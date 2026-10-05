import { AuditReport, DeviceReport, Issue, ProviderStatus, Strategy, emptyDevice } from "@/lib/report"
import { GuardStorageError, claimPageSpeedSlot, notePageSpeedQuota, releasePageSpeedSlot } from "@/lib/guard-store"
import { consumeProviderBudget } from "@/lib/provider-budget"

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
const TIMEOUT_MS = 60_000

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })
  return { signal: controller.signal, cleanup: () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort) } }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function scoreOrNull(value: unknown) {
  const score = numberOrNull(value)
  return score === null ? null : Math.round(score * 100)
}

function severityFor(score: number | null): Issue["severity"] {
  if (score === 0) return "critical"
  if (score !== null && score < 0.5) return "high"
  if (score !== null && score < 0.75) return "medium"
  if (score !== null && score < 0.9) return "low"
  return "info"
}

function extractIssues(result: any, category: string): Issue[] {
  const categoryData = result?.categories?.[category]
  if (!categoryData || !Array.isArray(categoryData.auditRefs)) return []
  const issues: Issue[] = []
  for (const ref of categoryData.auditRefs) {
    const audit = result?.audits?.[ref.id]
    if (!audit || audit.score === null || audit.scoreDisplayMode === "notApplicable" || audit.scoreDisplayMode === "informative" || audit.scoreDisplayMode === "manual" || audit.score >= 1) continue
    const details = audit.details
    const savingsMs = numberOrNull(details?.overallSavingsMs)
    issues.push({
      id: String(ref.id),
      title: typeof audit.title === "string" ? audit.title : String(ref.id),
      description: typeof audit.description === "string" ? audit.description : "",
      score: numberOrNull(audit.score),
      displayValue: typeof audit.displayValue === "string" ? audit.displayValue : undefined,
      severity: severityFor(numberOrNull(audit.score)),
      numericValue: numberOrNull(audit.numericValue),
      numericUnit: typeof audit.numericUnit === "string" ? audit.numericUnit : null,
      savingsMs,
    })
  }
  return issues
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
      const severity = order[a.severity] - order[b.severity]
      if (severity !== 0) return severity
      return (b.savingsMs ?? 0) - (a.savingsMs ?? 0)
    })
    .slice(0, 18)
}

function logProviderEvent(provider: string, code: string, httpStatus?: number) {
  console.warn("WebGrade provider event", { provider, code, ...(httpStatus ? { httpStatus } : {}) })
}

function budgetMessage(provider: string, reason: "daily_limit" | "cooldown" | "guard_unavailable") {
  if (reason === "guard_unavailable") return "Provider safeguards are unavailable. Website analysis is paused."
  if (provider === "pagespeed" && reason === "cooldown") return "Google PageSpeed is temporarily paused after a quota response. Try again later."
  return `The daily ${provider} request limit has been reached. Try again after the quota resets.`
}

