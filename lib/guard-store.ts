import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { link, mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

export type GuardProvider = "pagespeed" | "cloudflare" | "observatory" | "crux"

type Usage = { day: string; used: number }
type GuestBucket = { startedAt: number; count: number; activeToken: string | null; activeUntil: number }
type LockOwner = { token: string; pid: number; host: string; instance?: string; createdAt: number }
type GuardState = {
  version: 1
  clientSalt: string
  usage: Partial<Record<GuardProvider, Usage>>
  guests: Record<string, GuestBucket>
  pageSpeedLeases: Record<string, number>
  pageSpeedCooldownUntil: number
}

const PROVIDERS: GuardProvider[] = ["pagespeed", "cloudflare", "observatory", "crux"]
const DEFAULT_LIMITS: Record<GuardProvider, number> = { pagespeed: 200, cloudflare: 100, observatory: 100, crux: 1000 }
const ENV_LIMITS: Record<GuardProvider, string> = { pagespeed: "WEBGRADE_DAILY_PAGESPEED", cloudflare: "WEBGRADE_DAILY_CLOUDFLARE", observatory: "WEBGRADE_DAILY_OBSERVATORY", crux: "WEBGRADE_DAILY_CRUX" }
const MAX_STATE_BYTES = 4 * 1024 * 1024
const MAX_GUESTS = 20_000
const MAX_GUEST_WINDOW_MS = 60 * 60 * 1000
const GUEST_WINDOW_LIMIT = 3
const GUEST_ACTIVE_LEASE_MS = 120_000
const PAGESPEED_SLOT_LEASE_MS = 120_000
const MAX_PAGESPEED_SLOTS = 2
const DEFAULT_GOOGLE_COOLDOWN_MS = 60 * 60 * 1000
const MAX_GOOGLE_COOLDOWN_MS = 24 * 60 * 60 * 1000
const LOCK_WAIT_MS = 8_000
const localHost = hostname()
const processInstanceSymbol = Symbol.for("webgrade.guard.process-instance.v1")
const processGuardStateSymbol = Symbol.for("webgrade.guard.local-state.v1")
const processGlobal = globalThis as unknown as { [key: symbol]: unknown }
const processInstance = typeof processGlobal[processInstanceSymbol] === "string"
  ? processGlobal[processInstanceSymbol] as string
  : (processGlobal[processInstanceSymbol] = randomUUID()) as string

type GuardProcessState = { pageSpeedPoisoned: boolean; pageSpeedCooldownUntil: number }

function processGuardState(): GuardProcessState {
  const directory = guardDirectory()
  let registry = processGlobal[processGuardStateSymbol]
  if (!(registry instanceof Map)) {
    registry = new Map<string, GuardProcessState>()
    processGlobal[processGuardStateSymbol] = registry
  }
  let state = (registry as Map<string, GuardProcessState>).get(directory)
  if (!state) {
    state = { pageSpeedPoisoned: false, pageSpeedCooldownUntil: 0 }
    const guardStateRegistry = registry as Map<string, GuardProcessState>
    guardStateRegistry.set(directory, state)
  }
  return state
}

export class GuardStorageError extends Error {
  constructor() {
    super("provider_guard_unavailable")
    this.name = "GuardStorageError"
  }
}

function guardDirectory() {
  return path.resolve(process.env.WEBGRADE_GUARD_DIR?.trim() || path.join(process.cwd(), ".webgrade", "guard"))
}

function paths() {
  const directory = guardDirectory()
  return { directory, state: path.join(directory, "state.json"), initialized: path.join(directory, "state.initialized"), lock: path.join(directory, "state.lock"), pageSpeedPoison: path.join(directory, "pagespeed.poison") }
}

function createEmptyState(): GuardState {
  return { version: 1, clientSalt: randomBytes(32).toString("hex"), usage: {}, guests: {}, pageSpeedLeases: {}, pageSpeedCooldownUntil: 0 }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseState(raw: string): GuardState {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new GuardStorageError() }
  if (!isRecord(value) || value.version !== 1 || typeof value.clientSalt !== "string" || !/^[a-f0-9]{64}$/.test(value.clientSalt) || !isRecord(value.usage) || !isRecord(value.guests) || !isRecord(value.pageSpeedLeases) || typeof value.pageSpeedCooldownUntil !== "number" || !Number.isFinite(value.pageSpeedCooldownUntil)) throw new GuardStorageError()
  for (const provider of PROVIDERS) {
    const usage = value.usage[provider]
    if (usage !== undefined && (!isRecord(usage) || typeof usage.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(usage.day) || typeof usage.used !== "number" || !Number.isSafeInteger(usage.used) || usage.used < 0)) throw new GuardStorageError()
  }
  for (const [key, bucket] of Object.entries(value.guests)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !isRecord(bucket) || typeof bucket.startedAt !== "number" || !Number.isFinite(bucket.startedAt) || typeof bucket.count !== "number" || !Number.isSafeInteger(bucket.count) || bucket.count < 0 || (bucket.activeToken !== null && typeof bucket.activeToken !== "string") || typeof bucket.activeUntil !== "number" || !Number.isFinite(bucket.activeUntil)) throw new GuardStorageError()
  }
  for (const [key, expiresAt] of Object.entries(value.pageSpeedLeases)) {
    if (!key || typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) throw new GuardStorageError()
  }
  return value as unknown as GuardState
}

