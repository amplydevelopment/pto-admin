// Faithful port of automations/new_workflows/shared/normalize.js — the ONE
// canonical parser the n8n workflows use. Adapted for the app: there is no
// webhook event here, so the status comes from the task's *current* status
// (task.status.status) instead of a status-change history item.
//
// Keep this in sync with normalize.js. Same date logic (date-only midday-UTC
// normalization + exclusive GCal end), same leave_code map, same fail-closed
// employee resolution (clickbot is never the requester).

export type DbStatus = "pending" | "approved" | "cancelled" | "denied" | "complete";

export type ClickupUser = {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type ClickupCustomField = {
  name?: string;
  value?: unknown;
  type_config?: { options?: Array<{ id?: string; name?: string; orderindex?: number }> };
};

export type ClickupTask = {
  id?: string;
  url?: string;
  name?: string;
  status?: { status?: string };
  start_date?: string | number | null;
  due_date?: string | number | null;
  start_date_time?: unknown;
  due_date_time?: unknown;
  custom_fields?: ClickupCustomField[];
  creator?: { email?: string };
};

export type NormalizedTask = {
  clickupTaskId: string | null;
  clickupTaskUrl: string | null;
  ptoType: string;
  leaveCode: string | null;
  startDate: string | null;
  endDate: string | null;
  gcalEndDate: string | null;
  daysRequested: number;
  employeeEmail: string | null;
  employeeName: string | null;
  employeeFieldPresent: boolean;
  clickupStatus: string | null;
  dbStatus: DbStatus;
  parseError: string | null;
};

export const LEAVE_LABEL: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick",
  birthday: "Birthday",
  maternity: "Maternity",
  paternity: "Paternity",
  unpaid: "Unpaid",
  absent: "Absent",
  half_day_am: "Half day (AM)",
  half_day_pm: "Half day (PM)",
};

const COMPANY_TZ = "America/New_York";
const MS_HOUR = 1000 * 60 * 60;

function toBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function fmtDate(ms: number, hasTime: boolean): string {
  if (hasTime) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: COMPANY_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(ms));
  }
  const normalized = ms + 12 * MS_HOUR; // midday-UTC "safe" for date-only values
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(normalized));
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function diffDaysExclusive(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const s = parseISO(a), e = parseISO(b);
  const diff = Math.floor(
    (Date.UTC(e.y, e.m - 1, e.d) - Date.UTC(s.y, s.m - 1, s.d)) / (1000 * 60 * 60 * 24)
  );
  return diff < 0 ? 0 : diff;
}

// Google Calendar all-day end.date is EXCLUSIVE -> endDate + 1
function addDaysISO(s: string, days: number): string {
  const { y, m, d } = parseISO(s);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.UTC(y, m - 1, d + days)));
}

// ClickUp status spelling -> DB status spelling (mirrors normalize.js's
// targetStatus mapping; open/review statuses fall through to 'pending').
export function mapDbStatus(clickupStatus: string | null | undefined): DbStatus {
  const s = String(clickupStatus || "").toLowerCase();
  if (s.includes("approved")) return "approved";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  if (s === "denied") return "denied";
  if (s === "complete" || s === "completed") return "complete";
  return "pending";
}

