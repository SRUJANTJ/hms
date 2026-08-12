import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { WARDEN_LINKS } from "@/components/navLinks";
import { StatCard, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function WardenDashboard() {
  const { user, loading } = useAuthGuard(["warden"], "/warden/login");
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) apiFetch("/api/warden/dashboard").then(setStats).catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Dashboard">
      {err && <p className="text-red-600 mb-4">{err}</p>}
      {!stats ? <p className="text-gray-400">Loading...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={stats.totalStudents} />
          <StatCard label="Open Complaints" value={stats.openComplaints} color="amber" />
          <StatCard label="Pending Leave Requests" value={stats.pendingLeaves} color="amber" />
          <StatCard label="Present Today" value={stats.presentToday} color="green" />
        </div>
      )}
    </PortalLayout>
  );
}