export async function runPageSpeed(url: string, strategy: Strategy, requestSignal?: AbortSignal): Promise<DeviceReport> {
  if (process.env.WEBGRADE_ANALYSIS_ENABLED === "0") return { ...emptyDevice(strategy, "Website analysis is disabled for this deployment.", "failed"), errorCode: "analysis_disabled" }
  let slotToken: string | null = null
  let timeout: ReturnType<typeof withTimeout> | null = null
  try {
    const slot = await claimPageSpeedSlot()
    if (!slot.ok) return { ...emptyDevice(strategy, "PageSpeed is busy. Try again shortly.", "failed"), errorCode: "provider_busy" }
    slotToken = slot.token
    timeout = withTimeout(requestSignal)
    const endpoint = new URL(PSI_ENDPOINT)
    endpoint.searchParams.set("url", url)
    endpoint.searchParams.set("strategy", strategy)
    for (const category of ["performance", "accessibility", "best-practices", "seo"]) endpoint.searchParams.append("category", category)
    if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY)

    const budget = await consumeProviderBudget("pagespeed")
    if (!budget.ok) {
      logProviderEvent("pagespeed", budget.reason)
      const guardFailure = budget.reason === "guard_unavailable"
      return { ...emptyDevice(strategy, budgetMessage("Google PageSpeed", budget.reason), "failed"), errorCode: guardFailure ? "provider_guard_unavailable" : "provider_quota" }
    }
    const response = await fetch(endpoint, { signal: timeout.signal, headers: { Accept: "application/json" } })
    if (!response.ok) {
      if (response.status === 429) {
        logProviderEvent("pagespeed", "provider_quota", response.status)
        try { await notePageSpeedQuota(response.headers.get("retry-after")) }
        catch { logProviderEvent("pagespeed", "provider_guard_unavailable"); return { ...emptyDevice(strategy, "Provider safeguards failed to save a PageSpeed quota cooldown. Website analysis is paused.", "failed"), errorCode: "provider_guard_unavailable" } }
        return { ...emptyDevice(strategy, "Google PageSpeed quota is temporarily exhausted. Try again later.", "failed"), errorCode: "provider_quota" }
      }
      if (response.status === 401 || response.status === 403) {
        const quotaDenied = response.status === 403 && await safeGoogleQuotaReason(response.clone())
        if (quotaDenied) {
          logProviderEvent("pagespeed", "provider_quota", response.status)
          try { await notePageSpeedQuota(response.headers.get("retry-after")) }
          catch { logProviderEvent("pagespeed", "provider_guard_unavailable"); return { ...emptyDevice(strategy, "Provider safeguards failed to save a PageSpeed quota cooldown. Website analysis is paused.", "failed"), errorCode: "provider_guard_unavailable" } }
          return { ...emptyDevice(strategy, "Google PageSpeed quota is temporarily exhausted. Try again later.", "failed"), errorCode: "provider_quota" }
        }
        logProviderEvent("pagespeed", "provider_config", response.status)
        return { ...emptyDevice(strategy, "Google PageSpeed is not authorized for this request. Check its API key and service settings.", "failed"), errorCode: "provider_config" }
      }
      logProviderEvent("pagespeed", "provider_error", response.status)
      return { ...emptyDevice(strategy, "Google PageSpeed could not complete this device audit.", "failed"), errorCode: "provider_error" }
    }
    const payload = await response.json()
    const result = payload?.lighthouseResult
    if (!result || typeof result !== "object") return emptyDevice(strategy, "Google PageSpeed returned no Lighthouse report.", "failed")

    const audits = result.audits ?? {}
    const report: DeviceReport = {
      strategy,
      status: "completed",
      errorCode: null,
      errorMessage: null,
      finalUrl: typeof result.finalUrl === "string" ? result.finalUrl : url,
      pageTitle: typeof audits["document-title"]?.displayValue === "string" ? audits["document-title"].displayValue : null,
      pageDescription: typeof audits["meta-description"]?.displayValue === "string" ? audits["meta-description"].displayValue : null,
      engineVersion: typeof result.lighthouseVersion === "string" ? result.lighthouseVersion : null,
      scores: {
        performance: scoreOrNull(result.categories?.performance?.score),
        accessibility: scoreOrNull(result.categories?.accessibility?.score),
        bestPractices: scoreOrNull(result.categories?.["best-practices"]?.score),
        seo: scoreOrNull(result.categories?.seo?.score),
      },
      metrics: {
        fcp: numberOrNull(audits["first-contentful-paint"]?.numericValue),
        lcp: numberOrNull(audits["largest-contentful-paint"]?.numericValue),
        tbt: numberOrNull(audits["total-blocking-time"]?.numericValue),
        cls: numberOrNull(audits["cumulative-layout-shift"]?.numericValue),
        speedIndex: numberOrNull(audits["speed-index"]?.numericValue),
      },
      issues: {
        performance: extractIssues(result, "performance"),
        accessibility: extractIssues(result, "accessibility"),
        bestPractices: extractIssues(result, "best-practices"),
        seo: extractIssues(result, "seo"),
      },
    }
    return report
  } catch (error) {
    if (error instanceof GuardStorageError) {
      logProviderEvent("pagespeed", "provider_guard_unavailable")
      return { ...emptyDevice(strategy, "Provider safeguards are unavailable. Website analysis is paused.", "failed"), errorCode: "provider_guard_unavailable" }
    }
    const aborted = error instanceof Error && error.name === "AbortError"
    if (aborted) logProviderEvent("pagespeed", "timeout")
    else logProviderEvent("pagespeed", "provider_error")
    const device = emptyDevice(strategy, aborted ? "The PageSpeed request timed out." : "PageSpeed could not complete this device audit.", "failed")
    return { ...device, errorCode: aborted ? "timeout" : "provider_error" }
  } finally {
    timeout?.cleanup()
    if (slotToken) {
      try { await releasePageSpeedSlot(slotToken) } catch { logProviderEvent("pagespeed", "provider_guard_unavailable") }
    }
  }
}

async function providerUnavailable(source: string, message: string): Promise<ProviderStatus> {
  return { status: "unavailable", source, checkedAt: null, message, data: null }
}

async function providerBudgetUnavailable(source: string, provider: string, reason: "daily_limit" | "cooldown" | "guard_unavailable"): Promise<ProviderStatus> {
  logProviderEvent(provider, reason)
  return { status: "unavailable", source, checkedAt: null, message: budgetMessage(provider, reason), data: null }
}

