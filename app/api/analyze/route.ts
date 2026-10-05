import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { isIP } from "node:net"
import { lookup } from "node:dns/promises"
import { z } from "zod"
import { createReport } from "@/lib/providers"
import { persistReport } from "@/lib/db"
import { getDb } from "@/lib/db"
import { claimGuest, guestAddress, releaseGuest } from "@/lib/rate-limit"
import { GuardStorageError, checkGuardStorage } from "@/lib/guard-store"
import { getWebGradeCapabilities } from "@/lib/capabilities"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  strategies: z.array(z.enum(["mobile", "desktop"])).min(1).max(2).default(["mobile", "desktop"]),
  cloudflareConsent: z.boolean().default(false),
  observatoryConsent: z.boolean().default(false),
  publicProviderConsent: z.boolean().optional(),
}).transform((body) => ({ ...body, cloudflareConsent: body.publicProviderConsent ?? body.cloudflareConsent, observatoryConsent: body.publicProviderConsent ?? body.observatoryConsent }))

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "")
  const privateIpv6 = isIP(normalized) === 6 && (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.") || normalized.startsWith("::ffff:172."))
  return privateIpv6 || /^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) || normalized === "0.0.0.0"
}

function hashCapability(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function validateTargetSyntax(raw: string) {
  let target: URL
  try { target = new URL(raw) } catch { return { error: "Enter a complete public URL, such as https://example.com." } }
  if (!["http:", "https:"].includes(target.protocol)) return { error: "Only HTTP and HTTPS URLs are supported." }
  if (target.username || target.password) return { error: "URLs with embedded credentials are not accepted." }
  if (target.port && !["80", "443"].includes(target.port)) return { error: "Only standard HTTP and HTTPS ports are supported." }
  const hostname = target.hostname.toLowerCase()
  const normalizedIp = hostname.replace(/^\[|\]$/g, "")
  const privateIpv6 = isIP(normalizedIp) === 6 && (normalizedIp === "::1" || normalizedIp === "::" || normalizedIp.toLowerCase().startsWith("fc") || normalizedIp.toLowerCase().startsWith("fd") || normalizedIp.toLowerCase().startsWith("fe80"))
  if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIp(normalizedIp) || privateIpv6) return { error: "Private and local network targets are not supported." }
  return { target: target.toString(), hostname, normalizedIp }
}

async function resolvesToPublicTarget(hostname: string, normalizedIp: string) {
  if (isIP(normalizedIp) !== 0) return true
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true })
    return addresses.length > 0 && !addresses.some((address) => isPrivateIp(address.address))
  } catch {
    return false
  }
}

async function readBoundedJson(request: Request): Promise<{ value: unknown } | { error: "too_large" | "malformed" }> {
  const maxBytes = 16_000
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > maxBytes) return { error: "too_large" }
  }
  if (!request.body) return { error: "malformed" }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { error: "too_large" }
      }
      chunks.push(value)
    }
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return { value: JSON.parse(text) as unknown }
  } catch {
    return { error: "malformed" }
  } finally {
    reader.releaseLock()
  }
}

