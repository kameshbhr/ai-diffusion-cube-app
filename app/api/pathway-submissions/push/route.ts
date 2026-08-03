import { readdir } from 'fs/promises';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasRole, isAdmin } from '@/lib/roles';

// Lets a pathway_contributor push their OWN reviewed draft straight to the
// public wiki — no separate admin approval step. Admins can still see and
// curate everything via /admin's Pathway Submissions panel; this is the
// self-serve path for the role that's meant to have it (see
// app/api/admin/pathway-submissions/publish/route.ts for the admin path,
// which stays in place for oversight/moderation).

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pathway'
  );
}

async function existingSlugs(admin: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const staticDir = path.join(process.cwd(), 'content', 'wiki', 'pathways');
  const staticFiles = await readdir(staticDir).catch(() => [] as string[]);
  const staticSlugs = staticFiles.filter((f) => f.endsWith('.md') && f !== 'index.md').map((f) => f.replace(/\.md$/, ''));

  const { data } = await admin.from('published_pathways').select('slug');
  const publishedSlugs = (data ?? []).map((r) => r.slug);

  return new Set([...staticSlugs, ...publishedSlugs]);
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const isContributor = await hasRole(supabase, 'pathway_contributor');
  const isCallerAdmin = await isAdmin(supabase, user.email);
  if (!isContributor && !isCallerAdmin) {
    return Response.json({ error: 'Pushing to the wiki requires the Contributor role.' }, { status: 403 });
  }

  const { submission_id, commit_message } = await req.json();
  if (typeof submission_id !== 'string') {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: submission, error: fetchError } = await admin
    .from('pathway_submissions')
    .select('id, content, design_id, user_id, designs(meta)')
    .eq('id', submission_id)
    .single();

  if (fetchError || !submission) {
    return Response.json({ error: 'Submission not found.' }, { status: 404 });
  }

  if (!isCallerAdmin && submission.user_id !== user.id) {
    return Response.json({ error: 'You can only push your own submissions.' }, { status: 403 });
  }

  const design = submission.designs as unknown as { meta?: { name?: string; summary?: string } } | { meta?: { name?: string; summary?: string } }[] | null;
  const meta = Array.isArray(design) ? design[0]?.meta : design?.meta;
  const title = meta?.name || 'Untitled Adoption';
  const description = meta?.summary || '';
  const commitMessage = typeof commit_message === 'string' ? commit_message : '';

  // Re-pushing an already-published submission updates the same row (and
  // keeps the same slug/URL) rather than creating a duplicate entry.
  const { data: existingPublished } = await admin
    .from('published_pathways')
    .select('slug')
    .eq('source_submission_id', submission_id)
    .maybeSingle();

  let slug = existingPublished?.slug;

  if (slug) {
    const { error: updateError } = await admin
      .from('published_pathways')
      .update({ title, description, content: submission.content, commit_message: commitMessage })
      .eq('slug', slug);
    if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  } else {
    const taken = await existingSlugs(admin);
    slug = uniqueSlug(slugify(title), taken);

    const { error: insertError } = await admin.from('published_pathways').insert({
      slug,
      title,
      description,
      content: submission.content,
      commit_message: commitMessage,
      source_submission_id: submission.id,
      published_by: user.id,
    });
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
  }

  await admin
    .from('pathway_submissions')
    .update({ status: 'published', reviewed_at: new Date().toISOString() })
    .eq('id', submission_id);

  return Response.json({ ok: true, slug });
}
