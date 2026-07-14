"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordTimeOff } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewConfirm } from "./review";
import { EmployeeSelect, type ActionsData } from "./actions-menu";

function inclusiveDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const ms = Date.parse(end) - Date.parse(start);
  return Math.round(ms / 86_400_000) + 1;
}

export function RecordTimeOffDialog({
  open,
  onClose,
  data,
  lockedEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  data: ActionsData;
  lockedEmployeeId?: string;
}) {
  const [employeeId, setEmployeeId] = useState(lockedEmployeeId ?? "");
  const [leaveType, setLeaveType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const employee = data.employees.find((e) => e.id === employeeId);
  const balance = data.balances.find((b) => b.employeeId === employeeId);
  const days = Number(duration) || inclusiveDays(startDate, endDate);
  const formValid = employeeId && leaveType && startDate && endDate && endDate >= startDate && days > 0;

  function reset() {
    setEmployeeId(lockedEmployeeId ?? ""); setLeaveType("vacation"); setStartDate(""); setEndDate("");
    setDuration(""); setNote(""); setReviewing(false);
  }

  function submit() {
    startTransition(async () => {
      const result = await recordTimeOff({
        employeeId, leaveType, startDate, endDate, durationDays: days, note,
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  const reviewLines = [
    `Add an approved ${leaveType} entry for ${employee?.display_name}: ${startDate} → ${endDate} (${days} day(s)).`,
    ...(leaveType === "vacation" && balance?.remaining != null
      ? [`Vacation remaining: ${balance.remaining} → ${balance.remaining - days}.`]
      : []),
    "NOT create a calendar event or Everhour block — this records history only.",
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record time off</DialogTitle>
          <DialogDescription>
            Manual entry, e.g. leave that didn't go through the ClickUp form.
          </DialogDescription>
        </DialogHeader>

        {reviewing ? (
          <ReviewConfirm
            lines={reviewLines}
            onBack={() => setReviewing(false)}
            onConfirm={submit}
            pending={pending}
            confirmLabel="Record it"
          />
        ) : (
          <div className="space-y-3">
            {!lockedEmployeeId && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                <EmployeeSelect employees={data.employees} value={employeeId} onChange={setEmployeeId} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                {data.leaveTypes.map((lt) => (
                  <option key={lt.code} value={lt.code}>{lt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input
                type="number" step="0.5" min="0.5"
                placeholder={startDate && endDate ? String(inclusiveDays(startDate, endDate)) : "auto"}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to calendar days incl. both ends. Override for half days or to skip weekends.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
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
