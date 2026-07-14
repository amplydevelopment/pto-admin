"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustAllocation } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewConfirm } from "./review";
import { EmployeeSelect, type ActionsData } from "./actions-menu";

export function AdjustAllocationDialog({
  open, onClose, data, lockedEmployeeId,
}: {
  open: boolean; onClose: () => void; data: ActionsData; lockedEmployeeId?: string;
}) {
  const currentYear = new Date().getFullYear();
  const [employeeId, setEmployeeId] = useState(lockedEmployeeId ?? "");
  const [year, setYear] = useState(String(currentYear));
  const [vacationDays, setVacationDays] = useState("");
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const employee = data.employees.find((e) => e.id === employeeId);
  const current = data.balances.find((b) => b.employeeId === employeeId)?.allotted;
  const formValid = employeeId && Number(year) >= 2020 && vacationDays !== "" && reason.trim().length >= 3;

  function reset() {
    setEmployeeId(lockedEmployeeId ?? ""); setYear(String(currentYear)); setVacationDays(""); setReason(""); setReviewing(false);
  }

  function submit() {
    startTransition(async () => {
      const result = await adjustAllocation({
        employeeId, year: Number(year), vacationDays: Number(vacationDays), reason,
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  const reviewLines = employee
    ? [
        `Set ${employee.display_name}'s ${year} vacation allowance to ${vacationDays} day(s)` +
          (Number(year) === currentYear && current != null ? ` (currently ${current}).` : "."),
        `Reason on record: "${reason.trim()}"`,
        "Used/remaining recalculate automatically — nothing else changes.",
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust allocation</DialogTitle>
          <DialogDescription>
            Changes someone's yearly vacation allowance (the old "TOTAL PTO").
          </DialogDescription>
        </DialogHeader>
        {reviewing && employee ? (
          <ReviewConfirm
            lines={reviewLines}
            onBack={() => setReviewing(false)}
            onConfirm={submit}
            pending={pending}
            confirmLabel="Update allowance"
          />
        ) : (
          <div className="space-y-3">
            {!lockedEmployeeId && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                <EmployeeSelect employees={data.employees} value={employeeId} onChange={setEmployeeId} />
              </div>
            )}
            {employee && Number(year) === currentYear && (
              <p className="text-sm text-muted-foreground">
                Current {currentYear} allowance: <b>{current ?? "none set"}</b>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vacation days</Label>
                <Input
                  type="number" step="0.5" min="0"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (required)</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button disabled={!formValid} onClick={() => setReviewing(true)}>Review…</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
