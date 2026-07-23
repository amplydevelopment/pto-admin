import "server-only";
import type { ClickupTask } from "@/lib/clickup-normalize";

const CLICKUP_API = "https://api.clickup.com/api/v2";

// Accepts a task URL (https://app.clickup.com/t/<id> or /t/<team>/<id>) or a
// bare task id. Returns the task id, or null if it isn't recognizable.
export function parseTaskId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const m = s.match(/\/t\/(?:[a-z0-9]+\/)?([a-z0-9]+)/i);
  if (m) return m[1];
  if (/^[a-z0-9]+$/i.test(s)) return s;
  return null;
}

export async function fetchClickupTask(taskId: string): Promise<ClickupTask> {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) throw new Error("CLICKUP_TOKEN is not set on the server.");

  const res = await fetch(`${CLICKUP_API}/task/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (res.status === 401)
    throw new Error("ClickUp rejected the token (401) — check CLICKUP_TOKEN.");
  if (res.status === 404) throw new Error(`ClickUp task "${taskId}" not found (404).`);
  if (!res.ok) throw new Error(`ClickUp API error (${res.status}).`);

  return (await res.json()) as ClickupTask;
}
