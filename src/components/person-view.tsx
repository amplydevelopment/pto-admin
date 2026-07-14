import type { getPerson } from "@/lib/queries";
import { Avatar, TypeBadge } from "@/components/pto-ui";
import { LogTable } from "@/components/log-table";
import { PersonActions } from "@/components/actions/person-actions";

type PersonData = Awaited<ReturnType<typeof getPerson>>;

// Presentational — rendered both by the /person/[id] page and the Sheet.
export function PersonView({ data, year }: { data: PersonData; year: number }) {
  const { employee, usage, remaining, requests, leaveTypes } = data;

  const primary = [
    ["Vacation allotted", remaining?.vacation_days_allotted ?? "—"],
    ["Vacation used", usage?.vacation_used ?? 0],
    ["Vacation remaining", remaining?.remaining_vacation_days ?? "—", true],
  ] as const;
  const secondary = [
    ["Sick", usage?.sick_used ?? 0],
    ["Birthday", usage?.birthday_used ?? 0],
    ["Maternity", usage?.maternity_used ?? 0],
    ["Paternity", usage?.paternity_used ?? 0],
    ["Unpaid", usage?.unpaid_used ?? 0],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={employee.display_name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold" style={{ color: "var(--ink)" }}>
              {employee.display_name}
            </h2>
            <TypeBadge type={employee.employment_type} />
            {employee.status === "inactive" && (
              <span className="rounded-[6px] border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                inactive
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
        </div>
        <span className="tnum ml-auto text-sm text-muted-foreground">{year}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {primary.map(([label, value, hero]) => (
          <StatCard key={label} label={label} value={value} hero={hero} />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {secondary.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">All requests</h3>
        <div className="overflow-x-auto">
          <LogTable requests={requests} hidePerson />
        </div>
      </div>

      <PersonActions
        employee={employee}
        leaveTypes={leaveTypes}
        allotted={remaining?.vacation_days_allotted ?? null}
        remaining={remaining?.remaining_vacation_days ?? null}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hero,
}: {
  label: string;
  value: string | number;
  hero?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className="tnum mt-1 text-xl font-semibold"
        style={hero ? { color: "var(--accent-strong)" } : { color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
