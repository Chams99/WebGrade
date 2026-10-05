"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowUpRight, CheckCircle2, Download, ExternalLink, FileText, Gauge, Info, Menu, Monitor, Printer, Share2, Smartphone, TriangleAlert, XCircle } from "lucide-react"
import type { WebGradeCapabilities } from "@/lib/capabilities"
import { AuditReport, DeviceReport, formatMetric, safeParseReport, scoreLabel, sampleReport } from "@/lib/report"
import { WebGradeBrand } from "@/components/webgrade/brand"

type DeviceKey = "mobile" | "desktop"

function ScoreCard({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? "score-unavailable" : value >= 90 ? "score-good" : value >= 50 ? "score-mid" : "score-low"
  return <div className={`report-score ${tone}`}><span>{label}</span><strong>{value === null ? "—" : value}</strong><small>{scoreLabel(value)}</small></div>
}

function ProviderEvidence({ report, provider, name }: { report: AuditReport; provider: keyof AuditReport["providers"]; name: string }) {
  const item = report.providers[provider]
  const tone = item.status === "completed" ? "provider-ok" : item.status === "skipped" ? "provider-skipped" : "provider-muted"
  const statusLabel = item.status === "completed" ? "Available" : item.status === "skipped" ? "Not requested" : item.status === "unavailable" ? "Unavailable" : "Provider failed"
  const data = item.data || {}
  return <article className={`provider-card ${tone}`}><div className="provider-card-heading"><div><span className="provider-status" aria-hidden="true" /><h3>{name}</h3></div><strong>{statusLabel}</strong></div><p>{item.message || "No provider detail was returned."}</p>{provider === "crux" && item.status === "completed" && <dl><div><dt>Scope</dt><dd>{String(data.scope || "Unavailable")} page/origin</dd></div><div><dt>LCP p75</dt><dd>{typeof data.lcp === "number" ? `${Math.round(data.lcp)} ms` : "Unavailable"}</dd></div><div><dt>INP p75</dt><dd>{typeof data.inp === "number" ? `${Math.round(data.inp)} ms` : "Unavailable"}</dd></div><div><dt>CLS p75</dt><dd>{typeof data.cls === "number" ? data.cls.toFixed(2) : "Unavailable"}</dd></div><div><dt>Collection</dt><dd>{String(data.collection || "Unavailable")}</dd></div></dl>}{provider === "observatory" && item.status === "completed" && <dl><div><dt>Grade</dt><dd>{String(data.grade || "Unavailable")}</dd></div><div><dt>Score</dt><dd>{typeof data.score === "number" ? String(data.score) : "Unavailable"}</dd></div><div><dt>Tests passed</dt><dd>{typeof data.testsPassed === "number" ? String(data.testsPassed) : "Unavailable"}</dd></div><div><dt>Tests failed</dt><dd>{typeof data.testsFailed === "number" ? String(data.testsFailed) : "Unavailable"}</dd></div></dl>}{provider === "cloudflare" && item.status === "completed" && <dl><div><dt>Scan ID</dt><dd className="mono">{String(data.scanId || "Unavailable")}</dd></div><div><dt>Target</dt><dd>{String(data.url || report.url)}</dd></div><div><dt>Report</dt><dd>{typeof data.reportUrl === "string" ? <a href={data.reportUrl} target="_blank" rel="noreferrer">Open scan <ExternalLink size={12} /></a> : "Unavailable"}</dd></div></dl>}</article>
}

function DevicePanel({ device }: { device: DeviceReport }) {
  const allIssues = [...device.issues.performance, ...device.issues.accessibility, ...device.issues.bestPractices, ...device.issues.seo]
  const priorityIssues = allIssues.slice(0, 3)
  const statusText = device.status === "completed" ? "Complete" : device.status === "not_requested" ? "Not selected" : device.errorMessage || "Unavailable"
  return <section className="device-report" aria-labelledby={`${device.strategy}-heading`}><div className="device-heading"><div><p className="eyebrow">{device.strategy === "mobile" ? "Mobile" : "Desktop"} lab run</p><h2 id={`${device.strategy}-heading`}>{device.strategy === "mobile" ? "Mobile" : "Desktop"} results</h2></div><span className={`status-pill ${device.status === "completed" ? "completed" : device.status === "not_requested" ? "pending" : "failed"}`}>{device.status === "completed" ? <><CheckCircle2 size={14} /> {statusText}</> : device.status === "not_requested" ? statusText : <><XCircle size={14} /> {statusText}</>}</span></div>{device.status === "completed" ? <><div className="report-score-grid"><ScoreCard label="Performance" value={device.scores.performance} /><ScoreCard label="Accessibility" value={device.scores.accessibility} /><ScoreCard label="Best practices" value={device.scores.bestPractices} /><ScoreCard label="SEO" value={device.scores.seo} /></div><div className="metric-row"><div><span>FCP</span><strong>{formatMetric(device.metrics.fcp)}</strong><small>Lighthouse lab</small></div><div><span>LCP</span><strong>{formatMetric(device.metrics.lcp)}</strong><small>Lighthouse lab</small></div><div><span>TBT</span><strong>{formatMetric(device.metrics.tbt)}</strong><small>Lighthouse lab</small></div><div><span>CLS</span><strong>{formatMetric(device.metrics.cls, "cls")}</strong><small>Lighthouse lab</small></div><div><span>Speed index</span><strong>{formatMetric(device.metrics.speedIndex)}</strong><small>Lighthouse lab</small></div></div><div className="report-target"><span>{device.pageTitle || "Untitled page"}</span>{device.finalUrl && <a href={device.finalUrl} target="_blank" rel="noreferrer">Open target <ExternalLink size={13} /></a>}</div><div className="issues-block"><div className="subheading"><div><p className="eyebrow">Priority findings</p><h3>What needs attention</h3></div><span>{allIssues.length} surfaced</span></div>{allIssues.length ? <><div className="issue-list">{priorityIssues.map((issue) => <article key={issue.id}><span className={`severity severity-${issue.severity}`}>{issue.severity}</span><div><h4>{issue.title}</h4><p>{issue.displayValue || issue.description.replace(/\[.*?\]\(.*?\)/g, "")}</p></div>{issue.savingsMs !== null && issue.savingsMs !== undefined && <span className="issue-saving">{Math.round(issue.savingsMs)} ms</span>}</article>)}</div>{allIssues.length > priorityIssues.length && <Accordion type="single" collapsible className="all-findings"><AccordionItem value="all"><AccordionTrigger>Show all {allIssues.length} findings</AccordionTrigger><AccordionContent><div className="issue-list">{allIssues.slice(priorityIssues.length).map((issue) => <article key={issue.id}><span className={`severity severity-${issue.severity}`}>{issue.severity}</span><div><h4>{issue.title}</h4><p>{issue.displayValue || issue.description.replace(/\[.*?\]\(.*?\)/g, "")}</p></div></article>)}</div></AccordionContent></AccordionItem></Accordion>}</> : <div className="empty-state"><CheckCircle2 size={18} /> No surfaced failures in the selected categories.</div>}</div></> : <div className="empty-state failed-empty">{device.status === "not_requested" ? <><Info size={19} />This device was not requested for this run.</> : <><TriangleAlert size={19} />This device did not complete. Other successful evidence remains available.</>}</div>}</section>
}

function loadingReportFromStorage() {
  try { const raw = localStorage.getItem("latest-scan-result"); return raw ? safeParseReport(JSON.parse(raw)) : null } catch { return null }
}

export default function ResultsPage() {
  const [report, setReport] = useState<AuditReport | null>(null)
  const [device, setDevice] = useState<DeviceKey>("mobile")
  const [history, setHistory] = useState<AuditReport[]>([])
  const [downloadState, setDownloadState] = useState("Download PDF")
  const [shareState, setShareState] = useState("Share")
  const [cloudShareState, setCloudShareState] = useState("Create cloud link")
  const [capabilities, setCapabilities] = useState<WebGradeCapabilities>({ analysisEnabled: false, cloudflareScan: false, observatoryScan: true, cloudShare: false })
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedRun = params.get("run")
    const requestedDevice = params.get("device")
    if (requestedDevice === "mobile" || requestedDevice === "desktop") setDevice(requestedDevice)
    const stored = loadingReportFromStorage()
    if (params.get("sample") === "1") { setReport(sampleReport); setLoading(false); return }
    if (stored?.success && (!requestedRun || stored.data.runId === requestedRun)) { setReport(stored.data); setLoading(false) }
    else if (!requestedRun) { setReport(sampleReport); setLoading(false) }
    else {
      const capability = sessionStorage.getItem(`webgrade-capability:${requestedRun}`)
      void fetch(`/api/analyze/${encodeURIComponent(requestedRun)}`, { headers: capability ? { "x-webgrade-capability": capability } : {}, cache: "no-store" }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (data.report) setReport(data.report)
        else setLoadError(data.error || "This run is unavailable or has expired.")
      }).catch(() => setLoadError("This run could not be loaded. Check the link and try again.")).finally(() => setLoading(false))
    }
    try { const raw = JSON.parse(localStorage.getItem("webgrade-reports") || "[]"); setHistory(Array.isArray(raw) ? raw.map((item) => safeParseReport(item)).filter((item) => item.success).map((item) => item.data) : []) } catch { setHistory([]) }
  }, [])

  useEffect(() => {
    void fetch("/api/capabilities", { cache: "no-store" }).then((response) => response.json()).then((data) => setCapabilities({ analysisEnabled: data.analysisEnabled === true, cloudflareScan: data.cloudflareScan === true, observatoryScan: data.observatoryScan !== false, cloudShare: data.cloudShare === true })).catch(() => undefined)
  }, [])

  useEffect(() => { if (report) localStorage.setItem("latest-scan-result", JSON.stringify(report)) }, [report])
  const current = report?.devices[device]
  const previous = useMemo(() => history.find((item) => item.runId !== report?.runId && item.url === report?.url && item.schemaVersion === report?.schemaVersion && item.devices[device].status === "completed" && current?.status === "completed"), [history, report, device, current])

  const chooseDevice = (next: string) => { if (next !== "mobile" && next !== "desktop") return; setDevice(next); const params = new URLSearchParams(window.location.search); params.set("device", next); window.history.replaceState(null, "", `/results?${params.toString()}`) }
  async function downloadPdf() { if (!report) return; setDownloadState("Preparing…"); try { const response = await fetch("/api/export-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) }); if (!response.ok) throw new Error("PDF export failed"); const blob = await response.blob(); const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `webgrade-${new URL(report.url).hostname}.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(href); setDownloadState("Downloaded") } catch { setDownloadState("Try again") } window.setTimeout(() => setDownloadState("Download PDF"), 2200) }
  async function shareReport() {
    if (!report) return
    const url = window.location.href
    setShareState("Sharing…")
    try {
      const share = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share
      if (typeof share === "function") await share.call(navigator, { title: `WebGrade report · ${new URL(report.url).hostname}`, text: "WebGrade report", url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else throw new Error("Browser sharing is unavailable")
      setShareState(typeof share === "function" ? "Shared" : "Link copied")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setShareState("Share")
      else setShareState(error instanceof Error ? error.message : "Share unavailable")
    }
    window.setTimeout(() => setShareState("Share"), 2800)
  }

  async function shareSnapshot() {
    if (!report || report.runId === sampleReport.runId) return
    if (!capabilities.cloudShare) { setCloudShareState("Cloud share unavailable"); window.setTimeout(() => setCloudShareState("Create cloud link"), 2800); return }
    setCloudShareState("Creating…")
    try {
      const response = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report, expiresInDays: 30 }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) throw new Error(data.error || "Owner sign-in is required")
      if (navigator.clipboard) await navigator.clipboard.writeText(data.url)
      setCloudShareState("Cloud link copied")
    } catch (error) { setCloudShareState(error instanceof Error ? error.message : "Cloud share unavailable") }
    window.setTimeout(() => setCloudShareState("Create cloud link"), 2800)
  }

  if (loading) return <main className="results-shell"><div className="results-loading"><Gauge className="spin" /><p>Loading report…</p></div></main>
  if (!report) return <main className="results-shell"><header className="results-nav"><Link href="/" className="brand"><span className="brand-mark"><Gauge size={16} /></span>WebGrade</Link></header><div className="results-empty"><TriangleAlert size={24} /><h1>Report unavailable</h1><p>{loadError || "This run is missing, expired, or has not been shared with you."}</p><Link href="/">Run a new audit <ArrowRightIcon /></Link></div></main>
  const completedDevices = [report.devices.mobile, report.devices.desktop].filter((item) => item.status === "completed").length
  return <main className="results-shell"><header className="results-nav"><Link href="/" className="brand"><span className="brand-mark"><Gauge size={16} /></span>WebGrade</Link><div className="results-actions"><Button variant="outline" onClick={() => window.print()}><Printer data-icon="inline-start" />Print</Button><Button variant="outline" onClick={shareReport}><Share2 data-icon="inline-start" />{shareState}</Button>{report.runId !== sampleReport.runId && (capabilities.cloudShare ? <Button variant="outline" onClick={shareSnapshot}>{cloudShareState}</Button> : <span className="share-availability-note">Cloud share unavailable</span>)}<Button onClick={downloadPdf}><Download data-icon="inline-start" />{downloadState}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="results-more" aria-label="More report actions"><Menu /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => window.print()}>Print report</DropdownMenuItem><DropdownMenuItem onSelect={() => void shareReport()}>Share this report</DropdownMenuItem>{report.runId !== sampleReport.runId && capabilities.cloudShare && <DropdownMenuItem onSelect={() => void shareSnapshot()}>Create cloud share link</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></header><div className="results-wrap"><div className="results-intro"><div><p className="eyebrow">Audit report / {new Date(report.createdAt).toLocaleDateString()}</p><h1>{new URL(report.url).hostname}</h1><p className="report-url">{report.url}</p></div><div className="report-badge"><FileText size={18} /><span>{report.runId === sampleReport.runId ? "Dated sample" : "Private report"}</span></div></div>{loadError && <p className="inline-notice"><Info size={16} />{loadError}</p>}<section className="summary-panel"><div><p className="eyebrow">Report reading</p><h2>Start with the evidence that changes a decision.</h2><p>Lab measurements, field data, and public observations remain separate. Missing data is shown as unavailable, never as zero.</p>{report.runId !== sampleReport.runId && !capabilities.cloudShare && <p className="report-share-note">Browser share copies the current report URL. Public cloud share is unavailable in this deployment.</p>}</div><div className="summary-facts"><div><span>Devices</span><strong>{completedDevices}/2 complete</strong></div><div><span>Current engine</span><strong>{current?.engineVersion || "Unavailable"}</strong></div><div><span>Public checks</span><strong>{report.providerConsent.cloudflare || report.providerConsent.observatory ? "Opted in" : "Skipped"}</strong></div></div></section><section className="report-results-section"><div className="section-heading"><div><p className="eyebrow">Scores and findings</p><h2>What the page is telling us.</h2></div><p>Choose a device to keep the comparison honest.</p></div><Tabs value={device} onValueChange={chooseDevice} className="report-tabs"><TabsList aria-label="Device results"><TabsTrigger value="mobile"><Smartphone size={15} />Mobile</TabsTrigger><TabsTrigger value="desktop"><Monitor size={15} />Desktop</TabsTrigger></TabsList><TabsContent value="mobile">{report.devices.mobile && <DevicePanel device={report.devices.mobile} />}</TabsContent><TabsContent value="desktop">{report.devices.desktop && <DevicePanel device={report.devices.desktop} />}</TabsContent></Tabs></section>{previous && current && <section className="comparison-panel"><div><p className="eyebrow">Comparison</p><h2>Compared with the previous matching run.</h2><p>URL, device, and report schema match. Engine changes stay visible so a delta is never overclaimed.</p></div><div className="comparison-grid">{(["performance", "accessibility", "bestPractices", "seo"] as const).map((key) => { const before = previous.devices[device].scores[key]; const after = current.scores[key]; const delta = before !== null && after !== null ? after - before : null; return <div key={key}><span>{key === "bestPractices" ? "Best practices" : key}</span><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</strong><small>{before ?? "—"} → {after ?? "—"}</small></div> })}</div></section>}<section className="provider-section report-providers"><div><p className="eyebrow">Provider evidence</p><h2>Different questions, different sources.</h2><p>Each provider keeps its own status, scope, timestamp, and methodology.</p></div><div className="provider-list"><ProviderEvidence report={report} name="Google CrUX" provider="crux" /><ProviderEvidence report={report} name="Cloudflare Agent Readiness" provider="cloudflare" /><ProviderEvidence report={report} name="Mozilla HTTP Observatory" provider="observatory" /></div></section><footer className="results-footer"><Link href="/"><ArrowLeft size={15} />Run another audit</Link><span>Report schema {report.schemaVersion}. Scores may vary between runs.</span><a href="https://developers.google.com/speed/docs/insights/v5/about" target="_blank" rel="noreferrer">About Lighthouse evidence <ArrowUpRight size={14} /></a></footer></div></main>
}

function ArrowRightIcon() { return <ArrowUpRight size={15} aria-hidden="true" /> }
