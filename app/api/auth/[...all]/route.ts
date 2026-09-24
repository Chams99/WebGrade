import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"

const handlers = toNextJsHandler(auth)
async function guard(request: Request, handler: (request: Request) => Promise<Response>) {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.DATABASE_URL) return Response.json({ code: "auth_unavailable", error: "Owner authentication is not configured." }, { status: 503 })
  return handler(request)
}
export const GET = (request: Request) => guard(request, handlers.GET)
export const POST = (request: Request) => guard(request, handlers.POST)
export const PATCH = (request: Request) => guard(request, handlers.PATCH)
export const PUT = (request: Request) => guard(request, handlers.PUT)
export const DELETE = (request: Request) => guard(request, handlers.DELETE)
