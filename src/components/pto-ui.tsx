import Link from "next/link";
import type { PtoRequest } from "@/lib/queries";

// Segmented year control — exact styling from the design (gray track, active
// = white chip + purple text + subtle shadow). Rendered with Links so year
// switching stays a normal server navigation.
export function YearTabs({
  year,
  hrefFor,
}: {
  year: number;
  hrefFor: (y: number) => string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border p-0.5" style={{ background: "#f4f4f5" }}>
      {[year - 1, year, year + 1].map((y) => {
        const active = y === year;
        return (
          <Link
            key={y}
            href={hrefFor(y)}
            className="tnum rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
            style={
              active
                ? { color: "#5c4bd4", background: "#fff", boxShadow: "0 1px 2px rgba(24,24,27,.08)", border: "1px solid #e3defb" }
                : { color: "#71717a", background: "transparent", border: "1px solid transparent" }
            }
          >
            {y}
          </Link>
        );
      })}
    </div>
  );
}

// Status chip — exact colors from the Claude Design file (design/TOKENS.md).
// Semantic (green/amber/red/blue) on purpose: approved vs denied must read
// instantly; the brand set has no green/red so these harmonize alongside it.
const STATUS_META: Record<
  PtoRequest["status"],
  { bg: string; color: string; border: string; label: string }
> = {
  pending: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Pending" },
  approved: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "Approved" },
  complete: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "Complete" },
  cancelled: { bg: "#f4f4f5", color: "#71717a", border: "#e4e4e7", label: "Cancelled" },
  denied: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: "Denied" },
};

export function StatusChip({ status }: { status: PtoRequest["status"] }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-medium"
      style={{ background: m.bg, color: m.color, borderColor: m.border }}
    >
      {m.label}
    </span>
  );
}

export function SourceDot({ source }: { source: PtoRequest["source"] }) {
  const isClickup = source === "clickup";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ background: isClickup ? "var(--primary)" : "#a1a1aa" }}
      />
      {isClickup ? "ClickUp" : "Manual"}
    </span>
  );
}

// Deterministic avatar with a ClickUp-palette hue (micro-accent only).
const AVATAR_HUES = ["#7b68ee", "#49ccf9", "#fd71af"];

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: hue }}
    >
      {initials}
    </span>
  );
}

// Remaining hero: big mono number + "/ allotted" + usage bar. LOW/NONE LEFT chip.
export function RemainingCell({
  remaining,
  allotted,
  used,
}: {
  remaining: number | null;
  allotted: number | null;
  used: number | null;
}) {
  if (remaining == null || allotted == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = allotted > 0 ? Math.min(100, Math.max(0, (Number(used ?? 0) / allotted) * 100)) : 0;
  const none = remaining <= 0;
  const low = !none && remaining <= 3;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-baseline gap-1.5">
        {(low || none) && (
          <span
            className="tnum rounded-[4px] px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: none ? "#fecaca" : "#fef2f2",
              color: none ? "#991b1b" : "#dc2626",
            }}
          >
            {none ? "None left" : "Low"}
          </span>
        )}
        <span className="tnum text-lg font-semibold text-foreground">{remaining}</span>
        <span className="tnum text-xs text-muted-foreground">/ {allotted}</span>
      </div>
      <div className="usage-track w-24">
        <div className="usage-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TypeBadge({ type }: { type: "employee" | "freelancer" }) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-medium capitalize"
      style={
        type === "employee"
          ? { background: "#f1eefe", color: "#5c4bd4", borderColor: "#e3defb" }
          : { background: "#fafafa", color: "#71717a", borderColor: "#e4e4e7" }
      }
    >
      {type}
    </span>
  );
}
