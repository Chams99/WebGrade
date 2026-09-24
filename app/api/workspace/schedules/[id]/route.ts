import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Schedules require the configured database." }, { status: 503 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as { enabled?: unknown }
  if (typeof body.enabled !== "boolean" || !/^\d+$/.test(id)) return NextResponse.json({ code: "invalid_request", error: "Provide an enabled boolean and schedule id." }, { status: 400 })
  const rows = await db`update schedules set enabled = ${body.enabled} where id = ${Number(id)} and owner_id = ${check.user.id} returning id`
  if (!rows[0]) return NextResponse.json({ code: "not_found", error: "Schedule not found." }, { status: 404 })
  return NextResponse.json({ enabled: body.enabled })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  const db = getDb()
  if (!db) return NextResponse.json({ code: "workspace_unavailable", error: "Schedules require the configured database." }, { status: 503 })
  const { id } = await context.params
  if (!/^\d+$/.test(id)) return NextResponse.json({ code: "invalid_request", error: "Schedule id is invalid." }, { status: 400 })
  const rows = await db`delete from schedules where id = ${Number(id)} and owner_id = ${check.user.id} returning id`
  if (!rows[0]) return NextResponse.json({ code: "not_found", error: "Schedule not found." }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
