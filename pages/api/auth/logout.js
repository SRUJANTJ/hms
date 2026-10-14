import { clearAuthCookie, getRequestedRole } from "@/lib/auth";

// Logs out only the portal the request came from. Use ?all=1 to clear every role.
export default function handler(req, res) {
  if (req.query?.all === "1") {
    clearAuthCookie(res);
  } else {
    clearAuthCookie(res, req.body?.role || getRequestedRole(req));
  }
  return res.status(200).json({ ok: true });
}