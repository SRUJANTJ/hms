import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PUT") {
    const { status, amount, due_date, remarks } = req.body || {};
    const paid_date = status === "Paid" ? new Date().toISOString().slice(0, 10) : null;
    const result = await query(
      `UPDATE fees SET
         status = COALESCE($1, status),
         amount = COALESCE($2, amount),
         due_date = COALESCE($3, due_date),
         remarks = COALESCE($4, remarks),
         paid_date = CASE WHEN $1 = 'Paid' THEN $5 WHEN $1 IS NOT NULL THEN NULL ELSE paid_date END
       WHERE id = $6 RETURNING *`,
      [status || null, amount || null, due_date || null, remarks || null, paid_date, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "DELETE") {
    await query("DELETE FROM fees WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
