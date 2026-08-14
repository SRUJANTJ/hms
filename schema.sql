-- schema.sql
-- Run this once against your Neon Postgres database:
--   psql "$DATABASE_URL" -f schema.sql
-- or paste it into the Neon SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== USERS (admin / warden / student / staff) ==========
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','warden','student','staff')),
  image         TEXT,               -- base64 data-url, stored directly in DB
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== LOGIN RATE LIMITING ==========
-- Tracks failed login attempts per (IP + email + role) so brute-forcing
-- a single account's password gets locked out for a cooldown period.
CREATE TABLE IF NOT EXISTS login_attempts (
  id               SERIAL PRIMARY KEY,
  identifier       TEXT UNIQUE NOT NULL,   -- e.g. "1.2.3.4:jane@x.com:student"
  attempts         INT NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);

-- ========== HOSTELS / BLOCKS ==========
CREATE TABLE IF NOT EXISTS hostels (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  address     TEXT,
  warden_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  capacity    INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ========== ROOMS ==========
CREATE TABLE IF NOT EXISTS rooms (
  id            SERIAL PRIMARY KEY,
  hostel_id     INT REFERENCES hostels(id) ON DELETE CASCADE,
  block         VARCHAR(50),
  floor         VARCHAR(20),
  room_number   VARCHAR(20) NOT NULL,
  room_type     VARCHAR(20) NOT NULL CHECK (room_type IN ('Single','Double','Triple','Dormitory')),
  capacity      INT NOT NULL DEFAULT 1,
  occupied      INT NOT NULL DEFAULT 0,
  monthly_rent  NUMERIC(10,2) DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available','Full','Maintenance')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hostel_id, room_number)
);

-- ========== STUDENTS (profile, linked 1:1 to users) ==========
CREATE TABLE IF NOT EXISTS students (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  roll_number        VARCHAR(50) UNIQUE,
  course             VARCHAR(100),
  year               VARCHAR(20),
  gender             VARCHAR(10),
  dob                DATE,
  address            TEXT,
  guardian_name      VARCHAR(150),
  guardian_phone     VARCHAR(20),
  emergency_contact  VARCHAR(20),
  id_proof           TEXT,
  room_id            INT REFERENCES rooms(id) ON DELETE SET NULL,
  hostel_id          INT REFERENCES hostels(id) ON DELETE SET NULL,
  hostel_name        VARCHAR(150),      -- NEW COLUMN
  check_in_date      DATE,
  check_out_date     DATE,
  status             VARCHAR(20) DEFAULT 'Active'
      CHECK (status IN ('Active','CheckedOut','Suspended')),
  created_at         TIMESTAMPTZ DEFAULT now()
);
-- ========== STAFF (warden/security/housekeeping profile) ==========
CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  designation   VARCHAR(100),        -- Warden / Security / Housekeeping / Electrician...
  hostel_id     INT REFERENCES hostels(id) ON DELETE SET NULL,
  salary        NUMERIC(10,2) DEFAULT 0,
  joined_date   DATE DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== STAFF <-> HOSTEL/BLOCK ASSIGNMENTS (many-to-many) ==========
-- A warden/staff member can be made responsible for one or more
-- hostel blocks/buildings. `staff.hostel_id` above is kept as a
-- "primary" block for backward compatibility, but the full set of
-- blocks a staff member is responsible for lives here.
CREATE TABLE IF NOT EXISTS staff_hostels (
  id          SERIAL PRIMARY KEY,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  hostel_id   INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (staff_id, hostel_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_hostels_staff ON staff_hostels(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_hostels_hostel ON staff_hostels(hostel_id);

-- Backfill: anyone who already had a single hostel_id gets that
-- carried over into the new many-to-many table. Safe to re-run.
INSERT INTO staff_hostels (staff_id, hostel_id)
SELECT id, hostel_id FROM staff WHERE hostel_id IS NOT NULL
ON CONFLICT (staff_id, hostel_id) DO NOTHING;

-- ========== FEES ==========
CREATE TABLE IF NOT EXISTS fees (
  id            SERIAL PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_type      VARCHAR(30) DEFAULT 'Monthly Rent' CHECK (fee_type IN ('Monthly Rent','Security Deposit','Late Fee','Other')),
  amount        NUMERIC(10,2) NOT NULL,
  due_date      DATE NOT NULL,
  paid_date     DATE,
  status        VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Overdue')),
  remarks       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== ATTENDANCE ==========
CREATE TABLE IF NOT EXISTS attendance (
  id            SERIAL PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status        VARCHAR(10) DEFAULT 'Present' CHECK (status IN ('Present','Absent','Leave')),
  marked_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  entry_time    TIME,
  exit_time     TIME,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, date)
);

-- ========== COMPLAINTS ==========
CREATE TABLE IF NOT EXISTS complaints (
  id            SERIAL PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  category      VARCHAR(50) DEFAULT 'General', -- Electric/Plumbing/Cleaning/General/Other
  title         VARCHAR(150) NOT NULL,
  description   TEXT,
  status        VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open','InProgress','Resolved','Rejected')),
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== LEAVE REQUESTS ==========
CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  reason        TEXT,
  status        VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== VISITORS ==========
CREATE TABLE IF NOT EXISTS visitors (
  id              SERIAL PRIMARY KEY,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  visitor_name    VARCHAR(150) NOT NULL,
  visitor_phone   VARCHAR(20),
  purpose         TEXT,
  id_proof_note   VARCHAR(150),
  status          VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','CheckedOut')),
  check_in_time   TIMESTAMPTZ,
  check_out_time  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ========== INVENTORY ==========
CREATE TABLE IF NOT EXISTS inventory (
  id            SERIAL PRIMARY KEY,
  hostel_id     INT REFERENCES hostels(id) ON DELETE CASCADE,
  item_name     VARCHAR(150) NOT NULL,
  category      VARCHAR(50),      -- Furniture/Electronics/Bedding...
  quantity      INT DEFAULT 0,
  condition     VARCHAR(20) DEFAULT 'Good',
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  message       TEXT NOT NULL,
  audience      VARCHAR(20) DEFAULT 'All' CHECK (audience IN ('All','Students','Wardens','Staff')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========== ACTIVITY LOG ==========
CREATE TABLE IF NOT EXISTS activity_log (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_students_room ON students(room_id);
CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(student_id);
