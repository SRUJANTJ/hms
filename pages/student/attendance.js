import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentAttendance() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) apiFetch("/api/student/attendance").then(setList).catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Attendance">
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.date}>
                <td>{String(a.date).slice(0, 10)}</td>
                <td><Badge color={a.status === "Present" ? "green" : a.status === "Absent" ? "red" : "amber"}>{a.status}</Badge></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={2} className="text-center text-gray-400 py-8">No attendance records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}
