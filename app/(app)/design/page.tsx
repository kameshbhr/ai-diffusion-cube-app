'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DesignDetailView from '@/components/DesignDetailView';
import { DesignConversation, rowToConversation } from '@/lib/design-conversation';
import { createClient } from '@/lib/supabase/client';

function formatRelativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// 'draft' means "creating a new one" — not a real id yet, since creation is
// deferred until the user actually sends a first message or attachment.
type Selection = string | 'draft' | null;

function DesignPageContent() {
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');

  const [designs, setDesigns] = useState<DesignConversation[]>([]);
  const [designsLoaded, setDesignsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [appliedOpenId, setAppliedOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .order('updated_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        setLoadError('Could not load your saved deployments.');
        setDesignsLoaded(true);
        return;
      }

      setDesigns((data as Parameters<typeof rowToConversation>[0][]).map(rowToConversation));
      setDesignsLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-links from the sidebar's "Deployments" list (/design?open=<id>).
  // Adjusted during render (React's documented pattern for this) rather than
  // in an effect. Tracks the last-applied id (not just "has this ever run")
  // so clicking a *different* deployment link while one is already open still
  // switches — a plain one-shot guard would ignore every param change after
  // the first — while still leaving "← All deployments" alone since the URL
  // param doesn't change when that's clicked.
  if (designsLoaded && openId && openId !== appliedOpenId && designs.some((d) => d.id === openId)) {
    setAppliedOpenId(openId);
    setSelection(openId);
  }

  async function deleteDesign(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('Delete this deployment? This cannot be undone.')) return;

    const supabase = createClient();
    const { error } = await supabase.from('designs').delete().eq('id', id);
    if (error) {
      setLoadError('Could not delete that deployment. Try again.');
      return;
    }
    setDesigns((prev) => prev.filter((d) => d.id !== id));
  }

  if (selection) {
    const existing = selection === 'draft' ? null : designs.find((d) => d.id === selection) ?? null;
    return (
      <DesignDetailView
        key={selection}
        initial={existing}
        onBack={() => setSelection(null)}
        onCreated={(c) => setDesigns((prev) => [c, ...prev])}
        onChange={(c) => setDesigns((prev) => prev.map((d) => (d.id === c.id ? c : d)))}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5EFE6] text-[#2C1A0E] p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your deployments</h1>
          <p className="text-[#7A5C44] text-sm mt-1">
            Design a new AI deployment, guided by lived experiences from existing deployments.
          </p>
        </div>
        <button
          onClick={() => setSelection('draft')}
          className="flex-shrink-0 px-4 py-2 bg-[#2C1A0E] hover:bg-[#3a2414] text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Deployment
        </button>
      </div>

      {!designsLoaded ? (
        <p className="text-[#7A5C44] text-sm">Loading your deployments…</p>
      ) : designs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center py-16">
          <p className="text-[#7A5C44] text-sm">
            Click <strong className="text-[#2C1A0E]">+ New Deployment</strong> above to start designing your first deployment.
          </p>
          {loadError && <p className="text-[#D64045] text-xs">{loadError}</p>}
        </div>
      ) : (
        <>
          {loadError && <p className="text-[#D64045] text-xs mb-4">{loadError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {designs.map((d) => (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelection(d.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelection(d.id);
                  }
                }}
                className="relative text-left rounded-2xl border border-[#7A5C44]/20 bg-white hover:border-[#7A5C44]/50 hover:shadow-sm transition-all p-5 flex flex-col gap-2 group cursor-pointer"
              >
                <button
                  type="button"
                  onClick={(e) => deleteDesign(e, d.id)}
                  aria-label="Delete deployment"
                  className="absolute top-3 right-3 text-[#7A5C44]/50 hover:text-[#D64045] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  🗑
                </button>
                <div className="font-semibold text-[#2C1A0E] pr-5">{d.meta.name || 'New deployment'}</div>
                {(d.meta.sector || d.meta.geography) && (
                  <div className="text-xs text-[#7A5C44]">
                    {[d.meta.sector, d.meta.geography].filter(Boolean).join(' · ')}
                  </div>
                )}
                {d.meta.summary && (
                  <p className="text-sm text-[#7A5C44] leading-relaxed line-clamp-3">{d.meta.summary}</p>
                )}
                <div className="text-[10px] text-[#7A5C44]/70 mt-auto pt-2">Updated {formatRelativeTime(d.updatedAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <DesignPageContent />
    </Suspense>
  );
}
