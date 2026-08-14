import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, fileToBase64, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  designation: "Security",
  role: "staff",
  salary: "",
  hostel_ids: [],
  image: "",
};

export default function AdminStaff() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [staff, setStaff] = useState([]);
  const [hostels, setHostels] = useState([]); // new
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = add mode, object = edit mode
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [staffData, hostelsData] = await Promise.all([
      apiFetch("/api/admin/staff"),
      apiFetch("/api/admin/hostels"),
    ]);
    setStaff(staffData);
    setHostels(hostelsData);
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
    setForm({
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
      password: "", // left blank = keep current password
      designation: s.designation || "Security",
      role: s.role || "staff",
      salary: s.salary || "",
      hostel_ids: Array.isArray(s.hostels) ? s.hostels.map((h) => String(h.id)) : [],
      image: s.image || "",
    });
    setErr("");
    setModalOpen(true);
  }

  function toggleHostel(hostelId) {
    const id = String(hostelId);
    setForm((f) => {
      const has = f.hostel_ids.includes(id);
      return {
        ...f,
        hostel_ids: has
          ? f.hostel_ids.filter((v) => v !== id)
          : [...f.hostel_ids, id],
      };
    });
  }

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((f) => ({ ...f, image: base64 }));
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      if (editing) {
        // Don't send an empty password — the API keeps the old one when omitted
        const { email, password, ...rest } = form;
        const body = password ? { ...rest, password } : rest;
        await apiFetch(`/api/admin/staff/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/admin/staff", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s) {
    await apiFetch(`/api/admin/staff/${s.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: !s.is_active }),
    });
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
        <button className="btn-primary" onClick={openAdd}>
          + Add Staff / Warden
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Hostel / Block(s)</th>
              <th>Contact</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.designation}</td>
                <td className="capitalize">{s.role}</td>
                <td>
                  {Array.isArray(s.hostels) && s.hostels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.hostels.map((h) => (
                        <Badge key={h.id} color="blue">
                          {h.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">— unassigned —</span>
                  )}
                </td>
                <td className="text-xs text-gray-500">
                  {s.email}
                  <br />
                  {s.phone}
                </td>
                <td>
                  <Badge color={s.is_active ? "green" : "gray"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button
                    className="text-gray-600 hover:underline text-xs mr-3"
                    onClick={() => openEdit(s)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-primary-600 hover:underline text-xs mr-3"
                    onClick={() => toggleActive(s)}
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="text-red-600 hover:underline text-xs"
                    onClick={() => remove(s)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  No staff yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add Staff / Warden"}
        wide
      >
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400 text-xs">
              {form.image ? (
                <img src={form.image} alt="" className="w-full h-full object-cover" />
              ) : (
                "Photo"
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleImage} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                required
                type="email"
                disabled={!!editing}
                className="input disabled:bg-gray-50 disabled:text-gray-400"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">
                {editing ? "New Password (optional)" : "Password"}
              </label>
              <input
                required={!editing}
                type="password"
                className="input"
                placeholder={editing ? "Leave blank to keep current" : ""}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div>
              <label className="label">User Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="staff">Staff</option>
                <option value="warden">Warden</option>
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              <select
                className="input"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              >
                <option>Warden</option>
                <option>Security</option>
                <option>Housekeeping</option>
                <option>Electrician</option>
                <option>Plumber</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Monthly Salary (₹)</label>
              <input
                type="number"
                className="input"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
              />
            </div>
          </div>

          {/* Hostel / block assignment - a warden or staff member can be
              made responsible for one building or several at once. */}
          <div>
            <label className="label">
              Responsible for Hostel(s) / Block(s)
            </label>
            {hostels.length === 0 ? (
              <p className="text-xs text-gray-400">
                No hostel blocks have been created yet. Add one under{" "}
                <span className="font-medium">Rooms &amp; Hostels</span> first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-3 max-h-40 overflow-y-auto">
                {hostels.map((h) => {
                  const checked = form.hostel_ids.includes(String(h.id));
                  return (
                    <label
                      key={h.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                        checked
                          ? "bg-primary-50 text-primary-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={checked}
                        onChange={() => toggleHostel(h.id)}
                      />
                      <span className="truncate">{h.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {form.hostel_ids.length === 0
                ? "No block selected — this staff member won't see any students yet."
                : `Selected ${form.hostel_ids.length} block${form.hostel_ids.length > 1 ? "s" : ""}. They'll only see students who belong to ${form.hostel_ids.length > 1 ? "these blocks" : "this block"}.`}
            </p>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </PortalLayout>
  );
}