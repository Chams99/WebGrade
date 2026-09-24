import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createReport } from "@/lib/providers"
import { persistReport } from "@/lib/db"
import { checkOwner, ownerResponse } from "@/lib/owner"
import { reserveProviderBudget } from "@/lib/provider-budget"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  urls: z.array(z.string().url().max(2048)).min(1).max(5),
  cloudflareConsent: z.boolean().default(false),
  observatoryConsent: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return NextResponse.json({ code: "unsupported_media", error: "Send a JSON request." }, { status: 415 })
  try {
    const body = schema.parse(await request.json())
    const origins = body.urls.map((url) => new URL(url).origin)
    if (new Set(origins).size !== 1) return NextResponse.json({ code: "different_origins", error: "Batch targets must share one origin." }, { status: 400 })
    const reports = []
    for (const url of body.urls) {
      const budgetOk = await reserveProviderBudget({ pagespeed: 2, crux: 2, cloudflare: body.cloudflareConsent ? 1 : 0, observatory: body.observatoryConsent ? 1 : 0 })
      if (!budgetOk) return NextResponse.json({ code: "provider_quota", error: "The daily provider budget is exhausted. Completed pages remain saved." }, { status: 429 })
      const report = await createReport(url, ["mobile", "desktop"], { cloudflare: body.cloudflareConsent, observatory: body.observatoryConsent }, request.signal)
      await persistReport(report, check.user.id)
      reports.push(report)
    }
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "invalid_request", error: "Provide up to five valid URLs." }, { status: 400 })
    console.error("WebGrade batch failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ code: "batch_failed", error: "The batch could not complete." }, { status: 502 })
  }
}
