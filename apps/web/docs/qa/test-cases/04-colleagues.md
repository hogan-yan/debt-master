# Test cases — Colleagues

**Common preconditions:** admin session; seed colleagues A–D; colleague A has expenses + payments.

---

## COL-001: Create colleague
**Priority:** P0 **Type:** Functional
1. Settings/colleagues → create "Eve Tester". **Expected:** appears in the active list; available in expense participant pickers immediately.
2. Name with 1 character. **Expected:** accepted or minimum-length validation per policy — no crash.
3. Name with 200+ characters. **Expected:** handled (validated/truncated); list layout not broken.
4. Create a colleague with a name identical to an existing one. **Expected:** allowed (names are not unique) — verify the two stay distinct everywhere (expense participant selection uses IDs, not names).

## COL-002: Inline colleague creation from the expense form
**Priority:** P1 **Type:** Functional
1. In a new expense, add participant "New Guy" that doesn't exist, submit. **Expected:** colleague created AND attached to the expense in one flow; appears in the colleagues list afterwards.

## COL-003: Edit colleague name
**Priority:** P1 **Type:** Functional
1. Rename colleague A. **Expected:** history rows/labels reflect the new name everywhere (payments list shows new name, no stale cached names after refresh).

## COL-004: Soft-delete colleague WITHOUT related data
**Priority:** P1 **Type:** Functional
1. Delete a colleague with no expenses/payments. **Expected:** disappears from the active list; confirm dialog copy has no destructive warning.

## COL-005: Soft-delete colleague WITH data
**Priority:** P0 **Type:** Functional
1. Delete colleague A (has expenses/payments). **Expected:** destructive-data warning in the dialog; A disappears from active list and from participant pickers; historical expenses/payments remain and still display A's name.
2. Check balances of A's former co-participants. **Expected:** unchanged (delete does not re-write history).

## COL-006: Restore a soft-deleted colleague
**Priority:** P1 **Type:** Functional
1. Restore A from the inactive tab. **Expected:** back in the active list; old data intact; participant pickers include A again.

## COL-007: Permanent delete — guarded
**Priority:** P0 **Type:** Functional
1. Attempt permanent delete of a colleague WITH live expense participation. **Expected:** blocked with a business error; nothing removed.
2. Permanent-delete a colleague with no data. **Expected:** row fully removed; cannot be restored.

## COL-008: Colleague detail page
**Priority:** P1 **Type:** Functional
1. Open colleague A's detail. **Expected:** balance, unapplied funds, payment history, expense participation all render and match DB (spot-check 2 numbers against SQL).
2. Open a colleague with zero activity. **Expected:** zeroed/empty states, no NaN.

## COL-009: Balance math — boundary cases
**Priority:** P0 **Type:** Functional
1. Colleague with exactly 0.00 balance (fully settled). **Expected:** shown as settled (neutral color/copy), not "owes 0.01" — float drift check.
2. Colleague with negative balance (overpaid → owed money). **Expected:** displayed as being owed; sign/color logic correct in list + detail + dashboard.

## COL-010: Colleagues list — pagination and search
**Priority:** P2 **Type:** Functional
1. Seed 60+ colleagues (or lower page-size threshold); paginate. **Expected:** correct slices.
2. Search by partial name. **Expected:** filtered server-side; clearing restores.

## COL-011: Inactive colleagues view
**Priority:** P2 **Type:** Functional
1. Open the inactive list. **Expected:** only soft-deleted colleagues; actions restore/permanent-delete present; restore and permanent-delete failures surface an error (never silently close the dialog with a stale list).

## COL-012: Colleague stats card
**Priority:** P2 **Type:** Functional
1. Compare the colleagues-page stats against DB aggregates. **Expected:** counts match after create/delete/restore.
