import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, loginIdentifier } from "@/lib/rateLimit";

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

  const identifier = loginIdentifier(req, email, role);

  try {
    const rateLimit = await checkLoginRateLimit(identifier);
    if (rateLimit.blocked) {
      const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      });
    }

    const result = await query(
      "SELECT id, name, email, password_hash, role, image, is_active FROM users WHERE email = $1 AND role = $2",
      [email.toLowerCase().trim(), role]
    );

    if (result.rowCount === 0) {
      await recordFailedLogin(identifier);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      // Not a credential failure, so it doesn't count against the
      // rate limit — a deactivated user retrying isn't a brute force.
      return res.status(403).json({ error: "This account has been deactivated" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordFailedLogin(identifier);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await clearLoginAttempts(identifier);

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
