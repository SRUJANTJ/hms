// components/charts.js
// Lightweight SVG charts + a notifications card for the dashboards.
// No extra dependency needed (pure React + SVG + Tailwind).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/useAuthGuard";

export const ATT_COLORS = {
  present: "#10b981", // emerald-500
  absent: "#ef4444", // red-500
  leave: "#f59e0b", // amber-500
};

function parseDay(s) {
  // "YYYY-MM-DD" (or ISO string) -> Date at local midnight
  return new Date(`${String(s).slice(0, 10)}T00:00:00`);
}

export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
      {[
        ["Present", ATT_COLORS.present],
        ["Absent", ATT_COLORS.absent],
        ["Leave", ATT_COLORS.leave],
      ].map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/*
  Stacked bar chart: one bar per bucket, split into Present / Absent / Leave.
  data        = [{ date: "2026-10-06", present, absent, leave }, ...]
  granularity = "day" | "week" | "month"  (what each bar represents)
*/
export function AttendanceBarChart({ data = [], height = 230, granularity = "day" }) {
  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 8;
  const padT = 12;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const totals = data.map((d) => d.present + d.absent + d.leave);
  const rawMax = Math.max(1, ...totals);
  const step = rawMax <= 5 ? 1 : Math.ceil(rawMax / 4 / 5) * 5;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  const slot = innerW / Math.max(data.length, 1);
  const bw = Math.max(2, Math.min(42, slot * 0.7));
  const y = (v) => padT + innerH - (v / max) * innerH;

  // show at most ~12 x-axis labels
  const every = Math.max(1, Math.ceil(data.length / 12));

  const labelFor = (dt) => {
    if (granularity === "month")
      return dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (data.length <= 7) return dt.toLocaleDateString("en-IN", { weekday: "short" });
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  const tipFor = (dt) => {
    if (granularity === "month")
      return dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const base = dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return granularity === "week" ? `Week of ${base}` : base;
  };

  const hasData = totals.some((t) => t > 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Attendance chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {t}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const x = cx - bw / 2;
          let acc = 0;
          const dt = parseDay(d.date);
          return (
            <g key={d.date}>
              <title>{`${tipFor(dt)} - Present ${d.present}, Absent ${d.absent}, Leave ${d.leave}`}</title>
              {[
                ["present", d.present],
                ["absent", d.absent],
                ["leave", d.leave],
              ].map(([k, v]) => {
                if (!v) return null;
                const h = (v / max) * innerH;
                const yy = y(acc + v);
                acc += v;
                return <rect key={k} x={x} y={yy} width={bw} height={h} fill={ATT_COLORS[k]} rx={bw > 6 ? 2 : 0} />;
              })}
              {i % every === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                  {labelFor(dt)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!hasData && (
        <p className="text-center text-xs text-gray-400 -mt-2">No attendance has been marked in this period.</p>
      )}
    </div>
  );
}

/* Donut: today's / overall split with the present % in the middle. */
export function AttendanceDonut({ present = 0, absent = 0, leave = 0, size = 150 }) {
  const total = present + absent + leave;
  const r = 52;
  const C = 2 * Math.PI * r;
  const pct = total ? Math.round((present / total) * 100) : 0;

  let offset = 0;
  const segs = [
    ["present", present],
    ["absent", absent],
    ["leave", leave],
  ].map(([k, v]) => {
    const len = total ? (v / total) * C : 0;
    const seg = { k, len, offset };
    offset += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Attendance split">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        {segs.map(
          (s) =>
            s.len > 0 && (
              <circle
                key={s.k}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={ATT_COLORS[s.k]}
                strokeWidth="16"
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 70 70)"
              />
            )
        )}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="#1f2937">
          {total ? `${pct}%` : "--"}
        </text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#94a3b8">
          {total ? "present" : "no data"}
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
        <div>
          <p className="font-semibold text-emerald-600 text-base">{present}</p>
          <p className="text-gray-400">Present</p>
        </div>
        <div>
          <p className="font-semibold text-red-600 text-base">{absent}</p>
          <p className="text-gray-400">Absent</p>
        </div>
        <div>
          <p className="font-semibold text-amber-600 text-base">{leave}</p>
          <p className="text-gray-400">Leave</p>
        </div>
      </div>
    </div>
  );
}

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/*
  Latest notifications. Anything posted in the last 3 days is flagged "New".
  items = [{ id, title, message, audience, created_at }]
*/
export function NotificationsCard({ items = [], href, className = "", delay = 0 }) {
  const NEW_MS = 3 * 24 * 60 * 60 * 1000;
  return (
    <div className={`card animate-fade-in-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700 inline-flex items-center gap-2">
          <Bell size={16} className="text-primary-600" /> Important Notifications
        </h3>
        {href && (
          <Link href={href} className="text-xs font-medium text-primary-600 hover:underline">
            View all
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No notifications right now." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((n) => {
            const isNew = Date.now() - new Date(n.created_at).getTime() < NEW_MS;
            return (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">
                    {n.title}
                    {isNew && (
                      <span className="ml-2 align-middle rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        NEW
                      </span>
                    )}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{n.message}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PRESETS = [
  ["30", "1 month"],
  ["90", "3 months"],
  ["180", "6 months"],
  ["365", "1 year"],
  ["all", "All time"],
  ["custom", "Custom"],
];

const fmt = (iso) =>
  parseDay(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/*
  Self-contained attendance graph with a time-frame selector.
  endpoint = API that accepts ?range=30|90|180|365|all|custom&from=&to= (minimum 1 month)
*/
export function AttendanceTrendPanel({ endpoint, title = "Attendance", className = "", delay = 0 }) {
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (range === "custom" && (!from || !to)) return undefined;
    let active = true;
    setBusy(true);
    setErr("");
    const qs = range === "custom" ? `range=custom&from=${from}&to=${to}` : `range=${range}`;
    apiFetch(`${endpoint}?${qs}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setErr(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [endpoint, range, from, to]);

  const t = data?.totals;
  const marked = t ? t.present + t.absent + t.leave : 0;
  const pct = marked ? Math.round((t.present / marked) * 100) : 0;
  const groupedBy = data?.granularity === "day" ? "daily" : data?.granularity === "week" ? "weekly" : "monthly";

  return (
    <div className={`card animate-fade-in-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === key
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400 pb-2">
            {!from || !to
              ? "Pick both dates to see the graph."
              : "Ranges shorter than 1 month are extended to the past 1 month."}
          </p>
        </div>
      )}

      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      <div className={`transition-opacity ${busy ? "opacity-50" : "opacity-100"}`}>
        {!data ? (
          range === "custom" && (!from || !to) ? null : <div className="skeleton h-48 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-gray-400">
                {fmt(data.from)} to {fmt(data.to)} &middot; {groupedBy}
              </p>
              <AttendanceLegend />
            </div>
            <AttendanceBarChart data={data.points} granularity={data.granularity} />
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-gray-100 pt-3 text-center">
              <div>
                <p className="text-lg font-semibold text-primary-600">{marked ? `${pct}%` : "--"}</p>
                <p className="text-xs text-gray-400">Attendance</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600">{t.present}</p>
                <p className="text-xs text-gray-400">Present</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-600">{t.absent}</p>
                <p className="text-xs text-gray-400">Absent</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-600">{t.leave}</p>
                <p className="text-xs text-gray-400">Leave</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}