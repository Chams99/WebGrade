# WebGrade VPS deployment

The site runs behind the existing Traefik network. The public-only deployment runs one web container with no database or worker; full mode adds PostgreSQL and the lease-backed worker. Both modes use the Docker named volume `webgrade_guard_state` for provider budgets, guest limits, and PageSpeed cooldowns. Web and worker run as UID/GID 1001 and share that volume. Docker initializes a new empty volume from the image directory's ownership and permissions on first mount. Keep this volume when switching modes or deploying new images.

The guard is a single-host file store. It coordinates containers on this VPS only when they share this local named volume. It does not coordinate separate VPS hosts or replicas with different volumes. Keep the public web container reachable only through Traefik; neither Compose file publishes port 3000 on the host. With `TRUST_PROXY=true`, the app uses the rightmost valid `X-Forwarded-For` address for the one Traefik hop and ignores `X-Real-IP` and earlier forwarded values.

## Public scanner deployment

Run these commands on the VPS from the existing checkout. `.env.public` is a local, Git-ignored runtime file and is excluded from Docker build context. Create it only if it does not already exist, then edit it with a secure editor to add runtime credentials. Do not pass provider keys as build arguments.

```sh
cd ~/projects/websiteGrader
test -f .env.public || cp .env.public.example .env.public
chmod 600 .env.public
```

For an update, confirm the tracked checkout has no local changes before pulling. The ignored `.env.public` remains in place through `git pull --ff-only`; do not run `git clean -x`.

```sh
git status --short
test -z "$(git status --porcelain)" || { echo "Stop: review the local checkout before pulling."; exit 1; }
git check-ignore -q .env.public || { echo "Stop: .env.public is not Git-ignored."; exit 1; }
git pull --ff-only
docker compose -f docker-compose.public.yml --env-file .env.public config --quiet
docker compose -f docker-compose.public.yml --env-file .env.public build web
docker compose -f docker-compose.public.yml --env-file .env.public up -d --no-deps web
```

Verify service health, feature status, persistent-volume access, and whether a PageSpeed key is configured. These commands print only the key-presence result, never its value. They make no provider calls and do not submit an analysis.

```sh
docker compose -f docker-compose.public.yml --env-file .env.public ps web
curl -fsS https://webgrade.chames.tn/api/health
curl -fsS https://webgrade.chames.tn/api/capabilities
docker compose -f docker-compose.public.yml --env-file .env.public exec -T web node -e 'const fs=require("node:fs");const p=process.env.WEBGRADE_GUARD_DIR||"/var/lib/webgrade/guard";try{fs.accessSync(p,fs.constants.W_OK|fs.constants.X_OK);console.log(JSON.stringify({guardPath:p,writable:true}))}catch{console.log(JSON.stringify({guardPath:p,writable:false}));process.exit(1)}'
docker compose -f docker-compose.public.yml --env-file .env.public exec -T web node -e 'console.log(process.env.PAGESPEED_API_KEY?.trim()?"PAGESPEED_API_KEY configured":"PAGESPEED_API_KEY not configured")'
```

