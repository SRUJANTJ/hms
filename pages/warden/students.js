import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { WARDEN_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function WardenStudents() {
  const { user, loading } = useAuthGuard(["warden"], "/warden/login");
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (user) apiFetch("/api/warden/students").then(setStudents).catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  const filtered = students.filter((s) => `${s.name} ${s.roll_number}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Students">
      <input className="input max-w-xs mb-4" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Student</th><th>Roll No</th><th>Room</th><th>Course</th><th>Status</th><th>Contact</th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.roll_number || "—"}</td>
                <td>{s.room_number ? `${s.block ? s.block + " - " : ""}${s.room_number}` : "Unassigned"}</td>
                <td>{s.course || "—"}</td>
                <td><Badge color={s.status === "Active" ? "green" : "gray"}>{s.status}</Badge></td>
                <td className="text-xs text-gray-500">{s.phone || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}
