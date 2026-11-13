-- Add missing query-path indexes and the access-code-to-colleague binding
-- used for per-resource storage authorization.

-- Expense.date: every expense list orders by date; without this index each
-- page is a filesort.
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- Payment.restaurantId: restaurant-scoped payment queries filter on it.
CREATE INDEX "payments_restaurant_id_idx" ON "payments"("restaurant_id");

-- AccessCode.colleagueId: binds a colleague to their sign-in code so receipt
-- and payment-proof URLs can be scoped to resources involving that colleague.
ALTER TABLE "access_codes" ADD COLUMN "colleague_id" INTEGER;
CREATE INDEX "access_codes_colleague_id_idx" ON "access_codes"("colleague_id");
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_colleague_id_fkey" FOREIGN KEY ("colleague_id") REFERENCES "colleagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
