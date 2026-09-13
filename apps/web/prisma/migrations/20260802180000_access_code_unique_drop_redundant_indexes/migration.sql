-- Partial unique: active (non-deleted) access codes must be unique.
-- Soft-deleted codes may reuse the same string on recreate.
CREATE UNIQUE INDEX "access_codes_code_active_key"
  ON "access_codes" ("code")
  WHERE "deleted_at" IS NULL;

-- Redundant with unique (expense_id, colleague_id) leading column.
DROP INDEX IF EXISTS "expense_participants_expense_id_idx";

-- Redundant with unique (payment_id, participant_id) leading column.
DROP INDEX IF EXISTS "payment_applications_payment_id_idx";

-- Redundant with unique two_factor_user_id_key.
DROP INDEX IF EXISTS "two_factor_user_id_idx";
