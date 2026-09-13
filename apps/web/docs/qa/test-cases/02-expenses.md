# Test cases — Expenses

**Common preconditions:** admin session on `/expenses` unless stated; seed: restaurant "R1", colleagues A, B, C, D; colleague-session cases noted.

---

## EXP-001: Create expense — EQUAL split, even division
**Priority:** P0 **Type:** Functional
1. Add expense: today, R1, amount 100.00, EQUAL, participants A+B+C+D. **Expected:** expense saved; each participant owes exactly 25.00; success toast with formatted amount.
2. Check `/` dashboard "who owes" / colleague balances. **Expected:** A–D balances reflect +25.00 owed each (no drift).

## EXP-002: EQUAL split — indivisible amounts round without drift
**Priority:** P0 **Type:** Functional
1. Create amount 100.00, EQUAL, participants A+B+C. **Expected:** per-participant 33.33/33.33/33.34 (or documented rounding); the three shares sum to exactly 100.00 in DB.
2. Repeat with amount 0.01 and 2 participants. **Expected:** 0.01/0.00 or 0.005-rounding per policy; sum still equals total.

## EXP-003: Create expense — amount boundaries
**Priority:** P1 **Type:** Functional
1. Amount `0.01`, participants A. **Expected:** saved; A owes 0.01.
2. Amount `99999999.99` (max for Decimal(10,2)). **Expected:** saved without error.
3. Amount `100000000.00`. **Expected:** rejected with a validation error, nothing saved.

## EXP-004: Create expense — validation negatives
**Priority:** P1 **Type:** Functional
Each sub-step must show a validation error and save nothing:
1. Missing date. 2. Missing restaurant. 3. Empty amount / non-numeric `abc`. 4. Negative amount `-5`. 5. Zero participants on EQUAL.

## EXP-005: Create expense — ITEMIZED split
**Priority:** P0 **Type:** Functional
1. Split ITEMIZED; add item "Lunch" 40.00 → A, item "Dinner" 60.00 → B; total 100.00. **Expected:** saved; A owes 40.00, B owes 60.00.
2. Make items sum ≠ total (90.00 vs total 100.00). **Expected:** inline validation blocks save (or documented auto-adjust policy) — state which.

## EXP-006: ITEMIZED edge cases
**Priority:** P2 **Type:** Functional
1. Item with price 0.00 assigned. **Expected:** accepted or rejected per validation — no crash; state which.
2. Item with no colleague assigned. **Expected:** blocked before save.
3. An item price with > 2 decimals `9.999`. **Expected:** rounded/rejected per policy; DB value has exactly 2 decimals.

## EXP-007: Receipt upload — happy path
**Priority:** P0 **Type:** Functional
1. Create expense with a 1 MB JPEG receipt. **Expected:** upload succeeds; expense shows a receipt indicator.
2. Open the receipt from the expense row/detail. **Expected:** image renders in the modal from a `/api/storage/...` URL containing `expires` + `signature`.

## EXP-008: Receipt upload — invalid files
**Priority:** P1 **Type:** Functional
1. Attach a 25 MB image (> 20 MB cap). **Expected:** rejected with size message; expense saves without receipt if submitted.
2. Attach a `.gif` / `.pdf`. **Expected:** rejected (mime validation), message shown.
3. Attach a renamed `.exe` as `.jpg`. **Expected:** rejected server-side (magic-byte sniff), not just by extension.
4. Cancel file selection mid-flow. **Expected:** no orphan state; expense saves without receipt.

## EXP-009: Edit expense — change amount on EQUAL split
**Priority:** P0 **Type:** Functional
1. Edit EXP-001 from 100.00 → 60.00. **Expected:** participants recomputed to 15.00 each; old claims/applications handled per business rules (no stale amounts anywhere).
2. Reload the detail page. **Expected:** persisted values match.

## EXP-010: Edit expense — replace and remove receipt
**Priority:** P1 **Type:** Functional
1. Edit: upload a new receipt. **Expected:** old object no longer referenced; new preview shown.
2. Edit: choose "remove receipt", save. **Expected:** indicator gone; object deleted from storage (bucket listing no longer contains it — no orphan).
3. Trigger a save failure after upload (e.g. validation) and re-check storage. **Expected:** the OLD receipt is still referenced by the row and still retrievable (delete happens only after commit).

