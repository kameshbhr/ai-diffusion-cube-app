'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdoptionWorkspace from '@/components/AdoptionWorkspace';
import { AdoptionConversation } from '@/lib/adoption-conversation';
import { createClient } from '@/lib/supabase/client';
import { fetchAdoptionsList, setAdoptionsListCache } from '@/lib/adoptions-cache';

function formatRelativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// null = grid, 'new' = fresh contributor workspace, otherwise an existing
// adoption's id.
type Selection = string | 'new' | null;

function ContributeGridContent() {
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');

  const [adoptions, setAdoptions] = useState<AdoptionConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [appliedOpenId, setAppliedOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdoptionsList()
      .then((list) => {
        if (cancelled) return;
        setAdoptions(list);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Could not load your contributions.');
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The full list is shared (same cache as /adoptions) — this page only
  // shows the Contributor-flow slice of it.
  const contributions = adoptions.filter((a) => a.meta.flow === 'contributor');

  // Deep-links (e.g. /contribute?open=<id>). Adjusted during render (React's
  // documented pattern) — tracks the last-applied id so a different link
  // still switches, while "← All contributions" stays put.
  if (loaded && openId && openId !== appliedOpenId && contributions.some((a) => a.id === openId)) {
    setAppliedOpenId(openId);
    setSelection(openId);
  }

  async function deleteContribution(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('Delete this contribution? This cannot be undone.')) return;

    const supabase = createClient();
    const { error } = await supabase.from('designs').delete().eq('id', id);
    if (error) {
      setLoadError('Could not delete that contribution. Try again.');
      return;
    }
    setAdoptions((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setAdoptionsListCache(next);
      return next;
    });
  }

  if (selection === 'new') {
    return (
      <AdoptionWorkspace
        key="new"
        initial={null}
        fixedFlow="contributor"
        onCreated={(c) =>
          setAdoptions((prev) => {
            const next = [c, ...prev];
            setAdoptionsListCache(next);
            return next;
          })
        }
        onChange={(c) =>
          setAdoptions((prev) => {
            const next = prev.map((a) => (a.id === c.id ? c : a));
            setAdoptionsListCache(next);
            return next;
          })
        }
      />
    );
  }

  if (selection) {
    const existing = contributions.find((a) => a.id === selection) ?? null;
    return (
      <AdoptionWorkspace
        key={selection}
        initial={existing}
        onChange={(c) =>
          setAdoptions((prev) => {
            const next = prev.map((a) => (a.id === c.id ? c : a));
            setAdoptionsListCache(next);
            return next;
          })
        }
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-paper p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-navy">Your contributions</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every deployment write-up you&apos;ve turned into a pathway draft, and where each one stands.
          </p>
        </div>
        <button
          onClick={() => setSelection('new')}
          className="flex-shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-coral"
        >
          + New Contribution
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : contributions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-ink-soft">Start a new contribution from the button above to see it here.</p>
          {loadError && <p className="text-xs text-coral">{loadError}</p>}
        </div>
      ) : (
        <>
          {loadError && <p className="mb-4 text-xs text-coral">{loadError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {contributions.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelection(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelection(a.id);
                  }
                }}
                className="group relative flex cursor-pointer flex-col gap-2 rounded-2xl border border-navy/10 bg-white p-5 text-left transition hover:border-coral/50 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={(e) => deleteContribution(e, a.id)}
                  aria-label="Delete contribution"
                  className="absolute top-3 right-3 text-ink-soft/50 opacity-0 transition hover:text-coral group-hover:opacity-100"
                >
                  🗑
                </button>
                <div className="pr-5 font-display font-medium text-navy">{a.meta.name || 'New contribution'}</div>
                {(a.meta.sector || a.meta.geography) && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                    {[a.meta.sector, a.meta.geography].filter(Boolean).join(' · ')}
                  </div>
                )}
                {a.meta.summary && <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">{a.meta.summary}</p>}
                <div className="mt-auto pt-2 text-[10px] text-ink-soft/70">Updated {formatRelativeTime(a.updatedAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ContributeGrid() {
  return (
    <Suspense fallback={null}>
      <ContributeGridContent />
    </Suspense>
  );
}
