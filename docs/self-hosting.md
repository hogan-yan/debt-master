# Self-hosting Debt Master

Run the web app (expense tracking for shared workplace lunches) on your own machine or server with Docker Compose. The bundle is two containers: the published app image (`ghcr.io/hogan-yan/debt-master:latest`) and PostgreSQL 17. Database migrations run automatically on every start — no manual steps.

Last verified: 2026-09-13

> **Maintainers:** this guide is about the deployment bundle at the repo root — [`docker-compose.yml`](../docker-compose.yml) (published image + Postgres only). Local *development* uses [`docker-compose.dev.yml`](../docker-compose.dev.yml) (build from source + Postgres + Valkey + MinIO); see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Requirements

- Docker with Compose v2 (the `docker compose` subcommand)
- 1 vCPU / 1 GB RAM minimum

The published image is amd64-only; the compose file pins `platform: linux/amd64`, so ARM hosts (e.g. Apple Silicon) pull-and-emulate instead of failing.

## Quickstart

```sh
git clone https://github.com/hogan-yan/debt-master.git
cd debt-master
cp .env.example .env
```

Edit `.env` and set the three secrets (generate each with `openssl rand -base64 32`):

- `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET`
- `JWT_SECRET`

Then start:

```sh
docker compose up -d --wait
```

`--wait` returns once the database is healthy and the app has passed its container healthcheck (migrations are applied before the app starts serving). Confirm:

```sh
$ curl http://localhost:3000/health
{"status":"ok","db":"up"}
```

Open `PUBLIC_APP_URL` (default `http://localhost:3000`) in a browser.

## First-run admin

The setup wizard is the only way to create the first admin in this deployment:

1. Visit `/login` — while zero admins exist, it auto-redirects to `/setup`.
2. Fill in name, email, and a password (at least 12 characters with upper-case, lower-case, digit, and special characters).
3. Submit — you are signed in and land on the dashboard. From now on, sign in at `/login`.

The wizard locks itself permanently once the first admin exists (`/setup` redirects to `/login` afterwards).

### Remote first-run (VPS / cloud / PaaS)

While setup is open, the wizard only accepts requests from private/loopback addresses. Setting up over a public hostname (a cloud VPS, PikaPods, …) requires a token: set `SETUP_TOKEN` in `.env` before starting the stack, then enter the same token in the wizard's "Setup token" field. A valid token authorizes setup from any network; without it, setup from a public IP is refused by design.

> Note: `apps/web/scripts/create-admin.ts` is a source-tree utility and cannot run inside the published image — use the `/setup` wizard.

## Environment reference

Every variable in [`.env.example`](../.env.example):

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `POSTGRES_PASSWORD` | yes | — | Postgres password; compose creates the database with it. |
| `BETTER_AUTH_SECRET` | yes | — | Auth/session signing secret. Generate: `openssl rand -base64 32`. |
| `JWT_SECRET` | yes | — | Legacy session signing secret — the server refuses to boot without it. |
| `PUBLIC_APP_URL` | no | `http://localhost:3000` | Public origin users will visit (no trailing slash). Set it to your real domain when serving behind a reverse proxy. |
| `PORT` | no | `3000` | Host port to expose the app on. |
| `SKIP_SEED` | no | `true` | `true` = empty database on first start; set `false` only to load demo data. |
| `SETUP_TOKEN` | no | unset | Shared secret for the `/setup` first-run wizard — authorizes setup from any network. Required for remote first-run (see above). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | unset | Outbound SMTP for verification/reset emails. Admin login works without it. |

The compose file also sets `DATABASE_URL` (points at the bundled Postgres), `RUN_MIGRATIONS_ON_START=true` (apply pending migrations on boot), `CACHE_PROVIDER=inmemory`, and `STORAGE_PROVIDER=localfs` (receipt uploads land on the container filesystem) — no extra services, nothing for you to configure.

## Data & backups

- Postgres data lives in the named volume `db-data`.
- Receipt uploads live on the app container's filesystem at `/app/apps/web/storage`. They do **not** survive container recreation unless you mount a volume there (add `./storage:/app/apps/web/storage` under the `app` service's `volumes:` in [`docker-compose.yml`](../docker-compose.yml)).

Back up the database:

```sh
docker compose exec db pg_dump -U debtmaster debtmaster > backup.sql
```

Restore into an empty database (a fresh volume, or drop the schema first — restoring over an existing schema conflicts):

```sh
docker compose down -v            # warning: deletes current data
docker compose up -d db           # start only Postgres
docker compose exec -T db psql -U debtmaster debtmaster < backup.sql
docker compose up -d              # bring the app back (migrations no-op)
```

## Upgrades

```sh
docker compose pull
docker compose up -d
```

Migrations run automatically on start, so an upgrade is pull + recreate; data in `db-data` is untouched.

## PikaPods

A request to list Debt Master on PikaPods (managed hosting, with a 20% revenue share to the project) is being prepared. This section will link the listing once accepted.
