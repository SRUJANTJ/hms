import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const result = await query(
    `SELECT l.*, u.name AS student_name, s.roll_number
     FROM leave_requests l
     JOIN students s ON s.id = l.student_id
     JOIN users u ON u.id = s.user_id
     ORDER BY l.created_at DESC`
  );
  res.status(200).json(result.rows);
}

export default withAuth(handler, ["admin", "warden"]);
