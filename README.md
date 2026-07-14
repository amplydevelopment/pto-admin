# PTO Admin

Internal web app for Ops to view (and later correct) Amply's PTO data without
touching the Supabase UI. Two read pages that mirror the old sheet tabs
(**Team Balances** ≈ Yearly Totals, **PTO Log** ≈ PTO Tracker) plus guided
actions that encode every multi-table process. Local-only for now.

**Safety model:** the app boots in **read-only mode** (`READ_ONLY=true`).
Every action walks through its form and confirmation, then refuses at the
final step. Nothing can write to the database until the flag is deliberately
set to `false`. Reads hit the live Amply Supabase project.

## Setup (one time)

1. `cp .env.local.example .env.local`
2. Supabase dashboard → project `aaiyycxehewdkzvallvf` → Settings → API:
   copy the URL and the `service_role` key into `.env.local`.
3. Run `sql/app_users.sql` in the Supabase SQL editor, then add yourself:
   `insert into app_users (email) values ('you@joinamply.com');`
4. In `.env.local`, set `APP_DEV_PASSWORD` (share with Ops) and
   `AUTH_SECRET` (`openssl rand -base64 32`).
5. `pnpm install && pnpm dev` → http://localhost:3000

Sign-in = work email (must be in `app_users`) + the shared password.

## What's what

| Path | Purpose |
|---|---|
| `src/lib/queries.ts` | every read (explicit column lists — see note below) |
| `src/lib/actions.ts` | every write; the `READ_ONLY` gate is the first statement of each |
| `src/auth.ts` | next-auth v5, JWT sessions, `app_users` allowlist |
| `src/components/actions/` | the guided action dialogs |
| `sql/app_users.sql` | the access-list table |

Note: `pto_requests.everhour_assignment_id` and `denied_at` exist only in the
dev-mirror database (workflow v2 work), not in prod yet — queries must not
select them until the workflow cutover adds them to prod.

## Before enabling writes (`READ_ONLY=false`) — checklist

- Decide test strategy (rehearse against the personal-mirror DB first?).
- Add an `app_audit` table + write per-action audit rows (skipped in v1
  because read-only mode meant there was nothing to audit).
- Re-read the cancel guardrail: ClickUp-sourced rows should normally be
  cancelled in ClickUp so the automation cleans up Calendar/Everhour.

## Deploying later (not set up yet)

Vercel + swap Credentials login for Google OAuth in `src/auth.ts`
(`signIn` callback keeps the same `app_users` check; restrict to
joinamply.com). Set the same env vars in Vercel; keep `READ_ONLY=true`
until writes are meant to go live.
