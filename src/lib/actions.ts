"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { parseTaskId, fetchClickupTask } from "@/lib/clickup";
import {
  normalizeClickupTask,
  LEAVE_LABEL,
  type ImportPreview,
} from "@/lib/clickup-normalize";
import {
  lookupSlackUserId,
  listSlackUsers,
  announceInChannel,
  dmUser,
} from "@/lib/slack";
import type { SlackUserOption } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };

// Every action calls this FIRST. While READ_ONLY is on (the default),
// nothing in this file can reach the database with a write.
async function gate(): Promise<ActionResult | null> {
  if (process.env.READ_ONLY !== "false") {
    return {
      ok: false,
      message: "Read-only mode is ON — no changes were made. (READ_ONLY env flag)",
    };
  }
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Not signed in." };
  return null;
}

// Read-only operations (previews) still require a signed-in user, but are not
// blocked by READ_ONLY since they never write.
async function requireAuth(): Promise<ActionResult | null> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Not signed in." };
  return null;
}

const fail = (message: string): ActionResult => ({ ok: false, message });

// Wraps every exported action: an unexpected throw (DB down, network, bug)
// becomes a returned ActionResult -> toast in the UI, never a crashed page.
function safe(fn: (input: unknown) => Promise<ActionResult>) {
  return async (input: unknown): Promise<ActionResult> => {
    try {
      return await fn(input);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Unexpected error.");
    }
  };
}
const done = (message: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// 1. Cancel time off
const cancelSchema = z.object({ requestId: z.uuid() });

export const cancelTimeOff = safe(async function cancelTimeOff(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = cancelSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { data, error } = await db
    .from("pto_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", p.data.requestId)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Request not found.");
  return done("Time off cancelled in the database.");
});

// 3. Add employee (employees row + current-year allocation, one intent)
const addEmployeeSchema = z.object({
  fullName: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  email: z.email(),
  employmentType: z.enum(["employee", "freelancer"]),
  startedAt: dateStr.optional().or(z.literal("")),
  vacationDays: z.coerce.number().min(0).optional(),
  slackUserId: z.string().trim().optional(),
});

export const addEmployee = safe(async function addEmployee(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = addEmployeeSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { data: employee, error } = await db
    .from("employees")
    .insert({
      full_name: p.data.fullName,
      display_name: p.data.displayName,
      email: p.data.email,
      employment_type: p.data.employmentType,
      status: "active",
      started_at: p.data.startedAt || null,
      slack_user_id: p.data.slackUserId || null,
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = unique_violation. The only unique column here is email (id is a
    // generated uuid), so this always means "that person already exists".
    if (error.code === "23505" || /employees_email_key/i.test(error.message)) {
      return fail(`Someone already exists with the email ${p.data.email}.`);
    }
    return fail(error.message);
  }

  if (p.data.employmentType === "employee" && p.data.vacationDays != null) {
    const { error: allocError } = await db.from("pto_allocations").insert({
      employee_id: employee.id,
      year: new Date().getFullYear(),
      vacation_days_allotted: p.data.vacationDays,
    });
    if (allocError) return fail(`Employee added, but allocation failed: ${allocError.message}`);
  }
  return done("Employee added.");
});

// 4. Set employee status (active <-> inactive; never delete)
const setStatusSchema = z.object({
  employeeId: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

export const setEmployeeStatus = safe(async function setEmployeeStatus(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = setStatusSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { data, error } = await db
    .from("employees")
    .update({ status: p.data.status })
    .eq("id", p.data.employeeId)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Employee not found.");
  return done(
    p.data.status === "inactive"
      ? "Employee marked inactive. Their history is untouched."
      : "Employee reactivated."
  );
});

// 5. Change employment type
const changeTypeSchema = z.object({
  employeeId: z.uuid(),
  employmentType: z.enum(["employee", "freelancer"]),
  vacationDays: z.coerce.number().min(0).optional(),
});

export const changeEmploymentType = safe(async function changeEmploymentType(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = changeTypeSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { data, error } = await db
    .from("employees")
    .update({ employment_type: p.data.employmentType })
    .eq("id", p.data.employeeId)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Employee not found.");

  if (p.data.employmentType === "employee" && p.data.vacationDays != null) {
    const year = new Date().getFullYear();
    const { error: allocError } = await db.from("pto_allocations").upsert(
      {
        employee_id: p.data.employeeId,
        year,
        vacation_days_allotted: p.data.vacationDays,
      },
      { onConflict: "employee_id,year" }
    );
    if (allocError) return fail(`Type changed, but allocation failed: ${allocError.message}`);
  }
  return done("Employment type updated.");
});

// 6. Adjust allocation (with a required reason)
const adjustSchema = z.object({
  employeeId: z.uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  vacationDays: z.coerce.number().min(0),
  reason: z.string().trim().min(3, "A reason is required."),
});

export const adjustAllocation = safe(async function adjustAllocation(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = adjustSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { error } = await db.from("pto_allocations").upsert(
    {
      employee_id: p.data.employeeId,
      year: p.data.year,
      vacation_days_allotted: p.data.vacationDays,
      notes: p.data.reason,
    },
    { onConflict: "employee_id,year" }
  );
  if (error) return fail(error.message);
  return done("Allocation updated.");
});

// 7. Year rollover (bulk-create next year's allocations)
const rolloverSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  rows: z
    .array(z.object({ employeeId: z.uuid(), vacationDays: z.coerce.number().min(0) }))
    .min(1),
});

export const yearRollover = safe(async function yearRollover(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = rolloverSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const { error } = await db.from("pto_allocations").insert(
    p.data.rows.map((row) => ({
      employee_id: row.employeeId,
      year: p.data.year,
      vacation_days_allotted: row.vacationDays,
    }))
  );
  if (error) return fail(error.message);
  return done(`Created ${p.data.rows.length} allocation(s) for ${p.data.year}.`);
});

// 8. Import from ClickUp — paste a task link; we fetch + parse it (same logic
// the workflow uses), then either preview it or write the DB record. The row is
// keyed on clickup_task_id, so this is idempotent and can never duplicate the
// live workflow's writes. Side-effects (calendar/Everhour/Slack) are NOT done
// here — see the preview text for exactly what happens per status.
const importSchema = z.object({ url: z.string().min(1) });

function timestampsFor(status: string, now: string): Record<string, string> {
  if (status === "approved") return { approved_at: now };
  if (status === "cancelled") return { cancelled_at: now };
  if (status === "denied") return { denied_at: now };
  if (status === "complete") return { completed_at: now };
  return {}; // pending
}

const importCommitSchema = z.object({
  url: z.string().min(1),
  notifyEmployee: z.boolean().optional().default(false),
  announceChannel: z.boolean().optional().default(false),
});

// Opt-in Slack for the upcoming-approved case only. Every send is best-effort
// and non-fatal: the DB record is already written by the time this runs, so
// failures come back as human-readable notes rather than errors.
async function runImportNotifications(opts: {
  employeeId: string;
  employeeEmail: string | null;
  employeeName: string | null;
  leaveLabel: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  year: number;
  notifyEmployee: boolean;
  announceChannel: boolean;
}): Promise<string[]> {
  const notes: string[] = [];
  const who = opts.employeeName ?? "the employee";

  if (opts.announceChannel) {
    try {
      await announceInChannel(
        `:beach_with_umbrella: *${who}* will be OOO — ${opts.leaveLabel}, ${opts.startDate} → ${opts.endDate} (${opts.days} day(s)).`
      );
      notes.push("Announced in #pto.");
    } catch (e) {
      notes.push(`Channel announce failed: ${e instanceof Error ? e.message : "error"}.`);
    }
  }

  if (opts.notifyEmployee) {
    // Prefer the stored Slack id — several people's Slack accounts use a
    // personal email, so email lookup is only the fallback.
    const { data: empSlack } = await db
      .from("employees")
      .select("slack_user_id")
      .eq("id", opts.employeeId)
      .maybeSingle();
    const stored = empSlack?.slack_user_id || null;
    const uid =
      stored ?? (opts.employeeEmail ? await lookupSlackUserId(opts.employeeEmail) : null);
    if (!uid) {
      notes.push("Couldn't DM the employee (no matching Slack user).");
    } else {
      let vacLine = "";
      const { data: rem } = await db
        .from("v_remaining_vacation")
        .select("vacation_days_allotted, remaining_vacation_days")
        .eq("employee_id", opts.employeeId)
        .eq("year", opts.year)
        .maybeSingle();
      if (rem?.remaining_vacation_days != null) {
        vacLine = `\n• Vacation balance: ${rem.remaining_vacation_days} of ${rem.vacation_days_allotted} day(s) left this year.`;
      }
      const first = (opts.employeeName ?? "there").split(" ")[0];
      try {
        await dmUser(
          uid,
          `Hi ${first}! Your ${opts.leaveLabel} has been recorded and approved :white_check_mark:\n` +
            `• Dates: ${opts.startDate} → ${opts.endDate} (${opts.days} day(s))${vacLine}\n\n` +
            `Logged by the Ops team — reach out to HR if anything looks off.`
        );
        notes.push(`DM'd ${who}.`);
      } catch (e) {
        notes.push(`DM failed: ${e instanceof Error ? e.message : "error"}.`);
      }
    }
  }
  return notes;
}

export async function previewClickupImport(
  input: unknown
): Promise<{ ok: boolean; message?: string; preview?: ImportPreview }> {
  try {
    const notAuthed = await requireAuth();
    if (notAuthed) return { ok: false, message: notAuthed.message };

    const p = importSchema.safeParse(input);
    if (!p.success) return { ok: false, message: "Paste a ClickUp task link." };
    const taskId = parseTaskId(p.data.url);
    if (!taskId) return { ok: false, message: "That doesn't look like a ClickUp task link." };

    const norm = normalizeClickupTask(await fetchClickupTask(taskId));

    // Match the requester to a known employee (fail-closed if not found).
    let matchedId: string | null = null;
    let matchedName: string | null = null;
    if (norm.employeeEmail) {
      const { data: emp } = await db
        .from("employees")
        .select("id, display_name")
        .eq("email", norm.employeeEmail)
        .maybeSingle();
      if (emp) {
        matchedId = emp.id;
        matchedName = emp.display_name;
      }
    }

    // Is this task already recorded?
    let existingStatus: string | null = null;
    if (norm.clickupTaskId) {
      const { data: ex } = await db
        .from("pto_requests")
        .select("status")
        .eq("clickup_task_id", norm.clickupTaskId)
        .maybeSingle();
      existingStatus = ex?.status ?? null;
    }

    // Vacation impact (only meaningful for counted statuses).
    let remaining: number | null = null;
    if (matchedId && norm.leaveCode === "vacation" && norm.startDate) {
      const year = Number(norm.startDate.slice(0, 4));
      const { data: rem } = await db
        .from("v_remaining_vacation")
        .select("remaining_vacation_days")
        .eq("employee_id", matchedId)
        .eq("year", year)
        .maybeSingle();
      remaining = rem?.remaining_vacation_days ?? null;
    }

    const today = new Date().toISOString().slice(0, 10);
    const isFuture = !!norm.endDate && norm.endDate >= today;
    const label = norm.leaveCode ? LEAVE_LABEL[norm.leaveCode] ?? norm.leaveCode : "—";

    const effects: string[] = [];
    const warnings: string[] = [];
    let canImport = true;

    if (norm.parseError) {
      warnings.push(`Couldn't read this task: ${norm.parseError}.`);
      canImport = false;
    }
    if (!matchedId) {
      warnings.push(
        `Couldn't identify the employee (${norm.employeeEmail ?? "no email on the task"}). ` +
          `Fix the Employee field in ClickUp, or add the person first.`
      );
      canImport = false;
    }

    if (canImport) {
      if (existingStatus) {
        if (existingStatus === norm.dbStatus) {
          effects.push(`Already recorded as ${existingStatus} — importing makes no change.`);
          canImport = false;
        } else {
          effects.push(`Update the existing record: status ${existingStatus} → ${norm.dbStatus}.`);
        }
      } else {
        effects.push(
          `Record ${matchedName ?? norm.employeeName}'s ${label}: ${norm.startDate} → ${norm.endDate} (${norm.daysRequested} day(s)) as ${norm.dbStatus}.`
        );
      }

      const counts = norm.dbStatus === "approved" || norm.dbStatus === "complete";
      if (counts && norm.leaveCode === "vacation" && remaining != null) {
        effects.push(
          `Counts toward vacation: ${remaining} → ${Math.max(0, remaining - norm.daysRequested)} remaining.`
        );
      }

      if (norm.dbStatus === "approved" && isFuture) {
        warnings.push(
          `Upcoming approved leave — it also needs a calendar event and Everhour block. ` +
            `This import writes the database record only; calendar/Everhour creation from the app isn't wired up yet.`
        );
        // Slack is opt-in below (only for this future-approved case).
      } else {
        effects.push(`No calendar event, Everhour block, or Slack message — database record only.`);
      }
    }

    return {
      ok: true,
      preview: {
        taskId: norm.clickupTaskId ?? taskId,
        taskUrl: norm.clickupTaskUrl ?? `https://app.clickup.com/t/${taskId}`,
        clickupStatus: norm.clickupStatus,
        dbStatus: norm.dbStatus,
        employeeName: norm.employeeName,
        employeeEmail: norm.employeeEmail,
        matchedName,
        leaveCode: norm.leaveCode,
        leaveLabel: label,
        startDate: norm.startDate,
        endDate: norm.endDate,
        days: norm.daysRequested,
        isFuture,
        alreadyExists: !!existingStatus,
        existingStatus,
        effects,
        warnings,
        canImport,
      },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error." };
  }
}

export const importClickupTask = safe(async function importClickupTask(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = importCommitSchema.safeParse(input);
  if (!p.success) return fail("Missing task link.");
  const taskId = parseTaskId(p.data.url);
  if (!taskId) return fail("That doesn't look like a ClickUp task link.");

  // Re-fetch fresh truth; never trust anything the client passed.
  const norm = normalizeClickupTask(await fetchClickupTask(taskId));
  if (norm.parseError) return fail(`Couldn't read the task: ${norm.parseError}`);
  if (!norm.clickupTaskId) return fail("Task has no id.");

  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("email", norm.employeeEmail ?? " ")
    .maybeSingle();
  if (!emp) {
    return fail(
      `Couldn't identify the employee (${norm.employeeEmail ?? "no email on the task"}). ` +
        `Fix the Employee field in ClickUp, or add the person first.`
    );
  }

  const now = new Date().toISOString();
  const stamps = timestampsFor(norm.dbStatus, now);
  const isFuture = !!norm.endDate && norm.endDate >= now.slice(0, 10);

  const { data: existing } = await db
    .from("pto_requests")
    .select("id, status")
    .eq("clickup_task_id", norm.clickupTaskId)
    .maybeSingle();

  if (existing) {
    if (existing.status === norm.dbStatus) {
      return done(`Already recorded as ${existing.status}. No change.`);
    }
    const { error } = await db
      .from("pto_requests")
      .update({ status: norm.dbStatus, ...stamps })
      .eq("id", existing.id);
    if (error) return fail(error.message);
    return done(`Updated status: ${existing.status} → ${norm.dbStatus}.`);
  }

  const { error } = await db.from("pto_requests").insert({
    employee_id: emp.id,
    leave_type: norm.leaveCode,
    start_date: norm.startDate,
    end_date: norm.endDate,
    duration_days: norm.daysRequested,
    status: norm.dbStatus,
    source: "clickup",
    clickup_task_id: norm.clickupTaskId,
    requested_at: now,
    ...stamps,
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return done("Already recorded (concurrent import). No change.");
    }
    return fail(error.message);
  }

  // Opt-in Slack — only ever for an upcoming approved leave, gated here so it
  // can't fire for the wrong case even if the client sends the flags.
  let extra = "";
  if (isFuture && norm.dbStatus === "approved" && (p.data.notifyEmployee || p.data.announceChannel)) {
    try {
      const notes = await runImportNotifications({
        employeeId: emp.id,
        employeeEmail: norm.employeeEmail,
        employeeName: norm.employeeName,
        leaveLabel: norm.leaveCode ? LEAVE_LABEL[norm.leaveCode] ?? norm.leaveCode : "leave",
        startDate: norm.startDate,
        endDate: norm.endDate,
        days: norm.daysRequested,
        year: norm.startDate ? Number(norm.startDate.slice(0, 4)) : new Date().getFullYear(),
        notifyEmployee: p.data.notifyEmployee,
        announceChannel: p.data.announceChannel,
      });
      if (notes.length) extra = " " + notes.join(" ");
    } catch (e) {
      extra = ` (notifications error: ${e instanceof Error ? e.message : "error"})`;
    }
  }

  return done(`Imported ${norm.employeeName}'s ${norm.leaveCode} as ${norm.dbStatus}.${extra}`);
});

// 9. Slack account resolution for the "Add employee" flow. Read-only, so these
// are guarded by requireAuth() and are not blocked by READ_ONLY. They return a
// custom shape, so they are not wrapped in safe().
const slackEmailSchema = z.object({ email: z.email() });
const slackQuerySchema = z.object({ query: z.string() });

export async function resolveSlackForEmail(
  input: unknown
): Promise<{ ok: boolean; message?: string; match?: SlackUserOption | null }> {
  try {
    const notAuthed = await requireAuth();
    if (notAuthed) return { ok: false, message: notAuthed.message };

    const p = slackEmailSchema.safeParse(input);
    if (!p.success) return { ok: false, message: "Enter a valid email address." };

    const id = await lookupSlackUserId(p.data.email);
    if (!id) return { ok: true, match: null };

    const found = (await listSlackUsers()).find((u) => u.id === id);
    return {
      ok: true,
      match: { id, name: found?.name || p.data.email, email: found?.email || p.data.email },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error." };
  }
}

export async function searchSlackUsers(
  input: unknown
): Promise<{ ok: boolean; message?: string; users?: SlackUserOption[] }> {
  try {
    const notAuthed = await requireAuth();
    if (notAuthed) return { ok: false, message: notAuthed.message };

    const p = slackQuerySchema.safeParse(input);
    if (!p.success) return { ok: false, message: "Type a name to search for." };

    const q = p.data.query.trim().toLowerCase();
    if (q.length < 2) return { ok: true, users: [] };

    const users = (await listSlackUsers()).filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
    return { ok: true, users: users.slice(0, 10) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error." };
  }
}
