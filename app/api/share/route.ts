import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"
import { safeParseReport } from "@/lib/report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({ report: z.unknown(), expiresInDays: z.number().int().min(1).max(30).default(30) })

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Sharing requires the configured database." }, { status: 503 })
  try {
    const body = schema.parse(await request.json())
    const requested = safeParseReport(body.report)
    if (!requested.success) return NextResponse.json({ code: "invalid_report", error: "The report snapshot is invalid." }, { status: 400 })
    const storedRows = await db`select report_json from audit_runs where id = ${requested.data.runId} and owner_id = ${check.user.id} and status = 'completed' limit 1`
    const stored = storedRows[0] as { report_json: unknown } | undefined
    const reportResult = stored ? safeParseReport(stored.report_json) : { success: false as const }
    if (!reportResult.success) return NextResponse.json({ code: "run_not_found", error: "Only a completed owner run can be shared." }, { status: 404 })
    const report = reportResult.data
    const token = randomBytes(32).toString("base64url")
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    await db.begin(async (transaction) => {
      await transaction`insert into share_links (run_id, token_hash, expires_at, report_json) values (${report.runId}, ${tokenHash}, ${expiresAt}, ${JSON.stringify(report)}::jsonb)`
    })
    return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://webgrade.chames.tn"}/share/${token}`, expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "invalid_request", error: "Provide a valid report snapshot and expiry." }, { status: 400 })
    console.error("WebGrade share creation failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ code: "share_failed", error: "The report could not be shared." }, { status: 500 })
  }
}
