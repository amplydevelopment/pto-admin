"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { yearRollover } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type ActionsData } from "./actions-menu";

export function RolloverDialog({
  open, onClose, data,
}: {
  open: boolean; onClose: () => void; data: ActionsData;
}) {
  const nextYear = new Date().getFullYear() + 1;
  const [pending, startTransition] = useTransition();

  // Active employees (not freelancers) who don't have a next-year allocation yet,
  // prefilled with their current allowance.
  const candidates = useMemo(
    () =>
      data.employees
        .filter(
          (e) =>
            e.status === "active" &&
            e.employment_type === "employee" &&
            !data.nextYearAllocated.includes(e.id)
        )
        .map((e) => ({
          employeeId: e.id,
          name: e.display_name,
          days: String(data.balances.find((b) => b.employeeId === e.id)?.allotted ?? 15),
        })),
    [data]
  );

  const [rows, setRows] = useState(candidates);
  const [initialized, setInitialized] = useState(false);
  if (open && !initialized) {
    setRows(candidates);
    setInitialized(true);
  }

  function reset() { setInitialized(false); }

  function submit() {
    startTransition(async () => {
      const result = await yearRollover({
        year: nextYear,
        rows: rows.map((r) => ({ employeeId: r.employeeId, vacationDays: Number(r.days) })),
      });
      result.ok ? toast.success(result.message) : toast.error(result.message);
      if (result.ok) { reset(); onClose(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Year rollover → {nextYear}</DialogTitle>
          <DialogDescription>
            Creates {nextYear} vacation allocations for every active employee who doesn't
            have one yet. Adjust individual numbers before confirming.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everyone already has a {nextYear} allocation. Nothing to do.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <span className="w-48 truncate text-sm">{row.name}</span>
                <Input
                  className="w-24"
                  type="number" step="0.5" min="0"
                  value={row.days}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, days: e.target.value };
                    setRows(next);
                  }}
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            ))}
            <DialogFooter className="pt-2">
              <Button onClick={submit} disabled={pending}>
                {pending ? "Working…" : `Create ${rows.length} allocation(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
