import postgres from "postgres"

let client: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!process.env.DATABASE_URL) return null
  if (!client) client = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: false })
  return client
}

export async function persistReport(report: { runId: string; url: string; createdAt: string; devices: unknown; providers: unknown; providerConsent: { cloudflare: boolean; observatory: boolean }; schemaVersion: number }, ownerId?: string) {
  const db = getDb()
  if (!db) return false
  await db`insert into audit_runs (id, owner_id, target_url, created_at, public_provider_consent, cloudflare_consent, observatory_consent, status, report_json) values (${report.runId}, ${ownerId ?? null}, ${report.url}, ${report.createdAt}, ${report.providerConsent.cloudflare || report.providerConsent.observatory}, ${report.providerConsent.cloudflare}, ${report.providerConsent.observatory}, 'completed', ${JSON.stringify(report)}::jsonb) on conflict (id) do nothing`
  return true
}
