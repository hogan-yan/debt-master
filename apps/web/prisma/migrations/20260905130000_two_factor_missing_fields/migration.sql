-- better-auth's two-factor plugin writes failedVerificationCount and
-- lockedUntil on create/update; the table was missing both columns, so
-- enabling 2FA failed with "Unknown argument".
ALTER TABLE "two_factor" ADD COLUMN "failed_verification_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "two_factor" ADD COLUMN "locked_until" TIMESTAMP(3);
