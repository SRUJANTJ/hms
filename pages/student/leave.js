import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Modal, Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentLeave() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() { setList(await apiFetch("/api/student/leave")); }
  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await apiFetch("/api/student/leave", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ from_date: "", to_date: "", reason: "" });
      await load();
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Leave">
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Apply for Leave</button>
      </div>
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td>{String(l.from_date).slice(0, 10)}</td>
                <td>{String(l.to_date).slice(0, 10)}</td>
                <td className="max-w-xs truncate">{l.reason || "—"}</td>
                <td><Badge color={l.status === "Approved" ? "green" : l.status === "Rejected" ? "red" : "amber"}>{l.status}</Badge></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply for Leave">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From</label><input required type="date" className="input" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
            <div><label className="label">To</label><input required type="date" className="input" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Reason</label><textarea rows={3} className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Submitting..." : "Submit"}</button></div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
