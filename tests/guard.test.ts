import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, beforeEach, test } from "node:test"
import { claimGuest, checkGuardStorage, claimPageSpeedSlot, consumeProviderCall, notePageSpeedQuota, releaseGuest, releasePageSpeedSlot, GuardStorageError } from "../lib/guard-store"
import { guestAddress } from "../lib/rate-limit"

const execFileAsync = promisify(execFile)
const envKeys = ["WEBGRADE_GUARD_DIR", "WEBGRADE_DAILY_PAGESPEED", "WEBGRADE_DAILY_CLOUDFLARE", "WEBGRADE_DAILY_OBSERVATORY", "WEBGRADE_DAILY_CRUX", "TRUST_PROXY", "WEBGRADE_ANALYSIS_ENABLED", "PAGESPEED_API_KEY", "CRUX_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]))
let directory = ""

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "webgrade-guard-test-"))
  process.env.WEBGRADE_GUARD_DIR = directory
  process.env.WEBGRADE_DAILY_PAGESPEED = "200"
  process.env.WEBGRADE_DAILY_CLOUDFLARE = "100"
  process.env.WEBGRADE_DAILY_OBSERVATORY = "100"
  process.env.WEBGRADE_DAILY_CRUX = "1000"
  process.env.TRUST_PROXY = "true"
  delete process.env.WEBGRADE_ANALYSIS_ENABLED
  delete process.env.PAGESPEED_API_KEY
  delete process.env.CRUX_API_KEY
  delete process.env.CLOUDFLARE_ACCOUNT_ID
  delete process.env.CLOUDFLARE_API_TOKEN
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

async function providerCase(mode: string, extraEnv: Record<string, string> = {}) {
  const helper = path.join(process.cwd(), "tests", "helpers", "provider-case.ts")
  const guardDirectory = extraEnv.WEBGRADE_GUARD_DIR ?? directory
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx", helper, mode], { env: { ...process.env, ...extraEnv, WEBGRADE_GUARD_DIR: guardDirectory } })
  return JSON.parse(stdout.trim()) as { calls: number; result: { errorCode?: string; status?: string; errorMessage?: string; message?: string }; second?: { errorCode?: string; status?: string; errorMessage?: string; message?: string }; logs: string[] }
}

async function isolatedProviderCase(mode: string, extraEnv: Record<string, string> = {}) {
  const isolated = await mkdtemp(path.join(os.tmpdir(), "webgrade-provider-case-"))
  try { return await providerCase(mode, { ...extraEnv, WEBGRADE_GUARD_DIR: isolated }) }
  finally { await rm(isolated, { recursive: true, force: true }) }
}

test("daily provider budgets persist across processes and roll at UTC midnight", async () => {
  process.env.WEBGRADE_DAILY_PAGESPEED = "3"
  const first = await consumeProviderCall("pagespeed")
  assert.equal(first.ok, true)
  const child = path.join(process.cwd(), "tests", "helpers", "consume-provider.ts")
  const childRun = await execFileAsync(process.execPath, ["--import", "tsx", child, "pagespeed"], { env: { ...process.env, WEBGRADE_GUARD_DIR: directory } })
  assert.equal(JSON.parse(childRun.stdout).ok, true)
  assert.equal((await consumeProviderCall("pagespeed")).ok, true)
  const exhausted = await consumeProviderCall("pagespeed")
  assert.equal(exhausted.ok, false)
  if (!exhausted.ok) assert.equal(exhausted.reason, "daily_limit")

  const file = path.join(directory, "state.json")
  const state = JSON.parse(await readFile(file, "utf8"))
  state.usage.pagespeed.day = "2000-01-01"
  await writeFile(file, JSON.stringify(state))
  assert.equal((await consumeProviderCall("pagespeed")).ok, true)
})

test("an explicit zero daily budget disables calls for that provider", async () => {
  process.env.WEBGRADE_DAILY_OBSERVATORY = "0"
  const result = await consumeProviderCall("observatory")
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "daily_limit")
})

