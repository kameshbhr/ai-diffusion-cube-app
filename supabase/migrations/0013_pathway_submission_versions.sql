-- Version history for a pathway submission's draft content, mirroring
-- design_documents' append-only versioning pattern. Every regeneration
-- (initial remap, or a conversational revision request) inserts a new
-- version rather than overwriting; pathway_submissions.content is kept as a
-- denormalized pointer to the latest version's content for convenience.
create table if not exists public.pathway_submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.pathway_submissions (id) on delete cascade,
  version_number integer not null,
  content text not null,
  commit_message text not null default '',
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

alter table public.pathway_submission_versions enable row level security;

create policy "Users can view versions of their own submissions"
  on public.pathway_submission_versions for select
  using (
    exists (
      select 1 from public.pathway_submissions ps
      where ps.id = submission_id and ps.user_id = auth.uid()
    )
  );

create policy "Users can insert versions of their own submissions"
  on public.pathway_submission_versions for insert
  with check (
    exists (
      select 1 from public.pathway_submissions ps
      where ps.id = submission_id and ps.user_id = auth.uid()
    )
  );

-- One draft per adoption — lets the app upsert on design_id instead of
-- tracking "does a submission already exist for this design" separately.
alter table public.pathway_submissions
  add constraint pathway_submissions_design_id_key unique (design_id);

-- A pathway_contributor can push their own submission straight to the wiki
-- (see app/api/pathway-submissions/push/route.ts) — this policy lets that
-- route use the caller's own session client rather than the service-role
-- client, same as any other owner-scoped update elsewhere in the app.
create policy "Users can update their own pathway submissions"
  on public.pathway_submissions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tracks which commit actually went live, for display alongside the
-- published page (and to distinguish "just drafted" from "actually pushed").
alter table public.published_pathways
  add column if not exists commit_message text not null default '';
