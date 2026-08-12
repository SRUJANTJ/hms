import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT h.*, u.name AS warden_name
       FROM hostels h LEFT JOIN users u ON u.id = h.warden_id
       ORDER BY h.created_at DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { name, address, capacity, warden_id } = req.body || {};
    if (!name) return res.status(400).json({ error: "Name is required" });
    const result = await query(
      `INSERT INTO hostels (name, address, capacity, warden_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, address || null, capacity || 0, warden_id || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
