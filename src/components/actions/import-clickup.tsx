"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { previewClickupImport, importClickupTask } from "@/lib/actions";
import type { ImportPreview } from "@/lib/clickup-normalize";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImportClickupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dmEmployee, setDmEmployee] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  function reset() {
    setUrl("");
    setPreview(null);
    setDmEmployee(false);
    setAnnounce(false);
  }

  function readTask() {
    startLoad(async () => {
      const r = await previewClickupImport({ url });
      if (r.ok && r.preview) setPreview(r.preview);
      else toast.error(r.message ?? "Couldn't read that task.");
    });
  }

  function doImport() {
    startSave(async () => {
      const r = await importClickupTask({
        url,
        notifyEmployee: dmEmployee,
        announceChannel: announce,
      });
      r.ok ? toast.success(r.message) : toast.error(r.message);
      if (r.ok) {
        reset();
        onClose();
      }
    });
  }

  const showNotify = !!preview && preview.dbStatus === "approved" && preview.isFuture;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add PTO</DialogTitle>
          <DialogDescription>
            Paste a PTO task link. We&apos;ll read it and show exactly what gets recorded before you commit.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>ClickUp task link</Label>
              <Input
                placeholder="https://app.clickup.com/t/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && url.trim() && !loading) readTask(); }}
              />
            </div>
            <DialogFooter>
              <Button disabled={!url.trim() || loading} onClick={readTask}>
                {loading ? "Reading…" : "Read task"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <Row label="Employee" value={preview.matchedName ?? preview.employeeName ?? "—"} />
              <Row label="Type" value={preview.leaveLabel} />
              <Row label="Dates" value={`${preview.startDate} → ${preview.endDate} (${preview.days}d)`} />
              <Row label="Status" value={`${preview.clickupStatus ?? "—"} → ${preview.dbStatus}`} />
            </div>

            {preview.warnings.length > 0 && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{ background: "#fff8e0", borderColor: "#ffe082" }}
              >
                <ul className="list-disc space-y-1 pl-5">
                  {preview.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="rounded-md border p-3 text-sm">
              <p className="mb-2 font-medium">This will:</p>
              <ul className="list-disc space-y-1 pl-5">
                {preview.effects.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>

            {showNotify && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium">Notify (optional)</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={dmEmployee}
                    onChange={(e) => setDmEmployee(e.target.checked)}
                  />
                  DM {preview.matchedName ?? preview.employeeName} their approval + balance
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={announce}
                    onChange={(e) => setAnnounce(e.target.checked)}
                  />
                  Announce in #pto that they&apos;ll be OOO
                </label>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={saving}>
                Back
              </Button>
              <Button onClick={doImport} disabled={!preview.canImport || saving}>
                {saving ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
