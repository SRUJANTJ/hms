import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    const result = await query(
      `SELECT s.*, u.name, u.email, u.phone, u.image, r.room_number, r.block
       FROM students s JOIN users u ON u.id = s.user_id
       LEFT JOIN rooms r ON r.id = s.room_id
       WHERE s.id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "PUT") {
    const {
      name, phone, image,
      course, year, gender, dob, address,
      guardian_name, guardian_phone, emergency_contact, id_proof,
      status,
    } = req.body || {};

    const current = await query("SELECT user_id FROM students WHERE id = $1", [id]);
    if (current.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const userId = current.rows[0].user_id;

    await query(
      `UPDATE users SET name = COALESCE($1,name), phone = COALESCE($2,phone), image = COALESCE($3,image) WHERE id = $4`,
      [name || null, phone || null, image || null, userId]
    );

    const result = await query(
      `UPDATE students SET
         course = COALESCE($1,course), year = COALESCE($2,year), gender = COALESCE($3,gender),
         dob = COALESCE($4,dob), address = COALESCE($5,address),
         guardian_name = COALESCE($6,guardian_name), guardian_phone = COALESCE($7,guardian_phone),
         emergency_contact = COALESCE($8,emergency_contact), id_proof = COALESCE($9,id_proof),
         status = COALESCE($10,status)
       WHERE id = $11 RETURNING *`,
      [course, year, gender, dob, address, guardian_name, guardian_phone, emergency_contact, id_proof, status, id]
    );
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "DELETE") {
    const student = await query("SELECT user_id, room_id FROM students WHERE id = $1", [id]);
    if (student.rowCount === 0) return res.status(404).json({ error: "Not found" });
    if (student.rows[0].room_id) {
      await query("UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), status = 'Available' WHERE id = $1", [
        student.rows[0].room_id,
      ]);
    }
    await query("DELETE FROM users WHERE id = $1", [student.rows[0].user_id]); // cascades to students
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
