import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { LandingNav, ScanForm } from "@/components/webgrade/home-interactions"
import { getWebGradeCapabilities } from "@/lib/capabilities"
import { sampleReport } from "@/lib/report"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const capabilities = getWebGradeCapabilities()
  const sources = [
    { name: "Google Lighthouse", scope: "lab" },
    { name: "Chrome UX Report", scope: "field when available" },
    ...(capabilities.cloudflareScan ? [{ name: "Cloudflare URL Scanner", scope: "optional" }] : []),
    ...(capabilities.observatoryScan ? [{ name: "Mozilla HTTP Observatory", scope: "optional" }] : []),
  ]
  return <main className="landing-shell">
    <LandingNav />
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-content shell-container">
        <div className="hero-copy"><h1 id="hero-title">Check your website.</h1><p className="hero-lede">One public URL, four useful lenses: performance, accessibility, SEO, and security signals.</p></div>
        <ScanForm capabilities={capabilities} />
      </div>
    </section>
    <section className="home-section shell-container home-evidence" aria-labelledby="sample-title">
      <div className="sample-preview"><div><p className="section-kicker">Dated sample · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(sampleReport.createdAt))}</p><h2 id="sample-title">Sample report</h2><p>A completed audit with clear evidence by source. It never uses provider quota.</p><Link className="quiet-link" href="/results?sample=1">Open sample report <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div>
      <div className="source-strip"><div><p className="section-kicker">Sources</p><h2>Evidence stays separate.</h2></div><div className="source-list">{sources.map((source) => <span key={source.name}>{source.name} <small>{source.scope}</small></span>)}</div></div>
      <details className="methodology-disclosure"><summary>How the evidence is collected</summary><p>Lab measurements, field measurements, and public provider observations are reported separately. Missing data remains unavailable rather than being converted into a score.</p></details>
    </section>
  </main>
}
