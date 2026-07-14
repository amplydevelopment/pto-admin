"use client";

import { useRouter } from "next/navigation";

const STATUSES = ["pending", "approved", "cancelled", "denied", "complete"];

// Status dropdown for the PTO Log (year is handled by YearTabs; name by NameSearch).
export function LogStatusFilter({ year, status }: { year: number; status: string }) {
  const router = useRouter();

  function update(nextStatus: string) {
    const query = new URLSearchParams({ year: String(year) });
    if (nextStatus) query.set("status", nextStatus);
    router.push(`/log?${query}`);
  }

  return (
    <select
      className="h-[33px] rounded-lg border bg-transparent px-2.5 text-[13px]"
      value={status}
      onChange={(e) => update(e.target.value)}
    >
      <option value="">All statuses</option>
      {STATUSES.map((s) => (
        <option key={s} value={s} className="capitalize">
          {s[0].toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
