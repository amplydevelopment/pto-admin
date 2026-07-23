"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addEmployee, resolveSlackForEmail, searchSlackUsers } from "@/lib/actions";
import type { SlackUserOption } from "@/lib/types";
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

  const [slackUser, setSlackUser] = useState<SlackUserOption | null>(null);
  const [slackChecking, setSlackChecking] = useState(false);
  const [slackNoMatch, setSlackNoMatch] = useState(false);
  const [slackQuery, setSlackQuery] = useState("");
  const [slackResults, setSlackResults] = useState<SlackUserOption[]>([]);
  const [slackSearching, setSlackSearching] = useState(false);
  const [notOnSlack, setNotOnSlack] = useState(false);

  const isEmployee = employmentType === "employee";
  const formValid = fullName.trim() && displayName.trim() && email.includes("@");

  function reset() {
    setFullName(""); setDisplayName(""); setEmail(""); setEmploymentType("employee");
    setStartedAt(""); setVacationDays("15"); setReviewing(false);
    setSlackUser(null); setSlackChecking(false); setSlackNoMatch(false);
    setSlackQuery(""); setSlackResults([]); setSlackSearching(false); setNotOnSlack(false);
  }

  async function checkEmailOnSlack() {
    if (notOnSlack || slackUser) return;
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return;
    setSlackChecking(true);
    const res = await resolveSlackForEmail({ email: value });
    setSlackChecking(false);
    if (!res.ok) { toast.error(res.message ?? "Slack lookup failed."); return; }
    if (res.match) { setSlackUser(res.match); setSlackNoMatch(false); }
    else { setSlackUser(null); setSlackNoMatch(true); }
  }

  async function runSlackSearch(q: string) {
    setSlackQuery(q);
    if (q.trim().length < 2) { setSlackResults([]); return; }
    setSlackSearching(true);
    const res = await searchSlackUsers({ query: q });
    setSlackSearching(false);
    setSlackResults(res.ok ? res.users ?? [] : []);
    if (!res.ok) toast.error(res.message ?? "Slack search failed.");
  }

  function pickSlackUser(u: SlackUserOption) {
    setSlackUser(u);
    setSlackNoMatch(false);
    setSlackQuery("");
    setSlackResults([]);
  }

  function clearSlackUser() {
    setSlackUser(null);
    setSlackNoMatch(true);
    setSlackQuery("");
    setSlackResults([]);
  }

  function toggleNotOnSlack(checked: boolean) {
    setNotOnSlack(checked);
    if (checked) {
      setSlackUser(null);
      setSlackNoMatch(false);
      setSlackQuery("");
      setSlackResults([]);
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await addEmployee({
        fullName, displayName, email, employmentType,
        startedAt,
        vacationDays: isEmployee ? Number(vacationDays) : undefined,
        slackUserId: notOnSlack ? undefined : slackUser?.id,
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
    !notOnSlack && slackUser
      ? `Link their Slack account: ${slackUser.name}.`
      : "No Slack account — they won't get PTO DMs.",
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
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSlackUser(null);
                  setSlackNoMatch(false);
                }}
                onBlur={checkEmailOnSlack}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Slack account</Label>
              {slackChecking && (
                <p className="text-xs text-muted-foreground">Checking Slack…</p>
              )}
              {notOnSlack ? (
                <p className="text-xs text-muted-foreground">
                  Marked as not on Slack — they won&apos;t receive PTO DMs.
                </p>
              ) : slackUser ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
                  <span className="text-sm">
                    ✅ Slack: {slackUser.name}
                    {slackUser.email ? ` (${slackUser.email})` : ""}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSlackUser}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  {slackNoMatch && (
                    <p className="text-xs text-amber-600">
                      Couldn&apos;t find them on Slack by this email — search by name instead.
                    </p>
                  )}
                  {slackNoMatch && (
                    <>
                      <Input
                        placeholder="Search Slack by name"
                        value={slackQuery}
                        onChange={(e) => runSlackSearch(e.target.value)}
                      />
                      {slackSearching && (
                        <p className="text-xs text-muted-foreground">Searching…</p>
                      )}
                      {!slackSearching && slackQuery.trim().length >= 2 && !slackResults.length && (
                        <p className="text-xs text-muted-foreground">No Slack users match that.</p>
                      )}
                      {slackResults.length > 0 && (
                        <div className="max-h-40 divide-y overflow-y-auto rounded-md border">
                          {slackResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="block w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                              onClick={() => pickSlackUser(u)}
                            >
                              {u.name}
                              {u.email ? (
                                <span className="text-muted-foreground"> — {u.email}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {!slackNoMatch && !slackChecking && (
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll look them up on Slack once you fill in the work email.
                    </p>
                  )}
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={notOnSlack}
                  onChange={(e) => toggleNotOnSlack(e.target.checked)}
                />
                Not on Slack
              </label>
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
