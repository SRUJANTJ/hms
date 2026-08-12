import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT st.*, u.name, u.email, u.phone, u.image, u.role, h.name AS hostel_name
       FROM staff st
       JOIN users u ON u.id = st.user_id
       LEFT JOIN hostels h ON h.id = st.hostel_id
       ORDER BY st.created_at DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { name, email, phone, password, image, designation, hostel_id, salary, role } = req.body || {};
    if (!name || !email || !password || !designation) {
      return res.status(400).json({ error: "Name, email, password and designation are required" });
    }
    const userRole = role === "warden" ? "warden" : "staff";

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const hash = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, image) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [name, email.toLowerCase().trim(), phone || null, hash, userRole, image || null]
      );
      const staffResult = await client.query(
        `INSERT INTO staff (user_id, designation, hostel_id, salary) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userResult.rows[0].id, designation, hostel_id || null, salary || 0]
      );
      await client.query("COMMIT");
      return res.status(201).json(staffResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") return res.status(409).json({ error: "Email already exists" });
      throw err;
    } finally {
      client.release();
    }
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
