import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, fileToBase64, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

const emptyForm = {
  name: "", email: "", phone: "", password: "",
  roll_number: "", course: "", year: "", gender: "", dob: "", address: "",
  guardian_name: "", guardian_phone: "", emergency_contact: "",
  room_id: "", image: "", id_proof: "",
};

export default function AdminStudents() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const [s, meta] = await Promise.all([apiFetch("/api/admin/students"), apiFetch("/api/admin/meta")]);
    setStudents(s);
    setRooms(meta.rooms);
  }

  useEffect(() => {
    if (user) load().catch((e) => setErr(e.message));
  }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setErr("");
    setModalOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({ ...emptyForm, ...s, password: "" });
    setErr("");
    setModalOpen(true);
  }

  async function handleImage(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((f) => ({ ...f, [field]: base64 }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (editing) {
        await apiFetch(`/api/admin/students/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/api/admin/students", { method: "POST", body: JSON.stringify(form) });
      }
      setModalOpen(false);
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s) {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    await apiFetch(`/api/admin/students/${s.id}`, { method: "DELETE" });
    await load();
  }

  async function handleAllocate(s, room_id) {
    await apiFetch(`/api/admin/students/${s.id}/allocate`, { method: "POST", body: JSON.stringify({ room_id }) });
    await load();
  }

  async function handleCheckout(s) {
    if (!confirm(`Check out ${s.name}?`)) return;
    await apiFetch(`/api/admin/students/${s.id}/allocate`, { method: "POST", body: JSON.stringify({ checkout: true }) });
    await load();
  }

  const filtered = students.filter((s) =>
    `${s.name} ${s.roll_number} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Students">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search by name, roll no, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary" onClick={openAdd}>+ Add Student</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Student</th><th>Roll No</th><th>Room</th><th>Status</th><th>Contact</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-500">
                      {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : s.name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td>{s.roll_number || "—"}</td>
                <td>
                  <select
                    className="input py-1 text-xs"
                    value={s.room_id || ""}
                    onChange={(e) => handleAllocate(s, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id} disabled={r.occupied >= r.capacity && r.id !== s.room_id}>
                        {r.room_number} ({r.occupied}/{r.capacity})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Badge color={s.status === "Active" ? "green" : s.status === "CheckedOut" ? "gray" : "red"}>{s.status}</Badge>
                </td>
                <td className="text-xs text-gray-500">{s.phone || "—"}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-primary-600 hover:underline text-xs mr-3" onClick={() => openEdit(s)}>Edit</button>
                  {s.status === "Active" && (
                    <button className="text-amber-600 hover:underline text-xs mr-3" onClick={() => handleCheckout(s)}>Check-out</button>
                  )}
                  <button className="text-red-600 hover:underline text-xs" onClick={() => handleDelete(s)}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Student" : "Add Student"} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400">
              {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : "Photo"}
            </div>
            <div>
              <label className="label">Profile Photo</label>
              <input type="file" accept="image/*" onChange={(e) => handleImage(e, "image")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Full Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Roll Number</label><input className="input" value={form.roll_number || ""} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} /></div>
            <div><label className="label">Email</label><input required type="email" disabled={!!editing} className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            {!editing && (
              <div><label className="label">Password</label><input required type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            )}
            <div><label className="label">Course</label><input className="input" value={form.course || ""} onChange={(e) => setForm({ ...form, course: e.target.value })} /></div>
            <div><label className="label">Year</label><input className="input" value={form.year || ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div><label className="label">Date of Birth</label><input type="date" className="input" value={form.dob ? String(form.dob).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
            <div><label className="label">Guardian Name</label><input className="input" value={form.guardian_name || ""} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
            <div><label className="label">Guardian Phone</label><input className="input" value={form.guardian_phone || ""} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></div>
            <div><label className="label">Emergency Contact</label><input className="input" value={form.emergency_contact || ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
            {!editing && (
              <div>
                <label className="label">Room</label>
                <select className="input" value={form.room_id || ""} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} disabled={r.occupied >= r.capacity}>{r.room_number} ({r.occupied}/{r.capacity})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div><label className="label">Address</label><textarea className="input" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>

          <div>
            <label className="label">ID Proof (image)</label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => handleImage(e, "id_proof")} />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
