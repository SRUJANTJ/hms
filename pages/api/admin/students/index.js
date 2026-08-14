import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
   const result = await query(
  `SELECT
    s.*,
    u.name,
    u.email,
    u.phone,
    u.image,
    r.room_number,
    r.block,
    COALESCE(s.hostel_name, h.name) AS hostel_name
FROM students s
JOIN users u
    ON u.id = s.user_id
LEFT JOIN rooms r
    ON r.id = s.room_id
LEFT JOIN hostels h
    ON h.id = s.hostel_id
ORDER BY s.created_at DESC;`
);
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const {
      name, email, phone, password, image,
      roll_number, course, year, gender, dob, address,
      guardian_name, guardian_phone, emergency_contact, id_proof,
      room_id, hostel_id, check_in_date,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // If a room is being assigned, the room's own hostel_id is the
      // source of truth - it overrides whatever hostel_id the client
      // sent, so a student can never end up linked to a room that
      // actually lives in a different hostel than their hostel_id says.
     let finalHostelId = hostel_id || null;
let finalHostelName = null;

      if (room_id) {
    const roomLookup = await client.query(
  `
  SELECT
      r.hostel_id,
      h.name AS hostel_name,
      r.capacity,
      r.occupied
  FROM rooms r
  LEFT JOIN hostels h
      ON h.id = r.hostel_id
  WHERE r.id = $1
  FOR UPDATE OF r
  `,
  [room_id]
);

        if (roomLookup.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Room not found" });
        }

        const room = roomLookup.rows[0];
        if (room.occupied >= room.capacity) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Room is already full" });
        }

        finalHostelId = room.hostel_id;
        finalHostelName = room.hostel_name;
      }

      const hash = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, image)
         VALUES ($1,$2,$3,$4,'student',$5) RETURNING id`,
        [name, email.toLowerCase().trim(), phone || null, hash, image || null]
      );
      const userId = userResult.rows[0].id;

      const studentResult = await client.query(
        `INSERT INTO students
(
user_id,
roll_number,
course,
year,
gender,
dob,
address,
guardian_name,
guardian_phone,
emergency_contact,
id_proof,
room_id,
hostel_id,
hostel_name,
check_in_date
)
VALUES
(
$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
)
RETURNING *`,
       [
  userId,
  roll_number || null,
  course || null,
  year || null,
  gender || null,
  dob || null,
  address || null,
  guardian_name || null,
  guardian_phone || null,
  emergency_contact || null,
  id_proof || null,
  room_id || null,
  finalHostelId,
  finalHostelName,
  check_in_date || new Date().toISOString().slice(0, 10),
]
      );

      if (room_id) {
        await client.query(
          `UPDATE rooms SET occupied = occupied + 1,
             status = CASE WHEN occupied + 1 >= capacity THEN 'Full' ELSE status END
           WHERE id = $1`,
          [room_id]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json(studentResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return res.status(409).json({ error: "Email or roll number already exists" });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  res.status(405).end();
}

// Admin: full access (list + create).
// Warden: create only ("Add new student" is optional/permission-based
// for wardens per the role matrix) - the warden UI never calls GET on
// this route, it uses /api/warden/students for listing instead.
export default withAuth(handler, ["admin", "warden"]);