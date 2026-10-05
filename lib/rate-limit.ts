import { isIP } from "node:net"
import { claimGuest as claimPersistentGuest, releaseGuest as releasePersistentGuest, type GuestClaim } from "@/lib/guard-store"

function validAddress(value: string | undefined | null) {
  const candidate = value?.trim().replace(/^\[|\]$/g, "")
  return candidate && isIP(candidate) ? candidate : null
}

/**
 * In the public Docker deployment Traefik is the only ingress hop and appends
 * the connecting client address to X-Forwarded-For. Select that rightmost
 * value; never trust X-Real-IP or the leftmost client-controlled value.
 */
export function guestAddress(request: Request & { ip?: string }) {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1"
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for")
    const appendedClient = forwarded?.split(",").map((value) => value.trim()).filter(Boolean).at(-1)
    return validAddress(appendedClient) ?? "unknown"
  }
  return validAddress(request.ip) ?? "unknown"
}

export function claimGuest(address: string): Promise<GuestClaim> {
  return claimPersistentGuest(address)
}

export function releaseGuest(token: string): Promise<void> {
  return releasePersistentGuest(token)
}
