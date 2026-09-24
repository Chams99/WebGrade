type Bucket = { startedAt: number; count: number; active: number }

const buckets = new Map<string, Bucket>()
const HOUR = 60 * 60 * 1000

function prune(now: number) {
  if (buckets.size < 1000) return
  for (const [key, bucket] of buckets) if (now - bucket.startedAt >= HOUR) buckets.delete(key)
}

export function guestAddress(request: Request & { ip?: string }) {
  if (process.env.TRUST_PROXY === "true") return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown"
  return request.ip || "unknown"
}

export function claimGuest(address: string) {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(address)
  if (!bucket || now - bucket.startedAt >= HOUR) {
    buckets.set(address, { startedAt: now, count: 1, active: 1 })
    return { ok: true as const, retryAfter: 0 }
  }
  if (bucket.count >= 3) return { ok: false as const, retryAfter: Math.ceil((bucket.startedAt + HOUR - now) / 1000) }
  if (bucket.active >= 1) return { ok: false as const, retryAfter: 5 }
  bucket.count += 1
  bucket.active += 1
  return { ok: true as const, retryAfter: 0 }
}

export function releaseGuest(address: string) {
  const bucket = buckets.get(address)
  if (bucket) bucket.active = Math.max(0, bucket.active - 1)
}
