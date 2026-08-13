import { useEffect, useRef, useState } from "react";

/*
  Counts a number up from 0 to `target` using an eased
  requestAnimationFrame loop. Non-numeric targets are returned as-is
  (so strings like "12/40" or "₹4,500" still render correctly without
  attempting to animate them).
*/
function useCountUp(target, { duration = 900 } = {}) {
  const [value, setValue] = useState(0);
  const frameRef = useRef();

  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) return undefined;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setValue(target);
      return undefined;
    }

    let start = null;

    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

const STAT_COLORS = {
  primary: {
    chip: "text-primary-600 bg-primary-50",
    icon: "text-primary-600 bg-primary-50",
    ring: "ring-primary-100",
  },
  green: {
    chip: "text-emerald-600 bg-emerald-50",
    icon: "text-emerald-600 bg-emerald-50",
    ring: "ring-emerald-100",
  },
  red: {
    chip: "text-red-600 bg-red-50",
    icon: "text-red-600 bg-red-50",
    ring: "ring-red-100",
  },
  amber: {
    chip: "text-amber-600 bg-amber-50",
    icon: "text-amber-600 bg-amber-50",
    ring: "ring-amber-100",
  },
};

/*
  StatCard - dashboard metric tile.

  New (backwards compatible) props:
    icon   - optional lucide-react icon component
    delay  - stagger index (0,1,2,3...) used to offset the entrance
             animation so a row of cards cascades in rather than
             popping in all at once
*/
export function StatCard({ label, value, sub, color = "primary", icon: Icon, delay = 0 }) {
  const palette = STAT_COLORS[color] || STAT_COLORS.primary;
  const isNumeric = typeof value === "number" && !Number.isNaN(value);
  const animatedValue = useCountUp(isNumeric ? value : 0);
  const displayValue = isNumeric ? animatedValue.toLocaleString() : value;

  return (
    <div
      className="card group animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-1 hover:ring-black/5"
      style={{ animationDelay: `${delay * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1 tabular-nums">{displayValue}</p>
          {sub && (
            <p className={`text-xs mt-2 inline-block px-2 py-1 rounded-full ${palette.chip}`}>
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${palette.icon} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
          >
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}

// Shimmering placeholder shown in a StatCard's spot while dashboard
// data is still loading.
export function StatCardSkeleton() {
  return (
    <div className="card">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-7 w-16 mt-3" />
      <div className="skeleton h-5 w-20 rounded-full mt-3" />
    </div>
  );
}

// Animated horizontal progress bar, e.g. for room occupancy.
export function ProgressBar({ value = 0, max = 100, color = "primary", label }) {
  const [width, setWidth] = useState(0);
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  const barColors = {
    primary: "bg-primary-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  useEffect(() => {
    const timeout = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(timeout);
  }, [pct]);

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span className="font-semibold text-gray-700">{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColors[color] || barColors.primary} transition-[width] duration-700 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div
      className="fixed  top-60 inset-0 z-50 flex items-center justify-center  px-4 animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] flex flex-col animate-scale-in`}
      >
        {/* Header: shrink-0 keeps it pinned at the top, never scrolls away */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 rounded-t-xl bg-white">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:rotate-90 transition-transform duration-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body: this is the only part that scrolls now.
            min-h-0 is required for overflow to work correctly inside a flex column. */}
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}
export function Badge({ children, color = "gray" }) {
  const colors = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-primary-100 text-primary-700",
  };
  return <span className={`badge ${colors[color] || colors.gray}`}>{children}</span>;
}

export function FullscreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400 animate-fade-in">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
      </div>
      <p className="text-sm animate-pulse">Loading...</p>
    </div>
  );
}

// Small inline spinner for buttons / in-place refresh states.
export function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}

// Friendly empty-state block for tables/lists with nothing to show.
export function EmptyState({ title = "Nothing here yet", hint }) {
  return (
    <div className="py-10 text-center animate-fade-in">
      <p className="text-gray-400">{title}</p>
      {hint && <p className="text-xs text-gray-300 mt-1">{hint}</p>}
    </div>
  );
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
