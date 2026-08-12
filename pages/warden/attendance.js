import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { WARDEN_LINKS } from "@/components/navLinks";
import { FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

const today = () => new Date().toISOString().slice(0, 10);

export default function WardenAttendance() {
  const { user, loading } = useAuthGuard(["warden"], "/warden/login");
  const [date, setDate] = useState(today());
  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const data = await apiFetch(`/api/admin/attendance?date=${date}`);
    setList(data.map((r) => ({ ...r, status: r.status || "Present" })));
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user, date]);

  if (loading || !user) return <FullscreenLoader />;

  function setStatus(idx, status) {
    setList((prev) => prev.map((r, i) => (i === idx ? { ...r, status } : r)));
  }

  async function saveAll() {
    setSaving(true);
    setErr("");
    try {
      await apiFetch("/api/admin/attendance", {
        method: "POST",
        body: JSON.stringify({ date, records: list.map((r) => ({ student_id: r.student_id, status: r.status })) }),
      });
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Attendance">
      <div className="flex items-center gap-3 mb-4">
        <input type="date" className="input max-w-[180px]" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveAll} disabled={saving}>{saving ? "Saving..." : "Save Attendance"}</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Student</th><th>Roll No</th><th>Room</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((r, idx) => (
              <tr key={r.student_id}>
                <td>{r.name}</td><td>{r.roll_number || "—"}</td><td>{r.room_number || "—"}</td>
                <td>
                  <div className="flex gap-2">
                    {["Present", "Absent", "Leave"].map((s) => (
                      <button key={s} onClick={() => setStatus(idx, s)} className={`btn text-xs py-1 ${r.status === s ? (s === "Present" ? "bg-emerald-600 text-white" : s === "Absent" ? "bg-red-600 text-white" : "bg-amber-500 text-white") : "btn-outline"}`}>{s}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No active students.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}