test("atomic provider cap cannot be overspent by concurrent processes", async () => {
  process.env.WEBGRADE_DAILY_PAGESPEED = "4"
  const helper = path.join(process.cwd(), "tests", "helpers", "consume-provider.ts")
  const runs = await Promise.all(Array.from({ length: 10 }, () => execFileAsync(process.execPath, ["--import", "tsx", helper, "pagespeed"], { env: { ...process.env, WEBGRADE_GUARD_DIR: directory } })))
  const successes = runs.filter((run) => JSON.parse(run.stdout).ok).length
  assert.equal(successes, 4)
  assert.equal((await consumeProviderCall("pagespeed")).ok, false)
})

test("guest limits use the rightmost trusted proxy address and ignore spoofed headers", async () => {
  const requestA = new Request("http://localhost/api/analyze", { headers: { "x-forwarded-for": "198.51.100.7, 203.0.113.14", "x-real-ip": "192.0.2.90" } })
  const requestB = new Request("http://localhost/api/analyze", { headers: { "x-forwarded-for": "10.0.0.1, 203.0.113.14", "x-real-ip": "198.51.100.21" } })
  assert.equal(guestAddress(requestA), "203.0.113.14")
  assert.equal(guestAddress(requestB), "203.0.113.14")
  for (let index = 0; index < 3; index += 1) {
    const claim = await claimGuest(guestAddress(index === 0 ? requestA : requestB))
    assert.equal(claim.ok, true)
    if (claim.ok) await releaseGuest(claim.token)
  }
  const limited = await claimGuest(guestAddress(requestA))
  assert.equal(limited.ok, false)
  if (!limited.ok) assert.equal(limited.reason, "limit")
  const state = await readFile(path.join(directory, "state.json"), "utf8")
  assert.equal(state.includes("203.0.113.14"), false)
  assert.equal(state.includes("192.0.2.90"), false)
})

test("PageSpeed leases cap concurrent calls and reclaim expired slots", async () => {
  const claims = await Promise.all(Array.from({ length: 5 }, () => claimPageSpeedSlot()))
  assert.equal(claims.filter((claim) => claim.ok).length, 2)
  const stateFile = path.join(directory, "state.json")
  const state = JSON.parse(await readFile(stateFile, "utf8"))
  const tokens = Object.keys(state.pageSpeedLeases)
  state.pageSpeedLeases[tokens[0]] = Date.now() - 1
  await writeFile(stateFile, JSON.stringify(state))
  const replacement = await claimPageSpeedSlot()
  assert.equal(replacement.ok, true)
  for (const claim of claims) if (claim.ok) await releasePageSpeedSlot(claim.token)
  if (replacement.ok) await releasePageSpeedSlot(replacement.token)
})

test("PageSpeed quota cooldown persists and a Google 429 stops later calls", async () => {
  await notePageSpeedQuota("3600")
  const blocked = await consumeProviderCall("pagespeed")
  assert.equal(blocked.ok, false)
  if (!blocked.ok) { assert.equal(blocked.reason, "cooldown"); assert.ok(blocked.retryAfter >= 3_590) }
  const mocked = await isolatedProviderCase("pagespeed-429")
  assert.equal(mocked.calls, 1)
  assert.equal(mocked.result.errorCode, "provider_quota")
  assert.equal(mocked.second?.errorCode, "provider_quota")
})

test("Google 403 quota and configuration failures are differentiated without exposing provider text", async () => {
  const quota = await isolatedProviderCase("pagespeed-403-quota")
  assert.equal(quota.calls, 1)
  assert.equal(quota.result.errorCode, "provider_quota")
  assert.equal(quota.second?.errorCode, "provider_quota")
  assert.equal(quota.logs.join(" ").includes("sensitive-key-marker"), false)

  const config = await isolatedProviderCase("pagespeed-403-config")
  assert.equal(config.calls, 2)
  assert.equal(config.result.errorCode, "provider_config")
  assert.equal(config.result.errorMessage?.includes("sensitive-key-marker"), false)
  assert.equal(config.logs.join(" ").includes("sensitive-key-marker"), false)
})

