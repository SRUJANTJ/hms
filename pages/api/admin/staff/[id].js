import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PUT") {
    const { designation, hostel_id, salary, is_active } = req.body || {};
    const staffRow = await query("SELECT user_id FROM staff WHERE id = $1", [id]);
    if (staffRow.rowCount === 0) return res.status(404).json({ error: "Not found" });

    if (typeof is_active === "boolean") {
      await query("UPDATE users SET is_active = $1 WHERE id = $2", [is_active, staffRow.rows[0].user_id]);
    }
    const result = await query(
      `UPDATE staff SET designation = COALESCE($1,designation), hostel_id = COALESCE($2,hostel_id),
         salary = COALESCE($3,salary) WHERE id = $4 RETURNING *`,
      [designation || null, hostel_id || null, salary || null, id]
    );
    return res.status(200).json(result.rows[0]);
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