async function safeGoogleQuotaReason(response: Response) {
  if (!response.body) return false
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8_192) { await reader.cancel().catch(() => undefined); return false }
      chunks.push(value)
    }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))))
    if (!parsed || typeof parsed !== "object") return false
    const error = (parsed as { error?: unknown }).error
    if (!error || typeof error !== "object") return false
    const details = error as { status?: unknown; errors?: unknown; details?: unknown }
    if (details.status === "RESOURCE_EXHAUSTED") return true
    const quotaReasons = new Set(["quotaExceeded", "dailyLimitExceeded", "userRateLimitExceeded", "rateLimitExceeded", "RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED"])
    const candidates = [...(Array.isArray(details.errors) ? details.errors : []), ...(Array.isArray(details.details) ? details.details : [])]
    return candidates.some((candidate) => candidate && typeof candidate === "object" && "reason" in candidate && typeof (candidate as { reason?: unknown }).reason === "string" && quotaReasons.has((candidate as { reason: string }).reason))
  } catch { return false }
  finally { reader.releaseLock() }
}

export async function runCrux(url: string, signal?: AbortSignal): Promise<ProviderStatus> {
  if (process.env.WEBGRADE_ANALYSIS_ENABLED === "0") return providerUnavailable("Google CrUX", "Website analysis is disabled for this deployment.")
  if (!process.env.CRUX_API_KEY) return providerUnavailable("Google CrUX", "CrUX is not configured for this deployment.")
  const timeout = withTimeout(signal)
  try {
    const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(process.env.CRUX_API_KEY)}`
    const pageBudget = await consumeProviderBudget("crux")
    if (!pageBudget.ok) return providerBudgetUnavailable("Google CrUX", "crux", pageBudget.reason)
    const pageResponse = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }), signal: timeout.signal })
    let response = pageResponse
    let scope: "page" | "origin" = "page"
    if (!pageResponse.ok && pageResponse.status === 404) {
      const origin = new URL(url).origin
      const originBudget = await consumeProviderBudget("crux")
      if (!originBudget.ok) return providerBudgetUnavailable("Google CrUX", "crux", originBudget.reason)
      response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin }), signal: timeout.signal })
      scope = "origin"
    }
    if (!response.ok) {
      if (response.status === 429) logProviderEvent("crux", "provider_quota", response.status)
      else logProviderEvent("crux", "provider_error", response.status)
      return { status: "failed", source: "Google CrUX", checkedAt: new Date().toISOString(), message: response.status === 404 ? "No field data exists for this page or origin." : "CrUX could not complete this request.", data: null }
    }
    const payload: any = await response.json()
    const metrics = payload?.record?.metrics ?? {}
    return { status: "completed", source: "Google CrUX", checkedAt: new Date().toISOString(), message: scope === "page" ? "Real-user data for this page from the Chrome UX Report." : "No page field data was available; this is an explicitly labelled origin fallback.", data: { scope, collection: payload?.record?.collectionPeriod?.lastDate ?? null, lcp: metrics?.largest_contentful_paint?.percentiles?.p75 ?? null, inp: metrics?.interaction_to_next_paint?.percentiles?.p75 ?? null, cls: metrics?.cumulative_layout_shift?.percentiles?.p75 ?? null } }
  } catch (error) {
    if (error instanceof GuardStorageError) {
      logProviderEvent("crux", "provider_guard_unavailable")
      return providerUnavailable("Google CrUX", "Provider safeguards are unavailable. Website analysis is paused.")
    }
    const timeoutError = error instanceof Error && error.name === "AbortError"
    logProviderEvent("crux", timeoutError ? "timeout" : "provider_error")
    return { status: "failed", source: "Google CrUX", checkedAt: new Date().toISOString(), message: timeoutError ? "CrUX timed out." : "CrUX could not complete.", data: null }
  } finally { timeout.cleanup() }
}

export async function runObservatory(url: string, consent: boolean, signal?: AbortSignal): Promise<ProviderStatus> {
  if (!consent) return { status: "skipped", source: "Mozilla HTTP Observatory", checkedAt: null, message: "Skipped until you opt in to a public third-party scan.", data: null }
  const host = new URL(url).hostname
  const timeout = withTimeout(signal)
  try {
    if (process.env.WEBGRADE_ANALYSIS_ENABLED === "0") return providerUnavailable("Mozilla HTTP Observatory", "Website analysis is disabled for this deployment.")
    const budget = await consumeProviderBudget("observatory")
    if (!budget.ok) return providerBudgetUnavailable("Mozilla HTTP Observatory", "observatory", budget.reason)
    const response = await fetch(`https://observatory.mozilla.org/api/v2/scan?host=${encodeURIComponent(host)}`, { signal: timeout.signal, headers: { Accept: "application/json" } })
    if (!response.ok) { logProviderEvent("observatory", "provider_error", response.status); return { status: "failed", source: "Mozilla HTTP Observatory", checkedAt: new Date().toISOString(), message: "Observatory could not complete this request.", data: null } }
    const payload: any = await response.json()
    return { status: "completed", source: "Mozilla HTTP Observatory", checkedAt: new Date().toISOString(), message: "Public HTTP security scan. Review the provider’s scope before acting on findings.", data: { grade: payload?.grade ?? null, score: payload?.score ?? null, testsPassed: payload?.tests_passed ?? null, testsFailed: payload?.tests_failed ?? null } }
  } catch (error) {
    if (error instanceof GuardStorageError) { logProviderEvent("observatory", "provider_guard_unavailable"); return providerUnavailable("Mozilla HTTP Observatory", "Provider safeguards are unavailable. Website analysis is paused.") }
    const timeoutError = error instanceof Error && error.name === "AbortError"
    logProviderEvent("observatory", timeoutError ? "timeout" : "provider_error")
    return { status: "failed", source: "Mozilla HTTP Observatory", checkedAt: new Date().toISOString(), message: timeoutError ? "Observatory timed out." : "Observatory could not complete.", data: null }
  } finally { timeout.cleanup() }
}

