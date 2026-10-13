import { withAuth } from "@/lib/auth";

// ───────────────────────────────────────────────────────────
// Predefined master-access password (change it here).
// Checked on the server so it is never shipped to the browser.
// ───────────────────────────────────────────────────────────
const MASTER_ACCESS_PASSWORD = "Master@2026";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body || {};
  if (typeof password !== "string" || password !== MASTER_ACCESS_PASSWORD) {
    return res.status(401).json({ error: "Incorrect master password" });
  }
  return res.status(200).json({ ok: true });
}

export default withAuth(handler, ["admin"]);