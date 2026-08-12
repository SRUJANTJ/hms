import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function AdminComplaints() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [complaints, setComplaints] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState("All");
  const [err, setErr] = useState("");

  async function load() {
    const [c, s] = await Promise.all([apiFetch("/api/admin/complaints"), apiFetch("/api/admin/staff")]);
    setComplaints(c);
    setStaff(s);
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function updateStatus(c, status) {
    await apiFetch(`/api/admin/complaints/${c.id}`, { method: "PUT", body: JSON.stringify({ status }) });
    await load();
  }

  async function assign(c, assigned_to) {
    await apiFetch(`/api/admin/complaints/${c.id}`, { method: "PUT", body: JSON.stringify({ assigned_to: assigned_to || null }) });
    await load();
  }

  const filtered = filter === "All" ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Complaints">
      <div className="flex gap-2 mb-4">
        {["All", "Open", "InProgress", "Resolved", "Rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`btn text-xs ${filter === s ? "bg-primary-600 text-white" : "btn-outline"}`}>{s}</button>
        ))}
      </div>
      {err && <p className="text-red-600 mb-3">{err}</p>}

      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-gray-800">{c.title} <span className="text-xs font-normal text-gray-400">· {c.category}</span></p>
                <p className="text-sm text-gray-500 mt-1">{c.description || "No description"}</p>
                <p className="text-xs text-gray-400 mt-2">By {c.student_name} ({c.roll_number || "—"}) · {new Date(c.created_at).toLocaleString()}</p>
              </div>
              <Badge color={c.status === "Resolved" ? "green" : c.status === "Rejected" ? "red" : c.status === "InProgress" ? "blue" : "amber"}>{c.status}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <select className="input py-1 text-xs max-w-[160px]" value={c.assigned_to || ""} onChange={(e) => assign(c, e.target.value)}>
                <option value="">Assign staff...</option>
                {staff.map((s) => <option key={s.id} value={s.user_id}>{s.name} ({s.designation})</option>)}
              </select>
              {["Open", "InProgress", "Resolved", "Rejected"].map((s) => (
                <button key={s} onClick={() => updateStatus(c, s)} className={`btn text-xs py-1 ${c.status === s ? "bg-gray-800 text-white" : "btn-outline"}`}>{s}</button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No complaints.</p>}
      </div>
    </PortalLayout>
  );
}
