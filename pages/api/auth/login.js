import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, role } = req.body || {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password and role are required" });
  }

  if (!["admin", "warden", "student", "staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const result = await query(
      "SELECT id, name, email, password_hash, role, image, is_active FROM users WHERE email = $1 AND role = $2",
      [email.toLowerCase().trim(), role]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "This account has been deactivated" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ id: user.id, role: user.role, name: user.name, email: user.email });
    setAuthCookie(res, token);

    return res.status(200).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image },
    });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
