"use client";

import { useState } from "react";
import type { Employee, LeaveType } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import type { ActionsData } from "./actions-menu";
import { AdjustAllocationDialog } from "./adjust-allocation";
import { ChangeTypeDialog } from "./change-type";
import { SetStatusDialog } from "./set-status";

type PersonActionKey = "adjust-allocation" | "change-type" | "set-status";

// Footer actions on the employee Sheet — every dialog is pre-locked to this
// person (no person picker), so Ops acts on whoever they're already viewing.
export function PersonActions({
  employee,
  leaveTypes,
  allotted,
  remaining,
}: {
  employee: Employee;
  leaveTypes: LeaveType[];
  allotted: number | null;
  remaining: number | null;
}) {
  const [open, setOpen] = useState<PersonActionKey | null>(null);
  const close = () => setOpen(null);

  // Minimal ActionsData scoped to this one person; satisfies the dialogs'
  // employees/balances lookups without loading the whole roster.
  const data: ActionsData = {
    employees: [employee],
    leaveTypes,
    balances: [{ employeeId: employee.id, remaining, allotted }],
    nextYearAllocated: [],
  };

  const inactive = employee.status === "inactive";

  return (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button size="sm" variant="outline" onClick={() => setOpen("adjust-allocation")}>
        Adjust allocation
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen("change-type")}>
        Change employment type
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen("set-status")}>
        {inactive ? "Reactivate" : "Mark inactive"}
      </Button>

      <AdjustAllocationDialog open={open === "adjust-allocation"} onClose={close} data={data} lockedEmployeeId={employee.id} />
      <ChangeTypeDialog open={open === "change-type"} onClose={close} data={data} lockedEmployeeId={employee.id} />
      <SetStatusDialog open={open === "set-status"} onClose={close} data={data} lockedEmployeeId={employee.id} />
    </div>
  );
}
