# Test cases — Restaurants

**Common preconditions:** admin session; `Expense.restaurantId` is REQUIRED by the schema, so a restaurant must exist before any expense can be created.

---

## RST-001: Create restaurant — happy path
**Priority:** P1 **Type:** Functional
1. Create "R2" with address, cuisine "Noodles", notes. **Expected:** saved; visible in list and in the expense-form restaurant picker.

## RST-002: Create restaurant — required fields and lengths
**Priority:** P1 **Type:** Functional
1. Save with empty name. **Expected:** validation error.
2. Cuisine with 51+ characters (DB VarChar(50)). **Expected:** rejected by validation OR truncated cleanly — NOT a 500 from the DB; state which.
3. Notes with 501+ characters (VarChar(500)). **Expected:** same as above.

## RST-003: Duplicate restaurant names
**Priority:** P2 **Type:** Functional
1. Create a second "R1". **Expected:** allowed or rejected per current behavior — record it; expense forms must still bind to the intended row (IDs).

## RST-004: Edit restaurant
**Priority:** P2 **Type:** Functional
1. Rename R2, change cuisine. **Expected:** everywhere R2 is referenced (expense rows, restaurant page title, dashboard tab) shows the new name after refresh.

## RST-005: Delete restaurant — with expenses attached
**Priority:** P0 **Type:** Functional
### Preconditions
- R1 has expenses (schema relation is required).
1. Delete R1. **Expected:** blocked (FK restrict) with a clean business error — NOT a 500; no orphan expenses.
2. Delete a restaurant with NO expenses. **Expected:** removed cleanly.

## RST-006: Restaurant detail page
**Priority:** P1 **Type:** Functional
1. Open R1's page. **Expected:** its expenses list, totals, and any payment association match DB; pagination works with > 1 page.

## RST-007: Restaurants list — search and pagination
**Priority:** P2 **Type:** Functional
1. Search by partial name; paginate (seed ≥ 25 restaurants or lower threshold). **Expected:** correct filtering/slices.

## RST-008: Dashboard restaurants tab
**Priority:** P2 **Type:** Functional
1. Open the dashboard restaurants tab. **Expected:** per-restaurant aggregates match the detail pages (same numbers, two views).
2. Check the tab lazy-loads. **Expected:** no full-dashboard blocking; chart renders after load.

## RST-009: Restaurant picker in expense forms
**Priority:** P1 **Type:** Functional
1. Open create-expense. **Expected:** picker lists all restaurants; search/scroll works with 20+ entries; selected value persists through validation errors.
2. Delete a restaurant in another tab while the form is open, then submit. **Expected:** clean error (restaurant not found), not a silent partial save.
