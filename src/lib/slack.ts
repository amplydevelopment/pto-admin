import "server-only";

// Minimal Slack Web API client, server-side only. Shares the same "Amply Bot"
// token the n8n workflow uses (SLACK_BOT_TOKEN). Used only by the opt-in
// notifications on the "Add PTO" flow for upcoming-approved leaves.

const SLACK_API = "https://slack.com/api";

// The #pto channel (same one the workflow posts to). Override via env if needed.
export const PTO_CHANNEL_ID = process.env.SLACK_PTO_CHANNEL ?? "C09LJBZN88L";

function token(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error("SLACK_BOT_TOKEN is not set on the server.");
  return t;
}

// email -> Slack user id (users.lookupByEmail takes a query param, not JSON).
// Returns null when the person has no matching Slack user; callers treat that
// as "couldn't DM" rather than a hard failure.
export async function lookupSlackUserId(email: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" }
    );
    const data = (await res.json()) as { ok: boolean; user?: { id?: string } };
    return data.ok ? data.user?.id ?? null : null;
  } catch {
    return null;
  }
}

async function postMessage(channel: string, text: string): Promise<void> {
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "unknown Slack error");
}

export async function announceInChannel(text: string): Promise<void> {
  await postMessage(PTO_CHANNEL_ID, text);
}

export async function dmUser(userId: string, text: string): Promise<void> {
  await postMessage(userId, text);
}
