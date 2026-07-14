"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelTimeOff } from "@/lib/actions";
import type { PtoRequest } from "@/lib/queries";
import { StatusChip, SourceDot } from "@/components/pto-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function LogTable({
  requests,
  hidePerson = false,
}: {
  requests: PtoRequest[];
  hidePerson?: boolean;
}) {
  const [selected, setSelected] = useState<PtoRequest | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setSelected(null);
    setConfirmingCancel(false);
  }

  function submitCancel(request: PtoRequest) {
    startTransition(async () => {
      const result = await cancelTimeOff({ requestId: request.id });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) close();
    });
  }

  const cancellable = (r: PtoRequest) => r.status === "approved" || r.status === "pending";

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {!hidePerson && <TableHead>Name</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody data-log-body>
          {requests.map((r) => (
            <TableRow
              key={r.id}
              data-name={(r.employees?.display_name ?? "").toLowerCase()}
              className="cursor-pointer"
              onClick={() => setSelected(r)}
            >
              {!hidePerson && (
                <TableCell className="font-medium">{r.employees?.display_name ?? "?"}</TableCell>
              )}
              <TableCell>{r.leave_type}</TableCell>
              <TableCell>{r.start_date}</TableCell>
              <TableCell>{r.end_date}</TableCell>
              <TableCell className="tnum text-right">{r.duration_days}</TableCell>
              <TableCell><StatusChip status={r.status} /></TableCell>
              <TableCell><SourceDot source={r.source} /></TableCell>
            </TableRow>
          ))}
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={hidePerson ? 6 : 7} className="text-center text-muted-foreground">
                No requests match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!selected} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.employees?.display_name} — {selected.leave_type}
                </DialogTitle>
                <DialogDescription>
                  {selected.start_date} → {selected.end_date} · {selected.duration_days} day(s) ·{" "}
                  {selected.status}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1 text-sm">
                <p>Source: {selected.source}</p>
                {selected.clickup_task_id && (
                  <p>
                    ClickUp:{" "}
                    <a
                      className="underline"
                      href={`https://app.clickup.com/t/${selected.clickup_task_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.clickup_task_id}
                    </a>
                  </p>
                )}
                {selected.google_calendar_event_id && <p>Has a linked calendar event.</p>}
                {selected.notes && <p>Note: {selected.notes}</p>}
              </div>

              {confirmingCancel ? (
                <div className="space-y-3 rounded-md border p-3 text-sm">
                  {selected.clickup_task_id ? (
                    <p className="text-amber-700">
                      This request came from ClickUp. The recommended way to cancel it is to set
                      the ClickUp task to <b>canceled</b> — the automation then also removes the
                      calendar event and Everhour block. Cancelling here only updates the
                      database and leaves those in place.
                    </p>
                  ) : (
                    <p>
                      This will mark the request <b>cancelled</b> in the database. Nothing is
                      deleted.
                    </p>
                  )}
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setConfirmingCancel(false)}>
                      Back
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={pending}
                      onClick={() => submitCancel(selected)}
                    >
                      {selected.clickup_task_id ? "Cancel in database anyway" : "Confirm cancel"}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <DialogFooter>
                  {cancellable(selected) && (
                    <Button variant="destructive" onClick={() => setConfirmingCancel(true)}>
                      Cancel this time off…
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
