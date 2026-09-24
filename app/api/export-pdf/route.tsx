import { NextRequest, NextResponse } from "next/server"
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import { safeParseReport, AuditReport, DeviceReport } from "@/lib/report"

export const runtime = "nodejs"

const styles = StyleSheet.create({
  page: { padding: 34, fontFamily: "Helvetica", color: "#152437", fontSize: 9 },
  title: { fontSize: 24, marginBottom: 5, color: "#091828" },
  muted: { color: "#617186", marginBottom: 18 },
  section: { marginTop: 18, marginBottom: 8, fontSize: 14, color: "#0d718b" },
  grid: { display: "flex", flexDirection: "row", gap: 7, marginBottom: 10 },
  card: { flexGrow: 1, border: "1 solid #d7e0e8", borderRadius: 5, padding: 9 },
  label: { color: "#687b90", fontSize: 8, marginBottom: 4 },
  score: { fontSize: 22, marginBottom: 3 },
  metric: { backgroundColor: "#f0f4f7", padding: 8, flexGrow: 1 },
  issue: { borderBottom: "1 solid #e1e7ec", paddingVertical: 7 },
  issueTitle: { fontSize: 10, marginBottom: 2 },
  small: { fontSize: 8, color: "#6c7c8e" },
})

function score(value: number | null) { return value === null ? "Unavailable" : `${value}/100` }
function providerStatus(status: string) { return status === "completed" ? "Available" : status === "skipped" ? "Not requested" : status === "unavailable" ? "Unavailable" : "Provider failed" }
function DeviceSection({ device }: { device: DeviceReport }) {
  const issues = [...device.issues.performance, ...device.issues.accessibility, ...device.issues.bestPractices, ...device.issues.seo].slice(0, 12)
  return <View><Text style={styles.section}>{device.strategy === "mobile" ? "Mobile" : "Desktop"} evidence</Text>{device.status !== "completed" ? <Text style={styles.muted}>{device.errorMessage || "This device report was unavailable."}</Text> : <><View style={styles.grid}>{Object.entries({ Performance: device.scores.performance, Accessibility: device.scores.accessibility, "Best practices": device.scores.bestPractices, SEO: device.scores.seo }).map(([label, value]) => <View style={styles.card} key={label}><Text style={styles.label}>{label}</Text><Text style={styles.score}>{score(value)}</Text></View>)}</View><View style={styles.grid}>{Object.entries({ FCP: device.metrics.fcp === null ? "Unavailable" : `${Math.round(device.metrics.fcp)} ms`, LCP: device.metrics.lcp === null ? "Unavailable" : `${Math.round(device.metrics.lcp)} ms`, TBT: device.metrics.tbt === null ? "Unavailable" : `${Math.round(device.metrics.tbt)} ms`, CLS: device.metrics.cls === null ? "Unavailable" : device.metrics.cls.toFixed(2) }).map(([label, value]) => <View style={styles.metric} key={label}><Text style={styles.label}>{label} / Lighthouse lab</Text><Text>{value}</Text></View>)}</View><Text style={styles.section}>Priorities</Text>{issues.length ? issues.map((issue) => <View style={styles.issue} key={issue.id}><Text style={styles.issueTitle}>{issue.title}</Text><Text style={styles.small}>{issue.displayValue || issue.description.replace(/\[.*?\]\(.*?\)/g, "").slice(0, 260)}</Text></View>) : <Text style={styles.muted}>No surfaced failures in the selected categories.</Text>}</>}</View>
}

function ReportDocument({ report }: { report: AuditReport }) {
  return <Document title={`WebGrade report for ${report.url}`} author="WebGrade"><Page size="A4" style={styles.page}><Text style={styles.title}>WebGrade report</Text><Text style={styles.muted}>{report.url} · {new Date(report.createdAt).toLocaleString()} · schema {report.schemaVersion}</Text><Text style={styles.section}>Method</Text><Text style={styles.muted}>Lighthouse lab results, field data, and third-party observations are reported separately. Unavailable values are not treated as zero. Cloudflare and Mozilla checks only run after explicit opt-in.</Text><DeviceSection device={report.devices.mobile} /><DeviceSection device={report.devices.desktop} /><Text style={styles.section}>Provider status</Text>{Object.values(report.providers).map((provider) => <View style={styles.issue} key={provider.source}><Text style={styles.issueTitle}>{provider.source} — {providerStatus(provider.status)}</Text><Text style={styles.small}>{provider.message || "No additional detail."}</Text></View>)}</Page></Document>
}

export async function POST(request: NextRequest) {
  try {
    const parsed = safeParseReport(await request.json())
    if (!parsed.success) return NextResponse.json({ code: "invalid_report", error: "The report data is invalid." }, { status: 400 })
    const buffer = await renderToBuffer(<ReportDocument report={parsed.data} />)
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=webgrade-report.pdf", "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("PDF export failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ code: "pdf_failed", error: "The report could not be exported." }, { status: 500 })
  }
}
