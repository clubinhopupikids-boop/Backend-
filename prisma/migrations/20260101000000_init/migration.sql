-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('PT_BR', 'EN', 'ES');

-- CreateEnum
CREATE TYPE "DevelopmentProfile" AS ENUM ('TYPICAL_DEVELOPMENT', 'TEA', 'ADHD', 'DOWN_SYNDROME', 'MILD_INTELLECTUAL_DISABILITY', 'DEVELOPMENTAL_DELAY', 'LEARNING_DISABILITIES', 'SENSORY_SENSITIVITY', 'LOW_VISION', 'HIGH_ABILITIES_GIFTEDNESS', 'PREFER_NOT_TO_INFORM');

-- CreateTable
CREATE TABLE "communication_mode" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_mode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsible" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'PT_BR',
    "terms_accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child" (
    "id" UUID NOT NULL,
    "responsible_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "primary_language" "Language" NOT NULL DEFAULT 'PT_BR',
    "development_profile" "DevelopmentProfile",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_settings" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "animation_speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sound_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "visual_stimulus_level" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "pupi_response_time" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "pupi_speech_frequency" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "instruction_complexity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "max_simultaneous_interactive_elements" INTEGER NOT NULL DEFAULT 3,
    "narration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "music_enabled" BOOLEAN NOT NULL DEFAULT true,
    "visual_effects_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_communication_mode" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "communication_mode_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_communication_mode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_mode_code_key" ON "communication_mode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "responsible_email_key" ON "responsible"("email");

-- CreateIndex
CREATE INDEX "child_responsible_id_idx" ON "child"("responsible_id");

-- CreateIndex
CREATE UNIQUE INDEX "experience_settings_child_id_key" ON "experience_settings"("child_id");

-- CreateIndex
CREATE INDEX "child_communication_mode_communication_mode_id_idx" ON "child_communication_mode"("communication_mode_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_communication_mode_child_id_communication_mode_id_key" ON "child_communication_mode"("child_id", "communication_mode_id");

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "responsible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_settings" ADD CONSTRAINT "experience_settings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_communication_mode" ADD CONSTRAINT "child_communication_mode_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_communication_mode" ADD CONSTRAINT "child_communication_mode_communication_mode_id_fkey" FOREIGN KEY ("communication_mode_id") REFERENCES "communication_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
