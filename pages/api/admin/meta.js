import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const [hostels, rooms, wardens] = await Promise.all([
    query("SELECT id, name FROM hostels ORDER BY name"),
    query("SELECT id, room_number, block, capacity, occupied, hostel_id FROM rooms WHERE status != 'Maintenance' ORDER BY room_number"),
    query("SELECT id, name FROM users WHERE role = 'warden' ORDER BY name"),
  ]);
  res.status(200).json({ hostels: hostels.rows, rooms: rooms.rows, wardens: wardens.rows });
}

export default withAuth(handler, ["admin", "warden"]);