export async function runCloudflare(url: string, consent: boolean, signal?: AbortSignal): Promise<ProviderStatus> {
  if (!consent) return { status: "skipped", source: "Cloudflare Agent Readiness", checkedAt: null, message: "Skipped until you opt in to a public third-party scan.", data: null }
  if (process.env.WEBGRADE_ANALYSIS_ENABLED === "0") return providerUnavailable("Cloudflare Agent Readiness", "Website analysis is disabled for this deployment.")
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) return providerUnavailable("Cloudflare Agent Readiness", "Cloudflare URL Scanner is not configured for this deployment.")
  const timeout = withTimeout(signal)
  try {
    const budget = await consumeProviderBudget("cloudflare")
    if (!budget.ok) return providerBudgetUnavailable("Cloudflare Agent Readiness", "cloudflare", budget.reason)
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/urlscanner/v2/scan`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ url, agentReadiness: true, visibility: "Public" }), signal: timeout.signal })
    if (!response.ok) {
      logProviderEvent("cloudflare", response.status === 429 ? "provider_quota" : "provider_error", response.status)
      return { status: response.status === 429 ? "failed" : "unavailable", source: "Cloudflare Agent Readiness", checkedAt: new Date().toISOString(), message: response.status === 429 ? "Cloudflare quota is exhausted." : "Cloudflare could not complete this request.", data: null }
    }
    const payload: any = await response.json()
    const result = payload?.result
    const scanId = result?.uuid ?? result?.scan_id ?? payload?.uuid ?? null
    const reportUrl = typeof result?.url === "string" ? result.url : typeof result === "string" ? result : null
    return { status: "completed", source: "Cloudflare Agent Readiness", checkedAt: new Date().toISOString(), message: "Cloudflare scan submitted. The report may be publicly accessible by scan ID.", data: { scanId, reportUrl, url: payload?.url ?? url } }
  } catch (error) {
    if (error instanceof GuardStorageError) { logProviderEvent("cloudflare", "provider_guard_unavailable"); return providerUnavailable("Cloudflare Agent Readiness", "Provider safeguards are unavailable. Website analysis is paused.") }
    const timeoutError = error instanceof Error && error.name === "AbortError"
    logProviderEvent("cloudflare", timeoutError ? "timeout" : "provider_error")
    return { status: "failed", source: "Cloudflare Agent Readiness", checkedAt: new Date().toISOString(), message: timeoutError ? "Cloudflare timed out." : "Cloudflare could not complete.", data: null }
  } finally { timeout.cleanup() }
}

export async function createReport(url: string, strategies: Strategy[], consent: { cloudflare: boolean; observatory: boolean }, signal?: AbortSignal, runId = crypto.randomUUID()): Promise<AuditReport> {
  const chosen = new Set(strategies)
  const [mobile, desktop] = await Promise.all([
    chosen.has("mobile") ? runPageSpeed(url, "mobile", signal) : Promise.resolve(emptyDevice("mobile", "Not selected")),
    chosen.has("desktop") ? runPageSpeed(url, "desktop", signal) : Promise.resolve(emptyDevice("desktop", "Not selected")),
  ])
  const [crux, cloudflare, observatory] = await Promise.all([
    runCrux(url, signal),
    runCloudflare(url, consent.cloudflare, signal),
    runObservatory(url, consent.observatory, signal),
  ])
  return { schemaVersion: 2, runId, url, createdAt: new Date().toISOString(), providerConsent: consent, devices: { mobile, desktop }, providers: { crux, cloudflare, observatory } }
}
