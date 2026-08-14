import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

function normalizeHostelIds(raw) {
  const ids = raw
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isInteger(v));
  return [...new Set(ids)];
}

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PUT") {
    const {
      name, phone, image, password, role,
      designation, salary, is_active, hostel_ids,
    } = req.body || {};

    const staffRow = await query("SELECT user_id FROM staff WHERE id = $1", [id]);
    if (staffRow.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const userId = staffRow.rows[0].user_id;

    // Only hash + touch password_hash if a new password was actually typed
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Was a hostel_ids array sent at all? (An empty array is a valid
    // request meaning "unassign every block" - only `undefined` means
    // "the client didn't touch this field".)
    const hostelIdsProvided = Array.isArray(hostel_ids);
    const newHostelIds = hostelIdsProvided ? normalizeHostelIds(hostel_ids) : null;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE users SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           image = COALESCE($3, image),
           password_hash = COALESCE($4, password_hash),
           role = COALESCE($5, role),
           is_active = COALESCE($6, is_active)
         WHERE id = $7`,
        [
          name || null,
          phone || null,
          image || null,
          passwordHash,
          role || null,
          typeof is_active === "boolean" ? is_active : null,
          userId,
        ]
      );

      await client.query(
        `UPDATE staff SET
           designation = COALESCE($1, designation),
           salary = COALESCE($2, salary),
           hostel_id = COALESCE($3, hostel_id)
         WHERE id = $4`,
        [designation || null, salary || null, hostelIdsProvided ? (newHostelIds[0] || null) : null, id]
      );

      if (hostelIdsProvided) {
        await client.query(`DELETE FROM staff_hostels WHERE staff_id = $1`, [id]);
        for (const hostelId of newHostelIds) {
          await client.query(
            `INSERT INTO staff_hostels (staff_id, hostel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [id, hostelId]
          );
        }
        // hostel_id is a "primary block" convenience column and can
        // legitimately become NULL when every block is unassigned -
        // COALESCE above would skip that, so set it explicitly here.
        if (newHostelIds.length === 0) {
          await client.query(`UPDATE staff SET hostel_id = NULL WHERE id = $1`, [id]);
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const updated = await query(
      `SELECT st.*, u.name, u.email, u.phone, u.image, u.role, u.is_active,
              COALESCE(
                (SELECT json_agg(json_build_object('id', h.id, 'name', h.name) ORDER BY h.name)
                 FROM staff_hostels sh
                 JOIN hostels h ON h.id = sh.hostel_id
                 WHERE sh.staff_id = st.id),
                '[]'
              ) AS hostels
       FROM staff st JOIN users u ON u.id = st.user_id WHERE st.id = $1`,
      [id]
    );

    return res.status(200).json(updated.rows[0]);
  }

  if (req.method === "DELETE") {
    const staffRow = await query("SELECT user_id FROM staff WHERE id = $1", [id]);
    if (staffRow.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await query("DELETE FROM users WHERE id = $1", [staffRow.rows[0].user_id]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
