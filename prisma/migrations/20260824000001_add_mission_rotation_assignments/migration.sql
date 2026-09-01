-- Extends the already-created catalog foundation without rewriting prior migrations.
-- Existing unseeded mission rows receive a stable preservation code before the
-- new unique constraint is made mandatory.

CREATE TYPE "MissionRarity" AS ENUM ('NORMAL', 'RARE');

ALTER TABLE "mission"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "theme" TEXT,
  ADD COLUMN "exclusion_group" TEXT,
  ADD COLUMN "rarity" "MissionRarity" NOT NULL DEFAULT 'NORMAL';

UPDATE "mission"
SET "code" = 'legacy_unmapped_' || "id"::TEXT
WHERE "code" IS NULL;

ALTER TABLE "mission"
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "period" DROP NOT NULL;

CREATE UNIQUE INDEX "mission_code_key" ON "mission"("code");
CREATE INDEX "mission_period_is_active_rarity_display_order_idx"
  ON "mission"("period", "is_active", "rarity", "display_order");

CREATE TABLE "mission_assignment" (
  "id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "period" "MissionPeriod" NOT NULL,
  "period_key" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mission_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mission_assignment_child_id_mission_id_period_period_key_key"
  ON "mission_assignment"("child_id", "mission_id", "period", "period_key");
CREATE UNIQUE INDEX "mission_assignment_child_id_period_period_key_slot_key"
  ON "mission_assignment"("child_id", "period", "period_key", "slot");
CREATE INDEX "mission_assignment_child_id_period_period_key_idx"
  ON "mission_assignment"("child_id", "period", "period_key");
CREATE INDEX "mission_assignment_mission_id_idx" ON "mission_assignment"("mission_id");

ALTER TABLE "mission_assignment"
  ADD CONSTRAINT "mission_assignment_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_assignment"
  ADD CONSTRAINT "mission_assignment_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
