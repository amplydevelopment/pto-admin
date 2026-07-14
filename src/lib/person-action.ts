"use server";

import { auth } from "@/auth";
import { getPerson } from "@/lib/queries";

// Read-only fetch used by the on-demand employee Sheet.
export async function loadPerson(employeeId: string, year: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in.");
  return getPerson(employeeId, year);
}
