# P0 Full Pass Execution Report — 2026-09-08

**Scope:** the complete P0 tier ([REGRESSION-SUITE.md](./REGRESSION-SUITE.md)) — smoke items plus every P0 case not already automated. Follows the smoke pass of the same day ([EXECUTION-REPORT-2026-09-08.md](./EXECUTION-REPORT-2026-09-08.md)).
**Build:** `develop` @ `0eb9adb` + doc updates, fresh `bun run build`, `scripts/server.ts` on :3000
**Verdict: P0 tier GREEN.** 22/22 driver cases + 6/6 setup-wizard checks + 9/9 e2e-pw auth tests + 13/13 smoke. **Zero S1/S2 findings.**

**Drivers:** [tests/qa/qa-run5-p0.mjs](../../tests/qa/qa-run5-p0.mjs) (admin + bound-colleague contexts, server-fn replay, DB assertions; each case retries once) and `bun run test:e2e:pw`. Failure evidence in `/tmp/qa-shots/`.

## Results by area

| Area | Cases | Result |
|---|---|---|
| Money — expenses | EXP-002 (10/3 rounding), 005 (itemized), 009 (edit rebalances 11.00), 012/013 (delete ± payments), 017 (list state survives remote mutation) | PASS |
| Money — payments | PAY-003 (0/negative rejected), 004 (distribution ≥2 expenses), 007 (proof stored), 011 (double-approve replay fails cleanly), 020 (delete removes proof), 022 (foreign proof denied) | PASS |
| Colleagues | COL-005 (soft delete w/ data → `deleted_at` set, history intact), 007 (permanent delete guarded), 009 (settled boundary — smoke) | PASS |
| Restaurants | RST-005 (delete blocked with expenses via native confirm; empty deletes) | PASS |
| Security | XC-002 (colleague + anonymous replay of admin mutation → rejected), XC-003 (foreign receipt 403-class), XC-004 (noSig 403 / tamper 403 / anon 401 / traversal 403), XC-005 (XSS payload renders as text — screenshot evidence), PAY-022 | PASS |
| Auth | AUTH-005 (login rate limit engages), AUTH-025 (generic forgot-password response), AUTH-029 (2FA enable → TOTP login challenge → disable), AUTH-022/023 (setup wizard: renders re-armed, wrong/empty token rejected, correct token creates admin + dashboard landing, wizard locks after) | PASS |
| Smoke (same day) | 13 items incl. XC-019 reconciliation, XC-020 canary | PASS |

DB verification used throughout: participant sums, application targets, `deleted_at` semantics, proof object keys, `ai_usage` n/a here. XC-019 invariants re-run at end: clean.

## Skip ledger (environment-limited — staging items, not silent gaps)

| Case | Reason | Where it can run |
|---|---|---|
| AUTH-012 | No Turnstile keys locally | Staging (keys configured) |
| AUTH-014/015/016 | `AUTH_PROVIDER=better-auth` locally; Authentik not reachable | Staging second pass |
| AUTH-024 | Public-network setup refusal not reproducible on localhost | Staging with public URL |
| AUTH-026/027/028 (email arrival + token round-trip) | No SMTP locally; generic-response half verified (AUTH-025) | Staging SMTP sandbox |

## Findings

**No S1/S2.** Money math verified end-to-end to the DB row in every case; destructive paths all guard or cascade cleanly.

- **O-1 (S4, UX, carried from smoke)** — expense-detail "Pending Approval" shows a colleague's pending state on all their expenses; Confirm from a row whose claim lives elsewhere toasts "No pending payment claim found for this participant". Consistent with the per-colleague single-pending-claim guard; candidate for per-expense scoping.
- **O-4 (S4, UX, new)** — restaurant delete uses a **native `confirm()`** while every other destructive flow uses styled dialogs. Works, but inconsistent; also untestable via custom-dialog conventions.
- **O-5 (infra, new)** — hydration-race class: SSR-rendered buttons clicked before React attaches handlers are silent no-ops under load (no POST fired). Driver now clicks → polls DB → re-clicks. Worth knowing for any future Playwright work; not user-visible on warm pages.
- **O-6 (product behavior verified, positive)** — unapplied prepayments auto-apply to newly created expenses (new rows can render "Fully Paid" on creation when the participant holds credit). Matches PAY-006/auto-apply design; anyone hand-testing should expect it.

## QA data left in the local DB

Access codes `QASMKE*` (active) · ~12 expenses "Adams and Sons Mexican" $9–$33 dated Sep 7–8 · payments incl. $99,999/$8,888/$200 with unapplied credit (Coralie Jacobi now holds large credit — this is what powers the auto-apply observations) · colleagues `QA Vanish *` (one soft-deleted) · restaurant `QA Empty *` created-then-deleted · admin row restored via `scripts/create-admin.ts` (2FA off). Nuclear cleanup: re-run `bun prisma/seed.ts` after truncating app tables — or leave as-is (local dev DB).

## Follow-ups

1. Staging pass for the four env-skipped rows above.
2. O-1/O-4 UX notes → backlog.
3. O-5: consider a `waitForHydration()` helper (e.g. wait for a data-hydrated attribute) if Playwright coverage grows.