async function loadState(statePath: string, initializedPath: string): Promise<GuardState> {
  try {
    const info = await stat(statePath)
    if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new GuardStorageError()
    const state = parseState(await readFile(statePath, "utf8"))
    await ensureInitialized(initializedPath)
    return state
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      try {
        await stat(initializedPath)
        throw new GuardStorageError()
      } catch (markerError) {
        if (markerError instanceof GuardStorageError) throw markerError
        if (!isNodeError(markerError) || markerError.code !== "ENOENT") throw new GuardStorageError()
      }
      return createEmptyState()
    }
    if (error instanceof GuardStorageError) throw error
    throw new GuardStorageError()
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

async function hasPageSpeedPoison(markerPath: string) {
  if (processGuardState().pageSpeedPoisoned) return true
  try { await stat(markerPath); return true }
  catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false
    throw new GuardStorageError()
  }
}

async function poisonPageSpeedGuard(directory: string) {
  processGuardState().pageSpeedPoisoned = true
  const poisonPath = path.join(directory, "pagespeed.poison")
  try {
    const file = await open(poisonPath, "wx", 0o600)
    await file.writeFile(JSON.stringify({ code: "cooldown_persist_failed", at: Date.now() }))
    await file.sync()
    await file.close()
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") { /* Local process remains fail-closed. */ }
  }
}

async function ensureInitialized(markerPath: string) {
  const marker = `${JSON.stringify({ version: 1, createdAt: Date.now() })}\n`
  try {
    const file = await open(markerPath, "wx", 0o600)
    await file.writeFile(marker)
    await file.sync()
    await file.close()
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") return
    throw new GuardStorageError()
  }
}

function processIsAlive(pid: number) {
  try { process.kill(pid, 0); return true } catch (error) { return isNodeError(error) && error.code === "EPERM" }
}

function currentLockOwner(token: string): LockOwner {
  return { token, pid: process.pid, host: localHost, instance: processInstance, createdAt: Date.now() }
}

async function createExclusiveLockFile(filePath: string, owner: LockOwner) {
  const candidatePath = `${filePath}.candidate-${owner.token}`
  let candidate
  try {
    candidate = await open(candidatePath, "wx", 0o600)
    await candidate.writeFile(JSON.stringify(owner))
    await candidate.sync()
    await candidate.close()
    candidate = undefined
    try { await link(candidatePath, filePath); return true }
    catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") return false
      throw error
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") return false
    throw new GuardStorageError()
  } finally {
    if (candidate) await candidate.close().catch(() => undefined)
    await unlink(candidatePath).catch(() => undefined)
  }
}

