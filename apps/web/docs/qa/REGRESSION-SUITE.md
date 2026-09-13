# Regression Suite — Debt Master Web

**Execution order matters:** Smoke → P0 → P1 → P2 → exploratory. If any Smoke case fails, stop and fix the build before continuing.
**Release gate:** 100% P0 pass, ≥ 90% P1 pass, no Critical/High bugs open, money reconciliation (XC-019) clean.
**Case IDs** live in the [test-cases/](./test-cases/) files. Estimated total: Smoke 25 min, P0 ~90 min, P1 ~120 min, P2 ~90 min.

## Suite composition

| Area | File | Cases |
|---|---|---|
| Auth, sessions, setup, reset, 2FA | [01-auth-sessions.md](./test-cases/01-auth-sessions.md) | AUTH-001…033 |
| Expenses | [02-expenses.md](./test-cases/02-expenses.md) | EXP-001…022 |
| Payments, claims, proofs | [03-payments-claims.md](./test-cases/03-payments-claims.md) | PAY-001…023 |
| Colleagues | [04-colleagues.md](./test-cases/04-colleagues.md) | COL-001…012 |
| Restaurants | [05-restaurants.md](./test-cases/05-restaurants.md) | RST-001…009 |
| Dashboard + settings/security | [06-dashboard-settings-security.md](./test-cases/06-dashboard-settings-security.md) | DSH-001…011, SET-001…008 |
| Analytics telemetry + theme | [07-analytics-theme.md](./test-cases/07-analytics-theme.md) | ANL-001…002, THM-001 |
| Cross-cutting | [08-cross-cutting.md](./test-cases/08-cross-cutting.md) | XC-001…022 |

## Smoke (daily, 25 min, every deploy)

1. AUTH-001 admin login
2. AUTH-006 colleague access-code login
3. XC-001 route authorization (admin vs colleague vs signed-out)
4. EXP-001 create expense (EQUAL)
5. EXP-007 receipt upload + view
6. PAY-001 record payment for one expense
7. PAY-009 → PAY-010 claim submit + approve
8. DSH-001 dashboard stats match DB
9. COL-009 balance boundary (settled colleague shows settled)
10. SET-001 create access code
11. AUTH-018 logout
12. XC-019 money reconciliation sweep
13. XC-020 cold-boot render canary (BUG-001 regression)

## P0 — release blockers (every release)

- **Auth:** AUTH-002, 005, 007, 008, 010, 011, 012, 014, 015, 016, 022, 023, 024, 025, 027, 029
- **Expenses:** EXP-001, 002, 005, 007, 009, 012, 013, 017
- **Payments:** PAY-001, 003, 004, 007, 009, 010, 011, 020, 022, 023
- **Colleagues:** COL-005, 007, 009
- **Restaurants:** RST-005
- **Cross-cutting:** XC-002, 003, 004, 005, 019, 020

## P1 — major features (weekly / before release)

- **Auth:** AUTH-009, 013, 017, 020, 021*, 026, 028, 030, 032 (*documents the accepted deactivated-code session gap)
- **Expenses:** EXP-006↔(P2), EXP-008, 010, 011, 014, 015, 016, 018, 019, 022
- **Payments:** PAY-005, 006, 012, 013, 015, 016, 017, 018
- **Colleagues:** COL-002, 003, 006, 008
- **Restaurants:** RST-006, 009
- **Dashboard/settings:** DSH-002, 003, 004, 006, 009, 010; SET-001, 002, 005, 007
- **Cross-cutting:** XC-007, 008, 010, 015, 017, 018, 021, 022; THM-001

## P2 — standard/edge (per release, or on touch)

- AUTH-004, 019, 031 · EXP-003, 004, 006, 020, 021 · PAY-002, 008, 014, 019, 021 · COL-001, 004, 010, 011, 012 · RST-001, 002, 003, 004, 007, 008 · DSH-005, 007, 008, 011 · SET-003, 004, 006, 008 · ANL-001, 002 · XC-006, 009, 011, 012, 013, 014, 016

## Targeted regression (30–60 min, after a change)

| Change touches | Run |
|---|---|
| Expense create/edit/delete or splits | EXP-001…017, PAY-006, DSH-001, XC-019 |
| Payment/claim logic | PAY-001…018, EXP-013, DSH-006, XC-019 |
| Storage / receipts / proofs | EXP-007…010, PAY-007, PAY-019, PAY-022, XC-003, XC-004 |
| Auth / session / cookies | whole 01 file + XC-001, XC-002 |
| Access codes | SET-001…004, AUTH-006…011, PAY-022, XC-003 |
| Dashboard | DSH-001…011, COL-009 |
| i18n / styling | XC-008, 009, 012 + touched screens' UI cases |
| Brand tokens / design-system change (e.g. 2026-09-07 teal, radius, card shadow) | [TARGETED-2026-09-07-brand-teal-i18n.md](./TARGETED-2026-09-07-brand-teal-i18n.md) + XC-012 |

## Exploratory charters (30–60 min per release)

1. "Break the money": race claims against payments; edit while approving; find any 0.01 drift.
2. "Colleague day": do everything a colleague can do; try everything they shouldn't.
3. "Fresh boot": empty DB → setup → first expense → first payment → first claim, end to end.

## Maintenance

- After each release: add a case for every bug found (its regression test), refresh seed data, re-check the automation map in [TEST-PLAN.md](./TEST-PLAN.md) §6 — anything automated (Playwright migration landing) moves out of the manual suites.
- Review the suite monthly: delete obsolete cases, re-prioritize from production incidents.
