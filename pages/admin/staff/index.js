import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, fileToBase64, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

const emptyForm = { name: "", email: "", phone: "", password: "", designation: "Security", role: "staff", salary: "", image: "" };

export default function AdminStaff() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState("");

  async function load() {
    setStaff(await apiFetch("/api/admin/staff"));
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, image: null }));
    const base64 = await fileToBase64(file);
    setForm((f) => ({ ...f, image: base64 }));
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    try {
      await apiFetch("/api/admin/staff", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e2) { setErr(e2.message); }
  }

  async function toggleActive(s) {
    await apiFetch(`/api/admin/staff/${s.id}`, { method: "PUT", body: JSON.stringify({ is_active: !s.is_active }) });
    await load();
  }

  async function remove(s) {
    if (!confirm(`Remove ${s.name}?`)) return;
    await apiFetch(`/api/admin/staff/${s.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Staff & Wardens">
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Add Staff / Warden</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Designation</th><th>Role</th><th>Hostel</th><th>Contact</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.designation}</td>
                <td className="capitalize">{s.role}</td>
                <td>{s.hostel_name || "—"}</td>
                <td className="text-xs text-gray-500">{s.email}<br />{s.phone}</td>
                <td><Badge color={s.is_active ? "green" : "gray"}>{s.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-primary-600 hover:underline text-xs mr-3" onClick={() => toggleActive(s)}>{s.is_active ? "Deactivate" : "Activate"}</button>
                  <button className="text-red-600 hover:underline text-xs" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No staff yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Staff / Warden">
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400 text-xs">
              {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : "Photo"}
            </div>
            <input type="file" accept="image/*" onChange={handleImage} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Password</label><input required type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <label className="label">User Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option><option value="warden">Warden</option>
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              <select className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                <option>Warden</option><option>Security</option><option>Housekeeping</option><option>Electrician</option><option>Plumber</option><option>Other</option>
              </select>
            </div>
            <div><label className="label">Monthly Salary (₹)</label><input type="number" className="input" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
