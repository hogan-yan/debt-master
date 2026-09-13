# Debt Master — web app

Self-hosted expense tracking for admins and colleagues. TanStack Start (React 19) + Prisma 7 + Bun, with better-auth for admin login and Paraglide for i18n.

Last verified: 2026-09-05

## Quickstart

```sh
bun install
cp .env.example .env          # then set DATABASE_URL at minimum
bun run prisma:generate
bun run prisma:migrate        # dev migration against your local Postgres
bun run prisma:seed           # optional demo data
bun run dev
```

The app boots with zero external services: `STORAGE_PROVIDER=localfs` and an in-memory cache are enough for development. MinIO and Valkey are production-grade swaps behind the same interfaces (see [Provider knobs](#provider-knobs)).

Create the first admin with the setup wizard on first launch, or headlessly:

```sh
bun run create:admin
# or reset a lost admin password directly against the DB:
bun run reset:admin-password -- --email admin@example.com --new-password 'Str0ng!Pass'
```

## Provider knobs

Three swappable backends, each resolved through a factory in `src/server/infrastructure/` and validated in [`src/server/infrastructure/config.ts`](./src/server/infrastructure/config.ts):

| Knob | Values (default first) | Adapter seam |
|---|---|---|
| `AUTH_PROVIDER` | `better-auth`, `authentik` | `infrastructure/auth/` |
| `STORAGE_PROVIDER` | `minio`, `localfs` | `infrastructure/storage/` (`StorageAdapter`) |
| `CACHE_PROVIDER` | `inmemory`, `valkey` (auto: `valkey` in production or when any `VALKEY_*` var is set) | `infrastructure/cache/` (`CacheAdapter`) |

All environment variables and dev defaults are listed in [`.env.example`](./.env.example).

## Architecture

- **Server function handlers** are thin: auth → Zod validation → `prisma.$transaction(workflow)` → post-commit side effects (MinIO cleanup, cache invalidation). Business logic lives in `src/server/<domain>/workflows/` with pure functions that take `Prisma.TransactionClient` plus injected deps. The full contract (transaction boundaries, lock ordering, test pattern) is in [`AGENTS.md`](../../AGENTS.md) — read the "Architecture Patterns" section before adding a handler.
- **Money** uses `Prisma.Decimal` in the database and is serialized once at the edge (`src/server/utils/decimal.ts`); balance math is float-based today and acknowledged legacy — new money code belongs in `@debtmaster/core` (`packages/core`), not in this app.
- **Routes** (`src/routes/`) are TanStack Router file routes; shared table/search/pagination UI lives in `src/components/ui/`.
- **i18n** is Paraglide (`project.inlang/`, messages compiled into `src/paraglide/` — never hand-edit). Run `bun run i18n:check` after touching strings.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` / `build` / `start` | Vite dev server, production build (compiles Paraglide first), production server |
| `bun run typecheck` | `tsc --noEmit` (compiles Paraglide first) |
| `bun run typecov` | type-coverage gate, ≥99.5% (same pattern as mobile's 99.9% gate) |
| `bun run lint` | Biome check |
| `bun run test` | Unit/component suite (mocked, no DB) |
| `bun run test:coverage` | Unit suite with v8 coverage thresholds (see `vitest.config.ts`) |
| `bun run test:integration` | Real-DB integration tests; needs `RUN_INTEGRATION_TESTS=1` + migrated Postgres |
| `bun run test:e2e` | Playwright-based smoke scripts (`tests/e2e/run-smoke.ts`); needs a running dev server + seeded DB |
| `bun run knip` | Dead-code gate (files/dependencies/unresolved imports; unused-export rules off until backlog burns down) |
| `bun run i18n:check` | Translation parity across locales |
| `bun run prisma:*` | generate / migrate / studio / seed |

CI (`.github/workflows/ci-cd.yml`, `test-web` job) runs: typecheck, lint, i18n check, unit tests, integration tests against a Postgres service, then the typecov, coverage, and knip gates.

## Deployment

Docker image builds from the repo-root [`Dockerfile`](../../Dockerfile); CI publishes to ghcr.io and deploys on main (self-hosted runner). The container entrypoint (`scripts/entrypoint.sh`) runs `prisma migrate deploy` on boot when `RUN_MIGRATIONS_ON_START=true` (docker-compose sets it; the default is `false` — in k8s the migrate init container owns schema). Runtime config is environment-only — see `.env.example` for the full surface.
