-- Shared cache for the AI-generated pathway outputs (explore-init's per-dimension
-- scoring, explore-copy's card/summary text). Keyed by pathway slug with a hash
-- of the wiki content used to generate it, so a wiki update naturally invalidates
-- the cache instead of needing a manual bust. Shared across all users — this is
-- not per-user data, it's a cache of a deterministic-ish transformation of public
-- wiki content, so any authenticated user may read or refresh it.
create table if not exists public.pathway_cache (
  slug text primary key,
  content_hash text not null,
  cube_state jsonb,
  card text,
  summary text,
  updated_at timestamptz not null default now()
);

alter table public.pathway_cache enable row level security;

create policy "Authenticated users can read pathway cache"
  on public.pathway_cache for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert pathway cache"
  on public.pathway_cache for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update pathway cache"
  on public.pathway_cache for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
