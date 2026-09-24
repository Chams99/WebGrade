import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const db = getDb()
  if (!db) return NextResponse.json({ status: "ok", service: "webgrade", version: "1", database: "not_configured" }, { headers: { "Cache-Control": "no-store" } })
  try {
    const [database, worker] = await Promise.all([db`select 1 as ok`, db`select count(*)::int as count from worker_heartbeats where last_seen_at > now() - interval '2 minutes' and status = 'running'`])
    return NextResponse.json({ status: "ok", service: "webgrade", version: "1", database: database[0]?.ok === 1 ? "ok" : "unknown", worker: Number(worker[0]?.count || 0) > 0 ? "ok" : "stale" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ status: "degraded", service: "webgrade", version: "1", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
