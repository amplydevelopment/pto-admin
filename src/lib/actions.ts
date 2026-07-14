"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";

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

// 1. Record time off (manual entry — history only, no calendar/Everhour)
const recordSchema = z.object({
  employeeId: z.uuid(),
  leaveType: z.string().min(1),
  startDate: dateStr,
  endDate: dateStr,
  durationDays: z.coerce.number().gt(0).multipleOf(0.5),
  note: z.string().trim().optional(),
});

export const recordTimeOff = safe(async function recordTimeOff(input: unknown) {
  const blocked = await gate();
  if (blocked) return blocked;

  const p = recordSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  if (p.data.endDate < p.data.startDate) return fail("End date is before start date.");

  const now = new Date().toISOString();
  const { error } = await db.from("pto_requests").insert({
    employee_id: p.data.employeeId,
    leave_type: p.data.leaveType,
    start_date: p.data.startDate,
    end_date: p.data.endDate,
    duration_days: p.data.durationDays,
    status: "approved",
    source: "manual",
    notes: p.data.note || null,
    requested_at: now,
    approved_at: now,
  });
  if (error) return fail(error.message);
  return done("Time off recorded.");
});

// 2. Cancel time off
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
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

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
