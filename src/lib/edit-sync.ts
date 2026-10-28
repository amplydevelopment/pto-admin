import "server-only";

// Asks the n8n "PTO Edit Sync" workflow to bring the calendar event and
// Everhour entry in line with an edited pto_requests row. n8n re-reads the
// row itself, so only the id is sent. Returns plain-English notes for the
// toast; never throws (the DB edit has already been saved by then).

const CALENDAR_NOTE: Record<string, string | null> = {
  update: "Calendar event updated.",
  "skipped-no-event": "No linked calendar event, so the calendar wasn't touched.",
  "skipped-status": null,
};

const EVERHOUR_NOTE: Record<string, string | null> = {
  replace: "Everhour entry replaced.",
  "skipped-no-account": "This person has no Everhour account, so Everhour was skipped.",
  "skipped-no-entry": "No stored Everhour entry. Update Everhour by hand if needed.",
  "skipped-status": null,
};

export async function syncEditedRequest(requestId: string): Promise<string[]> {
  const url = process.env.N8N_EDIT_SYNC_URL;
  const secret = process.env.N8N_EDIT_SYNC_SECRET;
  if (!url || !secret) {
    return ["Calendar/Everhour sync isn't configured, so only the database changed."];
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PTO-Admin-Secret": secret },
      body: JSON.stringify({ requestId }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return [
        `Calendar/Everhour sync failed (HTTP ${res.status}). Ops has been alerted. ` +
          `Check the calendar and Everhour by hand.`,
      ];
    }
    const body = (await res.json()) as { calendar?: string; everhour?: string };
    return [CALENDAR_NOTE[body.calendar ?? ""], EVERHOUR_NOTE[body.everhour ?? ""]].filter(
      (note): note is string => !!note
    );
  } catch (err) {
    return [
      `Couldn't reach the Calendar/Everhour sync (${err instanceof Error ? err.message : "error"}). ` +
        `Check the calendar and Everhour by hand.`,
    ];
  }
}
