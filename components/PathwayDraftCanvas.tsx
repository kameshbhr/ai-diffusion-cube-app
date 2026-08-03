'use client';

import { useState } from 'react';
import Link from 'next/link';
import { diffLines } from 'diff';
import WikiMarkdown from '@/components/WikiMarkdown';
import type { PathwaySubmissionVersionRow } from '@/lib/pathway-submission-versions';

interface Props {
  markdown: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRevise: (instruction: string) => void;
  onPush: (commitMessage: string) => Promise<{ ok: boolean; slug?: string; error?: string }>;
  versions: PathwaySubmissionVersionRow[];
  selectedVersionNumber?: number;
  onSelectVersion: (versionNumber: number) => void;
  // What to diff the current draft against — the currently-published
  // content if this has been pushed before, otherwise the previous version.
  diffAgainst: string;
}

function DiffView({ before, after }: { before: string; after: string }) {
  if (!before) {
    return <p className="text-sm text-ink-soft">Nothing to compare against yet — this would be the first push.</p>;
  }
  const parts = diffLines(before, after);
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? 'block bg-green-100 text-green-900'
              : part.removed
                ? 'block bg-coral-soft text-coral line-through'
                : 'block text-ink-soft'
          }
        >
          {part.value}
        </span>
      ))}
    </pre>
  );
}

// A persistent side panel next to the chat (ChatGPT-canvas style) rather
// than a blocking modal — the conversation stays visible and usable while
// the draft is open, since "Ask for a change" is meant to feel like editing
// a shared document together, not a separate dialog you have to close first.
export default function PathwayDraftCanvas({
  markdown,
  loading,
  error,
  onClose,
  onRevise,
  onPush,
  versions,
  selectedVersionNumber,
  onSelectVersion,
  diffAgainst,
}: Props) {
  const [view, setView] = useState<'preview' | 'diff'>('preview');
  const [revision, setRevision] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushedSlug, setPushedSlug] = useState<string | null>(null);

  function handleRevise() {
    if (!revision.trim() || loading) return;
    onRevise(revision.trim());
    setRevision('');
  }

  async function handlePush() {
    setPushing(true);
    setPushError(null);
    try {
      const result = await onPush(commitMessage.trim() || 'Update pathway page');
      if (!result.ok) {
        setPushError(result.error || 'Could not push to the wiki. Try again.');
        return;
      }
      setPushedSlug(result.slug ?? null);
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-paper text-ink">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-navy/10 p-3">
        <div>
          <h2 className="font-display text-sm font-medium text-navy">Pathway Draft</h2>
          <p className="text-xs text-ink-soft">Remapped into the four-dimension pathway format for the wiki.</p>
        </div>
        <div className="flex items-center gap-2">
          {!pushedSlug && markdown && (
            <>
              <button
                onClick={() => setView('preview')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  view === 'preview' ? 'bg-navy text-white' : 'border border-navy/20 text-navy hover:border-coral hover:text-coral'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setView('diff')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  view === 'diff' ? 'bg-navy text-white' : 'border border-navy/20 text-navy hover:border-coral hover:text-coral'
                }`}
              >
                Diff
              </button>
              {versions.length > 0 && (
                <select
                  value={selectedVersionNumber}
                  onChange={(e) => onSelectVersion(Number(e.target.value))}
                  className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs text-ink"
                  aria-label="Select version"
                >
                  {versions.map((v) => (
                    <option key={v.version_number} value={v.version_number}>
                      v{v.version_number} — {new Date(v.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button onClick={onClose} aria-label="Close canvas" className="px-1 text-lg leading-none text-ink-soft transition hover:text-navy">
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <p className="text-sm text-coral">{error}</p>}

        {!error && pushedSlug && (
          <div className="rounded-xl border border-navy/10 bg-white p-4 text-sm">
            <p className="text-ink">Pushed to the wiki.</p>
            <Link href={`/wiki/${pushedSlug}`} className="mt-1 inline-block text-coral hover:underline">
              View it live →
            </Link>
          </div>
        )}

        {!error && !pushedSlug && !markdown && loading && (
          <p className="animate-pulse text-sm text-ink-soft">Drafting your pathway page…</p>
        )}

        {!error && !pushedSlug && markdown && view === 'preview' && <WikiMarkdown markdown={markdown} />}
        {!error && !pushedSlug && markdown && view === 'diff' && <DiffView before={diffAgainst} after={markdown} />}
      </div>

      {!error && !pushedSlug && markdown && (
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-navy/10 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              placeholder='Ask for a change — e.g. "add more detail on the data ownership decision"'
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-ink placeholder-ink-soft/70 focus:border-coral focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={handleRevise}
              disabled={loading || !revision.trim()}
              className="flex-shrink-0 rounded-lg border border-navy/20 px-3 py-2 text-xs font-medium text-navy transition hover:border-coral hover:text-coral disabled:opacity-40"
            >
              {loading ? 'Revising…' : 'Ask for a change'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {pushError && <p className="mr-auto text-xs text-coral">{pushError}</p>}
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder='Commit message (e.g. "Add data-ownership detail")'
              className="flex-1 rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs text-ink placeholder-ink-soft/70 focus:border-coral focus:outline-none"
            />
            <button
              onClick={handlePush}
              disabled={pushing || loading}
              className="flex-shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-coral disabled:opacity-40"
            >
              {pushing ? 'Pushing…' : 'Push to Wiki'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
