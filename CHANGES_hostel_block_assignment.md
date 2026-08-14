# What changed: multi-block staff/warden assignment

## 1. Database
- **`schema.sql`** — added a new `staff_hostels` table (many-to-many
  between `staff` and `hostels`), plus an idempotent backfill from
  the old single `staff.hostel_id` column. `staff.hostel_id` is kept
  as-is (now just a "primary block" convenience field) — nothing
  that reads it elsewhere breaks.
- **`migrations/001_staff_hostels.sql`** — the same change as a
  standalone script, for people who already have a live database and
  don't want to re-run the whole `schema.sql`. Safe to run more than
  once.

## 2. Backend
- **`lib/hostelAccess.js`** (new) — helpers to look up which
  hostel/block IDs (or full `{id, name}` records) a given warden/staff
  user has been assigned to.
- **`pages/api/admin/staff/index.js`**
  - `GET` now returns a `hostels: [{id, name}, ...]` array per staff
    member (in addition to the existing columns).
  - `POST` now accepts `hostel_ids: [1, 2, 3]` (an array) instead of
    a single `hostel_id`. It still accepts the old singular
    `hostel_id` for backward compatibility.
- **`pages/api/admin/staff/[id].js`**
  - `PUT` now accepts `hostel_ids` (array) and replaces the staff
    member's block assignments transactionally. Sending `hostel_ids: []`
    intentionally unassigns every block. Omitting the field entirely
    leaves existing assignments untouched (so `toggleActive` /
    "Deactivate" clicks, which only send `is_active`, don't wipe
    anyone's blocks).
- **`pages/api/warden/students.js`** — rewritten. It no longer trusts
  a `hostel_id` sent by the client to decide what a warden can see.
  Instead it looks up the blocks that warden was actually assigned to
  (via `staff_hostels`) and returns students from **all** of them by
  default. An optional `?hostel_id=` lets the UI narrow to one block
  at a time, but only if that block is one the warden is actually
  assigned to.
- **`pages/api/warden/my-hostels.js`** (new) — returns the list of
  blocks/buildings the logged-in warden/staff user is responsible for,
  used to populate the block switcher in the UI.
- **`pages/api/warden/dashboard.js`** — the stat counts (students,
  complaints, leave requests, present-today) are now scoped to the
  warden's assigned block(s) instead of the whole hostel system.
  Admins still see system-wide totals.

## 3. Frontend
- **`pages/admin/staff/index.js`**
  - The "Hostel" dropdown when adding/editing a staff/warden member
    is now a **multi-select checkbox grid** — an admin can tick as
    many blocks/buildings as that person is responsible for.
  - The staff table's "Hostel / Block(s)" column shows a badge per
    assigned block (or "— unassigned —").
- **`pages/warden/students.js`**
  - Fixed a bug where the page tried to read `user.hostel_id`, which
    never existed on the logged-in user object — the student list
    was silently always empty/incorrect before this change.
  - Added a "My Block(s)" bar showing the warden's assigned block(s)
    as chips. If they manage more than one, they can switch between
    "All my blocks" and a single block. If they have none assigned
    yet, a clear message tells them to ask the admin.
  - Added a "Hostel" column to the student table so it's obvious
    which building each row belongs to when viewing multiple blocks
    at once.

## Not touched
- The admin Students page already showed the hostel/block column per
  student and derives it from the student's assigned room — left
  exactly as-is.
- Room/hostel (building) CRUD under **Rooms & Hostels** — unchanged.
- No existing endpoints, props, or table columns were renamed or
  removed; the singular `hostel_id` is still accepted by the staff
  APIs so nothing else in the app breaks.

## To apply
1. Copy these files over your project (or unzip on top of it).
2. Run the migration once against your database:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_staff_hostels.sql
   ```
3. Restart `npm run dev` / redeploy.

---

# Follow-up fix: /admin/students — missing password field + hostel not saving on edit

## Bug 1 — "Add Student" had no password input
The Add/Edit Student modal's form state always had a `password` field,
but no `<input>` for it was ever rendered — so every "Add Student"
submit silently failed against the API's `Name, email and password are
required` check.

**Fix (`pages/admin/students/index.js`):** added a real Password field
right after Phone — required when adding, optional ("leave blank to
keep current") when editing, same pattern already used on the
Staff/Warden page.

## Bug 2 — assigning/changing a hostel in Edit didn't save
The modal actually had **two conflicting Hostel/Room selector pairs**
stacked on top of each other: a leftover "Hostel Block" dropdown bound
to `form.block` (a leftover using the page's block-name filter list),
and — further down — the correct "Hostel" dropdown bound to
`form.hostel_id` (the real hostel/building list). Both pairs rendered
a `room_id` select, so picking a hostel+room could silently get
overwritten by the other pair's state.

On top of that, the backend (`pages/api/admin/students/[id].js`) PUT
handler **never read `room_id`/`hostel_id`/`password`/`roll_number`
from the request body at all** — so even a correctly-filled form had
nothing to save to.

**Fix:**
- Removed the duplicate/legacy "Hostel Block" + Room select pair from
  the modal — only the real Hostel + Room selects remain now.
- Rewrote the PUT handler to:
  - Actually persist `room_id`/`hostel_id` changes, transactionally
    updating room occupancy counts (same capacity checks the
    dedicated allocate endpoint uses) — this covers **both** a
    student who had no hostel/room before (now assigning one for the
    first time) and one who's being moved or unassigned.
  - A room's own hostel always wins if both a room and a hostel are
    selected together (same rule the "Add Student" endpoint already
    followed), but a hostel/building can also be set on its own with
    no room picked yet.
  - Hash and update the password only when a new one was actually
    typed.
  - Also now saves `roll_number`, which was likewise editable in the
    UI but silently dropped before.


---

# Follow-up fix: `FOR UPDATE` cannot lock across a `LEFT JOIN`

Postgres refuses `SELECT ... FOR UPDATE` when the row lock would need
to apply to the nullable side of an outer join. Both the "assign a
room" queries (`admin/students/[id].js` PUT and `admin/students/index.js`
POST) did `FROM rooms r LEFT JOIN hostels h ... FOR UPDATE`, which hit
exactly that. Fixed by scoping the lock to just the row actually being
changed: `FOR UPDATE OF r` instead of `FOR UPDATE`.

---

# Added: login rate limiting

Login had **no rate limiting at all** — unlimited password attempts,
no lockout, no delay. Added a DB-backed limiter (`login_attempts` table
+ `lib/rateLimit.js`), wired into `pages/api/auth/login.js`, which
already handles all three login pages (student, warden, admin — they
all POST to the same endpoint with a different `role`).

**How it works:**
- Tracks failed attempts by `IP + email + role`, so brute-forcing one
  account's password gets locked out, without one person being able to
  lock out someone else's account by guessing their email from a
  different IP.
- 5 failed attempts within a 15-minute window → locked out for 15
  minutes. Both numbers are constants at the top of `lib/rateLimit.js`
  if you want to tune them.
- A deactivated-account response doesn't count as a failed attempt
  (that's not a brute-force signal).
- A successful login clears the counter for that identifier.
- Returns HTTP 429 with a friendly "Too many failed attempts. Try
  again in N minutes." message — no frontend changes were needed since
  all three login pages already do `if (!res.ok) throw new
  Error(data.error)`.

**New migration to run:**
```bash
psql "$DATABASE_URL" -f migrations/002_login_attempts.sql
```
