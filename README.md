# Debt Master

Self-hosted expense splitting for groups of colleagues — track shared lunches and expenses, see who owes whom, and settle up. TanStack Start (React 19) + Prisma 7 + Bun, with better-auth for admin login, colleague access-code login, and Paraglide for i18n.

## Features

- Expense splitting with colleagues — share expenses and let the app track each member's balance
- Payment tracking — record and confirm repayments between members
- Receipt uploads — attach receipt photos to expenses
- Admin + colleague access — password admin login (better-auth) and lightweight access-code login for colleagues, with optional 2FA for admins
- First-run setup wizard — walk through initial configuration at `/setup`
- i18n — English, 日本語, 繁體中文 (Paraglide)
- Swappable infrastructure — storage (localfs / MinIO), cache (in-memory / Valkey), auth (better-auth / Authentik) are all resolved through one factory and validated at boot
- Single-container self-hosting — one image, Postgres included via docker-compose; k8s manifests under `deploy/k8s/`

## Screenshots

> TODO(owner): add screenshots of the dashboard, expense list, and payment tracking views before announcing the repo.

## Quickstart (Docker)

The provided `docker-compose.yml` starts two services: `db` (Postgres 17) and `app` (the prebuilt image from GHCR).

```sh
git clone https://github.com/hogan-yan/debt-master-web.git
cd debt-master-web
cp .env.example .env
```

Set the three required values in `.env`:

| Variable | Why |
|---|---|
| `POSTGRES_PASSWORD` | Password for the Postgres container |
| `BETTER_AUTH_SECRET` | Signing secret for admin sessions |
| `JWT_SECRET` | Signing secret for colleague sessions (required in production) |

Then:

```sh
docker compose up -d
```

Open `http://localhost:3000` (override with `PORT` / `PUBLIC_APP_URL`). The app runs migrations on start. Create the first admin through the setup wizard at `/setup` — set `SETUP_TOKEN` in `.env` if the instance is reachable from non-local addresses.

Uploads persist on the container filesystem (`STORAGE_PROVIDER=localfs`); mount a volume at `/app/apps/web/storage` on the `app` service to keep them across recreation. Database data lives in the `db-data` volume.

### Variants

- `docker-compose.dev.yml` — builds the app image from source and adds Valkey + MinIO services (production-grade provider stack).
- Source development — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Environment variables

Copy `.env.example` to `.env`. Every variable is optional unless marked; provider knobs are validated (with defaults) at boot in `apps/web/src/server/infrastructure/config.ts`.

| Group | Variables | Notes |
|---|---|---|
| Core | `DATABASE_URL` **(REQUIRED)** | Postgres connection string |
| Runtime | `NODE_ENV`, `PORT`, `PUBLIC_APP_NAME` | App display name used in auth emails and 2FA flows |
| Admin auth | `AUTH_PROVIDER` (`better-auth` / `authentik`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_PROXIES`, `AUTHENTIK_BASE_URL`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_REDIRECT_URI`, `AUTHENTIK_SCOPE` | `authentik` values only used when `AUTH_PROVIDER=authentik` |
| Legacy JWT sessions | `JWT_SECRET`, `JWT_EXPIRY_DAYS` | Colleague access-code sessions |
| Email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ENABLE_EMAIL_VERIFICATION` | |
| Object storage | `STORAGE_PROVIDER` (`minio` / `localfs`), `LOCALFS_ROOT_DIR`, `LOCALFS_BUCKET`, `LOCALFS_PUBLIC_BASE_URL`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | `localfs` serves files through the cookie-gated `/api/storage/` route — no MinIO needed |
| Cache | `CACHE_PROVIDER` (`inmemory` / `valkey`), `VALKEY_URL`, `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD` | Unset: auto-selects valkey in production or when any `VALKEY_*` var is set, otherwise in-memory |
| First-run setup | `SETUP_TOKEN` | When set, a matching token authorizes setup from any network; unset, setup works only from private/loopback addresses |
| Hardening | `TRUSTED_PROXY_HOPS`, `ALLOW_UNBOUND_CODE_READ`, `MAX_BODY_SIZE_MB`, `ENABLE_HSTS`, `STORAGE_URL_TTL_SECONDS` | Security headers ship on every response; HSTS is opt-in |
| Seeding | `SEED_ON_START`, `SEED_COLLEAGUE_ACCESS_CODE`, `QA_ACCESS_CODE` | Unset `SEED_ON_START` seeds outside production only; leave unset in production |
| Feature flags | `ENABLE_2FA` | Two-factor auth for admin accounts |
| Captcha | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile |
| Test-only | `RUN_INTEGRATION_TESTS`, `TEST_ADMIN_ACCESS_CODE`, `TEST_SKIP_RATE_LIMIT` | Never set in production |
| Error reporting | `SENTRY_DSN` | Public DSN; without it the SDK is inert. Never a secret |

## Project layout

```
apps/web/           # TanStack Start web app (React 19 + Prisma 7 + Bun)
packages/core/      # Shared money + split math (bigint minor units, zero float)
```

## License

[MIT](./LICENSE)