async function readLockOwner(lockPath: string): Promise<{ owner: LockOwner | null; ageMs: number }> {
  try {
    const [raw, info] = await Promise.all([readFile(lockPath, "utf8"), stat(lockPath)])
    try {
      const value: unknown = JSON.parse(raw)
      if (isRecord(value) && typeof value.token === "string" && typeof value.pid === "number" && typeof value.host === "string" && typeof value.createdAt === "number" && (value.instance === undefined || typeof value.instance === "string")) return { owner: value as unknown as LockOwner, ageMs: Math.max(0, Date.now() - value.createdAt) }
    } catch { /* A process may have stopped while publishing the lock owner. */ }
    return { owner: null, ageMs: Math.max(0, Date.now() - info.mtimeMs) }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return { owner: null, ageMs: 0 }
    throw new GuardStorageError()
  }
}

function lockIsStale(owner: LockOwner | null) {
  if (!owner || owner.host !== localHost) return false
  // Docker can restart Node as PID 1 with the same container hostname. The
  // random process instance distinguishes that restart from a live lock owner.
  if (owner.pid === process.pid && owner.instance !== processInstance) return true
  return !processIsAlive(owner.pid)
}

async function releaseOwnedFile(filePath: string, token: string) {
  const { owner } = await readLockOwner(filePath)
  if (owner?.token === token) await unlink(filePath).catch((error) => { if (!isNodeError(error) || error.code !== "ENOENT") throw new GuardStorageError() })
}

async function acquireRecoveryGate(gatePath: string) {
  const deadline = Date.now() + LOCK_WAIT_MS
  while (Date.now() < deadline) {
    const owner = currentLockOwner(randomUUID())
    try {
      if (await createExclusiveLockFile(gatePath, owner)) return owner
    } catch { throw new GuardStorageError() }
    const existing = await readLockOwner(gatePath)
    if (lockIsStale(existing.owner) && existing.owner) await releaseOwnedFile(gatePath, existing.owner.token)
    await delay(8 + Math.floor(Math.random() * 18))
  }
  throw new GuardStorageError()
}

async function releaseRecoveryGate(gatePath: string, token: string) {
  await releaseOwnedFile(gatePath, token)
}

async function tryRecoverStaleLock(lockPath: string) {
  const before = await readLockOwner(lockPath)
  if (!lockIsStale(before.owner)) return false
  const gatePath = `${lockPath}.reclaim`
  const gate = await acquireRecoveryGate(gatePath)
  try {
    const current = await readLockOwner(lockPath)
    const sameOwner = before.owner ? current.owner?.token === before.owner.token : !current.owner
    if (sameOwner && lockIsStale(current.owner)) {
      await assertRecoveryGate(gatePath, gate.token)
      await unlink(lockPath).catch((error) => { if (!isNodeError(error) || error.code !== "ENOENT") throw new GuardStorageError() })
      return true
    }
    return false
  } finally {
    await releaseRecoveryGate(gatePath, gate.token)
  }
}

async function acquireLock(lockPath: string) {
  const deadline = Date.now() + LOCK_WAIT_MS
  while (Date.now() < deadline) {
    const owner = currentLockOwner(randomUUID())
    try {
      if (await createExclusiveLockFile(lockPath, owner)) return owner
    } catch { throw new GuardStorageError() }
    await tryRecoverStaleLock(lockPath)
    await delay(8 + Math.floor(Math.random() * 18))
  }
  throw new GuardStorageError()
}

async function assertRecoveryGate(gatePath: string, token: string) {
  const { owner } = await readLockOwner(gatePath)
  if (owner?.token !== token) throw new GuardStorageError()
}

async function releaseStateLock(lockPath: string, token: string) {
  // Serialize normal release with stale recovery. If recovery already replaced
  // this token, the old holder cannot remove the replacement lock.
  const gatePath = `${lockPath}.reclaim`
  const gate = await acquireRecoveryGate(gatePath)
  try {
    await assertRecoveryGate(gatePath, gate.token)
    await releaseOwnedFile(lockPath, token)
  } finally {
    await releaseRecoveryGate(gatePath, gate.token)
  }
}

