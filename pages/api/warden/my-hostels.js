// /api/warden/my-hostels.js
import { withAuth } from "@/lib/auth";
import { getStaffHostels } from "@/lib/hostelAccess";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const hostels = await getStaffHostels(req.user.id);
  return res.status(200).json({ hostels });
}

export default withAuth(handler, ["warden", "staff"]);
