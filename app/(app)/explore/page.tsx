'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CubeState, FaceState, DARK_CUBE, DIMENSION_NAMES } from '@/lib/dimensions';
import ChatPanel, { Message } from '@/components/ChatPanel';
import DimensionList from '@/components/DimensionList';
import { Pathway, fetchPathways, fetchPathwayMarkdown } from '@/lib/pathways';

interface PathwayMeta {
  sector: string;
  geography: string;
  status: string;
  summary: string;
}

const EMPTY_META: PathwayMeta = { sector: '', geography: '', status: '', summary: '' };

interface PathwayCopy {
  card: string;
  summary: string;
}

function parsePathwayCopy(text: string): PathwayCopy | null {
  const match = text.match(/<pathway_copy>([\s\S]*?)<\/pathway_copy>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseCubeUpdate(text: string): Partial<CubeState> | null {
  const match = text.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// Cuts at the opening tag rather than matching a closed block, so a
// <cube_update> that has only partially streamed in never renders.
function stripCubeUpdate(text: string): string {
  const idx = text.indexOf('<cube_update');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}

// Parse a pathway page's metadata header and Summary section.
function parsePathwayMeta(md: string): PathwayMeta {
  const grab = (label: string) => {
    const m = md.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const summaryMatch = md.match(/##\s*Summary\s*\n+([\s\S]*?)(?:\n---|\n##\s)/);
  return {
    sector: grab('Sector'),
    geography: grab('Geography'),
    status: grab('Deployment status'),
    summary: summaryMatch ? summaryMatch[1].trim() : '',
  };
}

function ExplorePageContent() {
  const searchParams = useSearchParams();
  const pathwaySlugParam = searchParams.get('pathway');
  const appliedPathwaySlug = useRef<string | null>(null);

  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [selected, setSelected] = useState<Pathway | null>(null);
  const [meta, setMeta] = useState<PathwayMeta>(EMPTY_META);
  const [copyCache, setCopyCache] = useState<Record<string, PathwayCopy>>({});
  const [cubeState, setCubeState] = useState<CubeState>(DARK_CUBE);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const isInit = useRef(false);
  const cubeStateRef = useRef<CubeState>(DARK_CUBE);

  // Generates the outcome-first card blurb + panel summary for a pathway via
  // the model (see explorePathwayCopySystemPrompt) — keeps this working for
  // any pathway added to the wiki later, with no app changes required.
  const fetchPathwayCopy = useCallback(async (slug: string): Promise<PathwayCopy | null> => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Produce the card and summary copy for this deployment.' }],
          mode: 'explore-copy',
          pathwaySlug: slug,
        }),
      });
      const text = await res.text();
      const copy = parsePathwayCopy(text);
      if (copy) setCopyCache((prev) => ({ ...prev, [slug]: copy }));
      return copy;
    } catch {
      // ignore — falls back to the raw wiki description/summary
      return null;
    }
  }, []);

  // Load pathway list from index
  useEffect(() => {
    fetchPathways()
      .then((list) => {
        setPathways(list);
        list.forEach((p) => fetchPathwayCopy(p.slug));
      })
      .catch(() => {});
  }, [fetchPathwayCopy]);

  const sendMessage = useCallback(
    async (text: string, history: Message[], slug: string, hidden = false, updateCube = false) => {
      const apiMessages: Message[] = [...history, { role: 'user', content: text }];
      if (!hidden) { setMessages(apiMessages); messagesRef.current = apiMessages; }
      setLoading(true);

      const mode = updateCube ? 'explore-init' : 'explore';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          mode,
          pathwaySlug: slug,
          cubeState: updateCube ? undefined : cubeStateRef.current,
        }),
      });

      if (!res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      if (!hidden) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });

        if (updateCube) {
          const update = parseCubeUpdate(assistantText);
          if (update) {
            setCubeState((prev) => {
              const next = { ...prev };
              for (const [code, face] of Object.entries(update)) {
                if (face) next[code] = face as FaceState;
              }
              cubeStateRef.current = next;
              return next;
            });
          }
        }

        if (!hidden) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: stripCubeUpdate(assistantText),
            };
            messagesRef.current = updated;
            return updated;
          });
        }
      }

      setLoading(false);
    },
    []
  );

  async function selectPathway(pathway: Pathway) {
    setSelected(pathway);
    setMeta(EMPTY_META);
    setCubeState(DARK_CUBE);
    cubeStateRef.current = DARK_CUBE;
    setMessages([]);
    messagesRef.current = [];
    isInit.current = true;

    fetchPathwayMarkdown(pathway.slug)
      .then((md) => setMeta(parsePathwayMeta(md)))
      .catch(() => {});

    const copyPromise = copyCache[pathway.slug]
      ? Promise.resolve<PathwayCopy | null>(copyCache[pathway.slug])
      : fetchPathwayCopy(pathway.slug);

    const initPrompt = `Analyse the deployment "${pathway.name}" across all seven dimensions of the framework using only the wiki content provided. Set a status for each (green/amber/red/dark) and write a phrase of 5 words or fewer naming the key gap or strength. Your entire response must be a single <cube_update> block with no other text before or after it.`;
    const [copy] = await Promise.all([copyPromise, sendMessage(initPrompt, [], pathway.slug, true, true)]);
    isInit.current = false;

    const oneLinerRaw = (copy?.card ?? pathway.description).trim();
    const oneLiner = /[.!?]$/.test(oneLinerRaw) ? oneLinerRaw : `${oneLinerRaw}.`;
    const greeting: Message = {
      role: 'assistant',
      content: `Hi, I'm Jude. I can help you explore **${pathway.name}** — ${oneLiner} What would you like to know?`,
    };
    setMessages([greeting]);
    messagesRef.current = [greeting];
  }

  // Deep-links from elsewhere in the app (e.g. the home page's "already
  // implemented" blocks, or the sidebar's "Deployments" list): /explore?pathway=<slug>.
  // Tracks the last-applied slug (not just "has this ever run") so clicking a
  // *different* pathway link while one is already open still switches the
  // selection — a plain one-shot guard would ignore every param change after
  // the first.
  useEffect(() => {
    if (!pathwaySlugParam || pathwaySlugParam === appliedPathwaySlug.current || pathways.length === 0) return;
    const match = pathways.find((p) => p.slug === pathwaySlugParam);
    if (match) {
      appliedPathwaySlug.current = pathwaySlugParam;
      // Unlike a plain state derivation, this kicks off real network calls
      // (wiki fetches, the explore-init/copy API calls) — genuine effect work,
      // not something that could just be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      selectPathway(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathwaySlugParam, pathways]);

  function handleDimensionClick(code: string) {
    if (!selected) return;
    const dimName = DIMENSION_NAMES[code];
    sendMessage(
      `Give me a snapshot of the ${dimName} dimension for this deployment.`,
      messagesRef.current,
      selected.slug
    );
  }

  function handleUserSend(text: string) {
    if (!selected) return;
    sendMessage(text, messagesRef.current, selected.slug);
  }

  if (!selected) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F5EFE6] text-[#2C1A0E] p-4 sm:p-8">
        <h1 className="text-2xl font-bold">Deployments Library</h1>
        <p className="text-[#7A5C44] text-sm mt-1 mb-6">
          Lived experiences from existing AI deployments - pick one to see what worked, what didn&apos;t, and what&apos;s reusable.
        </p>
        {pathways.length === 0 ? (
          <p className="text-[#7A5C44] text-sm">Loading deployments…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pathways.map((p) => (
              <button
                key={p.slug}
                onClick={() => selectPathway(p)}
                className="text-left rounded-2xl border border-[#7A5C44]/20 bg-white hover:border-[#7A5C44]/50 hover:shadow-sm transition-all p-5 flex flex-col gap-2"
              >
                <div className="font-semibold text-[#2C1A0E]">{p.name}</div>
                <p className="text-sm text-[#7A5C44] leading-relaxed">
                  {copyCache[p.slug]?.card ?? <span className="italic text-[#7A5C44]/60">Loading description…</span>}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5EFE6] text-[#2C1A0E]">
      {/* Deployment info */}
      <div className="border-b border-[#7A5C44]/20 p-4">
        <button
          onClick={() => setSelected(null)}
          className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] mb-2 transition-colors"
        >
          ← All deployments
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[#2C1A0E]">{selected.name}</h2>
          {loading && isInit.current && (
            <span className="text-xs text-[#E8A838] animate-pulse">Analysing deployment…</span>
          )}
        </div>
        <p className="text-xs text-[#7A5C44] mt-1">
          {[meta.sector, meta.geography, meta.status].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm text-[#2C1A0E] mt-2 leading-relaxed whitespace-pre-line max-h-24 overflow-y-auto">
          {copyCache[selected.slug]?.summary || meta.summary || 'Loading summary…'}
        </p>
        <div className="mt-3">
          <DimensionList cubeState={cubeState} onSelect={handleDimensionClick} />
        </div>
      </div>
      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={handleUserSend}
          loading={loading}
          placeholder="Ask about this deployment…"
        />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExplorePageContent />
    </Suspense>
  );
}
