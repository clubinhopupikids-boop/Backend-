-- Additive parental-access foundation. The account password and child profiles are untouched.
ALTER TABLE "responsible"
  ADD COLUMN "parent_pin_hash" TEXT,
  ADD COLUMN "parent_pin_created_at" TIMESTAMP(3),
  ADD COLUMN "parent_pin_updated_at" TIMESTAMP(3),
  ADD COLUMN "parent_pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parent_pin_locked_until" TIMESTAMP(3);

ALTER TABLE "responsible"
  ADD CONSTRAINT "responsible_parent_pin_failed_attempts_nonnegative"
  CHECK ("parent_pin_failed_attempts" >= 0);
