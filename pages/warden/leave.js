import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { WARDEN_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function WardenLeave() {
  const { user, loading } = useAuthGuard(["warden"], "/warden/login");
  const [leaves, setLeaves] = useState([]);
  const [err, setErr] = useState("");

  async function load() { setLeaves(await apiFetch("/api/admin/leave")); }
  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function review(l, status) {
    await apiFetch(`/api/admin/leave/${l.id}`, { method: "PUT", body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Leave Requests">
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Student</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id}>
                <td>{l.student_name} <span className="text-xs text-gray-400">({l.roll_number || "—"})</span></td>
                <td>{String(l.from_date).slice(0, 10)}</td>
                <td>{String(l.to_date).slice(0, 10)}</td>
                <td className="max-w-xs truncate">{l.reason || "—"}</td>
                <td><Badge color={l.status === "Approved" ? "green" : l.status === "Rejected" ? "red" : "amber"}>{l.status}</Badge></td>
                <td className="text-right whitespace-nowrap">
                  {l.status === "Pending" && (
                    <>
                      <button className="text-emerald-600 hover:underline text-xs mr-3" onClick={() => review(l, "Approved")}>Approve</button>
                      <button className="text-red-600 hover:underline text-xs" onClick={() => review(l, "Rejected")}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No leave requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}
