-- CommunicationMode is lookup data required by the atomic child-creation contract.
-- This is idempotent and preserves any existing production data.
INSERT INTO "communication_mode" ("id", "code", "label", "created_at", "updated_at")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'VOICE', 'Fala / voz', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000002', 'IMAGES_SYMBOLS', 'Imagens ou símbolos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000003', 'TOUCH', 'Toque / apontar', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000004', 'TEXT', 'Texto', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000005', 'SUPPORTED_COMMUNICATION', 'Comunicação com apoio', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "label" = EXCLUDED."label", "updated_at" = CURRENT_TIMESTAMP;
