"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeEmploymentType } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewConfirm } from "./review";
import { EmployeeSelect, type ActionsData } from "./actions-menu";

export function ChangeTypeDialog({
  open, onClose, data, lockedEmployeeId,
}: {
  open: boolean; onClose: () => void; data: ActionsData; lockedEmployeeId?: string;
}) {
  const year = new Date().getFullYear();
  const [employeeId, setEmployeeId] = useState(lockedEmployeeId ?? "");
  const [vacationDays, setVacationDays] = useState("15");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const employee = data.employees.find((e) => e.id === employeeId);
  const newType = employee?.employment_type === "employee" ? "freelancer" : "employee";
  const hasAllocation = data.balances.find((b) => b.employeeId === employeeId)?.allotted != null;
  const needsAllocation = newType === "employee" && !hasAllocation;

  function reset() { setEmployeeId(lockedEmployeeId ?? ""); setVacationDays("15"); setReviewing(false); }

  function submit() {
    startTransition(async () => {
      const result = await changeEmploymentType({
        employeeId,
        employmentType: newType,
        vacationDays: needsAllocation ? Number(vacationDays) : undefined,
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  const reviewLines = employee
    ? [
        `Change ${employee.display_name} from ${employee.employment_type} to ${newType}.`,
        ...(needsAllocation
          ? [`Create their ${year} vacation allocation: ${vacationDays} day(s).`]
          : []),
        ...(newType === "freelancer"
          ? ["Their existing allocation and history stay untouched."]
          : []),
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change employment type</DialogTitle>
          <DialogDescription>
            E.g. a freelancer becoming a full-time employee.
          </DialogDescription>
        </DialogHeader>
        {reviewing && employee ? (
          <ReviewConfirm
            lines={reviewLines}
            onBack={() => setReviewing(false)}
            onConfirm={submit}
            pending={pending}
            confirmLabel="Change type"
          />
        ) : (
          <div className="space-y-3">
            {!lockedEmployeeId && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                <EmployeeSelect employees={data.employees} value={employeeId} onChange={setEmployeeId} />
              </div>
            )}
            {employee && (
              <p className="text-sm text-muted-foreground">
                {employee.display_name} is currently a <b>{employee.employment_type}</b> — this
                will make them a <b>{newType}</b>.
              </p>
            )}
            {needsAllocation && (
              <div className="space-y-1.5">
                <Label>{year} vacation days</Label>
                <Input
                  type="number" step="0.5" min="0"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  New employees need an allocation. Prorate if they convert mid-year.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button disabled={!employeeId} onClick={() => setReviewing(true)}>Review…</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
