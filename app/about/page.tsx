import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PublicHeader } from "@/components/webgrade/public-header"

const providers = [
  ["Google Lighthouse", "Lab", "Performance, accessibility, best practices, and SEO for the selected device."],
  ["Chrome UX Report", "Field", "Real-user LCP, INP, and CLS when the page or origin has data."],
  ["Cloudflare URL Scanner", "Optional · where configured", "Observed discoverability, content access, policies, and protocol signals."],
  ["Mozilla HTTP Observatory", "Optional · public", "HTTP security configuration findings and an attributed grade."],
]

export default function AboutPage() {
  return <main className="public-page about-page">
    <PublicHeader active="about" />
    <div className="editorial-content">
      <aside className="editorial-rail"><span>ABOUT WEBGRADE</span><span>01 / 03</span></aside>
      <div className="editorial-body">
        <p className="section-kicker">Website evidence, with its edges left visible.</p>
        <h1>About WebGrade</h1>
        <p className="editorial-intro">WebGrade turns a public URL into a report you can inspect. It keeps lab measurements, real-user data, and third-party observations in their own lanes so the result stays useful.</p>
        <div className="editorial-rule" />
        <section className="reading-section"><p className="section-kicker">What it checks</p><div><h2>Four questions, one readable report.</h2><p>How fast does the page feel in a controlled lab? Can people use it? Can search engines understand it? What do public security and agent-readiness services observe?</p></div></section>
        <section className="reading-section"><p className="section-kicker">How to read it</p><div><h2>Scores are signals, not a verdict.</h2><p>A Lighthouse score describes a lab run. CrUX describes a field collection period and scope. Cloudflare and Observatory report their own observations. Missing data stays unavailable, and an optional provider never runs without your explicit consent.</p></div></section>
        <section className="provider-table-section"><div className="section-heading-inline"><p className="section-kicker">Sources</p><h2>Provider map</h2></div><div className="provider-table" role="table" aria-label="WebGrade providers"><div className="provider-row provider-row-head" role="row"><span>Provider</span><span>Use</span><span>Evidence</span></div>{providers.map(([name, use, evidence]) => <div className="provider-row" role="row" key={name}><strong>{name}</strong><span className="mono">{use}</span><span>{evidence}</span></div>)}</div></section>
        <div className="about-footer"><p>WebGrade is a project by <a href="https://chames.youssef.tn" target="_blank" rel="noreferrer">Chames Dhibi</a>.</p><Link className="quiet-link" href="/">Check a website <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </div>
  </main>
}
