import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface PathwayCacheRow {
  slug: string;
  content_hash: string;
  cube_state: Record<string, { status: string; phrase: string }> | null;
  card: string | null;
  summary: string | null;
}

// Shared across all users — keyed by pathway slug + a hash of the wiki
// content used to generate it, so a wiki edit naturally invalidates the
// cache instead of needing a manual bust. Any failure (including the table
// not existing yet) is treated as a cache miss rather than an error — the
// caller just falls back to calling Claude as if nothing were cached.
export async function getPathwayCache(slug: string, contentHash: string): Promise<PathwayCacheRow | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('pathway_cache')
      .select('*')
      .eq('slug', slug)
      .eq('content_hash', contentHash)
      .maybeSingle();
    if (error) {
      console.error('[pathway-cache] Failed to read cache:', error.message);
      return null;
    }
    return (data as PathwayCacheRow | null) ?? null;
  } catch (err) {
    console.error('[pathway-cache] Failed to read cache:', err);
    return null;
  }
}

// Only sets the columns passed in — Supabase's upsert (merge-duplicates)
// leaves any other cached columns for this slug untouched. These are
// fire-and-forget from the caller's side, so failures (including the table
// not existing yet, before the migration has been run) are swallowed here —
// worst case, caching just doesn't happen and the next request regenerates.
export async function upsertPathwayCubeState(
  slug: string,
  contentHash: string,
  cubeState: Record<string, { status: string; phrase: string }>
) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('pathway_cache')
      .upsert(
        { slug, content_hash: contentHash, cube_state: cubeState, updated_at: new Date().toISOString() },
        { onConflict: 'slug' }
      );
    if (error) console.error('[pathway-cache] Failed to write cube_state cache:', error.message);
  } catch (err) {
    console.error('[pathway-cache] Failed to write cube_state cache:', err);
  }
}

export async function upsertPathwayCopy(slug: string, contentHash: string, card: string, summary: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('pathway_cache')
      .upsert(
        { slug, content_hash: contentHash, card, summary, updated_at: new Date().toISOString() },
        { onConflict: 'slug' }
      );
    if (error) console.error('[pathway-cache] Failed to write copy cache:', error.message);
  } catch (err) {
    console.error('[pathway-cache] Failed to write copy cache:', err);
  }
}
