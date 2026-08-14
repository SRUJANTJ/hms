import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

// Normalizes whatever the client sent for hostel(s) into a clean
// array of unique integer hostel IDs. Accepts the new `hostel_ids`
// (array) as well as the legacy single `hostel_id`, so old clients
// still work.
function normalizeHostelIds(body) {
  const raw = Array.isArray(body?.hostel_ids)
    ? body.hostel_ids
    : body?.hostel_id
      ? [body.hostel_id]
      : [];

  const ids = raw
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isInteger(v));

  return [...new Set(ids)];
}

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT st.*, u.name, u.email, u.phone, u.image, u.role, u.is_active,
              COALESCE(
                (SELECT json_agg(json_build_object('id', h.id, 'name', h.name) ORDER BY h.name)
                 FROM staff_hostels sh
                 JOIN hostels h ON h.id = sh.hostel_id
                 WHERE sh.staff_id = st.id),
                '[]'
              ) AS hostels
       FROM staff st
       JOIN users u ON u.id = st.user_id
       ORDER BY st.created_at DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { name, email, phone, password, image, designation, salary, role } = req.body || {};
    if (!name || !email || !password || !designation) {
      return res.status(400).json({ error: "Name, email, password and designation are required" });
    }
    const userRole = role === "warden" ? "warden" : "staff";
    const hostelIds = normalizeHostelIds(req.body);

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
        [userResult.rows[0].id, designation, hostelIds[0] || null, salary || 0]
      );
      const staffId = staffResult.rows[0].id;

      for (const hostelId of hostelIds) {
        await client.query(
          `INSERT INTO staff_hostels (staff_id, hostel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [staffId, hostelId]
        );
      }

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
