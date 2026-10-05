import path from "node:path"
import { runCloudflare, runCrux, runPageSpeed } from "../../lib/providers"

async function main() {
const mode = process.argv[2] ?? ""
const initialGuardDirectory = process.env.WEBGRADE_GUARD_DIR!
const originalWarn = console.warn
const logs: string[] = []
let calls = 0
console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")) }
const goodBody = JSON.stringify({ lighthouseResult: { finalUrl: "https://example.test/", lighthouseVersion: "test", categories: {}, audits: {} } })
globalThis.fetch = async () => {
  calls += 1
  if (mode === "pagespeed-429") return new Response("{}", { status: 429, headers: { "retry-after": "3600" } })
  if (mode === "pagespeed-403-quota") return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "sensitive-key-marker" } }), { status: 403 })
  if (mode === "pagespeed-403-config") return new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED", message: "sensitive-key-marker" } }), { status: 403 })
  if (mode === "pagespeed-poison") {
    if (calls === 1) process.env.WEBGRADE_GUARD_DIR = path.join(initialGuardDirectory, "regular-file")
    return new Response("{}", { status: 429 })
  }
  if (mode === "crux-origin") return new Response("{}", { status: 404 })
  return new Response(goodBody, { status: 200, headers: { "content-type": "application/json" } })
}

let result: unknown
let second: unknown
if (mode.startsWith("pagespeed")) {
  if (mode === "pagespeed-poison") {
    const fs = await import("node:fs/promises")
    await fs.writeFile(path.join(initialGuardDirectory, "regular-file"), "not a directory")
  }
  result = await runPageSpeed("https://example.test/", "mobile")
  second = await runPageSpeed("https://example.test/", "desktop")
} else if (mode === "crux-origin") {
  process.env.CRUX_API_KEY = "test-key"
  result = await runCrux("https://example.test/page")
} else if (mode === "cloudflare-budget") {
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account"
  process.env.CLOUDFLARE_API_TOKEN = "test-token"
  result = await runCloudflare("https://example.test/", true)
  second = await runCloudflare("https://example.test/", true)
} else if (mode === "kill-switch") {
  process.env.WEBGRADE_ANALYSIS_ENABLED = "0"
  result = await runPageSpeed("https://example.test/", "mobile")
  second = await runCloudflare("https://example.test/", true)
}
console.warn = originalWarn
process.stdout.write(`${JSON.stringify({ calls, result, second, logs })}\n`)
}

void main().catch((error: unknown) => { process.stderr.write(String(error)); process.exitCode = 1 })
