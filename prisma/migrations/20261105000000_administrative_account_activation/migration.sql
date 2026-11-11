CREATE TABLE "administrative_account_activation" (
    "responsible_id" UUID PRIMARY KEY REFERENCES "responsible"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "activated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_by" TEXT NOT NULL CHECK (btrim("authorized_by") <> ''),
    "authorization_ref" TEXT NOT NULL CHECK (btrim("authorization_ref") <> ''),
    "holder_consent_confirmed" BOOLEAN NOT NULL CHECK ("holder_consent_confirmed"),
    CONSTRAINT "administrative_account_activation_allowed_responsible" CHECK (
        "responsible_id" IN (
            'd1f20223-45c5-47e5-bc9d-9b589ffba095'::uuid,
            'e695a668-60d1-4d96-a064-7fbb650c32ba'::uuid
        )
    )
);
