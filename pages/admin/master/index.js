import { useCallback, useEffect, useRef, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Badge, FullscreenLoader, Spinner } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";
import { useToast } from "@/components/Toast";
import {
  AlertTriangle,
  Lock,
  LogOut,
  Play,
  RefreshCcw,
  ShieldCheck,
  Table2,
  Terminal,
} from "lucide-react";

const UNLOCK_KEY = "hms_master_access_unlocked";
const LAST_ACTIVITY_KEY = "hms_master_access_last_activity";
const IDLE_TIMEOUT_MS = 30_000;

const WRITE_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "grant",
  "revoke",
];

function isWriteQuery(sql) {
  const firstWord = sql.trim().split(/\s+/)[0]?.toLowerCase() || "";
  return WRITE_KEYWORDS.includes(firstWord);
}

export default function MasterAccess() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const toast = useToast();

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockErr, setUnlockErr] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);

  const [tab, setTab] = useState("tables");

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesErr, setTablesErr] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [sql, setSql] = useState("SELECT * FROM users LIMIT 20;");
  const [running, setRunning] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryErr, setQueryErr] = useState("");
  const [pendingWriteConfirm, setPendingWriteConfirm] = useState(false);

  const idleTimerRef = useRef(null);

  const lock = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    try {
      sessionStorage.removeItem(UNLOCK_KEY);
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {}

    setUnlocked(false);
    setPassword("");
    setUnlockErr("");
    setPendingWriteConfirm(false);
    setQueryResult(null);
    setQueryErr("");
    setSelectedTable(null);
    setTableData(null);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    try {
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {}

    idleTimerRef.current = window.setTimeout(() => {
      lock();
      toast.info("Master access locked after 30 seconds of inactivity.");
    }, IDLE_TIMEOUT_MS);
  }, [lock, toast]);

  useEffect(() => {
    if (!user) return;

    try {
      const isUnlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";
      const lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      const stillWithinTimeout =
        lastActivity > 0 && Date.now() - lastActivity < IDLE_TIMEOUT_MS;

      if (isUnlocked && stillWithinTimeout) {
        setUnlocked(true);
        resetIdleTimer();
      } else {
        sessionStorage.removeItem(UNLOCK_KEY);
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      }
    } catch {
      // If sessionStorage is unavailable, remain locked.
    }
  }, [user, resetIdleTimer]);

  useEffect(() => {
    if (!unlocked) return;

    const activityEvents = [
      "pointerdown",
      "keydown",
      "mousemove",
      "touchstart",
      "scroll",
    ];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetIdleTimer, { passive: true })
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetIdleTimer)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [unlocked, resetIdleTimer, lock]);

  async function submitUnlock(event) {
    event.preventDefault();
    setUnlockErr("");
    setUnlockBusy(true);

    try {
      await apiFetch("/api/admin/master-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      } catch {}

      setUnlocked(true);
      setPassword("");
      resetIdleTimer();
    } catch (error) {
      setUnlockErr(error.message || "Incorrect master password");
    } finally {
      setUnlockBusy(false);
    }
  }

  async function loadTables() {
    setTablesLoading(true);
    setTablesErr("");

    try {
      const data = await apiFetch("/api/admin/master/tables");
      setTables(data.tables || []);
    } catch (error) {
      setTablesErr(error.message || "Failed to load tables");
      toast.error(error.message || "Failed to load tables");
    } finally {
      setTablesLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadTables();
  }, [unlocked]);

  async function openTable(tableName, targetPage = 1) {
    setSelectedTable(tableName);
    setPage(targetPage);
    setTableDataLoading(true);

    try {
      const data = await apiFetch(
        `/api/admin/master/table?name=${encodeURIComponent(tableName)}&page=${targetPage}&pageSize=${pageSize}`
      );
      setTableData(data);
    } catch (error) {
      toast.error(error.message || "Failed to load table");
    } finally {
      setTableDataLoading(false);
    }
  }

  async function runQuery(skipConfirm = false) {
    if (!sql.trim()) return;

    if (!skipConfirm && isWriteQuery(sql)) {
      setPendingWriteConfirm(true);
      return;
    }

    setPendingWriteConfirm(false);
    setRunning(true);
    setQueryErr("");
    setQueryResult(null);

    try {
      const data = await apiFetch("/api/admin/master/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });

      setQueryResult(data);
      toast.success(
        `Query ok · ${data.command} · ${data.rowCount ?? 0} row(s)`
      );
    } catch (error) {
      setQueryErr(error.message || "Query failed");
      toast.error(error.message || "Query failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading || !user) return <FullscreenLoader />;

  const totalPages = tableData
    ? Math.max(1, Math.ceil(tableData.rowCount / tableData.pageSize))
    : 1;

  return (
    <PortalLayout
      role="admin"
      user={user}
      links={ADMIN_LINKS}
      title="Master Access"
    >
      {!unlocked ? (
        <div className="card mx-auto max-w-md animate-fade-in-up">
          <div className="mb-1 flex items-center gap-2">
            <Lock size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-700">Master Access</h3>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            Enter the master password to open this page.
          </p>

          <form onSubmit={submitUnlock} className="space-y-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Master password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {unlockErr && (
              <p className="text-sm text-red-600">{unlockErr}</p>
            )}

            <button
              type="submit"
              disabled={unlockBusy || !password}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {unlockBusy ? "Checking..." : "Unlock"}
            </button>
          </form>
        </div>
      ) : (
        <div className="animate-fade-in-up space-y-4">
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-green-600" />
              <h3 className="font-semibold text-gray-700">
                Master access granted
              </h3>
            </div>

            <button
              type="button"
              onClick={lock}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
            >
              <LogOut size={14} /> Lock
            </button>
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              Database access can make destructive changes. Use with care; a
              browser confirmation is not a substitute for server-side
              authorization or backups.
            </p>
          </div>

          <div className="mb-5 flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab("tables")}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === "tables"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Table2 size={16} /> Browse Tables
            </button>

            <button
              type="button"
              onClick={() => setTab("query")}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === "query"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Terminal size={16} /> SQL Query
            </button>
          </div>

          {tab === "tables" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="card h-fit lg:col-span-1">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Tables</h3>
                  <button
                    type="button"
                    onClick={loadTables}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label="Refresh table list"
                  >
                    <RefreshCcw
                      size={15}
                      className={tablesLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>

                {tablesErr && (
                  <p className="mb-2 text-sm text-red-600">{tablesErr}</p>
                )}

                {tablesLoading && tables.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : (
                  <ul className="max-h-[65vh] space-y-1 overflow-y-auto">
                    {tables.map((table) => (
                      <li key={table.name}>
                        <button
                          type="button"
                          onClick={() => openTable(table.name)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                            selectedTable === table.name
                              ? "bg-primary-50 font-medium text-primary-700"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <span className="truncate">{table.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-gray-400">
                            {table.rowCount}
                          </span>
                        </button>
                      </li>
                    ))}

                    {tables.length === 0 && !tablesLoading && (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No tables found.
                      </p>
                    )}
                  </ul>
                )}
              </div>

              <div className="lg:col-span-3">
                {!selectedTable && (
                  <div className="card flex h-64 items-center justify-center text-sm text-gray-400">
                    Select a table on the left to view its rows.
                  </div>
                )}

                {selectedTable && (
                  <div className="card">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800">
                          {selectedTable}
                        </h3>
                        {tableData && <Badge>{tableData.rowCount} rows</Badge>}
                      </div>

                      {tableData && (
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            type="button"
                            disabled={page <= 1 || tableDataLoading}
                            onClick={() => openTable(selectedTable, page - 1)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span className="text-gray-500">
                            Page {page} / {totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={page >= totalPages || tableDataLoading}
                            onClick={() => openTable(selectedTable, page + 1)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>

                    {tableDataLoading ? (
                      <div className="flex justify-center py-10">
                        <Spinner />
                      </div>
                    ) : (
                      tableData && (
                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                {tableData.columns.map((column) => (
                                  <th key={column.column_name}>
                                    {column.column_name}
                                    <span className="ml-1 font-normal normal-case text-gray-400">
                                      ({column.data_type})
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.rows.map((row, index) => (
                                <tr key={index}>
                                  {tableData.columns.map((column) => (
                                    <td
                                      key={column.column_name}
                                      className="max-w-xs truncate"
                                    >
                                      {formatCell(row[column.column_name])}
                                    </td>
                                  ))}
                                </tr>
                              ))}

                              {tableData.rows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={tableData.columns.length}
                                    className="py-8 text-center text-gray-400"
                                  >
                                    No rows.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "query" && (
            <div className="space-y-4">
              <div className="card">
                <label className="label" htmlFor="master-sql">
                  SQL query
                </label>
                <textarea
                  id="master-sql"
                  className="input font-mono text-sm"
                  rows={6}
                  value={sql}
                  onChange={(event) => setSql(event.target.value)}
                  spellCheck={false}
                />

                {pendingWriteConfirm && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={16} />
                      This looks like a write/destructive statement. Run it
                      anyway?
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setPendingWriteConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                        onClick={() => runQuery(true)}
                      >
                        Yes, run it
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={running || !sql.trim()}
                    onClick={() => runQuery(false)}
                    className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {running ? <Spinner /> : <Play size={16} />}
                    {running ? "Running..." : "Run query"}
                  </button>
                </div>
              </div>

              {queryErr && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {queryErr}
                </div>
              )}

              {queryResult && (
                <div className="card">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <Badge color="green">{queryResult.command}</Badge>
                    <span>{queryResult.rowCount ?? 0} row(s)</span>
                    <span>{queryResult.durationMs}ms</span>
                  </div>

                  {queryResult.rows?.length > 0 ? (
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr>
                            {queryResult.fields.map((field) => (
                              <th key={field}>{field}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, index) => (
                            <tr key={index}>
                              {queryResult.fields.map((field) => (
                                <td key={field} className="max-w-xs truncate">
                                  {formatCell(row[field])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Statement executed — no rows returned.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}

function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="text-gray-300">null</span>;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}