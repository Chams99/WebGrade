# WebGrade VPS deployment

WebGrade is designed to run as one Next.js web container, one lease-backed worker, and a private PostgreSQL service behind the existing Traefik network.

1. Create `.env.production` from `.env.example` on the server. Set a 32+ character `BETTER_AUTH_SECRET`, the real database password, the owner GitHub credentials, and provider keys. Never pass secrets as Docker build arguments.
2. Confirm the external `traefik` Docker network exists and that DNS for `webgrade.chames.tn` points to the VPS.
3. Run `docker compose --env-file .env.production --profile migrate run --rm migrate` before the first web start or after a schema change. Passing the file here is required because Compose resolves `${POSTGRES_*}` values while it parses the file; a service-level `env_file` alone does not provide those interpolation values.
4. Deploy with `docker compose --env-file .env.production up -d --build web worker`.
5. Check `https://webgrade.chames.tn/api/health`, the worker logs, and the Traefik router before sharing the URL.

PostgreSQL has no published host port. Keep a tagged image and a database backup before upgrades. Restore the prior image and rerun the health check when rolling back. The worker claims schedule jobs with database leases, runs the provider checks, stores immutable reports, and records score-drop alerts after two comparable runs. A restart can safely reclaim queued work after a lease expires.
