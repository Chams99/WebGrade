import { NextResponse } from "next/server"
import { getWebGradeCapabilities } from "@/lib/capabilities"
import { checkGuardStorage } from "@/lib/guard-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const configured = getWebGradeCapabilities()
  let guardReady = false
  if (configured.analysisEnabled) {
    try { await checkGuardStorage(); guardReady = true } catch { guardReady = false }
  }
  const analysisEnabled = configured.analysisEnabled && guardReady
  return NextResponse.json({ ...configured, analysisEnabled, cloudflareScan: analysisEnabled && configured.cloudflareScan, observatoryScan: analysisEnabled && configured.observatoryScan }, { headers: { "Cache-Control": "no-store" } })
}
