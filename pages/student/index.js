import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Badge, fileToBase64, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentProfile() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ phone: "", address: "", guardian_name: "", guardian_phone: "", emergency_contact: "", image: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const p = await apiFetch("/api/student/profile");
    setProfile(p);
    setForm({
      phone: p.phone || "", address: p.address || "", guardian_name: p.guardian_name || "",
      guardian_phone: p.guardian_phone || "", emergency_contact: p.emergency_contact || "", image: p.image || "",
    });
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((f) => ({ ...f, image: base64 }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      await apiFetch("/api/student/profile", { method: "PUT", body: JSON.stringify(form) });
      setSaved(true);
      await load();
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Profile">
      {!profile ? <p className="text-gray-400">Loading...</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1 text-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 mx-auto overflow-hidden flex items-center justify-center text-gray-400">
              {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : profile.name?.[0]}
            </div>
            <p className="font-semibold text-gray-800 mt-3">{profile.name}</p>
            <p className="text-xs text-gray-400">{profile.roll_number || "No roll number"}</p>
            <div className="mt-3"><Badge color={profile.status === "Active" ? "green" : "gray"}>{profile.status}</Badge></div>
            <div className="text-left mt-5 space-y-2 text-sm">
              <p><span className="text-gray-400">Room:</span> {profile.room_number ? `${profile.block ? profile.block + " - " : ""}${profile.room_number}` : "Unassigned"}</p>
              <p><span className="text-gray-400">Hostel:</span> {profile.hostel_name || "—"}</p>
              <p><span className="text-gray-400">Course:</span> {profile.course || "—"} {profile.year ? `(${profile.year})` : ""}</p>
              <p><span className="text-gray-400">Check-in:</span> {profile.check_in_date ? String(profile.check_in_date).slice(0, 10) : "—"}</p>
            </div>
          </div>

          <div className="card lg:col-span-2">
            <h3 className="font-semibold text-gray-700 mb-4">Editable Details</h3>
            <form onSubmit={save} className="space-y-4">
              <div><label className="label">Profile Photo</label><input type="file" accept="image/*" onChange={handleImage} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label">Emergency Contact</label><input className="input" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
                <div><label className="label">Guardian Name</label><input className="input" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
                <div><label className="label">Guardian Phone</label><input className="input" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></div>
              </div>
              <div><label className="label">Address</label><textarea className="input" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              {saved && <p className="text-sm text-emerald-600">Profile updated.</p>}
              <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
