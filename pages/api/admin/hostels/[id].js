import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PUT") {
    const { name, address, capacity, warden_id } = req.body || {};
    const result = await query(
      `UPDATE hostels SET name=$1, address=$2, capacity=$3, warden_id=$4 WHERE id=$5 RETURNING *`,
      [name, address || null, capacity || 0, warden_id || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "DELETE") {
    await query("DELETE FROM hostels WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
