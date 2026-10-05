import postgres from "postgres"
import { createReport } from "../lib/providers"
import { safeParseReport } from "../lib/report"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the worker")
const sql = postgres(process.env.DATABASE_URL, { max: 4, prepare: false })
const workerId = `worker-${process.pid}`
let lastMaintenance = 0

type Job = { id: number; kind: string; payload: unknown; attempts: number }
type Schedule = { id: number; owner_id: string; targets: unknown; cadence: "daily" | "weekly"; cloudflare_consent: boolean; observatory_consent: boolean }

async function enqueueDueSchedules() {
  await sql.begin(async (transaction) => {
    const due = await transaction<Schedule[]>`select id, owner_id, targets, cadence, cloudflare_consent, observatory_consent from schedules where enabled = true and next_due_at <= now() for update skip locked`
    for (const schedule of due) {
      const payload = JSON.stringify({ scheduleId: schedule.id, ownerId: schedule.owner_id })
      const active = await transaction`select id from jobs where kind = 'scheduled-run' and payload ->> 'scheduleId' = ${String(schedule.id)} and status in ('queued', 'running') limit 1`
      if (!active[0]) await transaction`insert into jobs (kind, payload) values ('scheduled-run', ${payload}::jsonb)`
      const interval = schedule.cadence === "daily" ? "1 day" : "7 days"
      await transaction`update schedules set next_due_at = now() + ${interval}::interval where id = ${schedule.id}`
    }
  })
}

async function runScheduledJob(job: Job) {
  const payload = (job.payload ?? {}) as { scheduleId?: number; ownerId?: string }
  if (!payload.scheduleId || !payload.ownerId) throw new Error("Scheduled job payload is incomplete")
  const rows = await sql<Schedule[]>`select id, owner_id, targets, cadence, cloudflare_consent, observatory_consent from schedules where id = ${payload.scheduleId} and owner_id = ${payload.ownerId} and enabled = true limit 1`
  const schedule = rows[0]
  if (!schedule) return
  const targets = Array.isArray(schedule.targets) ? schedule.targets.filter((value): value is string => typeof value === "string").slice(0, 5) : []
  for (const url of targets) {
    const report = await createReport(url, ["mobile", "desktop"], { cloudflare: schedule.cloudflare_consent, observatory: schedule.observatory_consent })
    await sql`insert into audit_runs (id, owner_id, target_url, created_at, public_provider_consent, cloudflare_consent, observatory_consent, status, report_json) values (${report.runId}, ${schedule.owner_id}, ${report.url}, ${report.createdAt}, ${report.providerConsent.cloudflare || report.providerConsent.observatory}, ${report.providerConsent.cloudflare}, ${report.providerConsent.observatory}, 'completed', ${JSON.stringify(report)}::jsonb) on conflict (id) do nothing`
    await createRegressionAlerts(schedule.owner_id, report)
  }
}

async function runAnalysisJob(job: Job) {
  const payload = (job.payload ?? {}) as { runId?: string; url?: string; strategies?: string[]; cloudflareConsent?: boolean; observatoryConsent?: boolean }
  if (!payload.runId || !payload.url) throw new Error("Analysis job payload is incomplete")
  const current = await sql`select status from audit_runs where id = ${payload.runId} limit 1`
  if (!current[0] || current[0].status !== "queued") return
  await sql`update audit_runs set status = 'running' where id = ${payload.runId} and status = 'queued'`
  const strategies = payload.strategies?.filter((value): value is "mobile" | "desktop" => value === "mobile" || value === "desktop")
  const report = await createReport(payload.url, strategies?.length ? strategies : ["mobile", "desktop"], { cloudflare: Boolean(payload.cloudflareConsent), observatory: Boolean(payload.observatoryConsent) }, undefined, payload.runId)
  await sql`update audit_runs set status = 'completed', report_json = ${JSON.stringify(report)}::jsonb where id = ${payload.runId}`
}

async function createRegressionAlerts(ownerId: string, report: Awaited<ReturnType<typeof createReport>>) {
  const previousRows = await sql`select report_json from audit_runs where owner_id = ${ownerId} and target_url = ${report.url} and status = 'completed' and id <> ${report.runId} order by created_at desc limit 2`
  const previous = previousRows.map((row) => safeParseReport(row.report_json)).filter((result): result is { success: true; data: Awaited<ReturnType<typeof createReport>> } => result.success).map((result) => result.data)
  if (previous.length < 2) return
  const current = report.devices.mobile.scores.performance
  const first = previous[0].devices.mobile.scores.performance
  const second = previous[1].devices.mobile.scores.performance
  if (current !== null && first !== null && second !== null && current <= first - 10 && current <= second - 10) {
    const existing = await sql`select id from alerts where owner_id = ${ownerId} and run_id = ${report.runId} and kind = 'score_drop' limit 1`
    if (!existing[0]) await sql`insert into alerts (owner_id, run_id, kind, message) values (${ownerId}, ${report.runId}, 'score_drop', ${`Mobile performance dropped to ${current}/100 across two comparable runs.`})`
  }
}

async function tick() {
  await sql`insert into worker_heartbeats (worker_id, last_seen_at, status) values (${workerId}, now(), 'running') on conflict (worker_id) do update set last_seen_at = now(), status = 'running'`
  if (Date.now() - lastMaintenance > 60_000) {
    lastMaintenance = Date.now()
    await sql`delete from share_links where expires_at <= now() or revoked_at is not null`
    await sql`delete from audit_runs where expires_at <= now()`
    await sql`delete from provider_usage where usage_day < current_date - 7`
  }
  await enqueueDueSchedules()
  const jobs = await sql.begin(async (transaction) => {
    const claimed = await transaction<Job[]>`select id, kind, payload, attempts from jobs where status = 'queued' and available_at <= now() order by id for update skip locked limit 1`
    if (!claimed[0]) return []
    await transaction`update jobs set status = 'running', attempts = attempts + 1, lease_until = now() + interval '2 minutes' where id = ${claimed[0].id}`
    return claimed
  })
  const job = jobs[0] as Job | undefined
  if (!job) return
  try {
    if (job.kind === "scheduled-run") await runScheduledJob(job)
    if (job.kind === "analysis") await runAnalysisJob(job)
    await sql`update jobs set status = 'completed', lease_until = null where id = ${job.id}`
  } catch (error) {
    console.error("WebGrade job failed", job.id, error instanceof Error ? error.message : "unknown error")
    if (job.attempts < 1) await sql`update jobs set status = 'queued', available_at = now() + interval '30 seconds', lease_until = null where id = ${job.id}`
    else {
      if (job.kind === "analysis") {
        const payload = (job.payload ?? {}) as { runId?: string }
        if (payload.runId) await sql`update audit_runs set status = 'failed' where id = ${payload.runId}`
      }
      await sql`update jobs set status = 'failed', lease_until = null where id = ${job.id}`
    }
  }
}

console.log(`${workerId} started`)
const timer = setInterval(() => { void tick().catch((error) => console.error("WebGrade worker tick failed", error instanceof Error ? error.message : "unknown error")) }, 5000)
process.once("SIGTERM", async () => { clearInterval(timer); await sql.end(); process.exit(0) })
process.once("SIGINT", async () => { clearInterval(timer); await sql.end(); process.exit(0) })
