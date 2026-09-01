-- Evolve the existing empty library foundation without rewriting earlier
-- migrations. Existing legacy URL columns are retained for compatibility but
-- new catalog entries use object-storage keys as their source of truth.

CREATE TYPE "LibraryMediaFormat" AS ENUM ('AUDIO', 'VIDEO');
CREATE TYPE "LibraryTheme" AS ENUM ('EMOTIONS', 'ROUTINE', 'SOCIAL', 'DEVELOPMENT', 'MOVEMENT');

ALTER TABLE "library_content"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "media_format" "LibraryMediaFormat",
  ADD COLUMN "mime_type" TEXT,
  ADD COLUMN "storage_key" TEXT,
  ADD COLUMN "thumbnail_storage_key" TEXT,
  ADD COLUMN "theme" "LibraryTheme";

-- Older foundation rows, if any, remain valid and do not receive invented
-- media metadata. The generated code only preserves their identity.
UPDATE "library_content"
SET "code" = 'legacy_library_' || "id"::text
WHERE "code" IS NULL;

ALTER TABLE "library_content"
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "library_content_code_key" ON "library_content"("code");
