import { notFound } from "next/navigation"
import Link from "next/link"
import { getDb } from "@/lib/db"
import { safeParseReport } from "@/lib/report"
import { createHash } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function providerStatus(status: string) { return status === "completed" ? "Available" : status === "skipped" ? "Not requested" : status === "unavailable" ? "Unavailable" : "Provider failed" }

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const db = getDb()
  if (!db) notFound()
  const { token } = await params
  const hash = createHash("sha256").update(token).digest("hex")
  const rows = await db`select coalesce(s.report_json, a.report_json) as report_json, s.expires_at, s.revoked_at from share_links s join audit_runs a on a.id = s.run_id where s.token_hash = ${hash} limit 1`
  const row = rows[0] as { report_json: unknown; expires_at: Date | string; revoked_at: Date | string | null } | undefined
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) notFound()
  const result = safeParseReport(row.report_json)
  if (!result.success) notFound()
  const report = result.data
  const hostname = new URL(report.url).hostname
  return <main className="results-shell shared-report"><header className="results-nav"><Link href="/" className="brand"><span className="brand-mark">W</span>WebGrade</Link><span className="status-pill completed">Read-only snapshot</span></header><div className="results-wrap"><div className="results-intro"><div><p className="eyebrow">Shared report / {report.createdAt.slice(0, 10)}</p><h1>{hostname}</h1><p className="report-url">{report.url}</p></div></div><section className="summary-panel"><div><p className="eyebrow">Snapshot method</p><h2>Evidence preserved at publication time.</h2><p>Scores, lab measurements, field data, and provider status below are immutable. This link expires {new Date(row.expires_at).toLocaleDateString()}.</p></div></section>{(["mobile", "desktop"] as const).map((strategy) => { const device = report.devices[strategy]; const tone = device.status === "completed" ? "completed" : device.status === "not_requested" ? "pending" : "failed"; return <section className="device-report" key={strategy}><div className="device-heading"><div><p className="eyebrow">{strategy === "mobile" ? "Handset simulation" : "Desktop simulation"}</p><h2>{strategy === "mobile" ? "Mobile" : "Desktop"} evidence</h2></div><span className={`status-pill ${tone}`}>{device.status === "completed" ? "Available" : device.status === "not_requested" ? "Not selected" : "Unavailable"}</span></div><div className="report-score-grid">{Object.entries({ Performance: device.scores.performance, Accessibility: device.scores.accessibility, "Best practices": device.scores.bestPractices, SEO: device.scores.seo }).map(([label, value]) => <div className="report-score" key={label}><span>{label}</span><strong>{value ?? "—"}</strong><small>{value === null ? "Unavailable" : "/100"}</small></div>)}</div></section> })}<section className="provider-section report-providers"><div><p className="eyebrow">Provider evidence</p><h2>Separate sources, separate claims.</h2></div><div className="provider-list">{Object.values(report.providers).map((provider) => <article className="provider-card" key={provider.source}><h3>{provider.source}</h3><strong>{providerStatus(provider.status)}</strong><p>{provider.message || "No additional detail."}</p></article>)}</div></section></div></main>
}
