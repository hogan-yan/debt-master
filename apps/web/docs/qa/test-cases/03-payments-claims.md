# Test cases — Payments, distribution, claims, proofs

**Common preconditions:** admin session on `/payments` (or `/expenses` for claims) unless stated; seed: colleagues A–D with unpaid expenses; PAYME/FPS/CASH/OTHER all selectable. Money reconciliation = UI total equals `SUM(payments.amount)` minus reversals in DB.

---

## PAY-001: Record a full payment for one expense
**Priority:** P0 **Type:** Functional
1. Create payment: colleague A, type CASH, amount exactly equal to A's remaining debt on expense E1, attach proof. **Expected:** payment saved; E1 flips to paid; A's balance drops accordingly; proof stored.
2. Check payment stats card. **Expected:** totals update immediately (≤ cache TTL) and match DB.

## PAY-002: Payment type coverage
**Priority:** P2 **Type:** Functional
1. Record one payment of each type PAYME, FPS, CASH, OTHER. **Expected:** all four save; type shown on list/detail; default selection is stable.

## PAY-003: Payment amount validation
**Priority:** P0 **Type:** Functional
1. Amount greater than the colleague's total remaining debt. **Expected:** blocked with an explanatory error (no silent overpayment).
2. Amount 0.00 or negative. **Expected:** validation error; nothing saved.
3. Amount 0.01 against a 50.00 debt. **Expected:** saves as partial; applications distribute 0.01 correctly.

## PAY-004: Smart distribution across multiple expenses
**Priority:** P0 **Type:** Functional
1. A owes 30 (E1), 20 (E2), 10 (E3). Record 45 with multi-expense selection. **Expected:** E1 fully paid, E2 fully paid, E3 partially (5.00 applied); leftover 0 — applications sum to exactly 45.00.
2. Open each expense. **Expected:** paid/partial status per above.

## PAY-005: Distribution — unapplied remainder
**Priority:** P1 **Type:** Functional
1. Pay 45 against selected expenses totaling only 40. **Expected:** 5.00 stays as unapplied funds on the payment (visible in colleague detail); DB applications sum to 40.00.

## PAY-006: Unapplied funds applied later (auto-apply)
**Priority:** P1 **Type:** Functional
1. With A holding 5.00 unapplied funds, create a NEW expense where A participates. **Expected:** funds auto-apply to the new debt (auto-apply behavior), A's balance updates once — not double-counted.

## PAY-007: Payment proof — upload and view
**Priority:** P0 **Type:** Functional
1. Upload a valid JPEG proof. **Expected:** stored; view opens the image via a signed `/api/storage/` URL.
2. View the same proof from the payments list and from the expense detail. **Expected:** both render; URL differs per generation but each is valid (fresh signature, unexpired).

## PAY-008: Proof — invalid file handling
**Priority:** P2 **Type:** Functional
1. 25 MB file; 2. non-image; 3. renamed executable. **Expected:** each rejected with a message; payment still recordable without proof.

## PAY-009: Colleague submits a claim (pending payment)
**Priority:** P0 **Type:** Functional
### Preconditions
- Colleague session for A (bound code) on `/expenses`.
1. A claims their share on expense E1, type PAYME, with proof. **Expected:** pending claim created (`isApproved: false`, `createdBy: COLLEAGUE_CLAIM`); proof stored; admin's pending-claims card shows it.
2. A submits a SECOND claim for the same participant while one is pending. **Expected:** blocked by the duplicate-claim guard (error, not a second pending row). *(DB failure inside this check must surface as an error, never as "no pending claim".)*

## PAY-010: Admin approves a claim
**Priority:** P0 **Type:** Functional
1. Approve A's pending claim. **Expected:** payment becomes approved; applications applied to the expense; expense status updates; pending card loses the row; both caches refresh (stats + list ≤ TTL).

## PAY-011: Approve twice / approve already-approved claim
**Priority:** P0 **Type:** Security
1. Approve the same claim twice (double-click + replayed request). **Expected:** second attempt rejected with a business error; no duplicate applications.

## PAY-012: Undo a PENDING claim
**Priority:** P1 **Type:** Functional
1. Undo A's pending claim. **Expected:** pending payment row deleted; its proof object removed from storage (no orphan); A can claim again afterwards.

