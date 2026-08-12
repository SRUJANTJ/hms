import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  const studentRow = await query(
    `SELECT s.*, u.name, u.email, u.phone, u.image, r.room_number, r.block, h.name AS hostel_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN rooms r ON r.id = s.room_id
     LEFT JOIN hostels h ON h.id = s.hostel_id
     WHERE s.user_id = $1`,
    [req.user.id]
  );
  if (studentRow.rowCount === 0) return res.status(404).json({ error: "Student profile not found" });
  const student = studentRow.rows[0];

  if (req.method === "GET") {
    return res.status(200).json(student);
  }

  if (req.method === "PUT") {
    const { phone, image, address, guardian_name, guardian_phone, emergency_contact } = req.body || {};

    await query(
      `UPDATE users SET phone = COALESCE($1,phone), image = COALESCE($2,image) WHERE id = $3`,
      [phone || null, image || null, req.user.id]
    );

    const result = await query(
      `UPDATE students SET
         address = COALESCE($1,address),
         guardian_name = COALESCE($2,guardian_name),
         guardian_phone = COALESCE($3,guardian_phone),
         emergency_contact = COALESCE($4,emergency_contact)
       WHERE id = $5 RETURNING *`,
      [address || null, guardian_name || null, guardian_phone || null, emergency_contact || null, student.id]
    );
    return res.status(200).json(result.rows[0]);
  }

  res.status(405).end();
}

export default withAuth(handler, ["student"]);
