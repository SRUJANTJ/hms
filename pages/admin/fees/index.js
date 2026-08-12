import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function AdminFees() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", fee_type: "Monthly Rent", amount: "", due_date: "", remarks: "" });
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("All");

  async function load() {
    const [f, s] = await Promise.all([apiFetch("/api/admin/fees"), apiFetch("/api/admin/students")]);
    setFees(f);
    setStudents(s);
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function saveFee(e) {
    e.preventDefault();
    setErr("");
    try {
      await apiFetch("/api/admin/fees", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ student_id: "", fee_type: "Monthly Rent", amount: "", due_date: "", remarks: "" });
      await load();
    } catch (e2) { setErr(e2.message); }
  }

  async function markPaid(f) {
    await apiFetch(`/api/admin/fees/${f.id}`, { method: "PUT", body: JSON.stringify({ status: "Paid" }) });
    await load();
  }

  async function deleteFee(id) {
    if (!confirm("Delete this fee record?")) return;
    await apiFetch(`/api/admin/fees/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = filter === "All" ? fees : fees.filter((f) => f.status === filter);

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Fee Management">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2">
          {["All", "Pending", "Paid", "Overdue"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`btn text-xs ${filter === s ? "bg-primary-600 text-white" : "btn-outline"}`}>{s}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Add Fee</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Student</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id}>
                <td>{f.student_name} <span className="text-gray-400 text-xs">({f.roll_number || "—"})</span></td>
                <td>{f.fee_type}</td>
                <td>₹{Number(f.amount).toLocaleString()}</td>
                <td>{String(f.due_date).slice(0, 10)}</td>
                <td><Badge color={f.status === "Paid" ? "green" : f.status === "Overdue" ? "red" : "amber"}>{f.status}</Badge></td>
                <td className="text-right whitespace-nowrap">
                  {f.status !== "Paid" && <button className="text-emerald-600 hover:underline text-xs mr-3" onClick={() => markPaid(f)}>Mark Paid</button>}
                  <button className="text-red-600 hover:underline text-xs" onClick={() => deleteFee(f.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No fee records.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Fee Record">
        <form onSubmit={saveFee} className="space-y-3">
          <div>
            <label className="label">Student</label>
            <select required className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_number || "—"})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fee Type</label>
            <select className="input" value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })}>
              <option>Monthly Rent</option><option>Security Deposit</option><option>Late Fee</option><option>Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount (₹)</label><input required type="number" min={0} className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label className="label">Due Date</label><input required type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Remarks</label><input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
