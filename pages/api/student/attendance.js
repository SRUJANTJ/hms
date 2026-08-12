import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const studentRow = await query("SELECT id FROM students WHERE user_id = $1", [req.user.id]);
  if (studentRow.rowCount === 0) return res.status(404).json({ error: "Student profile not found" });

  const result = await query(
    "SELECT date, status, entry_time, exit_time FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 60",
    [studentRow.rows[0].id]
  );
  res.status(200).json(result.rows);
}

export default withAuth(handler, ["student"]);