In public-only mode, `/api/health` should report `database: "not_configured"`, `providerGuard: "ok"`, and `analysis: "enabled"`; capabilities should report `analysisEnabled: true`. Health checks the application and guard storage, not Google credentials or current Google quota. A configured key is recommended for frequent PageSpeed requests, but the [PSI API also supports requests without a key](https://developers.google.com/speed/docs/insights/v5/get-started). A 429 alone does not identify the quota condition or caller. Inspect the [Google Cloud API Dashboard request and error metrics](https://docs.cloud.google.com/apis/docs/monitoring) for the project used by the runtime key (if any), and check that the PageSpeed Insights API is enabled and the key's restrictions match the server request. Zero traffic for a particular key does not prove that Google received no keyless requests. Application health and a configured key do not prove quota recovery.

## Limits and pause switch

The application guard counts provider HTTP attempts across containers sharing the volume. Its defaults are 200 PageSpeed, 100 Cloudflare, 100 Observatory, and 1,000 CrUX requests per UTC day. Set `WEBGRADE_DAILY_PAGESPEED`, `WEBGRADE_DAILY_CLOUDFLARE`, `WEBGRADE_DAILY_OBSERVATORY`, or `WEBGRADE_DAILY_CRUX` in the runtime env file to lower or otherwise adjust an application cap; set one to `0` to disable that provider's outbound requests. Missing, blank, or invalid values use the defaults. These are local safeguards and do not change provider-side quota. Guest runs allow three starts per address in a rolling hour and one active run at a time. PageSpeed allows two concurrent provider requests. A PageSpeed 429 opens a one-hour cooldown by default; a valid `Retry-After` supplies the duration, capped at 24 hours.

To pause all new analyses while leaving the site available, set `WEBGRADE_ANALYSIS_ENABLED=0` in `.env.public`, validate, and recreate only the web service:

```sh
docker compose -f docker-compose.public.yml --env-file .env.public config --quiet
docker compose -f docker-compose.public.yml --env-file .env.public up -d --no-deps --force-recreate web
curl -fsS https://webgrade.chames.tn/api/health
curl -fsS https://webgrade.chames.tn/api/capabilities
```

The health response should then report `analysis: "disabled"`, and capabilities should report `analysisEnabled: false`. Set it back to `1` only when you want to resume analyses; the stored daily usage and cooldown remain in force. Never clear provider state to bypass an active cooldown.

## Full web, worker, and database deployment

Use `.env.production` for runtime configuration. It must provide the database interpolation variables, database URL, and the credentials needed for the enabled features. Compose's `env_file` passes variables into containers; `--env-file` also supplies values used while Compose parses `${...}` expressions. The env file stays out of the image build context.

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production --profile migrate build migrate
docker compose --env-file .env.production --profile migrate run --rm migrate
docker compose --env-file .env.production build web worker
docker compose --env-file .env.production up -d web worker
docker compose --env-file .env.production ps
curl -fsS https://webgrade.chames.tn/api/health
```

Web and worker mount the same guard volume, so provider budgets and cooldowns are shared. The PostgreSQL volume and provider guard volume are independent persistent volumes. Routine updates must not use `docker compose down -v`, which removes named volumes. The public-only stack has no database or worker; do not start either one for a public-only deployment.

## Guard storage recovery

Normal container restarts recover locks owned by that same process instance, so routine deploys should not need manual cleanup. If the guard continues to report unavailable after a storage or crash problem, first stop **every** web and worker container using `webgrade_guard_state`. Never clean markers while a writer is running. For the public-only stack:

```sh
docker compose -f docker-compose.public.yml --env-file .env.public stop web
```

For full mode:

```sh
docker compose --env-file .env.production stop web worker
```

After confirming no other container mounts this volume, remove only stale transient lock and temporary files with the matching Compose stack. This command preserves `state.json`, `state.initialized`, and `pagespeed.poison`:

```sh
docker compose -f docker-compose.public.yml --env-file .env.public run --rm --no-deps --entrypoint node web -e 'const fs=require("node:fs");const path=require("node:path");const dir=process.env.WEBGRADE_GUARD_DIR||"/var/lib/webgrade/guard";const transient=fs.readdirSync(dir).filter(n=>n==="state.lock"||n==="state.lock.reclaim"||/^state\.lock(?:\.reclaim)?\.candidate-[a-f0-9-]+$/.test(n)||/^state\.json\.\d+\.[a-f0-9-]+\.tmp$/.test(n));for(const name of transient){fs.unlinkSync(path.join(dir,name));console.log("removed "+name)}'
docker compose -f docker-compose.public.yml --env-file .env.public up -d --no-deps web
```

In full mode, replace the public Compose options with `--env-file .env.production` and restart with `docker compose --env-file .env.production up -d web worker`. Do not delete or edit the volume, reset `state.json`, or remove `pagespeed.poison` as routine recovery. A poison marker means the guard could not safely persist a provider cooldown; investigate the storage failure and provider quota before any deliberate state reset.

After any guard-storage write failure, set `WEBGRADE_ANALYSIS_ENABLED=0` and keep it disabled while restoring and verifying persistent-volume access, before restarting containers or re-enabling scans. If both the cooldown state and poison marker failed to persist, the in-memory pause is lost when that process exits; an uninitialized store may then start with fresh counters. Preserve `state.initialized` and `state.json`; never delete them to reset quota.

## Backups and rollback

Back up PostgreSQL before schema changes, keep a known-good tagged image for rollback, and check `/api/health`, worker heartbeats, and the Traefik router after deployment. Do not remove `webgrade_guard_state` during image rollback or mode changes. Health `200` confirms service and guard availability; it is not a PageSpeed quota test. Provider recovery must be verified through the relevant provider dashboard or by a later, deliberately authorized analysis.