## PAY-013: Undo an APPROVED claim
**Priority:** P1 **Type:** Functional
1. Undo an approved claim. **Expected:** applications reversed; expense status recomputed (paid → unpaid/partial); amounts restored; proof cleaned up per policy.

## PAY-014: Cancel redundant pending claims on approval
**Priority:** P2 **Type:** Functional
### Preconditions
- Two pending claims for the same participant (created before the guard, or via DB seed).
1. Approve one. **Expected:** the redundant pending claim is auto-cancelled; its proof cleaned; totals stay consistent.

## PAY-015: Bulk claim for a colleague
**Priority:** P1 **Type:** Functional
1. Run bulk-claim for A with 3 unpaid expenses. **Expected:** single payment created and applied across all three; A's balance → 0; idempotent on re-run (no duplicate applications).
2. Run bulk-claim for A with NO unpaid expenses. **Expected:** clean business error, no empty payment.

## PAY-016: Apply unused funds to an expense
**Priority:** P1 **Type:** Functional
1. With A having unapplied funds, apply them to A's specific expense debt. **Expected:** applications created; funds reduced; BOTH payment stats and expense views refresh (cache invalidation on both domains).

## PAY-017: Payment stats consistency under claims
**Priority:** P1 **Type:** Regression
1. Submit a claim, then check payment stats within the TTL window. **Expected:** stats reflect the claim within the documented staleness bound and are correct after invalidation — never double-counted.

## PAY-018: Edit a payment — amount change redistributes
**Priority:** P1 **Type:** Functional
1. Edit a 45.00 payment (applied 45) down to 30.00. **Expected:** applications re-adjusted/removed per business rules; expense statuses recomputed; no orphan applications.
2. Edit up beyond the selected expenses' debt. **Expected:** blocked or unapplied-remainder handled per policy — state observed behavior; totals must reconcile.

## PAY-019: Replace a payment proof
**Priority:** P2 **Type:** Functional
1. Edit payment, upload new proof. **Expected:** new object referenced; OLD proof object deleted from storage after commit (no orphan); viewing shows the new image.

## PAY-020: Delete a payment
**Priority:** P0 **Type:** Functional
1. Delete a payment with applications + proof. **Expected:** row, applications, and proof object all removed; expense statuses revert; stats/list refresh; storage bucket has no orphan.

## PAY-021: Delete fails mid-flow (rollback hygiene)
**Priority:** P2 **Type:** Functional
### Preconditions
- Simulate proof-delete failure (e.g. revoke bucket permissions) — exploratory.
1. Delete such a payment. **Expected:** DB deletion still succeeds once; failure is LOGGED (orphan object), request does not 500, and the row is gone.

## PAY-022: Colleague visibility of proofs
**Priority:** P0 **Type:** Security
### Preconditions
- Colleague B (bound code) signed in.
1. Open the payment-proof URL issued for A's payment (obtained while signed in as A, or via API enumeration of payment IDs). **Expected:** colleague B receives `You do not have access to this file` for A's payment; sees their own.

## PAY-023: Payments list — search, sort, pagination
**Priority:** P1 **Type:** Functional
### Preconditions
- ≥ 25 payments seeded (mixed types, with/without proofs, some with claims).
1. Type into the payments search box (colleague or expense reference) — no Enter. **Expected:** results filter automatically after the debounce (no submit button, no flickering spinner next to the input — repo search-UX rule); nonsense query gives a clean empty state.
2. Page through pages 1→2→3 and switch page sizes. **Expected:** correct slices, no duplicates across pages, total count stable; page-size change re-queries at page 1.
3. Cycle every sort option in the UI, both directions. **Expected:** order matches DB ordering (spot-check 3 rows).
4. Delete a payment from the last page (PAY-020 state). **Expected:** list refetches keeping page + search + sort; no empty last page.
2. Colleague session with an UNBOUND code requests A's proof. **Expected:** currently allowed with a logged warning (legacy) — confirm the warning lands in server logs; flag for policy change.
3. Request a storage URL with the `signature` param stripped or expired. **Expected:** 403 from `/api/storage/`, even with a valid session.
