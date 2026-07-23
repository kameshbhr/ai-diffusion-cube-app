-- Stores signup requests awaiting admin review before any Supabase auth user
-- is created. Holds not-yet-verified personal data plus a sensitive
-- single-use approval token, so RLS is enabled with zero client-facing
-- policies — every read/write happens through the service-role client
-- (lib/supabase/admin.ts), never the anon/authenticated REST API.
create table if not exists public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approval_token text not null unique,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists pending_signups_email_idx on public.pending_signups (email);

alter table public.pending_signups enable row level security;

-- Intentionally no policies: RLS enabled + zero grants denies all access via
-- the anon/authenticated REST API. The service-role client bypasses RLS
-- entirely, which is the only way this table is ever read or written.
