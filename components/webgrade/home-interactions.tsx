"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Activity, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WarpBackground } from "@/components/webgrade/warp-background"
import { PrimaryNav } from "@/components/webgrade/primary-nav"
import type { WebGradeCapabilities } from "@/lib/capabilities"

type Strategy = "mobile" | "desktop"
type DeviceChoice = "both" | Strategy

async function waitForQueuedReport(runId: string, capability: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const response = await fetch(`/api/analyze/${encodeURIComponent(runId)}`, { headers: { "x-webgrade-capability": capability }, cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (data.status === "completed" && data.report) return data.report
    if (!response.ok && data.status !== "queued" && data.status !== "running") throw new Error(data.error || "The analysis could not be read.")
  }
  throw new Error("The analysis is taking longer than expected. Refresh this page to resume it.")
}

export function LandingNav() {
  const [motionPaused, setMotionPaused] = useState(false)
  useEffect(() => { setMotionPaused(localStorage.getItem("webgrade-motion-paused") === "1"); const onChange = (event: Event) => setMotionPaused((event as CustomEvent<boolean>).detail); window.addEventListener("webgrade-motion-change", onChange); return () => window.removeEventListener("webgrade-motion-change", onChange) }, [])
  return <><WarpBackground paused={motionPaused} /><PrimaryNav active="home" showMotion /></>
}

export function ScanForm({ capabilities }: { capabilities: WebGradeCapabilities }) {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [device, setDevice] = useState<DeviceChoice>("both")
  const [cloudflareConsent, setCloudflareConsent] = useState(false)
  const [observatoryConsent, setObservatoryConsent] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState("")
  const optionalProviders = capabilities.analysisEnabled ? [
    capabilities.cloudflareScan ? { name: "Cloudflare URL Scanner", detail: "Observed agent-readiness and HTTP/TLS signals." } : null,
    capabilities.observatoryScan ? { name: "Mozilla HTTP Observatory", detail: "HTTP security configuration observations; public submission." } : null,
  ].filter((provider): provider is { name: string; detail: string } => provider !== null) : []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!capabilities.analysisEnabled) return
    setError("")
    setIsRunning(true)
    const strategies: Strategy[] = device === "both" ? ["mobile", "desktop"] : [device]
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, strategies, cloudflareConsent, observatoryConsent }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "The analysis could not start.")
      if (data.runId && data.capability) sessionStorage.setItem(`webgrade-capability:${data.runId}`, data.capability)
      const report = data.report || (data.runId && data.capability ? await waitForQueuedReport(data.runId, data.capability) : null)
      if (!report) throw new Error("The analysis was accepted, but no report was returned.")
      localStorage.setItem("latest-scan-result", JSON.stringify(report))
      router.push(`/results?run=${encodeURIComponent(report.runId)}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysis could not start.")
    } finally { setIsRunning(false) }
  }

  return <div className="scanner-card" id="scanner"><form onSubmit={handleSubmit} className="audit-form">
    <div className="form-intro"><span className="form-kicker">Start with a public URL</span><p>Run a focused check across the signals that matter.</p></div>
    <label htmlFor="target-url">Website URL</label>
    <div className="url-row"><Input id="target-url" name="url" type="url" inputMode="url" autoComplete="url" placeholder="https://your-site.com" value={url} onChange={(event) => setUrl(event.target.value)} required aria-describedby="url-help" /><Button type="submit" disabled={isRunning || !capabilities.analysisEnabled}>{isRunning ? <><Activity data-icon="inline-start" aria-hidden="true" />Scanning…</> : <>Analyze <ArrowRight data-icon="inline-end" aria-hidden="true" /></>}</Button></div>
    <p id="url-help" className="form-help">Public HTTP(S) pages only. No credentials required.</p>
    {!capabilities.analysisEnabled && <p className="form-error" role="status">Website analysis is unavailable because provider safeguards are disabled or unavailable. Try again later.</p>}
    <fieldset className="scanner-options"><legend>Devices</legend><div className="device-options" role="radiogroup" aria-label="Devices to analyze">{(["both", "mobile", "desktop"] as const).map((option) => <label key={option} className={`device-choice ${device === option ? "selected" : ""}`}><input type="radio" name="device" value={option} checked={device === option} onChange={() => setDevice(option)} /><span>{option === "both" ? "Both" : option === "mobile" ? "Mobile" : "Desktop"}</span></label>)}</div></fieldset>
    {optionalProviders.length > 0 && <details className="additional-checks"><summary><ShieldCheck size={16} aria-hidden="true" /><span>Optional public scans</span><small>Off by default</small></summary><p className="consent-intro">These providers receive a public submission. Enable each one only when you want its separate evidence.</p><div className="consent-list">{optionalProviders.map((provider) => <label key={provider.name}><input type="checkbox" name={provider.name === "Cloudflare URL Scanner" ? "cloudflare-consent" : "observatory-consent"} checked={provider.name === "Cloudflare URL Scanner" ? cloudflareConsent : observatoryConsent} onChange={(event) => provider.name === "Cloudflare URL Scanner" ? setCloudflareConsent(event.target.checked) : setObservatoryConsent(event.target.checked)} /><span><strong>{provider.name}</strong><small>{provider.detail}</small></span></label>)}</div></details>}
    {error && <p className="form-error" role="alert">{error}</p>}{isRunning && <p className="scan-status" role="status" aria-live="polite">Collecting independent provider results…</p>}
    <div className="form-foot"><span>No combined score. Evidence stays separated by source.</span><Link href="/results?sample=1">Explore dated sample <ArrowRight size={14} aria-hidden="true" /></Link></div>
  </form></div>
}
