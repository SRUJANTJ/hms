import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Badge, Spinner, fileToBase64, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";
import { Home, GraduationCap, CalendarCheck2, Building2 } from "lucide-react";

const PROFILE_FIELDS = [
  { icon: Building2, label: "Room", key: "room" },
  { icon: Home, label: "Hostel", key: "hostel_name" },
  { icon: GraduationCap, label: "Course", key: "course" },
  { icon: CalendarCheck2, label: "Check-in", key: "check_in_date" },
];

export default function StudentProfile() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    phone: "",
    address: "",
    guardian_name: "",
    guardian_phone: "",
    emergency_contact: "",
    image: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const p = await apiFetch("/api/student/profile");
    setProfile(p);
    setForm({
      phone: p.phone || "",
      address: p.address || "",
      guardian_name: p.guardian_name || "",
      guardian_phone: p.guardian_phone || "",
      emergency_contact: p.emergency_contact || "",
      image: p.image || "",
    });
  }

  useEffect(() => {
    if (user) load().catch((e) => setErr(e.message));
  }, [user]);

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
      setTimeout(() => setSaved(false), 3000);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  const infoValues = profile
    ? {
        room: profile.room_number
          ? `${profile.block ? profile.block + " - " : ""}${profile.room_number}`
          : "Unassigned",
        hostel_name: profile.hostel_name || "—",
        course: profile.course ? `${profile.course}${profile.year ? ` (${profile.year})` : ""}` : "—",
        check_in_date: profile.check_in_date ? String(profile.check_in_date).slice(0, 10) : "—",
      }
    : {};

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Profile">
      {!profile ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1">
            <div className="skeleton h-24 w-24 rounded-full mx-auto" />
            <div className="skeleton h-4 w-32 mx-auto mt-4" />
            <div className="skeleton h-3 w-20 mx-auto mt-2" />
          </div>
          <div className="card lg:col-span-2">
            <div className="skeleton h-4 w-40 mb-4" />
            <div className="skeleton h-9 w-full mb-3" />
            <div className="skeleton h-9 w-full mb-3" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className="card lg:col-span-1 text-center animate-fade-in-up transition-shadow duration-300 hover:shadow-lg"
          >
            <div className="w-24 h-24 rounded-full bg-gray-100 mx-auto overflow-hidden flex items-center justify-center text-2xl text-gray-400 animate-pop-in ring-4 ring-primary-50">
              {form.image ? (
                <img src={form.image} alt="" className="w-full h-full object-cover" />
              ) : (
                profile.name?.[0]
              )}
            </div>

            <p className="font-semibold text-gray-800 mt-3">{profile.name}</p>
            <p className="text-xs text-gray-400">{profile.roll_number || "No roll number"}</p>

            <div className="mt-3 animate-pop-in" style={{ animationDelay: "120ms" }}>
              <Badge color={profile.status === "Active" ? "green" : "gray"}>{profile.status}</Badge>
            </div>

            <div className="text-left mt-5 space-y-3 text-sm">
              {PROFILE_FIELDS.map((field, i) => {
                const Icon = field.icon;
                return (
                  <div
                    key={field.key}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-200 hover:bg-gray-50 animate-fade-in-up"
                    style={{ animationDelay: `${160 + i * 60}ms` }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{field.label}</p>
                      <p className="text-gray-700 truncate">{infoValues[field.key]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="card lg:col-span-2 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <h3 className="font-semibold text-gray-700 mb-4">Editable Details</h3>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="label">Profile Photo</label>
                <input type="file" accept="image/*" onChange={handleImage} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input transition-shadow duration-200"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Emergency Contact</label>
                  <input
                    className="input transition-shadow duration-200"
                    value={form.emergency_contact}
                    onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Guardian Name</label>
                  <input
                    className="input transition-shadow duration-200"
                    value={form.guardian_name}
                    onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Guardian Phone</label>
                  <input
                    className="input transition-shadow duration-200"
                    value={form.guardian_phone}
                    onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <textarea
                  className="input transition-shadow duration-200"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {err && <p className="text-sm text-red-600 animate-slide-down">{err}</p>}
              {saved && (
                <p className="text-sm text-emerald-600 animate-slide-down">Profile updated.</p>
              )}

              <button
                className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving && <Spinner />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
