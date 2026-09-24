import { randomUUID } from "node:crypto"
import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL
const githubId = process.env.WEBGRADE_OWNER_GITHUB_ID?.trim()
const email = process.env.WEBGRADE_OWNER_EMAIL?.trim().toLowerCase()
const name = process.env.WEBGRADE_OWNER_NAME?.trim() || "WebGrade owner"
if (!databaseUrl || !githubId || !email) throw new Error("DATABASE_URL, WEBGRADE_OWNER_GITHUB_ID, and WEBGRADE_OWNER_EMAIL are required")
const ownerDatabaseUrl = databaseUrl!
const ownerGithubId = githubId!
const ownerEmail = email!

const sql = postgres(ownerDatabaseUrl, { max: 1, prepare: false })
async function main() {
  try {
    const existing = await sql`select id from "user" where email = ${ownerEmail} limit 1`
    const userId = String(existing[0]?.id || randomUUID())
    if (!existing[0]) await sql`insert into "user" (id, name, email, email_verified) values (${userId}, ${name}, ${ownerEmail}, true)`
    await sql`insert into account (id, account_id, provider_id, user_id) values (${randomUUID()}, ${ownerGithubId}, 'github', ${userId}) on conflict (provider_id, account_id) do nothing`
    console.log(`Provisioned WebGrade owner ${ownerEmail} (${ownerGithubId})`)
  } finally {
    await sql.end()
  }
}
void main()
