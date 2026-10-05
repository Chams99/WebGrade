import { consumeProviderCall, type GuardProvider, type ProviderCallResult } from "@/lib/guard-store"

/** Charge the persistent global budget for one imminent provider HTTP request. */
export function consumeProviderBudget(provider: GuardProvider): Promise<ProviderCallResult> {
  return consumeProviderCall(provider)
}
