-- Shared cache for wiki pages fetched from GitHub (index, framework doc,
-- pathway pages). Keyed by relative path. This replaces the old in-memory
-- Map in lib/wiki-loader.ts, which only lived on a single serverless
-- instance — under real concurrent traffic, many parallel instances would
-- each cold-fetch the same content from GitHub independently, wasting
-- requests and risking GitHub's rate limit on raw content. Shared across all
-- users — this is public wiki content, not per-user data.
create table if not exists public.wiki_cache (
  path text primary key,
  content text not null,
  fetched_at timestamptz not null default now()
);

alter table public.wiki_cache enable row level security;

create policy "Authenticated users can read wiki cache"
  on public.wiki_cache for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert wiki cache"
  on public.wiki_cache for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update wiki cache"
  on public.wiki_cache for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
