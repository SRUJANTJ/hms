import { withAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

// Body: { room_id }  -> allocate/transfer to a new room
// Body: { checkout: true } -> vacate current room + mark student CheckedOut
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { id } = req.query;
  const { room_id, checkout } = req.body || {};

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const studentResult = await client.query("SELECT room_id FROM students WHERE id = $1 FOR UPDATE", [id]);
    if (studentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }
    const oldRoomId = studentResult.rows[0].room_id;

    if (oldRoomId) {
      await client.query(
        "UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), status = 'Available' WHERE id = $1",
        [oldRoomId]
      );
    }

    if (checkout) {
      await client.query(
        "UPDATE students SET room_id = NULL, status = 'CheckedOut', check_out_date = CURRENT_DATE WHERE id = $1",
        [id]
      );
      await client.query("COMMIT");
      return res.status(200).json({ ok: true, message: "Student checked out" });
    }

    if (!room_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "room_id is required" });
    }

    const roomResult = await client.query("SELECT capacity, occupied FROM rooms WHERE id = $1 FOR UPDATE", [room_id]);
    if (roomResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult.rows[0];
    if (room.occupied >= room.capacity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Room is already full" });
    }

    await client.query(
      "UPDATE students SET room_id = $1, status = 'Active' WHERE id = $2",
      [room_id, id]
    );
    await client.query(
      `UPDATE rooms SET occupied = occupied + 1, status = CASE WHEN occupied + 1 >= capacity THEN 'Full' ELSE status END
       WHERE id = $1`,
      [room_id]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, message: "Room allocated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("allocate error", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
}

export default withAuth(handler, ["admin", "warden"]);
