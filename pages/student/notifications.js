import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentNotifications() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) apiFetch("/api/student/notifications").then(setList).catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="Notifications">
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="space-y-3">
        {list.map((n) => (
          <div key={n.id} className="card">
            <p className="font-semibold text-gray-800">{n.title}</p>
            <p className="text-sm text-gray-500 mt-1">{n.message}</p>
            <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-400 py-10">No notifications yet.</p>}
      </div>
    </PortalLayout>
  );
}
