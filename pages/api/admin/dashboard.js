import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const [students, rooms, revenue, pending, complaints, recentComplaints] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM students WHERE status = 'Active'"),
      query("SELECT COALESCE(SUM(capacity),0)::int AS total, COALESCE(SUM(occupied),0)::int AS occupied FROM rooms"),
      query("SELECT COALESCE(SUM(amount),0)::numeric AS total FROM fees WHERE status = 'Paid'"),
      query("SELECT COALESCE(SUM(amount),0)::numeric AS total, COUNT(*)::int AS count FROM fees WHERE status IN ('Pending','Overdue')"),
      query("SELECT status, COUNT(*)::int AS count FROM complaints GROUP BY status"),
      query(
        `SELECT c.id, c.title, c.status, c.created_at, u.name AS student_name
         FROM complaints c
         JOIN students s ON s.id = c.student_id
         JOIN users u ON u.id = s.user_id
         ORDER BY c.created_at DESC LIMIT 5`
      ),
    ]);

    res.status(200).json({
      totalStudents: students.rows[0].count,
      rooms: {
        total: rooms.rows[0].total,
        occupied: rooms.rows[0].occupied,
        vacant: Math.max(rooms.rows[0].total - rooms.rows[0].occupied, 0),
      },
      revenue: Number(revenue.rows[0].total),
      pendingPayments: { total: Number(pending.rows[0].total), count: pending.rows[0].count },
      complaints: complaints.rows,
      recentComplaints: recentComplaints.rows,
    });
  } catch (err) {
    console.error("dashboard error", err);
    res.status(500).json({ error: "Server error" });
  }
}

export default withAuth(handler, ["admin"]);
