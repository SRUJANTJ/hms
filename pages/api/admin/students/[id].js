import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const result = await query(
      `
    SELECT
        s.*,
        u.name,
        u.email,
        u.phone,
        u.image,
        r.room_number,
        r.block,
        h.name AS hostel
    FROM students s
    JOIN users u
        ON u.id = s.user_id
    LEFT JOIN rooms r
        ON r.id = s.room_id
    LEFT JOIN hostels h
        ON h.id = s.hostel_id
    WHERE s.id = $1
    `,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "PUT") {
    const {
      name, phone, image, password,
      roll_number, course, year, gender, dob, address,
      guardian_name, guardian_phone, emergency_contact, id_proof,
      status, room_id, hostel_id,
    } = req.body || {};

    const current = await query(
      "SELECT user_id, room_id, hostel_id, hostel_name FROM students WHERE id = $1",
      [id]
    );
    if (current.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const userId = current.rows[0].user_id;
    const oldRoomId = current.rows[0].room_id;

    // Only hash + touch password_hash if a new password was actually typed
    // (the edit form leaves this blank to mean "keep current password").
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // The edit form always sends both `room_id` and `hostel_id` (as ""
    // when unset), so their presence in the body tells us the admin is
    // actively setting/changing them here — this is what lets a student
    // who previously had NO hostel/room go from unassigned -> assigned,
    // and also lets an already-assigned student be moved or cleared,
    // all from the same Edit form (not just the inline room dropdown).
    const roomIdProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "room_id");
    const hostelIdProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "hostel_id");

    let finalRoomId = current.rows[0].room_id;
    let finalHostelId = current.rows[0].hostel_id;
    let finalHostelName = current.rows[0].hostel_name;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let roomJustAssigned = false;

      if (roomIdProvided) {
        const requestedRoomId = room_id || null;

        if (requestedRoomId !== oldRoomId) {
          // Free up the old room, if any.
          if (oldRoomId) {
            await client.query(
              "UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), status = 'Available' WHERE id = $1",
              [oldRoomId]
            );
          }

          if (requestedRoomId) {
            const roomLookup = await client.query(
              `SELECT r.hostel_id, h.name AS hostel_name, r.capacity, r.occupied
               FROM rooms r LEFT JOIN hostels h ON h.id = r.hostel_id
               WHERE r.id = $1 FOR UPDATE OF r`,
              [requestedRoomId]
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

            await client.query(
              `UPDATE rooms SET occupied = occupied + 1,
                 status = CASE WHEN occupied + 1 >= capacity THEN 'Full' ELSE status END
               WHERE id = $1`,
              [requestedRoomId]
            );

            // A room's own hostel_id is always the source of truth for
            // which building a student belongs to, same rule as on create.
            finalRoomId = requestedRoomId;
            finalHostelId = room.hostel_id;
            finalHostelName = room.hostel_name;
            roomJustAssigned = true;
          } else {
            // Room explicitly cleared.
            finalRoomId = null;
          }
        }
      }

      // A hostel/building can also be assigned (or cleared) on its own,
      // with no specific room picked yet. Skip this when a room was just
      // assigned above — the room's hostel always wins over a standalone
      // hostel_id so the two can never disagree.
      if (hostelIdProvided && !roomJustAssigned) {
        if (hostel_id) {
          const hostelLookup = await client.query("SELECT name FROM hostels WHERE id = $1", [hostel_id]);
          if (hostelLookup.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Hostel not found" });
          }
          finalHostelId = hostel_id;
          finalHostelName = hostelLookup.rows[0].name;
        } else if (!finalRoomId) {
          // Cleared, and there's no room left to derive a hostel from.
          finalHostelId = null;
          finalHostelName = null;
        }
      }

      await client.query(
        `UPDATE users SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           image = COALESCE($3, image),
           password_hash = COALESCE($4, password_hash)
         WHERE id = $5`,
        [name || null, phone || null, image || null, passwordHash, userId]
      );

      const result = await client.query(
        `UPDATE students SET
           roll_number = COALESCE($1, roll_number),
           course = COALESCE($2, course), year = COALESCE($3, year), gender = COALESCE($4, gender),
           dob = COALESCE($5, dob), address = COALESCE($6, address),
           guardian_name = COALESCE($7, guardian_name), guardian_phone = COALESCE($8, guardian_phone),
           emergency_contact = COALESCE($9, emergency_contact), id_proof = COALESCE($10, id_proof),
           status = COALESCE($11, status),
           room_id = $12,
           hostel_id = $13,
           hostel_name = $14
         WHERE id = $15 RETURNING *`,
        [
          roll_number || null, course || null, year || null, gender || null,
          dob || null, address || null, guardian_name || null, guardian_phone || null,
          emergency_contact || null, id_proof || null, status || null,
          finalRoomId, finalHostelId, finalHostelName,
          id,
        ]
      );

      await client.query("COMMIT");
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return res.status(409).json({ error: "Roll number already exists" });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (req.method === "DELETE") {
    const student = await query("SELECT user_id, room_id FROM students WHERE id = $1", [id]);
    if (student.rowCount === 0) return res.status(404).json({ error: "Not found" });
    if (student.rows[0].room_id) {
      await query("UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), status = 'Available' WHERE id = $1", [
        student.rows[0].room_id,
      ]);
    }
    await query("DELETE FROM users WHERE id = $1", [student.rows[0].user_id]); // cascades to students
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
