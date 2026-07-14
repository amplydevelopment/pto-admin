import "server-only";
import { db } from "@/lib/supabase";

// Explicit column lists everywhere. `everhour_assignment_id` and `denied_at`
// exist only in the dev mirror, not in this (Amply prod) database yet —
// selecting them would error.
const REQUEST_COLUMNS =
  "id, employee_id, leave_type, start_date, end_date, duration_days, status, source, clickup_task_id, google_calendar_event_id, notes, requested_at, approved_at, cancelled_at, completed_at, created_at";

export type Employee = {
  id: string;
  full_name: string;
  display_name: string;
  email: string;
  employment_type: "employee" | "freelancer";
  status: "active" | "inactive";
  started_at: string | null;
};

export type LeaveType = {
  code: string;
  label: string;
  day_fraction: number;
};

export type PtoRequest = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: "pending" | "approved" | "cancelled" | "denied" | "complete";
  source: "clickup" | "manual";
  clickup_task_id: string | null;
  google_calendar_event_id: string | null;
  notes: string | null;
  requested_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  employees: { display_name: string; email: string } | null;
};

export type Usage = {
  employee_id: string;
  year: number | null;
  vacation_used: number;
  sick_used: number;
  birthday_used: number;
  maternity_used: number;
  paternity_used: number;
  unpaid_used: number;
  absent_days: number;
  half_day_am_count: number;
  half_day_pm_count: number;
};

export type Remaining = {
  employee_id: string;
  year: number;
  vacation_days_allotted: number;
  vacation_used: number;
  remaining_vacation_days: number;
};

export type BalanceRow = {
  employee: Employee;
  usage: Usage | null;
  remaining: Remaining | null;
};

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function getEmployees(): Promise<Employee[]> {
  return throwOnError(
    await db
      .from("employees")
      .select("id, full_name, display_name, email, employment_type, status, started_at")
      .order("display_name")
  );
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  return throwOnError(
    await db.from("leave_types").select("code, label, day_fraction").order("sort_order")
  );
}

export async function getBalances(year: number): Promise<BalanceRow[]> {
  const [employees, usage, remaining] = await Promise.all([
    getEmployees(),
    throwOnError<Usage[]>(
      await db.from("v_pto_usage_by_year").select("*").eq("year", year)
    ),
    throwOnError<Remaining[]>(
      await db
        .from("v_remaining_vacation")
        .select("employee_id, year, vacation_days_allotted, vacation_used, remaining_vacation_days")
        .eq("year", year)
    ),
  ]);

  const usageById = new Map(usage.map((u) => [u.employee_id, u]));
  const remainingById = new Map(remaining.map((r) => [r.employee_id, r]));

  return employees.map((employee) => ({
    employee,
    usage: usageById.get(employee.id) ?? null,
    remaining: remainingById.get(employee.id) ?? null,
  }));
}

export type LogFilters = {
  year?: number;
  status?: string;
  employeeId?: string;
};

export async function getLog(filters: LogFilters): Promise<PtoRequest[]> {
  let query = db
    .from("pto_requests")
    .select(`${REQUEST_COLUMNS}, employees(display_name, email)`)
    .order("start_date", { ascending: false })
    .limit(500);

  if (filters.year) {
    query = query
      .gte("start_date", `${filters.year}-01-01`)
      .lte("start_date", `${filters.year}-12-31`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);

  return throwOnError(await query) as unknown as PtoRequest[];
}

export async function getPerson(employeeId: string, year: number) {
  const [employee, usage, remaining, requests, leaveTypes] = await Promise.all([
    throwOnError<Employee>(
      await db
        .from("employees")
        .select("id, full_name, display_name, email, employment_type, status, started_at")
        .eq("id", employeeId)
        .single()
    ),
    throwOnError<Usage[]>(
      await db
        .from("v_pto_usage_by_year")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", year)
    ),
    throwOnError<Remaining[]>(
      await db
        .from("v_remaining_vacation")
        .select("employee_id, year, vacation_days_allotted, vacation_used, remaining_vacation_days")
        .eq("employee_id", employeeId)
        .eq("year", year)
    ),
    throwOnError<PtoRequest[]>(
      (await db
        .from("pto_requests")
        .select(`${REQUEST_COLUMNS}, employees(display_name, email)`)
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false })) as never
    ),
    getLeaveTypes(),
  ]);

  return {
    employee,
    usage: usage[0] ?? null,
    remaining: remaining[0] ?? null,
    requests,
    leaveTypes,
  };
}

// For the "Add employee" duplicate check and the rollover wizard.
export async function getAllocations(year: number) {
  return throwOnError<{ employee_id: string; year: number; vacation_days_allotted: number }[]>(
    await db
      .from("pto_allocations")
      .select("employee_id, year, vacation_days_allotted")
      .eq("year", year)
  );
}
