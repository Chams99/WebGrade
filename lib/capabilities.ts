export type WebGradeCapabilities = {
  cloudflareScan: boolean
  observatoryScan: boolean
  cloudShare: boolean
}

/**
 * Public feature availability. This only reports whether a feature is wired
 * for this deployment; it never exposes credentials or provider secrets.
 */
export function getWebGradeCapabilities(): WebGradeCapabilities {
  const database = Boolean(process.env.DATABASE_URL?.trim())
  return {
    cloudflareScan: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim()),
    observatoryScan: process.env.WEBGRADE_OBSERVATORY_ENABLED !== "0",
    cloudShare: database,
  }
}