export function normalizeClickupTask(task: ClickupTask): NormalizedTask {
  const getField = (name: string) =>
    (task.custom_fields || []).find(
      (f) => (f.name || "").toLowerCase() === name.toLowerCase()
    ) || null;

  let parseError: string | null = null;

  const startMs = task.start_date ? Number(task.start_date) : null;
  const endMs = task.due_date ? Number(task.due_date) : startMs;
  if (!startMs) parseError = "task has no start_date";

  const startDate = startMs ? fmtDate(startMs, toBool(task.start_date_time)) : null;
  const endDate = endMs ? fmtDate(endMs, toBool(task.due_date_time)) : null;
  const gcalEndDate = endDate ? addDaysISO(endDate, 1) : null;
  const diffDays = diffDaysExclusive(startDate, endDate);

  // Duration -> daysRequested
  const durationField = getField("Duration");
  let daysRequested: number;
  if (durationField && durationField.value != null && durationField.value !== "") {
    daysRequested = Number(durationField.value);
    if (Number.isNaN(daysRequested)) daysRequested = diffDays + 1;
  } else {
    daysRequested = diffDays + 1;
  }

  // PTO Type (dropdown resolution) + leave_code mapping
  const ptoTypeField = getField("PTO Type");
  let ptoType = "";
  if (ptoTypeField) {
    const value: unknown = ptoTypeField.value;
    const options = ptoTypeField.type_config?.options || [];
    let matched = options.find((o) => o.orderindex === (value as number));
    if (!matched && typeof value === "number") matched = options[value];
    if (!matched) matched = options.find((o) => String(o.id) === String(value));
    ptoType = matched?.name || "";
  }
  const t = String(ptoType || "").toLowerCase();
  let leaveCode: string | null = null;
  if (t.includes("vacation")) leaveCode = "vacation";
  else if (t.includes("sick")) leaveCode = "sick";
  else if (t.includes("birthday")) leaveCode = "birthday";
  else if (t.includes("maternity")) leaveCode = "maternity";
  else if (t.includes("paternity")) leaveCode = "paternity";
  else if (t.includes("unpaid")) leaveCode = "unpaid";
  else if (t.includes("absent")) leaveCode = "absent";
  else if (t.includes("half day morning") || t.includes("h1")) leaveCode = "half_day_am";
  else if (t.includes("half day afternoon") || t.includes("h2")) leaveCode = "half_day_pm";
  if (!leaveCode && !parseError) parseError = `unmapped PTO Type: "${ptoType}"`;

  // Employee (fail-closed: clickbot is NOT a requester)
  const realEmail = (e: unknown): string | null => {
    const s = String(e || "").toLowerCase().trim();
    if (!s || s === "clickbot@clickup.com") return null;
    return s;
  };
  const employeeField = getField("Employee");
  const values: ClickupUser[] = Array.isArray(employeeField?.value)
    ? (employeeField!.value as ClickupUser[])
    : [];
  const employeeFieldPresent = values.length > 0 && !!values[0];
  let employeeEmail: string | null = null;
  let employeeName: string | null = null;
  if (employeeFieldPresent) {
    const v = values[0];
    employeeEmail = realEmail(v.email);
    employeeName = v.username || `${v.first_name || ""} ${v.last_name || ""}`.trim() || null;
  }
  // No assignee fallback (assignee is the reviewer, not the requester).
  if (!employeeEmail) employeeEmail = realEmail(task.creator?.email);
  if (!employeeName) employeeName = task.name || employeeEmail || "Unknown";

  const clickupStatus = task.status?.status || null;
  const clickupTaskId = task.id || null;
  const clickupTaskUrl =
    task.url || (clickupTaskId ? `https://app.clickup.com/t/${clickupTaskId}` : null);
  if (!clickupTaskId && !parseError) parseError = "no task id";

  return {
    clickupTaskId,
    clickupTaskUrl,
    ptoType,
    leaveCode,
    startDate,
    endDate,
    gcalEndDate,
    daysRequested,
    employeeEmail,
    employeeName,
    employeeFieldPresent,
    clickupStatus,
    dbStatus: mapDbStatus(clickupStatus),
    parseError,
  };
}

// What the app will show + do, computed server-side so the UI just renders it.
export type ImportPreview = {
  taskId: string;
  taskUrl: string;
  clickupStatus: string | null;
  dbStatus: DbStatus;
  employeeName: string | null;
  employeeEmail: string | null;
  matchedName: string | null;
  leaveCode: string | null;
  leaveLabel: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  isFuture: boolean;
  alreadyExists: boolean;
  existingStatus: string | null;
  effects: string[];
  warnings: string[];
  canImport: boolean;
};
