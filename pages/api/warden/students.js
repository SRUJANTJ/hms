import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const result = await query(
    `SELECT s.*, u.name, u.email, u.phone, u.image, r.room_number, r.block
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN rooms r ON r.id = s.room_id
     ORDER BY u.name`
  );
  res.status(200).json(result.rows);
}

export default withAuth(handler, ["warden", "admin"]);
