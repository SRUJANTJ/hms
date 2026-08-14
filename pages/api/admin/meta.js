import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const [hostels, rooms, wardens] = await Promise.all([
      query(`
        SELECT
          id,
          name
        FROM hostels
        ORDER BY name
      `),

      query(`
        SELECT
          id,
          hostel_id,
          room_number,
          block,
          capacity,
          occupied
        FROM rooms
        WHERE status <> 'Maintenance'
        ORDER BY room_number
      `),

      query(`
        SELECT
          id,
          name
        FROM users
        WHERE role = 'warden'
        ORDER BY name
      `),
    ]);

    return res.status(200).json({
      hostels: hostels.rows,
      rooms: rooms.rows,
      wardens: wardens.rows,
    });
  } catch (err) {
    console.error("Meta API Error:", err);

    return res.status(500).json({
      message: "Failed to load metadata",
    });
  }
}

export default withAuth(handler, ["admin", "warden"]);