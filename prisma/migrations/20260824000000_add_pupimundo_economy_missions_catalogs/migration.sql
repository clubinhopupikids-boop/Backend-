-- Additive PupiMundo infrastructure. Existing children start with zero balances.
-- No mission, game or library rows are inserted: empty catalogs are valid.

CREATE TYPE "MissionPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "MissionFeedbackRating" AS ENUM ('VERY_FUN', 'FUN', 'SO_SO', 'DIFFICULT', 'VERY_DIFFICULT');
CREATE TYPE "CatalogStatus" AS ENUM ('AVAILABLE', 'COMING_SOON');
CREATE TYPE "GameCategory" AS ENUM ('EMOTIONS', 'CREATIVITY', 'LOGIC', 'ATTENTION_MEMORY');
CREATE TYPE "LibraryContentType" AS ENUM ('STORIES', 'MUSIC', 'VIDEOS');

ALTER TABLE "child"
  ADD COLUMN "star_balance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "crystal_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "child"
  ADD CONSTRAINT "child_star_balance_nonnegative" CHECK ("star_balance" >= 0),
  ADD CONSTRAINT "child_crystal_balance_nonnegative" CHECK ("crystal_balance" >= 0);

CREATE TABLE "mission" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "period" "MissionPeriod" NOT NULL,
  "icon_key" TEXT,
  "star_reward" INTEGER NOT NULL DEFAULT 0,
  "crystal_reward" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mission_completion" (
  "id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "period" "MissionPeriod" NOT NULL,
  "period_key" TEXT NOT NULL,
  "star_awarded" INTEGER NOT NULL,
  "crystal_awarded" INTEGER NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "feedback_rating" "MissionFeedbackRating",
  "feedback_comment" TEXT,
  "feedback_created_at" TIMESTAMP(3),
  "feedback_updated_at" TIMESTAMP(3),
  CONSTRAINT "mission_completion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "category" "GameCategory" NOT NULL,
  "cover_url" TEXT,
  "star_reward" INTEGER NOT NULL DEFAULT 0,
  "crystal_reward" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogStatus" NOT NULL DEFAULT 'COMING_SOON',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_content" (
  "id" UUID NOT NULL,
  "type" "LibraryContentType" NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnail_url" TEXT,
  "media_url" TEXT,
  "duration_seconds" INTEGER,
  "status" "CatalogStatus" NOT NULL DEFAULT 'COMING_SOON',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_content_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mission_period_is_active_display_order_idx" ON "mission"("period", "is_active", "display_order");
CREATE UNIQUE INDEX "mission_completion_child_id_mission_id_period_period_key_key"
  ON "mission_completion"("child_id", "mission_id", "period", "period_key");
CREATE INDEX "mission_completion_child_id_period_period_key_idx"
  ON "mission_completion"("child_id", "period", "period_key");
CREATE INDEX "mission_completion_mission_id_idx" ON "mission_completion"("mission_id");
CREATE INDEX "game_category_status_display_order_idx" ON "game"("category", "status", "display_order");
CREATE INDEX "library_content_type_status_display_order_idx" ON "library_content"("type", "status", "display_order");

ALTER TABLE "mission"
  ADD CONSTRAINT "mission_star_reward_nonnegative" CHECK ("star_reward" >= 0),
  ADD CONSTRAINT "mission_crystal_reward_nonnegative" CHECK ("crystal_reward" >= 0);
ALTER TABLE "mission_completion"
  ADD CONSTRAINT "mission_completion_star_awarded_nonnegative" CHECK ("star_awarded" >= 0),
  ADD CONSTRAINT "mission_completion_crystal_awarded_nonnegative" CHECK ("crystal_awarded" >= 0);
ALTER TABLE "game"
  ADD CONSTRAINT "game_star_reward_nonnegative" CHECK ("star_reward" >= 0),
  ADD CONSTRAINT "game_crystal_reward_nonnegative" CHECK ("crystal_reward" >= 0);
ALTER TABLE "library_content"
  ADD CONSTRAINT "library_content_duration_nonnegative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);

ALTER TABLE "mission_completion"
  ADD CONSTRAINT "mission_completion_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_completion"
  ADD CONSTRAINT "mission_completion_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
