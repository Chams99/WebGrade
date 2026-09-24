import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

const databaseUrl = process.env.DATABASE_URL
const sql = databaseUrl ? postgres(databaseUrl, { max: 4, prepare: false }) : null
const database = sql ? drizzle(sql) : undefined

export const auth = betterAuth({
  appName: "WebGrade",
  baseURL: process.env.BETTER_AUTH_URL || "https://webgrade.chames.tn",
  // A build-safe placeholder keeps static collection from constructing a live
  // auth instance. The route refuses requests until production config exists.
  secret: process.env.BETTER_AUTH_SECRET || "webgrade-build-only-secret-change-me-32-chars",
  database: database ? drizzleAdapter(database, { provider: "pg" }) : undefined,
  trustedOrigins: [process.env.BETTER_AUTH_URL || "https://webgrade.chames.tn"],
  socialProviders: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, disableSignUp: true } } : undefined,
  emailAndPassword: { enabled: false },
  advanced: { useSecureCookies: true, defaultCookieAttributes: { sameSite: "lax" } },
  plugins: [nextCookies()],
})
