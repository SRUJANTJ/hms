import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { StatCard, Badge } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function AdminDashboard() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/admin/dashboard").then(setStats).catch((e) => setErr(e.message));
  }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Dashboard">
      {err && <p className="text-red-600 mb-4">{err}</p>}
      {!stats ? (
        <p className="text-gray-400">Loading stats...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Students" value={stats.totalStudents} />
            <StatCard
              label="Rooms Occupied"
              value={`${stats.rooms.occupied}/${stats.rooms.total}`}
              sub={`${stats.rooms.vacant} vacant`}
              color="green"
            />
            <StatCard label="Revenue Collected" value={`₹${stats.revenue.toLocaleString()}`} color="green" />
            <StatCard
              label="Pending Payments"
              value={`₹${stats.pendingPayments.total.toLocaleString()}`}
              sub={`${stats.pendingPayments.count} invoices`}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Complaints Summary</h3>
              <div className="flex flex-wrap gap-2">
                {stats.complaints.length === 0 && <p className="text-sm text-gray-400">No complaints yet.</p>}
                {stats.complaints.map((c) => (
                  <Badge key={c.status} color={c.status === "Resolved" ? "green" : c.status === "Rejected" ? "red" : "amber"}>
                    {c.status}: {c.count}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Recent Activity</h3>
              <ul className="space-y-2">
                {stats.recentComplaints.length === 0 && <p className="text-sm text-gray-400">Nothing recent.</p>}
                {stats.recentComplaints.map((c) => (
                  <li key={c.id} className="text-sm flex items-center justify-between">
                    <span className="text-gray-700">{c.title} — {c.student_name}</span>
                    <Badge color={c.status === "Resolved" ? "green" : "amber"}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </PortalLayout>
  );
}

function FullscreenLoader() {
  return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
}
