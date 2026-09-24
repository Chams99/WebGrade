import { getDb } from "@/lib/db"

type Provider = "pagespeed" | "cloudflare" | "observatory" | "crux"

const defaults: Record<Provider, number> = { pagespeed: 200, cloudflare: 100, observatory: 100, crux: 1000 }
const envNames: Record<Provider, string> = { pagespeed: "WEBGRADE_DAILY_PAGESPEED", cloudflare: "WEBGRADE_DAILY_CLOUDFLARE", observatory: "WEBGRADE_DAILY_OBSERVATORY", crux: "WEBGRADE_DAILY_CRUX" }

function limitFor(provider: Provider) {
  const configured = Number(process.env[envNames[provider]])
  return Number.isInteger(configured) && configured > 0 ? configured : defaults[provider]
}

export async function reserveProviderBudget(requests: Partial<Record<Provider, number>>) {
  const db = getDb()
  if (!db) return true
  return db.begin(async (transaction) => {
    for (const [provider, amount] of Object.entries(requests) as [Provider, number][]) {
      if (!amount || amount < 1) continue
      const rows = await transaction`insert into provider_usage (provider, used) values (${provider}, ${amount}) on conflict (provider, usage_day) do update set used = provider_usage.used + ${amount} where provider_usage.used + ${amount} <= ${limitFor(provider)} returning used`
      if (!rows[0]) throw new Error(`provider_budget:${provider}`)
    }
    return true
  }).catch((error) => {
    if (error instanceof Error && error.message.startsWith("provider_budget:")) return false
    throw error
  })
}
