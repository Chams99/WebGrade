import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { safeParseReport } from "@/lib/report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function hashCapability(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDb()
  if (!db) return NextResponse.json({ code: "analysis_unavailable", error: "Durable analysis is not configured." }, { status: 503 })
  const { id } = await context.params
  const capability = request.headers.get("x-webgrade-capability")
  if (!capability) return NextResponse.json({ code: "capability_required", error: "A run capability is required." }, { status: 401 })
  const rows = await db`select id, status, report_json, expires_at, read_capability_hash as "readCapabilityHash" from audit_runs where id = ${id} limit 1`
  const row = rows[0] as { id: string; status: string; report_json: unknown; expires_at: Date | string; readCapabilityHash: string | null } | undefined
  if (!row || new Date(row.expires_at).getTime() <= Date.now() || !row.readCapabilityHash || hashCapability(capability) !== row.readCapabilityHash) return NextResponse.json({ code: "not_found", error: "This run is unavailable." }, { status: 404 })
  if (row.status === "queued" || row.status === "running") return NextResponse.json({ runId: row.id, status: row.status }, { headers: { "Cache-Control": "no-store" } })
  if (row.status !== "completed") return NextResponse.json({ runId: row.id, status: row.status, error: "The analysis did not complete." }, { status: 502 })
  const report = safeParseReport(row.report_json)
  if (!report.success) return NextResponse.json({ code: "invalid_report", error: "The completed report could not be read." }, { status: 500 })
  return NextResponse.json({ runId: row.id, status: "completed", report: report.data }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDb()
  if (!db) return NextResponse.json({ code: "analysis_unavailable", error: "Durable analysis is not configured." }, { status: 503 })
  const { id } = await context.params
  const capability = request.headers.get("x-webgrade-capability")
  if (!capability) return NextResponse.json({ code: "capability_required", error: "A run capability is required." }, { status: 401 })
  const rows = await db`select read_capability_hash from audit_runs where id = ${id} and status = 'failed' limit 1`
  const row = rows[0] as { read_capability_hash: string | null } | undefined
  if (!row || !row.read_capability_hash || hashCapability(capability) !== row.read_capability_hash) return NextResponse.json({ code: "not_found", error: "This run is unavailable." }, { status: 404 })
  await db`update audit_runs set status = 'queued', report_json = null where id = ${id}`
  await db`insert into jobs (run_id, kind, payload) select id, 'analysis', jsonb_build_object('runId', id, 'url', target_url, 'strategies', jsonb_build_array('mobile', 'desktop'), 'cloudflareConsent', cloudflare_consent, 'observatoryConsent', observatory_consent) from audit_runs where id = ${id}`
  return NextResponse.json({ runId: id, status: "queued" }, { status: 202 })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDb()
  if (!db) return NextResponse.json({ code: "analysis_unavailable", error: "Durable analysis is not configured." }, { status: 503 })
  const { id } = await context.params
  const capability = request.headers.get("x-webgrade-capability")
  if (!capability) return NextResponse.json({ code: "capability_required", error: "A run capability is required." }, { status: 401 })
  const rows = await db`update audit_runs set status = 'cancelled' where id = ${id} and status in ('queued', 'running') and read_capability_hash = ${hashCapability(capability)} returning id`
  if (!rows[0]) return NextResponse.json({ code: "not_found", error: "This run is unavailable or already complete." }, { status: 404 })
  await db`update jobs set status = 'failed', lease_until = null where run_id = ${id} and status in ('queued', 'running')`
  return NextResponse.json({ runId: id, status: "cancelled" })
}
