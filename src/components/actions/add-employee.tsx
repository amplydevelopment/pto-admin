"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addEmployee } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewConfirm } from "./review";

export function AddEmployeeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const year = new Date().getFullYear();
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [employmentType, setEmploymentType] = useState<"employee" | "freelancer">("employee");
  const [startedAt, setStartedAt] = useState("");
  const [vacationDays, setVacationDays] = useState("15");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const isEmployee = employmentType === "employee";
  const formValid = fullName.trim() && displayName.trim() && email.includes("@");

  function reset() {
    setFullName(""); setDisplayName(""); setEmail(""); setEmploymentType("employee");
    setStartedAt(""); setVacationDays("15"); setReviewing(false);
  }

  function submit() {
    startTransition(async () => {
      const result = await addEmployee({
        fullName, displayName, email, employmentType,
        startedAt,
        vacationDays: isEmployee ? Number(vacationDays) : undefined,
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  const reviewLines = [
    `Add ${fullName} (${email}) as an active ${employmentType}.`,
    isEmployee
      ? `Create their ${year} vacation allocation: ${vacationDays} day(s).`
      : "No vacation allocation (freelancers don't have one).",
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Creates the person AND their vacation allocation in one step.
          </DialogDescription>
        </DialogHeader>

        {reviewing ? (
          <ReviewConfirm
            lines={reviewLines}
            onBack={() => setReviewing(false)}
            onConfirm={submit}
            pending={pending}
            confirmLabel="Add them"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full name (as in ClickUp)</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Work email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as "employee" | "freelancer")}
                >
                  <option value="employee">employee</option>
                  <option value="freelancer">freelancer</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start date (optional)</Label>
                <Input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
              </div>
            </div>
            {isEmployee && (
              <div className="space-y-1.5">
                <Label>{year} vacation days</Label>
                <Input
                  type="number" step="0.5" min="0"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Full year is 15. Mid-year joiners are usually prorated (~1.25 days per remaining month).
                </p>
              </div>
            )}
            <DialogFooter>
              <Button disabled={!formValid} onClick={() => setReviewing(true)}>
                Review…
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
