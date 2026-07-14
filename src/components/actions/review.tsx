"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

// Shared final step of every action dialog: a plain-English list of
// exactly what will happen, then Confirm.
export function ReviewConfirm({
  lines,
  onBack,
  onConfirm,
  pending,
  confirmLabel = "Confirm",
}: {
  lines: string[];
  onBack: () => void;
  onConfirm: () => void;
  pending: boolean;
  confirmLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-3 text-sm">
        <p className="mb-2 font-medium">This will:</p>
        <ul className="list-disc space-y-1 pl-5">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