export async function POST(request: NextRequest) {
  if (process.env.WEBGRADE_ANALYSIS_ENABLED === "0") return NextResponse.json({ code: "analysis_disabled", error: "Website analysis is disabled for this deployment." }, { status: 503 })
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase()
  if (contentType !== "application/json") return NextResponse.json({ code: "unsupported_media", error: "Send a JSON request." }, { status: 415 })
  const rawBody = await readBoundedJson(request)
  if ("error" in rawBody && rawBody.error === "too_large") return NextResponse.json({ code: "payload_too_large", error: "The request is too large." }, { status: 413 })
  if ("error" in rawBody && rawBody.error === "malformed") return NextResponse.json({ code: "invalid_request", error: "Send valid JSON with the URL and selected devices." }, { status: 400 })

  let body: z.infer<typeof requestSchema>
  try { body = requestSchema.parse("value" in rawBody ? rawBody.value : undefined) }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "invalid_request", error: "Check the URL, selected devices, and consent value." }, { status: 400 })
    return NextResponse.json({ code: "invalid_request", error: "Send a valid analysis request." }, { status: 400 })
  }
  const target = validateTargetSyntax(body.url)
  if ("error" in target) return NextResponse.json({ code: "invalid_target", error: target.error }, { status: 400 })
  const capabilities = getWebGradeCapabilities()
  if (body.cloudflareConsent && !capabilities.cloudflareScan) return NextResponse.json({ code: "provider_unavailable", provider: "cloudflare", error: "Cloudflare URL Scanner is unavailable in this deployment." }, { status: 503 })
  if (body.observatoryConsent && !capabilities.observatoryScan) return NextResponse.json({ code: "provider_unavailable", provider: "observatory", error: "Mozilla HTTP Observatory is unavailable in this deployment." }, { status: 503 })

  try { await checkGuardStorage() }
  catch {
    console.error("WebGrade analysis rejected", { code: "provider_guard_unavailable" })
    return NextResponse.json({ code: "provider_guard_unavailable", error: "Provider safeguards are unavailable. Website analysis is paused." }, { status: 503 })
  }
  const address = guestAddress(request)
  let claim
  try { claim = await claimGuest(address) }
  catch {
    console.error("WebGrade analysis rejected", { code: "provider_guard_unavailable" })
    return NextResponse.json({ code: "provider_guard_unavailable", error: "Provider safeguards are unavailable. Website analysis is paused." }, { status: 503 })
  }
  if (!claim.ok) return NextResponse.json({ code: "rate_limited", error: claim.reason === "active" ? "A guest analysis is already running." : "Guest analysis limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(claim.retryAfter) } })
  try {
    if (!await resolvesToPublicTarget(target.hostname, target.normalizedIp)) return NextResponse.json({ code: "invalid_target", error: "The host could not be resolved as a public website." }, { status: 400 })
    const db = getDb()
    if (db) {
      const runId = randomUUID()
      const capability = randomBytes(24).toString("base64url")
      await db.begin(async (transaction) => {
        await transaction`insert into audit_runs (id, target_url, status, public_provider_consent, cloudflare_consent, observatory_consent, expires_at, read_capability_hash) values (${runId}, ${target.target}, 'queued', ${body.cloudflareConsent || body.observatoryConsent}, ${body.cloudflareConsent}, ${body.observatoryConsent}, now() + interval '24 hours', ${hashCapability(capability)})`
        await transaction`insert into jobs (run_id, kind, payload) values (${runId}, 'analysis', ${JSON.stringify({ runId, url: target.target, strategies: body.strategies, cloudflareConsent: body.cloudflareConsent, observatoryConsent: body.observatoryConsent })}::jsonb)`
      })
      return NextResponse.json({ success: true, accepted: true, status: "queued", runId, capability }, { status: 202, headers: { "Cache-Control": "no-store" } })
    }
    const report = await createReport(target.target, body.strategies, { cloudflare: body.cloudflareConsent, observatory: body.observatoryConsent }, request.signal)
    await persistReport(report)
    return NextResponse.json({ success: true, accepted: true, status: "completed", runId: report.runId, report }, { status: 202, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof GuardStorageError) {
      console.error("WebGrade analysis failed", { code: "provider_guard_unavailable" })
      return NextResponse.json({ code: "provider_guard_unavailable", error: "Provider safeguards are unavailable. Website analysis is paused." }, { status: 503 })
    }
    console.error("WebGrade analysis failed", { code: "analysis_failed" })
    return NextResponse.json({ code: "analysis_failed", error: "The analysis could not complete. You can retry without losing the target URL." }, { status: 502 })
  } finally {
    try { await releaseGuest(claim.token) }
    catch { console.error("WebGrade guest claim cleanup failed", { code: "provider_guard_unavailable" }) }
  }
}
