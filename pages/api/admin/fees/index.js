import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT f.*, u.name AS student_name, s.roll_number
       FROM fees f
       JOIN students s ON s.id = f.student_id
       JOIN users u ON u.id = s.user_id
       ORDER BY f.due_date DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { student_id, fee_type, amount, due_date, remarks } = req.body || {};
    if (!student_id || !amount || !due_date) {
      return res.status(400).json({ error: "student_id, amount and due_date are required" });
    }
    const result = await query(
      `INSERT INTO fees (student_id, fee_type, amount, due_date, remarks) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, fee_type || "Monthly Rent", amount, due_date, remarks || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
