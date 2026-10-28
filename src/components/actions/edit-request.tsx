"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { editTimeOff } from "@/lib/actions";
import type { LeaveType, PtoRequest } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewConfirm } from "./review";

// Rendered inside the log's request dialog (in place of its footer).
export function EditRequestForm({
  request, leaveTypes, onBack, onDone,
}: {
  request: PtoRequest; leaveTypes: LeaveType[]; onBack: () => void; onDone: () => void;
}) {
  const [leaveType, setLeaveType] = useState(request.leave_type);
  const [startDate, setStartDate] = useState(request.start_date);
  const [endDate, setEndDate] = useState(request.end_date);
  const [days, setDays] = useState(String(request.duration_days));
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  const label = (code: string) => leaveTypes.find((t) => t.code === code)?.label ?? code;

  function pickType(code: string) {
    setLeaveType(code);
    // Half-day types are always 0.5 days; prefill so the count stays right.
    const fraction = leaveTypes.find((t) => t.code === code)?.day_fraction;
    if (fraction != null && fraction < 1) {
      setDays(String(fraction));
      setEndDate(startDate);
    }
  }

  const changed: string[] = [];
  if (leaveType !== request.leave_type) changed.push(`Type: ${label(request.leave_type)} → ${label(leaveType)}`);
  if (startDate !== request.start_date) changed.push(`Start: ${request.start_date} → ${startDate}`);
  if (endDate !== request.end_date) changed.push(`End: ${request.end_date} → ${endDate}`);
  if (Number(days) !== Number(request.duration_days)) changed.push(`Days: ${request.duration_days} → ${days}`);

  const datesValid = !!startDate && !!endDate && endDate >= startDate;
  const formValid = !!leaveType && datesValid && Number(days) > 0 && changed.length > 0;

  function submit() {
    startTransition(async () => {
      const result = await editTimeOff({
        requestId: request.id, leaveType, startDate, endDate, durationDays: Number(days), reason,
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) onDone();
    });
  }

  const hasSideEffects = request.status === "approved" || request.status === "complete";
  const reviewLines = [
    ...changed,
    reason.trim() ? `Note on record: "${reason.trim()}"` : "No note added.",
    "Used/remaining recalculate automatically.",
    ...(hasSideEffects
      ? [
          request.google_calendar_event_id
            ? "Update the team calendar event to match."
            : "No linked calendar event, so the calendar won't change.",
          request.everhour_assignment_id
            ? "Replace the Everhour time-off entry to match."
            : "No stored Everhour entry, so Everhour won't change.",
        ]
      : []),
    ...(request.clickup_task_id ? ["The ClickUp task keeps the old details."] : []),
  ];

  if (reviewing) {
    return (
      <ReviewConfirm
        lines={reviewLines}
        onBack={() => setReviewing(false)}
        onConfirm={submit}
        pending={pending}
        confirmLabel="Save changes"
      />
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <Label>Type</Label>
        <select
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          value={leaveType}
          onChange={(e) => pickType(e.target.value)}
        >
          {leaveTypes.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Start</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Days</Label>
          <Input
            type="number" step="0.5" min="0.5"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      </div>
      {!datesValid && startDate && endDate && (
        <p className="text-red-700">End date can&apos;t be before the start date.</p>
      )}
      <div className="space-y-1.5">
        <Label>Reason (optional)</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {request.status === "pending" && request.clickup_task_id && (
        <p className="text-amber-700">
          This request is still pending. When it&apos;s approved in ClickUp, the calendar event
          and Everhour entry are created from the ClickUp task&apos;s dates, not these.
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button disabled={!formValid} onClick={() => setReviewing(true)}>Review…</Button>
      </DialogFooter>
    </div>
  );
}
