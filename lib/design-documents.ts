import { createClient } from '@/lib/supabase/client';
import { CubeState } from '@/lib/dimensions';
import { Message } from '@/components/ChatPanel';

export type DocType = 'analysis' | 'plan';

export interface DesignDocumentRow {
  id: string;
  design_id: string;
  doc_type: DocType;
  version_number: number;
  content_hash: string;
  content: string;
  created_at: string;
}

// A lightweight, synchronous, non-cryptographic hash (djb2) — this is only a
// cache key for "has the conversation moved on since the last generation," not
// a security boundary, so a full SHA-256 (which would need the async Web
// Crypto API in the browser) is unnecessary overhead here.
function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Depth marker for a document version: changes whenever the conversation has
// moved on (new messages, or the cube state's understanding of any aspect has
// changed) — a regeneration with an unchanged hash is a cache hit.
export function hashConversationState(messages: Message[], cubeState: CubeState): string {
  return hashText(JSON.stringify({ messages, cubeState }));
}

// Latest version for this design + doc type, or null if none exists yet.
export async function getLatestDesignDocument(designId: string, docType: DocType): Promise<DesignDocumentRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('design_documents')
    .select('*')
    .eq('design_id', designId)
    .eq('doc_type', docType)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[design-documents] Failed to read latest version:', error.message);
    return null;
  }
  return data as DesignDocumentRow | null;
}

// Full version history, newest first — used for the version-history dropdown.
export async function listDesignDocumentVersions(designId: string, docType: DocType): Promise<DesignDocumentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('design_documents')
    .select('*')
    .eq('design_id', designId)
    .eq('doc_type', docType)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[design-documents] Failed to list versions:', error.message);
    return [];
  }
  return (data as DesignDocumentRow[]) ?? [];
}

// Inserts the next version (latest version_number + 1, or 1 if none exist).
export async function insertDesignDocumentVersion(
  designId: string,
  docType: DocType,
  contentHash: string,
  content: string,
  previousVersionNumber: number
): Promise<DesignDocumentRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('design_documents')
    .insert({
      design_id: designId,
      doc_type: docType,
      version_number: previousVersionNumber + 1,
      content_hash: contentHash,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('[design-documents] Failed to insert new version:', error.message);
    return null;
  }
  return data as DesignDocumentRow;
}

// "v0.1", "v0.2", ... — matches the versioning scheme requested (v0.N per
// generation), backed by a plain integer column rather than a float to avoid
// floating-point drift (0.1 + 0.2 !== 0.3 in JS).
export function formatVersionLabel(versionNumber: number): string {
  return `v0.${versionNumber}`;
}
