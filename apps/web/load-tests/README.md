# Load Tests (k6)

Performance suite for the web app (`apps/web`). Targets the SSR pages — each
request exercises the React tree + Prisma round-trip — plus the cheap
`/health` probe. Mobile/Supabase is out of scope (no HTTP surface we own).

## Install k6

```bash
brew install k6        # macOS
# or: docker run --rm -i grafana/k6 …
```

## Tests

| Script        | Pattern | Use |
| ------------- | ------- | --- |
| `smoke.js`    | 1 VU / 30s | Sanity check + per-page baselines |
| `journey.js`  | ramp 10 → 20 VUs | Realistic browse; authed walk when cookie set |
| `stress.js`   | tiers 25 → 150 VUs | Find the breaking point |
| `spike.js`    | 10 → 100 in 15s | Sudden surge (landing linked, push aftermath) |
| `soak.js`     | 10 VUs / 30m (env-extendable) | Leaks, pool exhaustion |

## Run

```bash
# Local dev stack (scripts/server.ts on :3000)
k6 run load-tests/smoke.js

# Dev deployment
BASE_URL=https://<dev-host> k6 run load-tests/journey.js

# Authenticated journey — paste a Cookie header from a logged-in browser tab.
# Login itself is NOT scripted (Turnstile protects it; a replayed login would
# only measure the captcha).
SESSION_COOKIE="better-auth.session_token=…" BASE_URL=https://<dev-host> k6 run load-tests/journey.js
```

Only load environments you own: local, dev, or a dedicated staging clone.
Never point these at production.

## Analyze

```bash
k6 run --out json=results.json load-tests/journey.js
node load-tests/analyze-results.js results.json
```

Prints a request/p95/p99/error summary, exits 1 outside the limits
(p95 < 800ms, p99 < 1500ms, errors < 1% — tuned for a single small pod).

## CI

`.github/workflows/load-tests.yml` is `workflow_dispatch`-only: pick a test
and target URL, results upload as an artifact. (Repo CI currently has the
hosted-lane billing issue — run locally until that's resolved.)

## Baseline

Record each baseline here after a run so regressions have a reference.

| Date | Target | Test | p95 | p99 | Error rate | Notes |
| ---- | ------ | ---- | --- | --- | ---------- | ----- |
| 2026-09-16 | local (bun + docker Postgres, warm) | smoke | 56.5ms | 167.9ms | 0% | First hit per page ~125–170ms (JIT/cache warmup); steady-state med ~4ms |
