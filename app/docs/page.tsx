import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { PublicHeader } from "@/components/webgrade/public-header"
import { DocsRail } from "@/components/webgrade/docs-rail"

const requestExample = `curl -X POST https://webgrade.chames.tn/api/analyze \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://example.com",
    "strategies": ["mobile", "desktop"],
    "cloudflareConsent": false,
    "observatoryConsent": false
  }'`

const healthExample = `{
  "status": "ok",
  "service": "webgrade",
  "version": "1",
  "database": "not_configured"
}`

const capabilitiesExample = `{
  "cloudflareScan": false,
  "observatoryScan": true,
  "cloudShare": false
}`

export default function DocsPage() {
  return <main className="public-page docs-page">
    <PublicHeader active="docs" />
    <div className="editorial-content docs-layout">
      <DocsRail />
      <div className="editorial-body docs-body">
        <p className="section-kicker">WebGrade API</p><h1>API reference</h1><p className="editorial-intro">Submit a public page, receive an accepted run, then read its report with the short-lived capability returned for guest access.</p>
        <div className="editorial-rule" />
        <section id="analyze" className="docs-section"><div className="endpoint-heading"><span className="method-post">POST</span><code>/api/analyze</code></div><p>Validate a public HTTP(S) target and start the requested device audits. With the database configured, the response queues durable work. Without it, the configured provider calls complete in the request and still return <code>202</code>.</p><div className="parameter-table"><div><b>url</b><span>string · required</span><small>Public HTTP(S) URL without credentials or private-network targets.</small></div><div><b>strategies</b><span>array · default both</span><small>One or both of <code>mobile</code> and <code>desktop</code>.</small></div><div><b>cloudflareConsent</b><span>boolean · default false</span><small>When true, submit the target URL to Cloudflare URL Scanner. This is a public third-party submission. It is unavailable when this deployment has not configured Cloudflare access.</small></div><div><b>observatoryConsent</b><span>boolean · default false</span><small>When true, submit the target URL to Mozilla HTTP Observatory. This is a public third-party submission; the report marks it unavailable if the provider cannot respond.</small></div></div><p className="docs-consent-note"><strong>About consent flags.</strong> <code>false</code> keeps both optional scans off. <code>true</code> sends only the target URL to that provider; it does not send WebGrade credentials or grant the provider access to your site. Use these flags only for public pages, and never include secrets, signed query strings, private staging URLs, or personal data in the target URL. A disabled or unavailable provider never blocks the other report evidence.</p><pre className="code-block"><code>{requestExample}</code></pre></section>
        <section id="status" className="docs-section"><div className="endpoint-heading"><span className="method-get">GET</span><code>/api/analyze/:runId</code></div><p>Read a guest run while it is queued, running, completed, or failed. Send the capability from the POST response as a header; it is never placed in the URL.</p><pre className="code-block"><code>{`x-webgrade-capability: <capability returned by POST>`}</code></pre></section>
        <section id="health" className="docs-section"><div className="endpoint-heading"><span className="method-get">GET</span><code>/api/health</code></div><p>Check WebGrade application infrastructure. This endpoint does not call PageSpeed, CrUX, Cloudflare, or Observatory, and it does not prove that a target website or provider is available.</p><pre className="code-block"><code>{healthExample}</code></pre><div className="health-proof-grid"><article><span className="health-proof-state health-online"><span className="online-dot" aria-hidden="true" />Online</span><code>database ok · worker ok</code><p>The web service, database, and recent worker heartbeat are all healthy.</p></article><article><span className="health-proof-state health-limited"><span className="online-dot" aria-hidden="true" />Limited</span><code>status ok · dependency not ready</code><p>The public scanner can be reachable while the database is not configured or the worker heartbeat is stale. The local response above is this state.</p></article><article><span className="health-proof-state health-unavailable"><span className="online-dot" aria-hidden="true" />Unavailable</span><code>503 · request failure</code><p>The health route cannot confirm the service or its database connection. A dev-server restart can cause this briefly.</p></article></div><p className="docs-note">The navigation badge starts at <code>Checking</code>, then shows <code>Ready</code> when the public scanner works without persistence, or <code>Online</code>, <code>Limited</code>, and <code>Unavailable</code> for infrastructure states. It refreshes every 30 seconds and keeps these separate from provider results.</p></section>
        <section id="capabilities" className="docs-section"><div className="endpoint-heading"><span className="method-get">GET</span><code>/api/capabilities</code></div><p>Read which optional features are configured for this deployment. This endpoint does not expose credentials and does not contact third-party providers.</p><pre className="code-block"><code>{capabilitiesExample}</code></pre><div className="parameter-table"><div><b>cloudflareScan</b><span>boolean</span><small>Consent can be enabled only when Cloudflare URL Scanner access is configured.</small></div><div><b>observatoryScan</b><span>boolean</span><small>Whether the Mozilla HTTP Observatory integration is enabled; the provider may still return an unavailable result.</small></div><div><b>cloudShare</b><span>boolean</span><small>Whether immutable public report snapshots can be stored. Browser share/copy remains separate.</small></div></div></section>
        <section id="errors" className="docs-section"><h2>Response states</h2><div className="error-list"><div><strong>202</strong><span>Accepted. The body includes a run ID; durable runs may still be queued.</span></div><div><strong>400</strong><span>Invalid JSON, target URL, device strategy, or request values.</span></div><div><strong>401 / 404</strong><span>Missing, invalid, or expired guest capability.</span></div><div><strong>413 / 415 / 429</strong><span>Payload, media type, rate limit, or provider budget limit.</span></div><div><strong>502 / 503</strong><span>Provider failure or durable analysis configuration unavailable.</span></div></div><p className="docs-note"><strong>Feature availability.</strong> The scanner labels optional providers as unavailable when this deployment has not configured them. Browser sharing can share or copy the current report URL; a public cloud snapshot requires the owner workspace storage.</p></section>
        <div className="docs-links"><Link href="/"><ArrowLeft size={14} aria-hidden="true" />Back to scanner</Link><a href="https://developers.google.com/speed/docs/insights/v5/get-started" target="_blank" rel="noreferrer">PageSpeed documentation <ExternalLink size={14} aria-hidden="true" /></a></div>
      </div>
    </div>
  </main>
}
