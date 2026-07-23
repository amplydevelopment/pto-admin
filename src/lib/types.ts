// Shared types. Kept out of actions.ts because that file is "use server" and
// may only export async functions.

export type SlackUserOption = { id: string; name: string; email: string };
