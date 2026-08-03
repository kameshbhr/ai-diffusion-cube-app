import { createClient } from '@/lib/supabase/client';

export interface PathwaySubmissionRow {
  id: string;
  design_id: string;
  user_id: string;
  content: string;
  status: 'pending_review' | 'reviewed' | 'published';
  created_at: string;
  reviewed_at: string | null;
}

export interface PathwaySubmissionVersionRow {
  id: string;
  submission_id: string;
  version_number: number;
  content: string;
  commit_message: string;
  created_at: string;
}

// One draft per adoption (design_id is unique on pathway_submissions — see
// migration 0013). Creates the row on first draft, otherwise just updates
// its denormalized `content` pointer to the latest version.
export async function upsertPathwaySubmission(
  designId: string,
  content: string
): Promise<PathwaySubmissionRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pathway_submissions')
    .upsert({ design_id: designId, content }, { onConflict: 'design_id' })
    .select()
    .single();

  if (error) {
    console.error('[pathway-submission-versions] Failed to upsert submission:', error.message);
    return null;
  }
  return data as PathwaySubmissionRow;
}

export async function getPathwaySubmissionByDesign(designId: string): Promise<PathwaySubmissionRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('pathway_submissions').select('*').eq('design_id', designId).maybeSingle();

  if (error) {
    console.error('[pathway-submission-versions] Failed to read submission:', error.message);
    return null;
  }
  return data as PathwaySubmissionRow | null;
}

export async function listPathwaySubmissionVersions(submissionId: string): Promise<PathwaySubmissionVersionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pathway_submission_versions')
    .select('*')
    .eq('submission_id', submissionId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[pathway-submission-versions] Failed to list versions:', error.message);
    return [];
  }
  return (data as PathwaySubmissionVersionRow[]) ?? [];
}

// Inserts the next version (latest version_number + 1, or 1 if none exist).
export async function insertPathwaySubmissionVersion(
  submissionId: string,
  content: string,
  commitMessage: string,
  previousVersionNumber: number
): Promise<PathwaySubmissionVersionRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pathway_submission_versions')
    .insert({
      submission_id: submissionId,
      version_number: previousVersionNumber + 1,
      content,
      commit_message: commitMessage,
    })
    .select()
    .single();

  if (error) {
    console.error('[pathway-submission-versions] Failed to insert new version:', error.message);
    return null;
  }
  return data as PathwaySubmissionVersionRow;
}

export function formatVersionLabel(versionNumber: number): string {
  return `v${versionNumber}`;
}

// The diff view compares the draft against whatever's currently live (if
// this submission has ever been pushed) — readable via the public
// `published_pathways` select policy, no special access needed.
export async function getPublishedContentBySubmission(submissionId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('published_pathways')
    .select('content')
    .eq('source_submission_id', submissionId)
    .maybeSingle();
  return data?.content ?? null;
}
