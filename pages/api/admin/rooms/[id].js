import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PUT") {
    const { block, floor, room_number, room_type, capacity, monthly_rent, status } = req.body || {};
    const result = await query(
      `UPDATE rooms SET block=$1, floor=$2, room_number=$3, room_type=$4, capacity=$5, monthly_rent=$6, status=$7
       WHERE id=$8 RETURNING *`,
      [block || null, floor || null, room_number, room_type, capacity, monthly_rent || 0, status || "Available", id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "DELETE") {
    const inUse = await query("SELECT COUNT(*)::int AS c FROM students WHERE room_id = $1", [id]);
    if (inUse.rows[0].c > 0) {
      return res.status(400).json({ error: "Cannot delete a room with allocated students" });
    }
    await query("DELETE FROM rooms WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
