import { withAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getStaffHostelIds } from "@/lib/hostelAccess";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Admin sees hostel-wide totals. A warden only sees numbers for
  // the block(s)/building(s) the admin has assigned them to.
  const scoped = req.user.role === "warden";
  const hostelIds = scoped ? await getStaffHostelIds(req.user.id) : null;

  if (scoped && hostelIds.length === 0) {
    return res.status(200).json({
      totalStudents: 0,
      openComplaints: 0,
      pendingLeaves: 0,
      presentToday: 0,
    });
  }

  const params = scoped ? [hostelIds] : [];
  const hostelClause = scoped ? "s.hostel_id = ANY($1::int[]) AND" : "";
  const hostelClauseNoAlias = scoped ? "hostel_id = ANY($1::int[]) AND" : "";

  const [students, complaints, leaves, todayAttendance] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count FROM students WHERE ${hostelClauseNoAlias} status = 'Active'`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM complaints c
       JOIN students s ON s.id = c.student_id
       WHERE ${hostelClause} c.status IN ('Open','InProgress')`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM leave_requests l
       JOIN students s ON s.id = l.student_id
       WHERE ${hostelClause} l.status = 'Pending'`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE ${hostelClause} a.date = CURRENT_DATE AND a.status = 'Present'`,
      params
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
