# Test cases — Dashboard and reports

**Common preconditions:** admin session on `/`; seed data with a mix of paid/partial/unpaid expenses across ≥ 3 restaurants and ≥ 4 colleagues.

---

## DSH-001: Dashboard stats cards match the database
**Priority:** P0 **Type:** Functional
1. Note total expenses, total amount, average, unique restaurants from the cards. **Expected:** each equals `COUNT/SUM/AVG/COUNT(DISTINCT)` from a direct DB query (aggregate-backed stats).
2. Average has more than 2 decimals in DB. **Expected:** displayed rounded to currency precision; no float noise digits.

## DSH-002: Debt chart reflects current balances
**Priority:** P1 **Type:** Functional
1. Record a payment that clears a colleague's debt; return to `/`. **Expected:** chart updates (≤ cache TTL) — colleague moves out of "owes".

## DSH-003: Balance distribution chart
**Priority:** P1 **Type:** Functional
1. Compare the distribution buckets against the colleagues list. **Expected:** same underlying numbers (bucket membership sums to the colleague count).

## DSH-004: Who-owes list
**Priority:** P1 **Type:** Functional
1. Verify each row against the colleague detail balance. **Expected:** identical amounts; settled colleagues excluded or zero-marked consistently.

## DSH-005: Recent activity feed
**Priority:** P2 **Type:** Functional
1. Create an expense + a payment; reload `/`. **Expected:** both appear as recent activity with correct type, amount, and relative time.
2. No activity at all (fresh DB). **Expected:** empty state, not an error.

## DSH-006: Pending payments card
**Priority:** P1 **Type:** Functional
1. With a pending claim, check the card. **Expected:** claim listed with participant + amount; approve routes through PAY-010; after approval the card empties.

## DSH-007: Tab lazy-loading
**Priority:** P2 **Type:** Performance
1. Open `/` with the network throttled; switch between dashboard tabs. **Expected:** initial page not blocked by tab data; each tab loads on demand; revisiting a tab reuses or refetches data WITHOUT showing permanently stale values (verify refresh behavior; the tab cache must not outlive mutations).

## DSH-008: Dashboard under zero and large data
**Priority:** P2 **Type:** Performance
1. Fresh empty DB. **Expected:** all widgets render zero/empty states.
2. Production-like volume (5k expenses). **Expected:** page interactive < 3 s; charts don't drop points silently (spot-check one restaurant's total).

## DSH-009: Dashboard staleness bound after mutations from other pages
**Priority:** P1 **Type:** Regression
1. Delete an expense from `/expenses`, immediately return to `/`. **Expected:** stats/chart reflect the deletion within the documented TTL; a manual reload is always correct.

## DSH-010: Spending tab correctness
**Priority:** P1 **Type:** Functional
### Preconditions
- ≥ 4 colleagues, ≥ 20 expenses spread across dates; per-colleague totals computable from the DB.
1. Open `/` → Spending tab. **Expected:** top spenders ranking matches the DB (spot-check the top 2: total spent = sum of their expense shares, expense count and average match); participation rate = share of expenses each colleague participates in; trends and insight cards render with data, no NaN/`Infinity`/divide-by-zero text.
2. Include a colleague with exactly 0 expenses. **Expected:** shows 0/zero-state gracefully (no blank row, no crash).
3. Watch the network tab while switching tabs (see DSH-007). **Expected:** spending data fetches once on first open; the tab never renders permanently stale totals after EXP/PAY mutations (bounded by the DSH-009 TTL).

## DSH-011: Dashboard onboarding checklist (fresh account)
**Priority:** P2 **Type:** UI
### Preconditions
- Fresh admin account with no expense logged yet.
1. Load `/` with 0 restaurants, 0 colleagues, 0 expenses. **Expected:** the 3-step checklist (restaurant, colleagues, first lunch) renders with all steps incomplete and 0% progress; per-step action buttons visible (admin).
2. Complete the steps in order (create restaurant → create colleague → log first expense). **Expected:** each step checks off and progress advances; once a lunch has been logged the checklist no longer gates the dashboard.
3. Sign in as a colleague on the same fresh account state. **Expected:** checklist status is visible but the action CTAs are hidden (admin-only) — no dead buttons.

---

# Test cases — Settings, security admin, audit

**Common preconditions:** admin session on `/settings`; second browser for session tests.

## SET-001: Create access code
**Priority:** P0 **Type:** Functional
1. Create code `TEST04`. **Expected:** appears in the list with `isActive: true`; login with it succeeds (AUTH-006).
2. Duplicate an existing active code. **Expected:** business error `Access code already exists`.
3. 3-character code / empty. **Expected:** validation errors (minimum 4).

## SET-002: Deactivate / reactivate a code
**Priority:** P0 **Type:** Functional
1. Deactivate `TEST04`; try logging in with it (AUTH-008). **Expected:** blocked. 2. Reactivate; login now succeeds. 3. Both actions audited.

## SET-003: Soft-delete a code
**Priority:** P1 **Type:** Functional
1. Delete `TEST04`. **Expected:** gone from the list; login blocked (AUTH-009); row still exists in DB (`deletedAt` set).

## SET-004: Assign a colleague to a code
**Priority:** P1 **Type:** Functional
1. Bind `TEST04` to colleague A. **Expected:** binding saved + audited (`access_code.colleague_assigned`).
2. Bind to a non-existent colleague id (via API). **Expected:** `Colleague not found`; binding unchanged.
3. Unbind (null). **Expected:** audited with the unbound flag; code returns to legacy full-read behavior (see PAY-022).

## SET-005: Security panel — change admin password
**Priority:** P1 **Type:** Functional
1. Change with wrong current password. **Expected:** rejected; old password still works.
2. Change with a policy-violating new password. **Expected:** policy error.
3. Change correctly. **Expected:** success toast; other sessions invalidated per better-auth behavior; new password works on next login.

## SET-006: Active sessions list + revoke
**Priority:** P2 **Type:** Functional
1. Sign in from two browsers; open the sessions list. **Expected:** both sessions visible with metadata.
2. Revoke one. **Expected:** that browser is signed out on next action; the other survives; audit `admin.session_revoked`.

## SET-007: Audit log viewer
**Priority:** P1 **Type:** Functional
1. Perform a login, failed login, password change, password reset (request + completion), 2FA change, access-code change; open the audit view. **Expected:** all recorded with action, actor, timestamp; NO raw access codes, passwords, or reset tokens anywhere in details (see AUTH-007/026 redactions).
2. Viewer requires admin. **Expected:** colleague session cannot open it.
3. Check the newest entries after step 1. **Expected:** viewing the audit log is itself audited (`admin.audit_log_viewed`).

## SET-008: Turnstile widget states
**Priority:** P2 **Type:** UI
### Preconditions
- Turnstile configured.
1. Load `/login` access-code form. **Expected:** widget renders; after expiry it refreshes; submitting after expiry gives `Security verification failed` (AUTH-012) rather than a hang.
