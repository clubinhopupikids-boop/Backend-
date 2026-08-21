-- Replace persisted `age` (integer) with `birth_date` (date).
-- In development with no real data, a full reset is cleaner; this migration
-- is provided for environments where the init migration has already been applied.

ALTER TABLE "child" DROP COLUMN "age";
ALTER TABLE "child" ADD COLUMN "birth_date" DATE NOT NULL DEFAULT '2018-01-01';
ALTER TABLE "child" ALTER COLUMN "birth_date" DROP DEFAULT;

UPDATE "responsible" SET "terms_accepted_at" = "created_at" WHERE "terms_accepted_at" IS NULL;
ALTER TABLE "responsible" ALTER COLUMN "terms_accepted_at" SET NOT NULL;
