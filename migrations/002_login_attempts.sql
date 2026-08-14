-- migrations/002_login_attempts.sql
-- Run this once against your EXISTING Neon Postgres database to add
-- login rate limiting (locks out repeated failed login attempts):
--   psql "$DATABASE_URL" -f migrations/002_login_attempts.sql
-- or paste it into the Neon SQL editor.
--
-- Safe to re-run — every statement is idempotent.

CREATE TABLE IF NOT EXISTS login_attempts (
  id               SERIAL PRIMARY KEY,
  identifier       TEXT UNIQUE NOT NULL,
  attempts         INT NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
