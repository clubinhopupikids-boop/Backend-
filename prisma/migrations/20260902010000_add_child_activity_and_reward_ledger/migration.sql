-- Add immutable product activity and reward projections for mission completions.
-- Existing completions are intentionally left untouched; environments with historical
-- rows may choose an explicit, separately reviewed backfill later.

CREATE TYPE "ChildActivityType" AS ENUM ('MISSION_COMPLETED');
CREATE TYPE "RewardCurrency" AS ENUM ('STAR', 'CRYSTAL');
CREATE TYPE "RewardReason" AS ENUM ('MISSION_COMPLETED');

CREATE UNIQUE INDEX "mission_completion_id_child_id_key"
  ON "mission_completion"("id", "child_id");

CREATE INDEX "mission_completion_child_id_completed_at_idx"
  ON "mission_completion"("child_id", "completed_at");

CREATE TABLE "child_activity_event" (
  "id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "type" "ChildActivityType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mission_completion_id" UUID NOT NULL,
  CONSTRAINT "child_activity_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "child_activity_event_mission_completion_id_child_id_key"
  ON "child_activity_event"("mission_completion_id", "child_id");

CREATE INDEX "child_activity_event_child_id_occurred_at_idx"
  ON "child_activity_event"("child_id", "occurred_at");

CREATE INDEX "child_activity_event_child_id_type_occurred_at_idx"
  ON "child_activity_event"("child_id", "type", "occurred_at");

CREATE TABLE "reward_transaction" (
  "id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "currency" "RewardCurrency" NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" "RewardReason" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotency_key" TEXT NOT NULL,
  "mission_completion_id" UUID NOT NULL,
  CONSTRAINT "reward_transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reward_transaction_amount_nonzero" CHECK ("amount" <> 0)
);

CREATE UNIQUE INDEX "reward_transaction_idempotency_key_key"
  ON "reward_transaction"("idempotency_key");

CREATE UNIQUE INDEX "reward_transaction_mission_completion_id_currency_key"
  ON "reward_transaction"("mission_completion_id", "currency");

CREATE INDEX "reward_transaction_child_id_occurred_at_idx"
  ON "reward_transaction"("child_id", "occurred_at");

CREATE INDEX "reward_transaction_child_id_currency_occurred_at_idx"
  ON "reward_transaction"("child_id", "currency", "occurred_at");

ALTER TABLE "child_activity_event"
  ADD CONSTRAINT "child_activity_event_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "child_activity_event"
  ADD CONSTRAINT "child_activity_event_mission_completion_id_child_id_fkey"
  FOREIGN KEY ("mission_completion_id", "child_id")
  REFERENCES "mission_completion"("id", "child_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reward_transaction"
  ADD CONSTRAINT "reward_transaction_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reward_transaction"
  ADD CONSTRAINT "reward_transaction_mission_completion_id_child_id_fkey"
  FOREIGN KEY ("mission_completion_id", "child_id")
  REFERENCES "mission_completion"("id", "child_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
