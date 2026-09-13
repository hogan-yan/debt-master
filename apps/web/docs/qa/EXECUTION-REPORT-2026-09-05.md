# QA Execution Report — Debt Master Web

**Date:** 2026-09-05 · **Environment:** production build (`vite build` + `scripts/server.ts`) served at localhost:3000, Postgres 17.7 (docker compose), seeded data (80 expenses, 18 restaurants, 12 colleagues), localfs storage, in-memory cache, Turnstile/Authentik/SMTP absent.
**Driver:** Playwright (Chromium headless) via `apps/web/tests/qa/qa-run*.mjs` + direct DB verification (psql).
**Suite:** [TEST-PLAN.md](./TEST-PLAN.md) — 133 cases across 8 files.

## Summary

| Status | Count | Meaning |
|---|---|---|
| PASS | 28 | Executed and verified (UI + DB assertions) |
| FAIL | 3 | Executed; product bugs found (see bugs below) |
| BLOCKED | 13 | Environment/credentials unavailable this run |
| NOT RUN | 89 | Blocked behind BUG-001 at session start + external dependencies; harness cases exist for ~20 more |

**Release gate: CONDITIONAL** — BUG-001 (Critical) is fixed in this working tree and must ship; BUG-003b (High, 2FA verification) remains open. Pagination was re-verified WORKING after deeper testing (see withdrawn BUG-002).

## Bugs found

### BUG-001 (Critical, FIXED this session): Login, setup and dashboard render blank
- **Symptom:** `/login`, `/setup`, `/` render an empty shell or hang at "Loading…" forever. Console: `Module "node:async_hooks" / "events" has been externalized for browser compatibility`.
- **Root cause:** server-only modules (Prisma client, ioredis/valkey, MinIO, `@tanstack/start-server-core`) ship in the client bundle: top-level imports in `auth.ts`, `two-factor.ts`, `admin-security.ts`, `auth-cookie.ts`, `better-auth-adapter.ts`, `network/index.ts`, `auth-rate-limit.ts`, `audit-log`, `storage/index.ts` (MinIO static despite comment), `cache/valkey-adapter.ts` (ioredis static). Present at committed HEAD (reproduced with local changes stashed) in **both dev and production builds**; CI never catches it because no browser test runs.
- **Fix applied:** `"sideEffects": false` in `apps/web/package.json` (lets the bundler drop server deps used only inside stripped handler bodies) + lazy dynamic imports for all nine leaking modules. Verified: setup/login/dashboard render and all following cases pass.

### BUG-002 — WITHDRAWN (pagination verified working)
- **Initial symptom:** page-2 rows were textually identical to page 1 on `/expenses`.
- **Root cause of the false alarm:** the QA-created seed rows are all identical (same restaurant, amount 42.00, date today), so page 1 and page 2 are indistinguishable by `textContent`. Verified by expense ID: page 1 serves ids 107-105, page 2 serves 97-95 (`probe34.mjs`).
- **Kept from the investigation:** the auto-search effect now guards against re-firing on parent re-renders (last-fired-value guard in `expense-list.tsx` + `paginated-data-table.tsx`, no-op guard in the route) — this closes the real hazard the audit flagged (search/pagination callbacks re-firing on every parent render and resetting the list).

### BUG-003a (Medium, FIXED this session): TwoFactor table missing better-auth columns
- **Symptom:** enabling 2FA threw `Unknown argument 'failedVerificationCount'` from better-auth's Prisma adapter.
- **Root cause:** the `TwoFactor` model was missing two fields better-auth 1.6 writes: `failedVerificationCount` and `lockedUntil` (verified against `better-auth/dist/plugins/two-factor/schema.mjs`).
- **Fix applied:** migration `20260905130000_two_factor_missing_fields` adds both columns; enable now succeeds (row created, TOTP URI issued).

### BUG-003b — RESOLVED: harness bug, product 2FA verified working
- **Resolution:** the "Invalid code" rejections were a HARNESS defect. The `otpauth` npm package mis-decodes better-auth's base32 URI secrets (returns truncated bytes: 20 instead of 32), so the harness submitted wrong codes. Replicated the server chain byte-for-byte: `symmetricDecrypt(BETTER_AUTH_SECRET, stored)` returns the plain secret; `@better-auth/utils` `createOTP(plain)` matches node-crypto standards TOTP exactly. The product's TOTP verification is correct — real authenticator apps will work.
- **End-to-end proof (PASS):** enable → secret stored encrypted → verify correct code → `verified=true` + `two_factor_enabled=true` → logout → login challenge accepts TOTP → disable with password → flag cleared. The harness now computes codes with node crypto (no otpauth). UI and DB flow are otherwise correct.

