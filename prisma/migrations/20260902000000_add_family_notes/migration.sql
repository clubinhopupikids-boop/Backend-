-- Add the private family notebook without changing existing child or account data.
-- The composite relationship guarantees that responsible_id and child_id always
-- identify the same family, in addition to the service-level ownership checks.

CREATE UNIQUE INDEX "child_id_responsible_id_key"
  ON "child"("id", "responsible_id");

CREATE TABLE "family_note" (
  "id" UUID NOT NULL,
  "responsible_id" UUID NOT NULL,
  "child_id" UUID NOT NULL,
  "client_request_id" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "family_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "family_note_child_id_observed_at_idx"
  ON "family_note"("child_id", "observed_at");

CREATE INDEX "family_note_responsible_id_child_id_idx"
  ON "family_note"("responsible_id", "child_id");

CREATE UNIQUE INDEX "family_note_responsible_id_child_id_client_request_id_key"
ON "family_note"("responsible_id", "child_id", "client_request_id");

ALTER TABLE "family_note"
  ADD CONSTRAINT "family_note_responsible_id_fkey"
  FOREIGN KEY ("responsible_id") REFERENCES "responsible"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_note"
  ADD CONSTRAINT "family_note_child_id_responsible_id_fkey"
  FOREIGN KEY ("child_id", "responsible_id")
  REFERENCES "child"("id", "responsible_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
