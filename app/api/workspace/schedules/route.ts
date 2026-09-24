import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"
import { getWebGradeCapabilities } from "@/lib/capabilities"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z.object({
  projectName: z.string().trim().min(1).max(80),
  urls: z.array(z.string().url().max(2048)).min(1).max(5),
  cadence: z.enum(["daily", "weekly"]).default("weekly"),
  cloudflareConsent: z.boolean().default(false),
  observatoryConsent: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Schedules require the configured database." }, { status: 503 })
  const rows = await db`select id, project_name as "projectName", targets, cadence, next_due_at as "nextDueAt", enabled, cloudflare_consent as "cloudflareConsent", observatory_consent as "observatoryConsent" from schedules where owner_id = ${check.user.id} order by created_at desc`
  return NextResponse.json({ schedules: rows }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Schedules require the configured database." }, { status: 503 })
  try {
    const body = createSchema.parse(await request.json())
    const capabilities = getWebGradeCapabilities()
    if (body.cloudflareConsent && !capabilities.cloudflareScan) return NextResponse.json({ code: "provider_unavailable", provider: "cloudflare", error: "Cloudflare URL Scanner is unavailable in this deployment." }, { status: 503 })
    if (body.observatoryConsent && !capabilities.observatoryScan) return NextResponse.json({ code: "provider_unavailable", provider: "observatory", error: "Mozilla HTTP Observatory is unavailable in this deployment." }, { status: 503 })
    const origins = body.urls.map((url) => new URL(url).origin)
    if (new Set(origins).size !== 1) return NextResponse.json({ code: "different_origins", error: "Scheduled targets must share one origin." }, { status: 400 })
    const [schedule] = await db`insert into schedules (owner_id, project_name, targets, cadence, next_due_at, public_provider_consent, cloudflare_consent, observatory_consent) values (${check.user.id}, ${body.projectName}, ${JSON.stringify(body.urls)}::jsonb, ${body.cadence}, now() + ${body.cadence === "daily" ? "1 day" : "7 days"}::interval, ${body.cloudflareConsent || body.observatoryConsent}, ${body.cloudflareConsent}, ${body.observatoryConsent}) returning id, project_name as "projectName", targets, cadence, next_due_at as "nextDueAt", enabled, cloudflare_consent as "cloudflareConsent", observatory_consent as "observatoryConsent"`
    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "invalid_request", error: "Provide a project name and up to five same-origin URLs." }, { status: 400 })
    console.error("WebGrade schedule creation failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ code: "schedule_failed", error: "The schedule could not be created." }, { status: 500 })
  }
}
