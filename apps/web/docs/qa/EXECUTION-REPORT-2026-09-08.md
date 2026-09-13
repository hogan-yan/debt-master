# Smoke Execution Report — 2026-09-08

**Suite:** [REGRESSION-SUITE.md](./REGRESSION-SUITE.md) Smoke (13 items) · **Verdict: 13/13 PASS** (one PASS on retry — noted below)
**Build:** `develop` @ `0eb9adb` + doc updates; fresh `bun run build`; server `scripts/server.ts` on :3000
**Environment:** local self-host (docker Postgres `postgres-debt-master`, seeded: 23 colleagues / 18 restaurants / ~190 expenses / 65+ payments / 26 access codes / 1 better-auth admin)
**Drivers:** `bun run test:e2e:pw` (auth subset, 9 tests) + [tests/qa/qa-run4.mjs](../../tests/qa/qa-run4.mjs) (money flows, console-error canary, psql reconciliation). Failure evidence: `/tmp/qa-shots/*.png`.

## Results

| # | Case | Result | Notes |
|---|---|---|---|
| 1 | AUTH-001 admin login | PASS | via e2e-pw |
| 2 | AUTH-006 colleague code login | PASS | flaked on cold server first run (see O-3) |
| 3 | AUTH-002/003, 007/008/009, 010/011, XC-001 | PASS | via e2e-pw (9 tests total) |
| 4 | XC-020 cold-boot canary | PASS | /login, /, /expenses, /payments, /settings — no blank renders, no externalization/hydration console errors |
| 5 | EXP-001 create EQUAL $30, 3 participants | PASS | participant sum = 30.00 verified in DB |
| 6 | EXP-007 receipt upload + viewer | PASS | object stored, modal image renders |
| 7 | PAY-001 record payment (expense mode) | PASS | payment + applications created same day |
| 8 | DSH-001 dashboard totals vs DB | PASS | expense count / paid total present and consistent |
| 9 | COL-009 settled-colleague boundary | PASS | zero-balance colleague shows settled status pill |
| 10 | SET-001 create access code | PASS | code active in DB |
| 11 | PAY-009 → PAY-010 claim → approve | PASS (retry) | claim approved, $10.00 application settles participant 495 (expense 183) |
| 12 | AUTH-018 logout | PASS | |
| 13 | XC-019 reconciliation invariants | PASS | no over-applied expenses, no over-applied payments, no negative colleague balances |

## Findings

**No S1/S2 product bugs.** The money path (create → claim → approve → application → settlement) is correct end-to-end against the live DB, and the reconciliation invariants hold after ~10 smoke-created expenses/payments/claims.

- **O-1 (S4, UX observation) — pending-claim state is per-colleague across expenses.** `approve-claim-workflow` looks up pending claims by (colleague, expense of the participant), but the expense-detail "Pending Approval" section renders a participant as pending whenever the colleague has ANY pending claim — e.g. expense 183 showed Coralie (claim lives on expense 181) and Ms. Welch (on 185). Confirming from the "wrong" expense's row errors honestly ("No pending payment claim found for this participant"). Consistent with the per-colleague duplicate-claim guard, but an admin can reasonably click a Confirm button that can never succeed. Candidate UX polish: scope the pending indicator to the participant's own expense.
- **O-2 (S4, docs) — expense detail URL is singular.** Deep links are `/expense/<id>`; the EXP-018 case previously wrote `/expenses/<id>` (which 404s — itself the branded not-found page, so the case's subject was accidentally verified too). Fixed in [02-expenses.md](./test-cases/02-expenses.md).
- **O-3 (infra, test) — cold-server flake.** The e2e auth spec's 1200 ms hard wait after colleague login loses the race on a cold server (first run after restart); it passes warm. Consider `waitForURL` instead of `waitForTimeout` in `tests/e2e-pw/auth.spec.ts`.
- **O-4 (infra, process) — parallel sessions swap the server mid-run.** A second session rebuilt `dist/` and restarted `scripts/server.ts` twice during execution; a swapped server 307s asset requests → pages never hydrate → every UI case fails at once. If a whole run collapses, check `ps aux | grep server.ts` (PID change) and restart before blaming the build. (Also true: a 2-day-old idle `vite start` on :5173 was ruled out — 0% CPU.)

## QA data left in the local DB (harmless, delete at will)

- ~8 expenses "Adams and Sons Mexican" $30.00 dated 2026-09-07/08, participants = colleague ids 1–3
- Payments incl. one $200.00 with unapplied remainder; claims 66/67/70 now approved
- Access codes `QASMKE*` (active) — deactivate via Settings or:
  `delete from access_codes where code like 'QASMKE%';`
- `JUDebt123!~` is now BOUND to colleague id 1 (was unbound; SET-004 step-3 state changed by the claim flow)

## Follow-ups

1. O-1 pending-indicator scoping → `READINESS-TODO` or UX backlog (mobile not affected).
2. O-3 replace hard waits in the e2e auth spec (test-infra chore).
3. Continue the full P0 pass (next session: PAY-002…005, EXP-002…006, COL-005/007, GRP-style destructive cases, 2FA on staging).
