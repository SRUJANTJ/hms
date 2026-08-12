import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).end();
  const { id } = req.query;
  const { status } = req.body || {};
  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "status must be Approved or Rejected" });
  }
  const result = await query(
    `UPDATE leave_requests SET status = $1, reviewed_by = $2 WHERE id = $3 RETURNING *`,
    [status, req.user.id, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(200).json(result.rows[0]);
}

export default withAuth(handler, ["admin", "warden"]);
