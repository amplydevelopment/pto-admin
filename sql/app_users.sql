-- PTO Admin access list. Run once in the Supabase SQL editor.
-- A person can sign in to the app iff their email has a row here.

create table if not exists app_users (
  email      citext primary key,
  created_at timestamptz not null default now()
);

-- Add people like this:
-- insert into app_users (email) values ('jaivik@joinamply.com');
