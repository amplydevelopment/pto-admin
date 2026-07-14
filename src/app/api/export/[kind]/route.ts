import { auth } from "@/auth";
import { toCsv } from "@/lib/csv";
import { getBalances, getLog } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  try {
    return await handle(request, params);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return new Response(`Export failed: ${message}`, { status: 500 });
  }
}

async function handle(request: Request, params: Promise<{ kind: string }>) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { kind } = await params;
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();

  let csv: string;
  if (kind === "balances") {
    const balances = await getBalances(year);
    csv = toCsv(
      ["Name", "Email", "Type", "Status", "Allotted", "Vacation used", "Sick", "Birthday", "Maternity", "Paternity", "Unpaid", "Remaining"],
      balances.map(({ employee, usage, remaining }) => [
        employee.display_name,
        employee.email,
        employee.employment_type,
        employee.status,
        remaining?.vacation_days_allotted,
        usage?.vacation_used ?? 0,
        usage?.sick_used ?? 0,
        usage?.birthday_used ?? 0,
        usage?.maternity_used ?? 0,
        usage?.paternity_used ?? 0,
        usage?.unpaid_used ?? 0,
        remaining?.remaining_vacation_days,
      ])
    );
  } else if (kind === "log") {
    const requests = await getLog({
      year,
      status: url.searchParams.get("status") ?? undefined,
      employeeId: url.searchParams.get("employee") ?? undefined,
    });
    csv = toCsv(
      ["Name", "Email", "Leave type", "Start", "End", "Duration", "Status", "Source", "ClickUp task", "Note"],
      requests.map((r) => [
        r.employees?.display_name,
        r.employees?.email,
        r.leave_type,
        r.start_date,
        r.end_date,
        r.duration_days,
        r.status,
        r.source,
        r.clickup_task_id,
        r.notes,
      ])
    );
  } else {
    return new Response("Unknown export", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pto-${kind}-${year}.csv"`,
    },
  });
}
