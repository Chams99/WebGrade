import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"

export type OwnerCheck =
  | { configured: false; authorized: false; reason: "missing_configuration" }
  | { configured: true; authorized: false; reason: "signed_out" | "not_owner" }
  | { configured: true; authorized: true; user: { id: string; email: string; name: string } }

export async function checkOwner(request: Request): Promise<OwnerCheck> {
  const ownerGithubId = process.env.WEBGRADE_OWNER_GITHUB_ID?.trim()
  const ownerEmail = process.env.WEBGRADE_OWNER_EMAIL?.trim().toLowerCase()
  if (!process.env.BETTER_AUTH_SECRET || !process.env.DATABASE_URL || !ownerGithubId) {
    return { configured: false, authorized: false, reason: "missing_configuration" }
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { configured: true, authorized: false, reason: "signed_out" }
  const email = session.user.email.trim().toLowerCase()
  const db = getDb()
  const account = db ? await db`select account_id from account where user_id = ${session.user.id} and provider_id = 'github' limit 1` : []
  const githubMatches = account[0] && String(account[0].account_id) === ownerGithubId
  if (!githubMatches || (ownerEmail && email !== ownerEmail)) return { configured: true, authorized: false, reason: "not_owner" }
  return { configured: true, authorized: true, user: { id: session.user.id, email, name: session.user.name } }
}

export function ownerResponse(check: Exclude<OwnerCheck, { authorized: true }>) {
  if (!check.configured) return Response.json({ code: "workspace_unavailable", error: "Owner workspace is not configured." }, { status: 503 })
  return Response.json({ code: check.reason, error: check.reason === "signed_out" ? "Sign in with the configured owner account." : "This workspace is restricted to its owner." }, { status: 401 })
}
