import { checkOwner, ownerResponse } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const check = await checkOwner(request)
  if (!check.authorized) return ownerResponse(check)
  return Response.json({ authenticated: true, user: check.user }, { headers: { "Cache-Control": "no-store" } })
}
