import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const result = await query(
    `SELECT c.*, u.name AS student_name, s.roll_number, au.name AS assigned_name
     FROM complaints c
     JOIN students s ON s.id = c.student_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN users au ON au.id = c.assigned_to
     ORDER BY c.created_at DESC`
  );
  res.status(200).json(result.rows);
}

export default withAuth(handler, ["admin", "warden"]);