async function assertLockOwner(lockPath: string, token: string) {
  const { owner } = await readLockOwner(lockPath)
  if (owner?.token !== token) throw new GuardStorageError()
}

async function saveState(statePath: string, lockPath: string, state: GuardState, lockToken: string) {
  const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`
  let file
  try {
    file = await open(temporaryPath, "wx", 0o600)
    await file.writeFile(JSON.stringify(state))
    await file.sync()
    await file.close()
    file = undefined
    await assertLockOwner(lockPath, lockToken)
    await rename(temporaryPath, statePath)
  } catch {
    if (file) await file.close().catch(() => undefined)
    await unlink(temporaryPath).catch(() => undefined)
    throw new GuardStorageError()
  }
}

function prune(state: GuardState, now: number) {
  for (const [key, bucket] of Object.entries(state.guests)) {
    const active = bucket.activeToken !== null && bucket.activeUntil > now
    if (!active && now - bucket.startedAt >= MAX_GUEST_WINDOW_MS) delete state.guests[key]
    else if (bucket.activeToken !== null && bucket.activeUntil <= now) { bucket.activeToken = null; bucket.activeUntil = 0 }
  }
  for (const [token, expiresAt] of Object.entries(state.pageSpeedLeases)) if (expiresAt <= now) delete state.pageSpeedLeases[token]
  if (state.pageSpeedCooldownUntil <= now) state.pageSpeedCooldownUntil = 0
}

async function withGuardState<T>(action: (state: GuardState, now: number) => T): Promise<T> {
  const { directory, state: statePath, initialized: initializedPath, lock: lockPath } = paths()
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const lock = await acquireLock(lockPath)
    try {
      const state = await loadState(statePath, initializedPath)
      const now = Date.now()
      prune(state, now)
      const result = action(state, now)
      await saveState(statePath, lockPath, state, lock.token)
      await ensureInitialized(paths().initialized)
      return result
    } finally {
      await releaseStateLock(lockPath, lock.token)
    }
  } catch (error) {
    if (error instanceof GuardStorageError) throw error
    throw new GuardStorageError()
  }
}

function providerLimit(provider: GuardProvider) {
  const raw = process.env[ENV_LIMITS[provider]]?.trim()
  if (!raw) return DEFAULT_LIMITS[provider]
  const configured = Number(raw)
  return Number.isSafeInteger(configured) && configured >= 0 ? configured : DEFAULT_LIMITS[provider]
}

function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10)
}

function secondsUntilNextUtcDay(now: number) {
  const next = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1)
  return Math.max(1, Math.ceil((next - now) / 1000))
}

export type ProviderCallResult = { ok: true; remaining: number } | { ok: false; reason: "daily_limit" | "cooldown" | "guard_unavailable"; retryAfter: number }

/** Atomically charge one provider HTTP attempt. Call directly before every outbound provider request. */
export async function consumeProviderCall(provider: GuardProvider): Promise<ProviderCallResult> {
  const { pageSpeedPoison } = paths()
  const localState = processGuardState()
  if (provider === "pagespeed") {
    if (localState.pageSpeedCooldownUntil > Date.now()) return { ok: false, reason: "cooldown", retryAfter: Math.max(1, Math.ceil((localState.pageSpeedCooldownUntil - Date.now()) / 1000)) }
    if (await hasPageSpeedPoison(pageSpeedPoison)) return { ok: false, reason: "guard_unavailable", retryAfter: 0 }
  }
  const result = await withGuardState((state, now) => {
    if (provider === "pagespeed" && state.pageSpeedCooldownUntil > now) return { ok: false as const, reason: "cooldown" as const, retryAfter: Math.max(1, Math.ceil((state.pageSpeedCooldownUntil - now) / 1000)) }
    const day = utcDay(now)
    const usage = state.usage[provider]
    const used = usage?.day === day ? usage.used : 0
    if (used >= providerLimit(provider)) return { ok: false as const, reason: "daily_limit" as const, retryAfter: secondsUntilNextUtcDay(now) }
    state.usage[provider] = { day, used: used + 1 }
    return { ok: true as const, remaining: providerLimit(provider) - used - 1 }
  })
  if (provider === "pagespeed" && await hasPageSpeedPoison(pageSpeedPoison)) return { ok: false, reason: "guard_unavailable", retryAfter: 0 }
  return result
}

/** Hold the Google quota circuit open after a 429. The default is deliberately long enough to avoid retry churn. */
export async function notePageSpeedQuota(retryAfterHeader?: string | null): Promise<void> {
  const now = Date.now()
  let duration = DEFAULT_GOOGLE_COOLDOWN_MS
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader)
    const date = Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000 : Date.parse(retryAfterHeader)
    if (Number.isFinite(date) && date > now) duration = Math.min(MAX_GOOGLE_COOLDOWN_MS, date - now)
  }
  const until = now + Math.max(1_000, duration)
  processGuardState().pageSpeedCooldownUntil = Math.max(processGuardState().pageSpeedCooldownUntil, until)
  try {
    await withGuardState((state) => { state.pageSpeedCooldownUntil = Math.max(state.pageSpeedCooldownUntil, until) })
  } catch (error) {
    await poisonPageSpeedGuard(paths().directory)
    throw error
  }
}

export type PageSpeedSlotResult = { ok: true; token: string } | { ok: false; retryAfter: number }

export function claimPageSpeedSlot(): Promise<PageSpeedSlotResult> {
  return withGuardState((state, now) => {
    const active = Object.entries(state.pageSpeedLeases).filter(([, expiresAt]) => expiresAt > now)
    if (active.length >= MAX_PAGESPEED_SLOTS) return { ok: false, retryAfter: Math.max(1, Math.ceil((Math.min(...active.map(([, expiresAt]) => expiresAt)) - now) / 1000)) }
    const token = randomUUID()
    state.pageSpeedLeases[token] = now + PAGESPEED_SLOT_LEASE_MS
    return { ok: true, token }
  })
}

export function releasePageSpeedSlot(token: string): Promise<void> {
  return withGuardState((state) => { delete state.pageSpeedLeases[token] })
}

export type GuestClaim = { ok: true; retryAfter: 0; token: string } | { ok: false; retryAfter: number; reason: "active" | "limit" | "storage_full" }

export function claimGuest(address: string): Promise<GuestClaim> {
  return withGuardState((state, now) => {
    const key = createHmac("sha256", state.clientSalt).update(address).digest("hex")
    const bucket = state.guests[key]
    const inWindow = bucket && now - bucket.startedAt < MAX_GUEST_WINDOW_MS
    if (inWindow && bucket.activeToken && bucket.activeUntil > now) return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.activeUntil - now) / 1000)), reason: "active" }
    if (inWindow && bucket.count >= GUEST_WINDOW_LIMIT) return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.startedAt + MAX_GUEST_WINDOW_MS - now) / 1000)), reason: "limit" }
    if (!bucket && Object.keys(state.guests).length >= MAX_GUESTS) return { ok: false, retryAfter: MAX_GUEST_WINDOW_MS / 1000, reason: "storage_full" }
    const token = randomUUID()
    if (!bucket || !inWindow) state.guests[key] = { startedAt: now, count: 1, activeToken: token, activeUntil: now + GUEST_ACTIVE_LEASE_MS }
    else {
      bucket.count += 1
      bucket.activeToken = token
      bucket.activeUntil = now + GUEST_ACTIVE_LEASE_MS
    }
    return { ok: true, retryAfter: 0, token }
  })
}

export function releaseGuest(token: string): Promise<void> {
  return withGuardState((state) => {
    for (const bucket of Object.values(state.guests)) {
      if (bucket.activeToken === token) { bucket.activeToken = null; bucket.activeUntil = 0; return }
    }
  })
}

/** Performs a real read/write cycle so callers can surface a fail-closed guard as unavailable. */
export async function checkGuardStorage() {
  const { pageSpeedPoison } = paths()
  await withGuardState(() => true)
  if (await hasPageSpeedPoison(pageSpeedPoison)) throw new GuardStorageError()
  return true
}
