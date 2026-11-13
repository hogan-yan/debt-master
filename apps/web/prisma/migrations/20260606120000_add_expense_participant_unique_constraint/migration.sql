-- AddUniqueConstraint: Prevent duplicate participants per expense
-- A colleague should only appear once per expense
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_colleague_id_key" UNIQUE ("expense_id", "colleague_id");

-- AddIndex: Missing FK index on expense_id for join performance
CREATE INDEX "expense_participants_expense_id_idx" ON "expense_participants"("expense_id");
