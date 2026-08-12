import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const studentRow = await query("SELECT id FROM students WHERE user_id = $1", [req.user.id]);
  if (studentRow.rowCount === 0) return res.status(404).json({ error: "Student profile not found" });
  const studentId = studentRow.rows[0].id;

  if (req.method === "GET") {
    const result = await query(
      "SELECT * FROM leave_requests WHERE student_id = $1 ORDER BY created_at DESC",
      [studentId]
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { from_date, to_date, reason } = req.body || {};
    if (!from_date || !to_date) return res.status(400).json({ error: "from_date and to_date are required" });
    const result = await query(
      `INSERT INTO leave_requests (student_id, from_date, to_date, reason) VALUES ($1,$2,$3,$4) RETURNING *`,
      [studentId, from_date, to_date, reason || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["student"]);
