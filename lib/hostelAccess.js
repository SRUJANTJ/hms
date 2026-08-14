// lib/hostelAccess.js
import { query } from "./db";

// Returns the list of hostel/block IDs (numbers) that the given
// user (a warden or staff member, identified by users.id) has been
// made responsible for by the admin. A staff member can be assigned
// to zero, one, or many blocks.
export async function getStaffHostelIds(userId) {
  const result = await query(
    `SELECT sh.hostel_id
     FROM staff st
     JOIN staff_hostels sh ON sh.staff_id = st.id
     WHERE st.user_id = $1
     ORDER BY sh.hostel_id`,
    [userId]
  );
  return result.rows.map((r) => r.hostel_id);
}

// Same, but returns {id, name} pairs — handy for populating a
// "which block am I looking at" filter in the UI.
export async function getStaffHostels(userId) {
  const result = await query(
    `SELECT h.id, h.name
     FROM staff st
     JOIN staff_hostels sh ON sh.staff_id = st.id
     JOIN hostels h ON h.id = sh.hostel_id
     WHERE st.user_id = $1
     ORDER BY h.name`,
    [userId]
  );
  return result.rows;
}
