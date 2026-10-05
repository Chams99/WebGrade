# WebGrade

WebGrade is a focused website audit tool for developers and clients. A visitor can scan a public page on mobile, desktop, or both, inspect Lighthouse evidence, view CrUX field data when it exists, and print or download a report. The owner workspace adds PostgreSQL-backed runs, same-origin batches of up to five URLs, comparable snapshots, expiring read-only share links, and the schema for scheduled monitoring and dashboard alerts.

The public interface is available at [webgrade.chames.tn](https://webgrade.chames.tn) when the VPS deployment is configured. The checked-in sample report is dated and never consumes provider quota.

## Provider boundaries

- Google PageSpeed Insights supplies separate mobile and desktop Lighthouse lab audits for performance, accessibility, best practices, and SEO.
- Google CrUX is queried by page first. If no page record exists, the result may use an explicitly labelled origin fallback. Missing field data stays unavailable.
- Cloudflare URL Scanner Agent Readiness and Mozilla HTTP Observatory run only after an unchecked, provider-specific public-scan consent. Their public visibility and grades remain attributed to those providers.

WebGrade keeps provider scores separate and does not invent a combined security score, projected gains, certificate validity, compliance guarantee, or bot-readiness verdict. Intentional bot restrictions are reported as observations rather than automatic defects.

## Local setup

Use Node 20 and pnpm. Copy `.env.example` to `.env.local`, then configure at least `PAGESPEED_API_KEY` for a useful PageSpeed quota. `CRUX_API_KEY` is optional. Cloudflare and Observatory require explicit consent in the UI and are skipped unless their credentials are configured.

```bash
pnpm install
pnpm dev
```

Production checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Owner workspace and database

The workspace is restricted to the GitHub account whose provider ID matches `WEBGRADE_OWNER_GITHUB_ID` (and, when set, whose email matches `WEBGRADE_OWNER_EMAIL`). Public registration and password login are disabled. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and the owner identity variables before enabling owner sign-in. Provision the single owner identity after the migration with `pnpm exec tsx scripts/provision-owner.ts`. Apply the schema with:

```bash
pnpm db:migrate
```

Runs are stored as immutable report snapshots with retention timestamps. Share links store only a SHA-256 token hash, expire after at most 30 days, and can be revoked by the owner. Browser history from an earlier WebGrade build remains local and is labelled as local; it is never silently uploaded.

The persistent provider guard counts each outbound provider request against an application-level daily budget (`WEBGRADE_DAILY_PAGESPEED`, `WEBGRADE_DAILY_CLOUDFLARE`, `WEBGRADE_DAILY_OBSERVATORY`, and `WEBGRADE_DAILY_CRUX`). Defaults are 200, 100, 100, and 1,000 requests per UTC day. These are local safeguards, not Google's quota values. Set one provider limit to `0` to disable that provider's outbound requests. PageSpeed HTTP 429 responses open a shared one-hour cooldown by default; a valid `Retry-After` sets the cooldown duration up to 24 hours. Guest analyses are limited to three starts per address per rolling hour, with one active run at a time. Set `WEBGRADE_ANALYSIS_ENABLED=0` to stop all new analyses while leaving the site available.

## VPS deployment

The full deployment uses Docker Compose behind the existing Traefik network. The web service listens internally on port 3000; PostgreSQL, migrations, and the lease-backed worker have no public ports. Both the full and public-only Compose files persist provider budgets and cooldowns in the `webgrade_guard_state` named volume, shared by web and worker and owned by container UID 1001. This file guard is for one VPS host and one shared local volume; it does not coordinate separate hosts or unrelated volumes.

1. Copy `.env.example` to `.env.production` on the VPS and configure runtime-only credentials.
2. Validate Compose with `docker compose --env-file .env.production config --quiet`, then build and run the migration service with `docker compose --env-file .env.production --profile migrate build migrate` and `docker compose --env-file .env.production --profile migrate run --rm migrate`.
3. Build and start the web and worker services with `docker compose --env-file .env.production build web worker` and `docker compose --env-file .env.production up -d web worker`.
4. Check `/api/health`, the worker heartbeat logs, and the PostgreSQL backup before switching DNS to `webgrade.chames.tn`.

See [`deploy/README.md`](deploy/README.md) for public-only deployment and recovery commands, storage checks, backups, health checks, and tagged-image rollback. A healthy `/api/health` response verifies service and guard storage, not Google's current quota or PageSpeed credentials. There is no billing, email or Telegram delivery, automatic crawler, or public account system in this release. Monitoring notifications stay in the dashboard.
