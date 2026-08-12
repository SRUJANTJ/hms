import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Modal, Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentComplaints() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: "General", title: "", description: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() { setList(await apiFetch("/api/student/complaints")); }
  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await apiFetch("/api/student/complaints", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ category: "General", title: "", description: "" });
      await load();
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Complaints">
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Raise Complaint</button>
      </div>
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-800">{c.title} <span className="text-xs font-normal text-gray-400">· {c.category}</span></p>
                <p className="text-sm text-gray-500 mt-1">{c.description || "No description"}</p>
                {c.resolution_note && <p className="text-xs text-emerald-600 mt-2">Resolution: {c.resolution_note}</p>}
                <p className="text-xs text-gray-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <Badge color={c.status === "Resolved" ? "green" : c.status === "Rejected" ? "red" : c.status === "InProgress" ? "blue" : "amber"}>{c.status}</Badge>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-400 py-10">No complaints raised yet.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Raise Complaint">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>General</option><option>Electric</option><option>Plumbing</option><option>Cleaning</option><option>Other</option>
            </select>
          </div>
          <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea rows={4} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? "Submitting..." : "Submit"}</button></div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
