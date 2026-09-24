import { z } from "zod"

export const strategySchema = z.enum(["mobile", "desktop"])
export type Strategy = z.infer<typeof strategySchema>

export const issueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(""),
  score: z.number().min(0).max(1).nullable().optional(),
  displayValue: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).default("info"),
  numericValue: z.number().nullable().optional(),
  numericUnit: z.string().nullable().optional(),
  savingsMs: z.number().nullable().optional(),
})

export const metricSchema = z.object({
  fcp: z.number().nullable(),
  lcp: z.number().nullable(),
  tbt: z.number().nullable(),
  cls: z.number().nullable(),
  speedIndex: z.number().nullable(),
})

export const deviceReportSchema = z.object({
  strategy: strategySchema,
  status: z.enum(["completed", "failed", "not_requested"]),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  finalUrl: z.string().nullable(),
  pageTitle: z.string().nullable(),
  pageDescription: z.string().nullable(),
  engineVersion: z.string().nullable(),
  scores: z.object({
    performance: z.number().min(0).max(100).nullable(),
    accessibility: z.number().min(0).max(100).nullable(),
    bestPractices: z.number().min(0).max(100).nullable(),
    seo: z.number().min(0).max(100).nullable(),
  }),
  metrics: metricSchema,
  issues: z.object({
    performance: z.array(issueSchema),
    accessibility: z.array(issueSchema),
    bestPractices: z.array(issueSchema),
    seo: z.array(issueSchema),
  }),
})

export const providerStatusSchema = z.object({
  status: z.enum(["completed", "unavailable", "failed", "skipped"]),
  source: z.string(),
  checkedAt: z.string().nullable(),
  message: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
})

const reportBodySchema = z.object({
  runId: z.string(),
  url: z.string().url(),
  createdAt: z.string(),
  providerConsent: z.object({ cloudflare: z.boolean(), observatory: z.boolean() }),
  devices: z.object({
    mobile: deviceReportSchema,
    desktop: deviceReportSchema,
  }),
  providers: z.object({
    crux: providerStatusSchema,
    cloudflare: providerStatusSchema,
    observatory: providerStatusSchema,
  }),
})

export const reportSchema = reportBodySchema.extend({ schemaVersion: z.literal(2) })

const legacyReportSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  url: z.string().url(),
  createdAt: z.string(),
  publicProviderConsent: z.boolean(),
  devices: z.object({ mobile: deviceReportSchema, desktop: deviceReportSchema }),
  providers: z.object({ crux: providerStatusSchema, cloudflare: providerStatusSchema, observatory: providerStatusSchema }),
})

export type Issue = z.infer<typeof issueSchema>
export type DeviceReport = z.infer<typeof deviceReportSchema>
export type ProviderStatus = z.infer<typeof providerStatusSchema>
export type AuditReport = z.infer<typeof reportSchema>

/** Parse new reports while keeping immutable v1 reports readable. */
export function safeParseReport(input: unknown) {
  const current = reportSchema.safeParse(input)
  if (current.success) return current
  const legacy = legacyReportSchema.safeParse(input)
  if (!legacy.success) return current
  const { schemaVersion: _legacyVersion, publicProviderConsent, ...body } = legacy.data
  return { success: true as const, data: { ...body, schemaVersion: 2 as const, providerConsent: { cloudflare: publicProviderConsent, observatory: publicProviderConsent } } satisfies AuditReport }
}

export function parseReport(input: unknown): AuditReport {
  const result = safeParseReport(input)
  if (!result.success) throw new Error("Invalid WebGrade report")
  return result.data
}

export const emptyDevice = (strategy: Strategy, message = "Not run", status: DeviceReport["status"] = "not_requested") : DeviceReport => ({
  strategy,
  status,
  errorCode: status === "not_requested" ? "not_requested" : "provider_error",
  errorMessage: message,
  finalUrl: null,
  pageTitle: null,
  pageDescription: null,
  engineVersion: null,
  scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
  metrics: { fcp: null, lcp: null, tbt: null, cls: null, speedIndex: null },
  issues: { performance: [], accessibility: [], bestPractices: [], seo: [] },
})

export const sampleReport: AuditReport = {
  schemaVersion: 2,
  runId: "sample-webgrade-report",
  url: "https://web.dev/",
  createdAt: "2026-09-20T12:00:00.000Z",
  providerConsent: { cloudflare: false, observatory: false },
  devices: {
    mobile: {
      strategy: "mobile",
      status: "completed",
      errorCode: null,
      errorMessage: null,
      finalUrl: "https://web.dev/",
      pageTitle: "web.dev",
      pageDescription: "Web platform guidance for developers.",
      engineVersion: "sample",
      scores: { performance: 92, accessibility: 98, bestPractices: 96, seo: 100 },
      metrics: { fcp: 910, lcp: 1420, tbt: 84, cls: 0.02, speedIndex: 1510 },
      issues: {
        performance: [{ id: "render-blocking-resources", title: "Reduce render-blocking resources", description: "A small amount of CSS delays first paint.", score: 0.8, displayValue: "Estimated savings 120 ms", severity: "low", numericValue: 120, numericUnit: "millisecond", savingsMs: 120 }],
        accessibility: [],
        bestPractices: [],
        seo: [],
      },
    },
    desktop: {
      strategy: "desktop",
      status: "completed",
      errorCode: null,
      errorMessage: null,
      finalUrl: "https://web.dev/",
      pageTitle: "web.dev",
      pageDescription: "Web platform guidance for developers.",
      engineVersion: "sample",
      scores: { performance: 99, accessibility: 98, bestPractices: 96, seo: 100 },
      metrics: { fcp: 420, lcp: 760, tbt: 18, cls: 0.01, speedIndex: 680 },
      issues: { performance: [], accessibility: [], bestPractices: [], seo: [] },
    },
  },
  providers: {
    crux: { status: "completed", source: "Google CrUX (sample)", checkedAt: "2026-09-20T12:00:00.000Z", message: "Sample field data", data: { scope: "origin", lcp: 1800, inp: 140, cls: 0.03, collection: "28-day sample" } },
    cloudflare: { status: "skipped", source: "Cloudflare Agent Readiness", checkedAt: null, message: "Disabled in this sample to avoid a public scan.", data: null },
    observatory: { status: "skipped", source: "Mozilla HTTP Observatory", checkedAt: null, message: "Disabled in this sample to avoid a public scan.", data: null },
  },
}

export function scoreLabel(score: number | null) {
  if (score === null) return "Unavailable"
  if (score >= 90) return "Strong"
  if (score >= 50) return "Needs work"
  return "Priority"
}

export function formatMetric(value: number | null, unit: "ms" | "score" | "cls" = "ms") {
  if (value === null || !Number.isFinite(value)) return "Unavailable"
  if (unit === "cls") return value.toFixed(2)
  if (unit === "score") return `${Math.round(value)}/100`
  return `${Math.round(value)} ms`
}
