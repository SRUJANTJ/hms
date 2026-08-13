import { useEffect, useRef, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, Spinner, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";
import { downloadFeesTemplate, parseFeesFile, exportFeesToExcel } from "@/lib/excel";
import {
  FileDown,
  FileUp,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function AdminFees() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_id: "", fee_type: "Monthly Rent", amount: "", due_date: "", remarks: "" });
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("All");
  const [loadingData, setLoadingData] = useState(true);

  // Bulk update via excel
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importErr, setImportErr] = useState("");
  const fileInputRef = useRef(null);

  async function load() {
    setLoadingData(true);
    try {
      const [f, s] = await Promise.all([apiFetch("/api/admin/fees"), apiFetch("/api/admin/students")]);
      setFees(f);
      setStudents(s);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => { if (user) load().catch((e) => setErr(e.message)); }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function saveFee(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await apiFetch("/api/admin/fees", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ student_id: "", fee_type: "Monthly Rent", amount: "", due_date: "", remarks: "" });
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
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

  const totalsByStatus = fees.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  /* ---------------- Bulk excel update ---------------- */

  function openImport() {
    setImportRows([]);
    setImportFileName("");
    setImportResults(null);
    setImportErr("");
    setImportOpen(true);
  }

  async function handleImportFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportErr("");
    setImportResults(null);
    setImportFileName(file.name);

    try {
      const rows = await parseFeesFile(file);
      if (rows.length === 0) {
        setImportErr("No rows found in that file.");
        setImportRows([]);
        return;
      }
      setImportRows(rows);
    } catch (error) {
      console.error("Error parsing file:", error);
      setImportErr("Could not read that file. Please use the provided template.");
      setImportRows([]);
    }
  }

  async function runImport() {
    if (importRows.length === 0) return;

    setImporting(true);
    setImportErr("");

    try {
      const response = await apiFetch("/api/admin/fees/bulk-update", {
        method: "POST",
        body: JSON.stringify({ rows: importRows }),
      });

      setImportResults(response);
      await load();
    } catch (error) {
      console.error("Error importing fees:", error);
      setImportErr(error.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    exportFeesToExcel(filtered, "fees_export.xlsx");
  }

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Fee Management">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {["All", "Pending", "Paid", "Overdue"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn text-xs transition-all duration-200 ${
                filter === s ? "bg-primary-600 text-white shadow-sm" : "btn-outline"
              }`}
            >
              {s}
              {s !== "All" && totalsByStatus[s] ? ` (${totalsByStatus[s]})` : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <FileDown size={16} /> Export
          </button>
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <FileUp size={16} /> Bulk Update
          </button>
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} /> Add Fee
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in-up">
          {err}
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Student</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {loadingData &&
              [0, 1, 2].map((i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={6} className="py-3"><div className="skeleton h-5 w-full" /></td>
                </tr>
              ))}

            {!loadingData && filtered.map((f, i) => (
              <tr key={f.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
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
            {!loadingData && filtered.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No fee records.</td></tr>}
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
          {err && <p className="text-sm text-red-600 animate-slide-down">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving}>
              {saving && <Spinner />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk update modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Bulk Update Fees" wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet size={18} className="text-primary-600" />
              Matches rows to students by roll number. Existing fees (same type + due date) are updated; new ones are created.
            </div>
            <button
              type="button"
              onClick={downloadFeesTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 shrink-0"
            >
              <FileDown size={14} /> Download template
            </button>
          </div>

          <div>
            <label className="label">Excel file (.xlsx)</label>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFileChange} />
            {importFileName && (
              <p className="mt-1 text-xs text-gray-400">
                {importRows.length} row{importRows.length === 1 ? "" : "s"} detected in {importFileName}
              </p>
            )}
          </div>

          {importErr && <p className="text-sm text-red-600 animate-slide-down">{importErr}</p>}

          {importResults && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={14} /> {importResults.successCount} processed
                </span>
                {importResults.failedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <XCircle size={14} /> {importResults.failedCount} failed
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-100 text-xs">
                {importResults.results.map((r) => (
                  <li key={r.row} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="text-gray-600 truncate">Row {r.row} — {r.roll_number}</span>
                    {r.success ? (
                      <span className="text-emerald-600 capitalize">{r.action}</span>
                    ) : (
                      <span className="text-red-600">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setImportOpen(false)}>Close</button>
            <button
              type="button"
              disabled={importRows.length === 0 || importing}
              onClick={runImport}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing && <Spinner />}
              {importing ? "Updating..." : `Update ${importRows.length || ""} row${importRows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Modal>
    </PortalLayout>
  );
}
