import { NextResponse } from "next/server"
import { getWebGradeCapabilities } from "@/lib/capabilities"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(getWebGradeCapabilities(), { headers: { "Cache-Control": "no-store" } })
}
