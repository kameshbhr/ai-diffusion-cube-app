create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  cube_state jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  document_review_turns_left integer not null default 0,
  typed_intro_turns_left integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.designs enable row level security;

create policy "Users can view their own designs"
  on public.designs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own designs"
  on public.designs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own designs"
  on public.designs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own designs"
  on public.designs for delete
  using (auth.uid() = user_id);
