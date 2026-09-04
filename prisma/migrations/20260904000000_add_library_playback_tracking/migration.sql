-- Add canonical, real-media participation without reconstructing old library use.
-- This migration is additive only. Historical library consumption is intentionally
-- not backfilled because the catalog and player had no reliable participation fact.

CREATE TYPE "LibraryPlaybackStatus" AS ENUM ('STARTED', 'COMPLETED');

ALTER TYPE "ChildActivityType" ADD VALUE 'LIBRARY_STARTED';
ALTER TYPE "ChildActivityType" ADD VALUE 'LIBRARY_COMPLETED';

CREATE TABLE "library_playback" (
  "id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "library_content_id" UUID NOT NULL,
  "client_session_id" UUID NOT NULL,
  "status" "LibraryPlaybackStatus" NOT NULL DEFAULT 'STARTED',
  "started_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "last_position_ms" INTEGER,
  "consumed_duration_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_playback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_playback_position_nonnegative" CHECK (
    ("last_position_ms" IS NULL OR "last_position_ms" >= 0)
    AND ("consumed_duration_ms" IS NULL OR "consumed_duration_ms" >= 0)
  ),
  CONSTRAINT "library_playback_completion_consistent" CHECK (
    ("status" = 'STARTED' AND "completed_at" IS NULL)
    OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
  ),
  CONSTRAINT "library_playback_completed_after_start" CHECK (
    "completed_at" IS NULL OR "completed_at" >= "started_at"
  )
);

CREATE UNIQUE INDEX "library_playback_client_session_id_key"
  ON "library_playback"("client_session_id");

CREATE UNIQUE INDEX "library_playback_id_child_id_key"
  ON "library_playback"("id", "child_id");

CREATE INDEX "library_playback_child_id_started_at_idx"
  ON "library_playback"("child_id", "started_at");

CREATE INDEX "library_playback_child_id_completed_at_idx"
  ON "library_playback"("child_id", "completed_at");

CREATE INDEX "library_playback_library_content_id_started_at_idx"
  ON "library_playback"("library_content_id", "started_at");

ALTER TABLE "child_activity_event"
  ALTER COLUMN "mission_completion_id" DROP NOT NULL,
  ADD COLUMN "library_playback_id" UUID;

CREATE UNIQUE INDEX "child_activity_event_library_playback_id_type_key"
  ON "child_activity_event"("library_playback_id", "type");

ALTER TABLE "child_activity_event"
  ADD CONSTRAINT "child_activity_event_exactly_one_source" CHECK (
    ("mission_completion_id" IS NOT NULL AND "library_playback_id" IS NULL)
    OR ("mission_completion_id" IS NULL AND "library_playback_id" IS NOT NULL)
  );

ALTER TABLE "child_activity_event"
  ADD CONSTRAINT "child_activity_event_source_type_consistent" CHECK (
    ("mission_completion_id" IS NOT NULL AND "type" = 'MISSION_COMPLETED')
    OR (
      "library_playback_id" IS NOT NULL
      AND "type" IN ('LIBRARY_STARTED', 'LIBRARY_COMPLETED')
    )
  );

ALTER TABLE "library_playback"
  ADD CONSTRAINT "library_playback_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "library_playback"
  ADD CONSTRAINT "library_playback_library_content_id_fkey"
  FOREIGN KEY ("library_content_id") REFERENCES "library_content"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "child_activity_event"
  ADD CONSTRAINT "child_activity_event_library_playback_id_child_id_fkey"
  FOREIGN KEY ("library_playback_id", "child_id")
  REFERENCES "library_playback"("id", "child_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
