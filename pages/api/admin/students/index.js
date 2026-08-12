import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query(
      `SELECT s.*, u.name, u.email, u.phone, u.image, r.room_number, r.block
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN rooms r ON r.id = s.room_id
       ORDER BY s.created_at DESC`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const {
      name, email, phone, password, image,
      roll_number, course, year, gender, dob, address,
      guardian_name, guardian_phone, emergency_contact, id_proof,
      room_id, hostel_id, check_in_date,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const hash = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, image)
         VALUES ($1,$2,$3,$4,'student',$5) RETURNING id`,
        [name, email.toLowerCase().trim(), phone || null, hash, image || null]
      );
      const userId = userResult.rows[0].id;

      const studentResult = await client.query(
        `INSERT INTO students
          (user_id, roll_number, course, year, gender, dob, address, guardian_name, guardian_phone,
           emergency_contact, id_proof, room_id, hostel_id, check_in_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          userId, roll_number || null, course || null, year || null, gender || null,
          dob || null, address || null, guardian_name || null, guardian_phone || null,
          emergency_contact || null, id_proof || null, room_id || null, hostel_id || null,
          check_in_date || new Date().toISOString().slice(0, 10),
        ]
      );

      if (room_id) {
        await client.query(
          `UPDATE rooms SET occupied = occupied + 1,
             status = CASE WHEN occupied + 1 >= capacity THEN 'Full' ELSE status END
           WHERE id = $1`,
          [room_id]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json(studentResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return res.status(409).json({ error: "Email or roll number already exists" });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin"]);
