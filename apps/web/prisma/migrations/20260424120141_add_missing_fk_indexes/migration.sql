-- CreateIndex
CREATE INDEX "expense_items_expense_id_idx" ON "expense_items"("expense_id");

-- CreateIndex
CREATE INDEX "expense_items_colleague_id_idx" ON "expense_items"("colleague_id");

-- CreateIndex
CREATE INDEX "expenses_restaurant_id_idx" ON "expenses"("restaurant_id");

-- CreateIndex
CREATE INDEX "payments_expense_id_idx" ON "payments"("expense_id");
