import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const [students, complaints, leaves, todayAttendance] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM students WHERE status = 'Active'"),
    query("SELECT COUNT(*)::int AS count FROM complaints WHERE status IN ('Open','InProgress')"),
    query("SELECT COUNT(*)::int AS count FROM leave_requests WHERE status = 'Pending'"),
    query(
      "SELECT COUNT(*)::int AS count FROM attendance WHERE date = CURRENT_DATE AND status = 'Present'"
    ),
  ]);

  res.status(200).json({
    totalStudents: students.rows[0].count,
    openComplaints: complaints.rows[0].count,
    pendingLeaves: leaves.rows[0].count,
    presentToday: todayAttendance.rows[0].count,
  });
}

export default withAuth(handler, ["warden", "admin"]);
