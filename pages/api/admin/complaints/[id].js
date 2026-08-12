import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== "PUT") return res.status(405).end();

  const { status, assigned_to, resolution_note } = req.body || {};
  const result = await query(
    `UPDATE complaints SET
       status = COALESCE($1, status),
       assigned_to = COALESCE($2, assigned_to),
       resolution_note = COALESCE($3, resolution_note),
       updated_at = now()
     WHERE id = $4 RETURNING *`,
    [status || null, assigned_to || null, resolution_note || null, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(200).json(result.rows[0]);
}

export default withAuth(handler, ["admin", "warden"]);
