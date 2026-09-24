import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Alerts require the configured database." }, { status: 503 })
  const rows = await db`select id, kind, message, created_at as "createdAt", read_at as "readAt" from alerts where owner_id = ${check.user.id} order by created_at desc limit 50`
  return NextResponse.json({ alerts: rows }, { headers: { "Cache-Control": "no-store" } })
}
