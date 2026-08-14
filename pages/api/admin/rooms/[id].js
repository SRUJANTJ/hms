import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  // UPDATE room
  if (req.method === "PUT") {
    const {
      hostel_id,
      block,
      floor,
      room_number,
      room_type,
      capacity,
      monthly_rent,
      status,
    } = req.body || {};

    const result = await query(
      `UPDATE rooms
       SET hostel_id = $1,
           block = $2,
           floor = $3,
           room_number = $4,
           room_type = $5,
           capacity = $6,
           monthly_rent = $7,
           status = $8
       WHERE id = $9
       RETURNING *`,
      [
        hostel_id || null,
        block || null,
        floor || null,
        room_number,
        room_type || "Double",
        Number(capacity) || 2,
        Number(monthly_rent) || 0,
        status || "Available",
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json(result.rows[0]);
  }

  // DELETE room
  if (req.method === "DELETE") {
    const inUse = await query(
      "SELECT COUNT(*)::int AS c FROM students WHERE room_id = $1",
      [id]
    );

    if (inUse.rows[0].c > 0) {
      return res
        .status(400)
        .json({ error: "Cannot delete a room with allocated students" });
    }

    await query("DELETE FROM rooms WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withAuth(handler, ["admin"]);