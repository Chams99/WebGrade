import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { safeParseReport } from "@/lib/report"
import { checkOwner, ownerResponse } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const db = getDb()
  if (!db) return NextResponse.json({ code: "share_unavailable", error: "Sharing is not configured." }, { status: 503 })
  const { token } = await context.params
  if (!token || token.length > 100) return NextResponse.json({ code: "not_found", error: "This share link is not available." }, { status: 404 })
  const rows = await db`select coalesce(s.report_json, a.report_json) as report_json, s.expires_at, s.revoked_at from share_links s join audit_runs a on a.id = s.run_id where s.token_hash = ${hashToken(token)} limit 1`
  const row = rows[0] as { report_json: unknown; expires_at: Date | string; revoked_at: Date | string | null } | undefined
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return NextResponse.json({ code: "expired", error: "This share link has expired or was revoked." }, { status: 410 })
  const parsed = safeParseReport(row.report_json)
  if (!parsed.success) return NextResponse.json({ code: "invalid_snapshot", error: "This report snapshot is no longer readable." }, { status: 500 })
  return NextResponse.json({ report: parsed.data, expiresAt: new Date(row.expires_at).toISOString() }, { headers: { "Cache-Control": "private, max-age=60" } })
}

export async function DELETE(request: Request, context: { params: Promise<{ token: string }> }) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "share_unavailable", error: "Sharing is not configured." }, { status: 503 })
  const { token } = await context.params
  const result = await db`update share_links set revoked_at = now() where token_hash = ${hashToken(token)} and exists (select 1 from audit_runs where audit_runs.id = share_links.run_id and audit_runs.owner_id = ${check.user.id}) and revoked_at is null returning id`
  if (!result[0]) return NextResponse.json({ code: "not_found", error: "This share link was not found." }, { status: 404 })
  return NextResponse.json({ revoked: true })
}
