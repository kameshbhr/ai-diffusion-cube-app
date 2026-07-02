'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Cube3D, { CubeState, FaceState } from '@/components/Cube3D';
import ChatPanel, { Message } from '@/components/ChatPanel';
import CubeIcon from '@/components/CubeIcon';

interface Pathway {
  slug: string;
  name: string;
  description: string;
}

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

const LEGEND = [
  { color: '#3D8B37', label: 'Well documented' },
  { color: '#E8A838', label: 'Gaps remain' },
  { color: '#D64045', label: 'Critical gap' },
  { color: '#1A3A5C', label: 'Not documented' },
];

function CubeLegend() {
  return (
    <div className="flex flex-col gap-1">
      {LEGEND.map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
          <span className="text-[10px] text-[#7A5C44]">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

const DIMENSION_NAMES: Record<string, string> = {
  A: 'Problem Orientation',
  B: 'Architecture',
  C: 'Institution',
  D: 'Ecosystem',
  E: 'Workforce',
  F: 'Operating Model',
};

const DARK_CUBE: CubeState = Object.fromEntries(
  ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => [c, { status: 'dark', phrase: '' } as FaceState])
);

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

// Parse pathways from the index.md "## Pathways" table:
// | [Name](pathways/slug.md) | Summary text |
function parsePathways(indexMd: string): Pathway[] {
  const results: Pathway[] = [];
  const re = /\|\s*\[([^\]]+)\]\(pathways\/([^)]+)\.md\)\s*\|\s*([^|\n]+?)\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexMd)) !== null) {
    results.push({
      name: m[1].trim(),
      slug: m[2].trim(),
      description: m[3].trim(),
    });
  }
  return results;
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

export default function ExplorePage() {
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
    const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
    fetch(`${base}/wiki/index.md`)
      .then((r) => r.text())
      .then((md) => {
        const list = parsePathways(md);
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

    const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
    fetch(`${base}/wiki/pathways/${pathway.slug}.md`)
      .then((r) => r.text())
      .then((md) => setMeta(parsePathwayMeta(md)))
      .catch(() => {});

    const copyPromise = copyCache[pathway.slug]
      ? Promise.resolve<PathwayCopy | null>(copyCache[pathway.slug])
      : fetchPathwayCopy(pathway.slug);

    const initPrompt = `Analyse the deployment "${pathway.name}" across all six dimensions (A–F) using only the wiki content provided. Set a status for each (green/amber/red/dark) and write a phrase of 5 words or fewer naming the key gap or strength. Your entire response must be a single <cube_update> block with no other text before or after it.`;
    const [copy] = await Promise.all([copyPromise, sendMessage(initPrompt, [], pathway.slug, true, true)]);
    isInit.current = false;

    const oneLinerRaw = (copy?.card ?? pathway.description).trim();
    const oneLiner = /[.!?]$/.test(oneLinerRaw) ? oneLinerRaw : `${oneLinerRaw}.`;
    const greeting: Message = {
      role: 'assistant',
      content: `Hello! I'm the AI Diffusion Cube agent. I can help you explore **${pathway.name}** — ${oneLiner} What would you like to know?`,
    };
    setMessages([greeting]);
    messagesRef.current = [greeting];
  }

  function handleFaceClick(code: string) {
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

  return (
    <div className="flex h-screen bg-[#F5EFE6] text-[#2C1A0E] overflow-hidden">
      {/* Left panel — pathway list */}
      <aside className="w-[30%] border-r border-[#7A5C44]/20 flex flex-col">
        <div className="p-4 border-b border-[#7A5C44]/20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CubeIcon size={18} />
              <h1 className="text-lg font-semibold leading-none">AI Diffusion Cube</h1>
            </div>
            <p className="text-[#7A5C44] text-xs mt-1">Explore existing deployments</p>
          </div>
          <a href="/" className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] border border-[#7A5C44]/30 rounded-lg px-3 py-1.5 transition-colors">
            ← Back
          </a>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {pathways.length === 0 && (
            <p className="text-[#7A5C44] text-sm">Loading deployments…</p>
          )}
          {pathways.map((p) => (
            <button
              key={p.slug}
              onClick={() => selectPathway(p)}
              className={`w-full text-left rounded-xl p-4 border transition-colors ${
                selected?.slug === p.slug
                  ? 'bg-[#2C1A0E] text-white border-[#E8A838]'
                  : 'bg-white border-[#7A5C44]/20 hover:border-[#7A5C44]/50 text-[#2C1A0E]'
              }`}
            >
              <div className="font-medium text-sm">{p.name}</div>
              {(copyCache[p.slug]?.card ?? p.description) && (
                <div className={`text-xs mt-1 leading-relaxed ${selected?.slug === p.slug ? 'text-[#C4A882]' : 'text-[#7A5C44]'}`}>
                  {copyCache[p.slug]?.card ?? p.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Right panel — cube + chat */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[#7A5C44]">
            Select a deployment to begin
          </div>
        ) : (
          <>
            {/* Deployment info — full width */}
            <div className="h-[25%] border-b border-[#7A5C44]/20 overflow-y-auto p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-[#2C1A0E]">{selected.name}</h2>
                {loading && isInit.current && (
                  <span className="text-xs text-[#E8A838] animate-pulse">Analysing deployment…</span>
                )}
              </div>
              <p className="text-xs text-[#7A5C44] mt-1">
                {[meta.sector, meta.geography, meta.status].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm text-[#2C1A0E] mt-2 leading-relaxed whitespace-pre-line">
                {copyCache[selected.slug]?.summary || meta.summary || 'Loading summary…'}
              </p>
            </div>
            {/* Chat + cube */}
            <div className="h-[75%] flex overflow-hidden">
              <div className="flex-1 min-w-0">
                <ChatPanel
                  messages={messages}
                  onSend={handleUserSend}
                  loading={loading}
                  placeholder="Ask about this deployment…"
                />
              </div>
              <div className="w-[190px] flex-shrink-0 border-l border-[#7A5C44]/20 flex flex-col items-center justify-center gap-3 p-3">
                <div style={{ width: 160, height: 160 }}>
                  <Cube3D cubeState={cubeState} onFaceClick={handleFaceClick} size={120} />
                </div>
                <CubeLegend />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
