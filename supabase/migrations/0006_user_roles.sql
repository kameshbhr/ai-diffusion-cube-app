-- Explicit multi-role grants per user (a user may hold more than one role at
-- once, e.g. adopter + pathway_contributor). Role assignment beyond the
-- default 'general_user' row created at signup approval is a backend-only
-- activity — an admin edits this table directly (Supabase dashboard) — so
-- there are intentionally no insert/update/delete policies for any client
-- role; only the service-role client (approval flow) or the dashboard
-- writes here.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('general_user', 'adopter', 'pathway_contributor')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);
