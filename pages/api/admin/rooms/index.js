import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT r.*, h.name AS hostel_name
       FROM rooms r LEFT JOIN hostels h ON h.id = r.hostel_id
       ORDER BY r.created_at DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { hostel_id, block, floor, room_number, room_type, capacity, monthly_rent } = req.body || {};
    if (!room_number || !room_type || !capacity) {
      return res.status(400).json({ error: "room_number, room_type and capacity are required" });
    }
    try {
      const result = await query(
        `INSERT INTO rooms (hostel_id, block, floor, room_number, room_type, capacity, monthly_rent)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [hostel_id || null, block || null, floor || null, room_number, room_type, capacity, monthly_rent || 0]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Room number already exists in this hostel" });
      throw err;
    }
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
