"use client";

import { useState } from "react";
import type { Employee, LeaveType } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddEmployeeDialog } from "./add-employee";
import { RolloverDialog } from "./rollover";
import { ImportClickupDialog } from "./import-clickup";

export type BalanceInfo = { employeeId: string; remaining: number | null; allotted: number | null };

export type ActionsData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
  balances: BalanceInfo[];
  nextYearAllocated: string[];
};

// Global actions only — the high-frequency one (Import from ClickUp), one with
// no single person yet (Add employee), and a bulk one (Year rollover).
// Per-person edits live on the employee Sheet (see PersonActions).
type ActionKey = "import" | "add-employee" | "rollover";

const ITEMS: [ActionKey, string][] = [
  ["import", "Add PTO"],
  ["add-employee", "Add employee"],
  ["rollover", "Year rollover"],
];

export function ActionsMenu(props: ActionsData) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const close = () => setOpen(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">+ New action</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ITEMS.slice(0, 2).map(([key, label]) => (
            <DropdownMenuItem key={key} className="whitespace-nowrap" onSelect={() => setOpen(key)}>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {ITEMS.slice(2).map(([key, label]) => (
            <DropdownMenuItem key={key} className="whitespace-nowrap" onSelect={() => setOpen(key)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportClickupDialog open={open === "import"} onClose={close} />
      <AddEmployeeDialog open={open === "add-employee"} onClose={close} />
      <RolloverDialog open={open === "rollover"} onClose={close} data={props} />
    </>
  );
}

export function EmployeeSelect({
  employees,
  value,
  onChange,
  activeOnly = true,
  showStatus = false,
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  activeOnly?: boolean;
  showStatus?: boolean;
}) {
  const list = activeOnly ? employees.filter((e) => e.status === "active") : employees;
  return (
    <select
      className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select person…</option>
      {list.map((e) => (
        <option key={e.id} value={e.id}>
          {e.display_name} ({e.employment_type}
          {showStatus && e.status === "inactive" ? ", inactive" : ""})
        </option>
      ))}
    </select>
  );
}
