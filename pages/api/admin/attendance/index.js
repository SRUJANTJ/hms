import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method === "GET") {
    const { date } = req.query;
    const d = date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `SELECT s.id AS student_id, u.name, s.roll_number, r.room_number,
              a.status, a.entry_time, a.exit_time
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date = $1
       WHERE s.status = 'Active'
       ORDER BY u.name`,
      [d]
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    // body: { date, records: [{ student_id, status }] }
    const { date, records } = req.body || {};
    const d = date || new Date().toISOString().slice(0, 10);
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "records array is required" });
    }
    for (const r of records) {
      await query(
        `INSERT INTO attendance (student_id, date, status, marked_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by`,
        [r.student_id, d, r.status, req.user.id]
      );
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

export default withAuth(handler, ["admin", "warden"]);
