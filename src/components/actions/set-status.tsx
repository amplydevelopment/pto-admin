"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setEmployeeStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ReviewConfirm } from "./review";
import { EmployeeSelect, type ActionsData } from "./actions-menu";

export function SetStatusDialog({
  open, onClose, data, lockedEmployeeId,
}: {
  open: boolean; onClose: () => void; data: ActionsData; lockedEmployeeId?: string;
}) {
  const [employeeId, setEmployeeId] = useState(lockedEmployeeId ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const employee = data.employees.find((e) => e.id === employeeId);
  const target = employee?.status === "active" ? "inactive" : "active";

  function reset() { setEmployeeId(lockedEmployeeId ?? ""); setReviewing(false); }

  function submit() {
    startTransition(async () => {
      const result = await setEmployeeStatus({ employeeId, status: target });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  const reviewLines =
    target === "inactive"
      ? [`Mark ${employee?.display_name} as inactive.`, "Keep all their PTO history and allocations untouched."]
      : [`Reactivate ${employee?.display_name} (back to active).`, "They'll reappear in the default balances view."];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set active / inactive</DialogTitle>
          <DialogDescription>
            Change whether someone is active. Nothing is ever deleted.
          </DialogDescription>
        </DialogHeader>
        {reviewing && employee ? (
          <ReviewConfirm
            lines={reviewLines}
            onBack={() => setReviewing(false)}
            onConfirm={submit}
            pending={pending}
            confirmLabel={target === "inactive" ? "Mark inactive" : "Reactivate"}
          />
        ) : (
          <div className="space-y-3">
            {!lockedEmployeeId && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                {/* activeOnly=false so inactive people can be reactivated */}
                <EmployeeSelect
                  employees={data.employees}
                  value={employeeId}
                  onChange={setEmployeeId}
                  activeOnly={false}
                  showStatus
                />
              </div>
            )}
            {employee && (
              <p className="text-sm text-muted-foreground">
                {employee.display_name} is currently <b>{employee.status}</b> — this will set them
                to <b>{target}</b>.
              </p>
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
