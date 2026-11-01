-- Sign-in sessions for the API server, plus sync bookkeeping.
BEGIN;

-- One row per signed-in device. Only a SHA-256 hash of the token is stored, so a copy of the
-- database can't be used to sign in.
CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    char(64) NOT NULL UNIQUE,
  device        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- What the last upload from the app looked like, so a download can be checked against the
-- app version that reads it.
CREATE TABLE IF NOT EXISTS sync_state (
  user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  app_schema   integer NOT NULL,
  exported_at  timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- The phone's database has no foreign key on payments.installment_id, so an upload can carry an
-- id whose installment plan was rebuilt. Keep the value without enforcing it.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_installment_id_fkey;

-- The app stores installments.paid_at as a calendar date (YYYY-MM-DD), not a timestamp.
ALTER TABLE installments ALTER COLUMN paid_at TYPE date USING paid_at::date;

COMMIT;