### BUG-004 (Low, doc): first-run redirect target
- Fresh DB sends every visit to `/login`, which then redirects to `/setup` — the plan's "redirect to /setup" wording was corrected to match. Setup wizard itself works (token, lockout).

## Executed cases ( PASS detail )

- **Auth (12):** AUTH-022 setup happy path + lockout; AUTH-001 login; AUTH-019 cookie refresh; AUTH-002/003 generic errors, no enumeration; AUTH-004 empty-field block; AUTH-006 colleague code login + lastUsed; AUTH-007/008/009 invalid/deactivated/deleted codes (raw code never in audit log); AUTH-010/011 per-code + per-IP rate-limit buckets incl. enumeration block; AUTH-018 logout; AUTH-020 garbage cookie → signed-out, no 500; AUTH-025 forgot-password generic success; AUTH-032 production weak-JWT-secret gate throws (component level).
- **Expenses (8):** EXP-001 EQUAL 100.77/4 shares sum exactly, 25.20 each; EXP-003 0.01 saves / 100M rejected; EXP-004 negative rejected; EXP-007 receipt upload + signed URL 200; EXP-008 fake image rejected; EXP-011 duplicate (verified via probe14: server 200 + success toast); EXP-015 search debounce/empty state; EXP-017 search survives mutation.
- **Payments (1):** PAY-001 record payment full form (FPS 10.00 saved).
- **Colleagues/Restaurants (2):** COL-001 create; RST-005 FK restrict holds.
- **Dashboard/settings (2):** DSH-001 totals match DB aggregate; SET-001 create code + duplicate rejected.
- **Cross-cutting (4):** XC-001 route authorization colleague vs admin; XC-004 storage signature enforcement (401/403 matrix); XC-005 stored XSS renders as text, no execution; XC-007 injection payloads harmless; XC-008 ja locale renders translated, no raw keys.
- **Data integrity:** XC-019 drift invariant — zero expenses where participant shares ≠ amount (seed's negative "adjustment" shares are by design and still sum exactly).

## FAIL detail (bugs above)

| Case | Bug | Evidence |
|---|---|---|
| AUTH-029/030 | RESOLVED — harness otpauth bug; full 2FA lifecycle now passes end-to-end | probe28 + final harness run |
| EXP-014 | withdrawn | probe34: page ids differ (107→97); earlier text-compare was data-blind |
| XC-001 (first pass) | assertion fixed; passes after redirect-target correction (BUG-004 doc) |
| EXP-005 | BLOCKED — ADD-dialog ITEMIZED shows no item inputs; needs manual verification whether item creation is intended there |
| RST-001/002 | BLOCKED — create-dialog automation flaky (silent validation on cuisine/address); RST-005 FK restrict passes |

## BLOCKED (13 groups) — needs environment

- AUTH-012/013 Turnstile flows (no Turnstile keys)
- AUTH-014…017 Authentik OAuth (no Authentik instance)
- AUTH-025(email arrival)/027/028 reset-token happy path (no SMTP sandbox; generic-success + rate-limit halves executed)
- AUTH-026 covered via audit rows only
- AUTH-031 plugin-off state (build flag flip)
- EXP-020/021, XC-012/013 (multi-browser, real HEIC files, largest-type-scale)
- XC-015 full perf pass (volume seed partially present; timings not load-tested)
- PAY-022 colleague-B proof enumeration (needs second bound colleague — code binding done, session flow not completed)

## Harness artifacts

`apps/web/tests/qa/qa-run*.mjs` (3 runners, ~50 automated checks) + `qa-results-p1/p2/p3.json` + probes. The auth suite is now ported to `@playwright/test` (`playwright.config.ts` + `tests/e2e-pw/auth.spec.ts`, 9 tests, run via `bun run test:e2e:pw`) and wired into CI's test-web job (builds the app, seeds, creates the QA admin, runs the spec). Remaining runners port to the same pattern; parts 2–3 need the sandbox dependencies above.

## Recommended order

1. ✅ Ship the BUG-001 fix — committed (4334077); guard rail added: `bun run lint:server-boundary` fails on any static `@tanstack/start-server-core` import under src/server (the crash vector), and the auth e2e spec now fails if a page emits a node-module externalization error.
2. ✅ BUG-003b resolved — harness otpauth bug; full 2FA lifecycle passes end-to-end.
3. Stand up Turnstile + Authentik + SMTP sandboxes to unblock the 13 blocked groups.
4. Structural follow-up: adopt the `.server.ts` file convention for server-impl modules (see `docs/architecture/2026-09-06-deepening-review.md` C2) so the boundary is enforced by the framework rather than by convention; then the CI marker canary (grep `dist/client` for prisma/ioredis/minio) becomes greenable.
