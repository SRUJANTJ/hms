import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  // UPDATE hostel
  if (req.method === "PUT") {
    const { name, address, capacity, warden_id } = req.body || {};

    const result = await query(
      `UPDATE hostels
       SET name = $1,
           address = $2,
           capacity = $3,
           warden_id = $4
       WHERE id = $5
       RETURNING *`,
      [
        name,
        address || null,
        capacity !== undefined && capacity !== "" ? Number(capacity) : null,
        warden_id || null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Hostel not found" });
    }

    return res.status(200).json(result.rows[0]);
  }

  // DELETE hostel
  if (req.method === "DELETE") {
    // Optional: check if any rooms belong to this hostel before deleting
    const roomsCount = await query(
      "SELECT COUNT(*)::int AS c FROM rooms WHERE hostel_id = $1",
      [id]
    );

    if (roomsCount.rows[0].c > 0) {
      return res
        .status(400)
        .json({ error: "Cannot delete hostel that has rooms. Delete rooms first." });
    }

    await query("DELETE FROM hostels WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withAuth(handler, ["admin"]);