## EXP-011: Duplicate expense
**Priority:** P1 **Type:** Functional
1. Use "Duplicate" on EXP-001. **Expected:** new expense dated TODAY, same restaurant/amount/split/participants; original untouched; success toast.
2. Duplicate twice quickly (double-click). **Expected:** exactly two copies, not three (double-submit guard).

## EXP-012: Delete expense without related payments
**Priority:** P0 **Type:** Functional
1. Delete an expense with no payments. **Expected:** confirm dialog without payment warning; row removed; colleague balances drop accordingly; stats refresh without stale values (≤ cache TTL).

## EXP-013: Delete expense WITH related payments
**Priority:** P0 **Type:** Functional
1. Click delete on an expense that has applications. **Expected:** warning about related payments shown (also when the lookup previously failed — fail-safe).
2. Confirm delete-with-payments. **Expected:** expense + related data removed per policy; totals reconcile with DB.
3. Cancel. **Expected:** nothing changed.

## EXP-014: Expense list — pagination
**Priority:** P1 **Type:** Functional
### Preconditions
- ≥ 25 expenses seeded.
1. Page through pages 1→2→3 at size 10. **Expected:** correct slices, no duplicates across pages, total count stable.
2. Switch page size 10→20→50→100. **Expected:** list re-queries at page 1 with the new size; count consistent.
3. Go to the last page, then delete one row of it. **Expected:** no empty page view; falls back to a populated page.

## EXP-015: Expense list — search
**Priority:** P1 **Type:** Functional
1. Type `R1` (restaurant name) — no Enter. **Expected:** results filter ~300 ms after typing stops (auto-search, no submit button, no flickering spinner next to the input).
2. Press Enter mid-debounce. **Expected:** immediate search with the current text.
3. Search a nonsense string. **Expected:** empty-state message, not an error.
4. Clear the search. **Expected:** full list returns.

## EXP-016: Expense list — filters and sort
**Priority:** P1 **Type:** Functional
1. Filter by colleagues A+B. **Expected:** only expenses where A or B participates.
2. Payment-status filter each of all/paid/unpaid/partial. **Expected:** rows match DB-computed status (spot-check 3 rows against payment applications).
3. Sort by date asc/desc, amount asc/desc, and restaurant. **Expected:** order matches DB ordering; combined with filters still correct.

## EXP-017: List state survives mutations (react-query behavior)
**Priority:** P0 **Type:** Regression
1. Go to page 3, filter colleague A, sort amount desc. 2. Edit one expense. **Expected:** list refetches keeping page 3 + filter + sort (does NOT jump to page 1).

## EXP-018: Expense detail page
**Priority:** P1 **Type:** Functional
1. Open an expense with claims/applications. **Expected:** participants with amounts, items (if itemized), receipt viewer, payment/claim status all present and matching DB.
2. Open one with a pending claim. **Expected:** pending state visible; approve/undo actions behave per PAY-0xx.
3. Open an unknown or deleted expense id (`/expense/999999`). **Expected:** friendly not-found state with a way back to the list — never a blank screen or raw error.

## EXP-019: Colleague-session visibility on expenses
**Priority:** P1 **Type:** Security
### Preconditions
- Colleague session (bound code).
1. Open `/expenses`. **Expected:** view-only UI (no add/edit/delete affordances or they are inert).
2. Call the delete server function directly via devtools as the colleague. **Expected:** rejected (admin required).
3. As the colleague, open the detail URL of an expense they do NOT participate in. **Expected (characterization, verified 2026-09-08):** the detail page RENDERS for bound colleagues — web models colleagues as team-wide readers (amounts visible), while receipt FILES stay denied (XC-003). If product wants page-level scoping too, flip this expectation.

## EXP-020: Currency/date formatting
**Priority:** P2 **Type:** UI
1. In each locale (en/ja/zh-tw/zh), check the amount column and date column. **Expected:** locale-appropriate formatting, no raw `Decimal` strings, no `US$` prefix (plain `$` policy), dates never time-of-day noise in rows.

## EXP-021: Empty and loading states
**Priority:** P2 **Type:** UI
1. Fresh workspace with zero expenses. **Expected:** empty state with a create affordance; no zero-division in stats (average 0).
2. Throttle network, reload. **Expected:** skeleton/loading state, then data; no broken image icons for receipts.

## EXP-022: Concurrent edits of the same expense
**Priority:** P1 **Type:** Functional
### Preconditions
- Two admins in two browsers.
1. Both edit the same expense with different amounts; A saves, then B saves. **Expected:** last-write-wins per current design — verify no partial/mixed participant rows; final DB state equals B's input exactly.
