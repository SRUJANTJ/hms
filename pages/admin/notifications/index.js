import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function AdminNotifications() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: "", message: "", audience: "All" });
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setList(await apiFetch("/api/admin/notifications"));
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setErr("");
    try {
      await apiFetch("/api/admin/notifications", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", message: "", audience: "All" });
      await load();
    } catch (e2) { setErr(e2.message); } finally { setSending(false); }
  }

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Notifications & Circulars">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1 h-fit">
          <h3 className="font-semibold text-gray-700 mb-3">New Announcement</h3>
          <form onSubmit={send} className="space-y-3">
            <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label">Message</label><textarea required rows={4} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <div>
              <label className="label">Audience</label>
              <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option>All</option><option>Students</option><option>Wardens</option><option>Staff</option>
              </select>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="btn-primary w-full" disabled={sending}>{sending ? "Sending..." : "Publish"}</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {list.map((n) => (
            <div key={n.id} className="card">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800">{n.title}</p>
                <Badge>{n.audience}</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">{n.message}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
          {list.length === 0 && <p className="text-center text-gray-400 py-10">No announcements yet.</p>}
        </div>
      </div>
    </PortalLayout>
  );
}
