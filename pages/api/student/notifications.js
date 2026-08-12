import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const result = await query(
    "SELECT * FROM notifications WHERE audience IN ('All','Students') ORDER BY created_at DESC LIMIT 50"
  );
  res.status(200).json(result.rows);
}

export default withAuth(handler, ["student"]);
