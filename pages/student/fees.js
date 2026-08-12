import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { STUDENT_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function StudentFees() {
  const { user, loading } = useAuthGuard(["student"], "/login");
  const [fees, setFees] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) apiFetch("/api/student/fees").then(setFees).catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  const pending = fees.filter((f) => f.status !== "Paid").reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <PortalLayout role="student" user={user} links={STUDENT_LINKS} title="My Fees">
      {err && <p className="text-red-600 mb-3">{err}</p>}
      <div className="card mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400 font-semibold">Total Pending</p>
          <p className="text-2xl font-bold text-gray-800">₹{pending.toLocaleString()}</p>
        </div>
        <p className="text-xs text-gray-400 max-w-xs text-right">Contact the hostel office to make a payment. Online payment isn't enabled yet.</p>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Paid Date</th></tr></thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.id}>
                <td>{f.fee_type}</td>
                <td>₹{Number(f.amount).toLocaleString()}</td>
                <td>{String(f.due_date).slice(0, 10)}</td>
                <td><Badge color={f.status === "Paid" ? "green" : f.status === "Overdue" ? "red" : "amber"}>{f.status}</Badge></td>
                <td>{f.paid_date ? String(f.paid_date).slice(0, 10) : "—"}</td>
              </tr>
            ))}
            {fees.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">No fee records.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}
