import { getUserFromReq } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function handler(req, res) {
  const tokenUser = getUserFromReq(req);
  if (!tokenUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const result = await query(
      "SELECT id, name, email, role, image FROM users WHERE id = $1",
      [tokenUser.id]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("me error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
