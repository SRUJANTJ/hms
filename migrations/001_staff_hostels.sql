-- migrations/001_staff_hostels.sql
-- Run this once against your EXISTING Neon Postgres database to add
-- support for assigning a warden/staff member to multiple hostel
-- blocks/buildings:
--   psql "$DATABASE_URL" -f migrations/001_staff_hostels.sql
-- or paste it into the Neon SQL editor.
--
-- Safe to re-run — every statement is idempotent.

CREATE TABLE IF NOT EXISTS staff_hostels (
  id          SERIAL PRIMARY KEY,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  hostel_id   INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (staff_id, hostel_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_hostels_staff ON staff_hostels(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_hostels_hostel ON staff_hostels(hostel_id);

-- Carry forward anyone who already had a single hostel_id assigned
-- on the staff row, so existing wardens/staff don't lose access.
INSERT INTO staff_hostels (staff_id, hostel_id)
SELECT id, hostel_id FROM staff WHERE hostel_id IS NOT NULL
ON CONFLICT (staff_id, hostel_id) DO NOTHING;
