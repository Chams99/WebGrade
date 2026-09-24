import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"
import { safeParseReport } from "@/lib/report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Saved runs require the configured database." }, { status: 503 })
  const rows = await db`select report_json from audit_runs where owner_id = ${check.user.id} and status = 'completed' and expires_at > now() order by created_at desc limit 20`
  const reports = rows.map((row) => safeParseReport(row.report_json)).filter((result) => result.success).map((result) => result.data)
  return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } })
}
