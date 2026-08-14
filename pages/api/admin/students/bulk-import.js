import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

// Body: { rows: [ { name, email, password, phone, roll_number, course,
//                    year, gender, dob, address, guardian_name,
//                    guardian_phone, emergency_contact, block,
//                    room_number } , ... ] }
//
// Every row is processed in its own transaction so one bad row
// (duplicate email, full room, missing field...) never rolls back the
// rows that were valid. Returns a per-row result list so the UI can
// show exactly what happened.
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rows.length === 0) {
    return res.status(400).json({ error: "No rows to import" });
  }

  if (rows.length > 1000) {
    return res.status(400).json({ error: "Please import 1000 rows or fewer at a time" });
  }

  const pool = getPool();
  const results = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rawRow = rows[index] || {};
    const rowNumber = index + 2; // +1 header row, +1 to make it 1-based

    const name = String(rawRow.name || "").trim();
    const email = String(rawRow.email || "").trim().toLowerCase();
    const password = String(rawRow.password || "").trim();
    const phone = String(rawRow.phone || "").trim() || null;
    const roll_number = String(rawRow.roll_number || "").trim() || null;
    const course = String(rawRow.course || "").trim() || null;
    const year = String(rawRow.year || "").trim() || null;
    const gender = String(rawRow.gender || "").trim() || null;
    const dob = String(rawRow.dob || "").trim() || null;
    const address = String(rawRow.address || "").trim() || null;
    const guardian_name = String(rawRow.guardian_name || "").trim() || null;
    const guardian_phone = String(rawRow.guardian_phone || "").trim() || null;
    const emergency_contact = String(rawRow.emergency_contact || "").trim() || null;
    const block = String(rawRow.block || "").trim();
    const room_number = String(rawRow.room_number || "").trim();

    if (!name || !email || !password) {
      results.push({
        row: rowNumber,
        name: name || email || `Row ${rowNumber}`,
        success: false,
        error: "Name, email and password are required",
      });
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let room_id = null;
      let hostel_id = null;

      if (room_number) {
        const roomLookup = await client.query(
          `SELECT id, hostel_id, capacity, occupied FROM rooms
             WHERE lower(room_number) = lower($1)
               AND ($2 = '' OR lower(block) = lower($2))
             ORDER BY id LIMIT 1 FOR UPDATE`,
          [room_number, block]
        );

        if (roomLookup.rowCount === 0) {
          throw Object.assign(
            new Error(`Room "${block ? block + " - " : ""}${room_number}" was not found`),
            { code: "ROOM_NOT_FOUND" }
          );
        }

        const room = roomLookup.rows[0];

        if (room.occupied >= room.capacity) {
          throw Object.assign(
            new Error(`Room "${block ? block + " - " : ""}${room_number}" is already full`),
            { code: "ROOM_FULL" }
          );
        }

        room_id = room.id;
        hostel_id = room.hostel_id;
      }

      const hash = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1,$2,$3,$4,'student') RETURNING id`,
        [name, email, phone, hash]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO students
          (user_id, roll_number, course, year, gender, dob, address, guardian_name,
           guardian_phone, emergency_contact, room_id, hostel_id, check_in_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          userId, roll_number, course, year, gender, dob || null, address,
          guardian_name, guardian_phone, emergency_contact, room_id, hostel_id,
          new Date().toISOString().slice(0, 10),
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

      results.push({ row: rowNumber, name, email, success: true });
    } catch (err) {
      await client.query("ROLLBACK");

      let message = err.message || "Failed to import this row";
      if (err.code === "23505") {
        message = "Email or roll number already exists";
      }

      results.push({ row: rowNumber, name: name || email, success: false, error: message });
    } finally {
      client.release();
    }
  }

  const createdCount = results.filter((r) => r.success).length;

  return res.status(200).json({
    createdCount,
    failedCount: results.length - createdCount,
    results,
  });
}

export default withAuth(handler, ["admin", "warden"]);