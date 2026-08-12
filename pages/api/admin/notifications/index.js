import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { title, message, audience } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
    const result = await query(
      `INSERT INTO notifications (title, message, audience, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, message, audience || "All", req.user.id]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin", "warden"]);
