import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { WARDEN_LINKS } from "@/components/navLinks";
import { StatCard, StatCardSkeleton, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";
import { Users, MessageSquareWarning, ClipboardList, UserCheck } from "lucide-react";

export default function WardenDashboard() {
  const { user, loading } = useAuthGuard(["warden"], "/warden/login");
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) {
      apiFetch("/api/warden/dashboard")
        .then(setStats)
        .catch((e) => setErr(e.message));
    }
  }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  const presentPct =
    stats && stats.totalStudents
      ? Math.min(100, Math.round((stats.presentToday / stats.totalStudents) * 100))
      : 0;

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Dashboard">
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
            <StatCard icon={Users} delay={0} label="Total Students" value={stats.totalStudents} />
            <StatCard
              icon={MessageSquareWarning}
              delay={1}
              label="Open Complaints"
              value={stats.openComplaints}
              color="amber"
            />
            <StatCard
              icon={ClipboardList}
              delay={2}
              label="Pending Leave Requests"
              value={stats.pendingLeaves}
              color="amber"
            />
            <StatCard
              icon={UserCheck}
              delay={3}
              label="Present Today"
              value={stats.presentToday}
              sub={stats.totalStudents ? `${presentPct}% of students` : undefined}
              color="green"
            />
          </div>

          <div
            className="card mt-6 animate-fade-in-up"
            style={{ animationDelay: "180ms" }}
          >
            <h3 className="font-semibold text-gray-700 mb-2">Welcome back, {user.name?.split(" ")[0] || "Warden"}</h3>
            <p className="text-sm text-gray-500">
              Head to <span className="font-medium text-gray-700">Students</span> to add new
              residents, allocate rooms, or check students in and out. Use the filters there to
              quickly find anyone by name, roll number, block or room.
            </p>
          </div>
        </>
      )}
    </PortalLayout>
  );
}
