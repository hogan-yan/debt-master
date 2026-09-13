# Debt Master Web — QA Test Plan

**Scope:** `apps/web` (self-hosted expense tracking: expenses, payments, colleagues, restaurants, dashboard, admin auth + colleague access codes, 2FA, audit log).
**Version:** 1.0 · **Created:** 2026-09-05 · **Owner:** QA
**Related:** [Test cases](./test-cases/) · [Regression suite](./REGRESSION-SUITE.md)

Last verified: 2026-09-05

## 1. Scope

**In scope**

| Area | Surfaces |
|---|---|
| Admin auth | better-auth email/password login, Authentik OAuth, 2FA (TOTP), password reset, email verification flag (`ENABLE_EMAIL_VERIFICATION`), setup wizard |
| Colleague auth | access-code login, session cookies, rate limiting, Turnstile |
| Expenses | create/edit/duplicate/delete, EQUAL + ITEMIZED splits, receipts (upload/replace/remove/view), list (search/filter/sort/pagination), detail |
| Payments | record payment (PAYME/FPS/CASH/OTHER), smart distribution across expenses, proofs, colleague claims (submit/approve/undo), bulk claim, unapplied funds, auto-apply, payments list (search/sort/pagination) |
| Colleagues | create/edit/soft-delete/restore/permanent-delete, detail balances + history |
| Restaurants | CRUD, per-restaurant expense views, dashboard tab |
| Dashboard | stats cards, debt charts + leaderboard, balance distribution, participation, who-owes, spending tab, onboarding checklist, recent activity, pending payments |
| Settings | access-code manager, security panel (password, sessions), 2FA panel, audit log viewer |
| Cross-cutting | i18n (en/ja/zh/zh-tw; zh is a partial locale — silent en fallback, unguarded by the parity test), dark mode/theme, analytics telemetry (Umami), a11y, responsive, browser matrix, file uploads, error/empty/loading states, security controls |

**Out of scope:** `apps/mobile`, `packages/core` (covered by their own suites), infrastructure pen-testing beyond the listed security cases.

## 2. Strategy

Layered per the repo's existing automation (3,690 unit/component tests, coverage-gated; integration tests run in CI against Postgres; Playwright e2e smoke for auth paths via `bun run test:e2e:pw` — `tests/e2e-pw/` — plus a legacy 23-spec custom-runner suite `bun run test:e2e`; cross-screen money flows have no e2e yet):

1. **Automated (already exists):** unit/component suites run on every PR; CI also runs integration handler tests against Postgres. QA does not re-execute these by hand.
2. **Manual functional (this plan):** anything a human observes better than a mocked test — real file uploads, real emails, real browser rendering, cross-screen money consistency, i18n rendering.
3. **Regression suite:** [REGRESSION-SUITE.md](./REGRESSION-SUITE.md) — Smoke daily, P0/P1/P2 per release.
4. **Exploratory:** 30–60 min per release, focused on money totals and concurrent edits.

Because e2e automation is absent, the manual suites below **are** the release gate until the Playwright migration lands.

## 3. Environments

| Env | Purpose | Notes |
|---|---|---|
| Local dev (`bun run dev`) | Case development, cheap iteration | `STORAGE_PROVIDER=localfs`, in-memory cache, `TEST_ADMIN_ACCESS_CODE` available (dev only), Turnstile off |
| Self-host staging | Full regression | MinIO + Valkey, Turnstile configured, SMTP sandbox, `AUTH_PROVIDER=better-auth`; second pass with `authentik` |
| Production-like data volume | Performance baselines | ≥ 5,000 expenses, ≥ 50 colleagues, ≥ 200 payments seeded |

**Browsers (last 2 majors):** Chrome, Firefox, Safari, Edge. **Viewports:** 1920, 1280, 768, 375.

**Test accounts**

| Account | Role | Used for |
|---|---|---|
| `admin@test.local` (better-auth) | Admin | Most cases |
| Authentik test user | Admin (OAuth) | AUTH-1xx OAuth cases |
| Access code bound to colleague A | Colleague | PAY claim cases, storage scoping |
| Access code unbound | Colleague | Legacy-access + scoping-negative cases |
| Deactivated + soft-deleted codes | Colleague | AUTH negative cases |

**Seed data:** ≥ 3 restaurants, ≥ 4 colleagues, expenses in every state (unpaid, partial, paid), one pending claim, one payment with proof, one colleague with exactly 0 balance. `prisma/seed.ts` covers colleagues/restaurants/expenses/payments/receipt flags, but **colleague claims are NOT seeded** — create one via PAY-009 before running claim-dependent cases (DSH-006, PAY-010/011/014, XC-018), and XC-015's 5k volume rows are not seeded either (see its precondition SQL).

## 4. Entry / exit criteria

**Entry:** build deployed to target env; migrations applied; CI unit + coverage + integration gates green; seed data loaded; test accounts provisioned.

**Exit (release gate):** all Smoke pass; 100% of P0 pass; ≥ 90% of P1 pass with no critical/high bugs open; every money-total check consistent with the database; no new Critical/High severity bugs.

## 5. Risks (drive the priorities)

| Risk | Why | Mitigation in plan |
|---|---|---|
| Float balance math (legacy) | Rounding drift across expenses × applications | EXP/PAY total-consistency cases + DB reconciliation checks |
| Cache staleness (300s TTL, two domains) | Stale stats/amounts after mutations | Post-mutation freshness cases in every area |
| Untested-against-Postgres paths (locks, permanent delete, bulk claim) | Concurrency + cascade behavior unproven | PAY/COL concurrent + destructive cases marked P0/P1 |
| Storage authz is new | Receipt/proof scoping logic fresh, unproven in prod | XC security cases (bound vs unbound codes, signed URLs) |
| Playwright e2e covers auth smoke only | Cross-screen money flows have no e2e | Manual suite is the release gate for money flows; smoke suite mandatory before any deploy |
| Colleague-facing surface | Colleagues hit states admins never see | Every area has at least one colleague-session case |

## 6. Automation vs manual map

| Layer | Automated today | Manual |
|---|---|---|
| Business logic (workflows) | Yes, mocked tx (unit) + partial Postgres (CI) | Only concurrency scenarios |
| UI components | Yes (jsdom + testing-library) | Visual/visual-state checks only |
| Playwright e2e | Auth smoke subset (`test:e2e:pw`), CI-gated in `ci-cd.yml`: AUTH-001/002/003/006/007/008/009/010/011 + XC-001 | QA may skip re-running these by hand; spot-check on release only. The legacy 23-spec `tests/e2e/` suite (`test:e2e`) is NOT CI-gated — on-demand only, do not count it as a gate |
| Cross-screen money consistency | No | **Yes — P0 reconciliation cases** |
| File uploads (real files, MIME, compression) | Partial (validation mocked at boundaries) | **Yes** |
| Email flows (SMTP) | No | **Yes** (password reset) |
| OAuth (Authentik) | No | **Yes** |
| i18n rendering, a11y, browsers | One axe file only | **Yes** |

## 7. Bug reporting

Follow the repo QA standard: title `[Feature] issue when [action]`; exact repro steps; environment (browser, viewport, account type, build/commit); expected vs actual; evidence (screenshot + console). Severity: Critical = data loss/money wrong/security hole; High = major feature broken, no workaround; Medium = workaround exists; Low = cosmetic.
