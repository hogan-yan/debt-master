-- DropForeignKey
ALTER TABLE "access_codes" DROP CONSTRAINT "access_codes_created_by_fkey";

-- Rename the old integer FK column out of the way
ALTER TABLE "access_codes" RENAME COLUMN "created_by" TO "created_by_user_id";

-- Add the new string creator column
ALTER TABLE "access_codes" ADD COLUMN "created_by" TEXT;

-- Backfill existing rows from users.username
UPDATE "access_codes" ac
SET "created_by" = u.username
FROM "users" u
WHERE ac."created_by_user_id" = u.id;

-- Drop the old integer column
ALTER TABLE "access_codes" DROP COLUMN "created_by_user_id";
