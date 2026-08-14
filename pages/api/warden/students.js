// /api/warden/students.js
import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getStaffHostelIds } from "@/lib/hostelAccess";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Which blocks/buildings this warden has actually been assigned to
  // by the admin - the source of truth is staff_hostels, never
  // something the client can pass in.
  const allowedHostelIds = await getStaffHostelIds(req.user.id);

  if (allowedHostelIds.length === 0) {
    // Not yet assigned to any block - nothing to show.
    return res.status(200).json([]);
  }

  const { hostel_id } = req.query;
  let scopedHostelIds = allowedHostelIds;

  if (hostel_id) {
    const requested = parseInt(hostel_id, 10);
    if (!allowedHostelIds.includes(requested)) {
      // Asking for a block this warden doesn't manage - don't leak it.
      return res.status(200).json([]);
    }
    scopedHostelIds = [requested];
  }

  const result = await query(
    `SELECT s.*, u.name, u.email, u.phone, u.image,
            r.room_number, r.block,
            h.name AS hostel_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN rooms r ON r.id = s.room_id
     LEFT JOIN hostels h ON h.id = s.hostel_id
     WHERE s.hostel_id = ANY($1::int[])
     ORDER BY u.name`,
    [scopedHostelIds]
  );

  return res.status(200).json(result.rows);
}

export default withAuth(handler, ["warden"]);