test("a failed cooldown write poisons the process before any next provider request", async () => {
  const poisoned = await isolatedProviderCase("pagespeed-poison")
  assert.equal(poisoned.calls, 1)
  assert.equal(poisoned.result.errorCode, "provider_guard_unavailable")
  assert.equal(poisoned.second?.errorCode, "provider_guard_unavailable")
})

test("duplicate guard modules share PageSpeed cooldown and poison after transient storage failure", async () => {
  const guardDirectory = path.join(directory, "transient-guard")
  await writeFile(guardDirectory, "temporarily blocks guard storage")
  process.env.WEBGRADE_GUARD_DIR = guardDirectory
  await assert.rejects(notePageSpeedQuota("3600"), (error: unknown) => error instanceof GuardStorageError)
  await rm(guardDirectory)
  await mkdir(guardDirectory)

  const duplicatePath = path.join(directory, "guard-store-copy.ts")
  await copyFile(path.join(process.cwd(), "lib", "guard-store.ts"), duplicatePath)
  const duplicate = await import(pathToFileURL(duplicatePath).href) as typeof import("../lib/guard-store")
  const registry = (globalThis as unknown as { [key: symbol]: unknown })[Symbol.for("webgrade.guard.local-state.v1")] as Map<string, { pageSpeedPoisoned: boolean; pageSpeedCooldownUntil: number }>
  const sharedState = registry.get(path.resolve(guardDirectory))!

  const cooldown = await duplicate.consumeProviderCall("pagespeed")
  assert.equal(cooldown.ok, false)
  if (!cooldown.ok) assert.equal(cooldown.reason, "cooldown")
  assert.equal(sharedState.pageSpeedPoisoned, true)
  sharedState.pageSpeedCooldownUntil = 0

  const poisoned = await duplicate.consumeProviderCall("pagespeed")
  assert.equal(poisoned.ok, false)
  if (!poisoned.ok) assert.equal(poisoned.reason, "guard_unavailable")
})

test("CrUX origin fallback and Cloudflare each charge every actual request", async () => {
  process.env.WEBGRADE_DAILY_CRUX = "1"
  const crux = await isolatedProviderCase("crux-origin", { WEBGRADE_DAILY_CRUX: "1" })
  assert.equal(crux.calls, 1)
  assert.equal(crux.result.status, "unavailable")

  process.env.WEBGRADE_DAILY_CLOUDFLARE = "1"
  const cloudflare = await isolatedProviderCase("cloudflare-budget", { WEBGRADE_DAILY_CLOUDFLARE: "1" })
  assert.equal(cloudflare.calls, 1)
  assert.equal(cloudflare.second?.status, "unavailable")
})

test("analysis kill switch prevents all provider HTTP requests", async () => {
  const killed = await isolatedProviderCase("kill-switch")
  assert.equal(killed.calls, 0)
  assert.equal(killed.result.errorCode, "analysis_disabled")
  assert.equal(killed.second?.status, "unavailable")
})

test("restarted process can recover its own abandoned lock but deleted state fails closed", async () => {
  const owner = { token: "old-process", pid: process.pid, host: os.hostname(), instance: "previous-container-process", createdAt: Date.now() }
  await writeFile(path.join(directory, "state.lock"), JSON.stringify(owner))
  assert.equal((await consumeProviderCall("cloudflare")).ok, true)
  await rm(path.join(directory, "state.json"))
  await assert.rejects(checkGuardStorage(), (error: unknown) => error instanceof GuardStorageError)
})

test("an interrupted recovery-gate candidate cannot block stale-lock recovery", async () => {
  const owner = { token: "old-process", pid: process.pid, host: os.hostname(), instance: "previous-container-process", createdAt: Date.now() }
  await writeFile(path.join(directory, "state.lock"), JSON.stringify(owner))
  await writeFile(path.join(directory, "state.lock.reclaim.candidate-abandoned"), "{\"token\":")
  assert.equal((await consumeProviderCall("cloudflare")).ok, true)
})
