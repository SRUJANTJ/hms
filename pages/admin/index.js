import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import {
  StatCard,
  StatCardSkeleton,
  ProgressBar,
  Badge,
  EmptyState,
  FullscreenLoader,
} from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";
import { Users, BedDouble, IndianRupee, AlertTriangle } from "lucide-react";

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
      {err && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in-up">
          {err}
        </div>
      )}

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              delay={0}
              label="Total Students"
              value={stats.totalStudents}
            />
            <StatCard
              icon={BedDouble}
              delay={1}
              label="Rooms Occupied"
              value={`${stats.rooms.occupied}/${stats.rooms.total}`}
              sub={`${stats.rooms.vacant} vacant`}
              color="green"
            />
            <StatCard
              icon={IndianRupee}
              delay={2}
              label="Revenue Collected"
              value={`₹${stats.revenue.toLocaleString()}`}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              delay={3}
              label="Pending Payments"
              value={`₹${stats.pendingPayments.total.toLocaleString()}`}
              sub={`${stats.pendingPayments.count} invoices`}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            <div
              className="card lg:col-span-1 animate-fade-in-up"
              style={{ animationDelay: "160ms" }}
            >
              <h3 className="font-semibold text-gray-700 mb-4">Occupancy</h3>
              <ProgressBar
                value={stats.rooms.occupied}
                max={stats.rooms.total || 1}
                color="primary"
                label="Beds filled"
              />
              <p className="text-xs text-gray-400 mt-3">
                {stats.rooms.vacant} bed{stats.rooms.vacant === 1 ? "" : "s"} still available
                across all hostels.
              </p>
            </div>

            <div
              className="card lg:col-span-1 animate-fade-in-up"
              style={{ animationDelay: "220ms" }}
            >
              <h3 className="font-semibold text-gray-700 mb-3">Complaints Summary</h3>
              <div className="flex flex-wrap gap-2">
                {stats.complaints.length === 0 && (
                  <EmptyState title="No complaints yet." />
                )}
                {stats.complaints.map((c, i) => (
                  <span
                    key={c.status}
                    className="animate-pop-in"
                    style={{ animationDelay: `${260 + i * 60}ms` }}
                  >
                    <Badge
                      color={
                        c.status === "Resolved"
                          ? "green"
                          : c.status === "Rejected"
                            ? "red"
                            : "amber"
                      }
                    >
                      {c.status}: {c.count}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>

            <div
              className="card lg:col-span-1 animate-fade-in-up"
              style={{ animationDelay: "280ms" }}
            >
              <h3 className="font-semibold text-gray-700 mb-3">Recent Activity</h3>
              <ul className="space-y-2">
                {stats.recentComplaints.length === 0 && (
                  <EmptyState title="Nothing recent." />
                )}
                {stats.recentComplaints.map((c, i) => (
                  <li
                    key={c.id}
                    className="text-sm flex items-center justify-between gap-2 animate-fade-in-up transition-colors duration-200 hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2"
                    style={{ animationDelay: `${320 + i * 60}ms` }}
                  >
                    <span className="text-gray-700 truncate">
                      {c.title} — {c.student_name}
                    </span>
                    <Badge color={c.status === "Resolved" ? "green" : "amber"}>
                      {c.status}
                    </Badge>
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
