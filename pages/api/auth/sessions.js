import { getAllSessions } from "@/lib/auth";

export default function handler(req, res) {
  const sessions = getAllSessions(req).map(({ role, user }) => ({
    role,
    name: user.name,
    email: user.email,
  }));
  return res.status(200).json({ sessions });
}