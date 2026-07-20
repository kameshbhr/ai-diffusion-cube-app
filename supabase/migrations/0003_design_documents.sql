-- Versioned, cached storage for generated design documents (the Analysis Doc
-- and the Plan Document). Append-only: every generation that reflects new
-- conversation content inserts a new version rather than overwriting, so past
-- versions stay retrievable. Regenerating with unchanged conversation content
-- (same content_hash) is a cache hit — the app should serve the existing row
-- instead of calling the model again.
create table if not exists public.design_documents (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc_type text not null check (doc_type in ('analysis', 'plan')),
  version_number integer not null,
  content_hash text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists design_documents_design_doc_type_idx
  on public.design_documents (design_id, doc_type, version_number desc);

alter table public.design_documents enable row level security;

create policy "Users can view their own design documents"
  on public.design_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own design documents"
  on public.design_documents for insert
  with check (auth.uid() = user_id);
