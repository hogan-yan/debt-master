-- Data safety: soft-delete any colleagues that are disabled but not already soft-deleted
-- so they don't silently become active when we drop the column
UPDATE "colleagues" SET "deleted_at" = NOW() WHERE "disabled" = true AND "deleted_at" IS NULL;

-- AlterTable: drop the disabled column
ALTER TABLE "colleagues" DROP COLUMN "disabled";
