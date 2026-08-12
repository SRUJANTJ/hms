import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const studentRow = await query("SELECT id FROM students WHERE user_id = $1", [req.user.id]);
  if (studentRow.rowCount === 0) return res.status(404).json({ error: "Student profile not found" });
  const studentId = studentRow.rows[0].id;

  if (req.method === "GET") {
    const result = await query(
      "SELECT * FROM complaints WHERE student_id = $1 ORDER BY created_at DESC",
      [studentId]
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { category, title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: "Title is required" });
    const result = await query(
      `INSERT INTO complaints (student_id, category, title, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [studentId, category || "General", title, description || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["student"]);
