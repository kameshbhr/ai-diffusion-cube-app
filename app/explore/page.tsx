'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Cube3D, { CubeState, FaceState } from '@/components/Cube3D';
import ChatPanel, { Message } from '@/components/ChatPanel';

interface Pathway {
  slug: string;
  name: string;
  sector: string;
  geography: string;
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

function stripCubeUpdate(text: string): string {
  return text.replace(/<cube_update>[\s\S]*?<\/cube_update>/g, '').trim();
}

// Parse pathways from index.md lines: - [Name](pathways/slug.md) — Sector — Geography
function parsePathways(indexMd: string): Pathway[] {
  const results: Pathway[] = [];
  const re = /\[([^\]]+)\]\(pathways\/([^)]+)\.md\)(?:[^\n]*?—\s*([^—\n]+))?(?:[^\n]*?—\s*([^\n]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexMd)) !== null) {
    results.push({
      name: m[1].trim(),
      slug: m[2].trim(),
      sector: m[3]?.trim() ?? '',
      geography: m[4]?.trim() ?? '',
    });
  }
  return results;
}

export default function ExplorePage() {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [selected, setSelected] = useState<Pathway | null>(null);
  const [cubeState, setCubeState] = useState<CubeState>(DARK_CUBE);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const isInit = useRef(false);
  const cubeStateRef = useRef<CubeState>(DARK_CUBE);

  // Load pathway list from index
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
    fetch(`${base}/wiki/index.md`)
      .then((r) => r.text())
      .then((md) => setPathways(parsePathways(md)))
      .catch(() => {});
  }, []);

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
    setCubeState(DARK_CUBE);
    cubeStateRef.current = DARK_CUBE;
    setMessages([]);
    messagesRef.current = [];
    isInit.current = true;

    const initPrompt = `Analyse the deployment "${pathway.name}" across all six dimensions (A–F) using only the wiki content provided. Set a status for each (green/amber/red/dark) and write a phrase of 5 words or fewer naming the key gap or strength. Your entire response must be a single <cube_update> block with no other text before or after it.`;
    await sendMessage(initPrompt, [], pathway.slug, true, true);
    isInit.current = false;

    // After cube loads, show deployment summary in chat
    const summaryPrompt = `Provide a deployment summary for "${pathway.name}".`;
    await sendMessage(summaryPrompt, messagesRef.current, pathway.slug, false, false);
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
      <aside className="w-[40%] border-r border-[#7A5C44]/20 flex flex-col">
        <div className="p-4 border-b border-[#7A5C44]/20 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">AI Diffusion Cube</h1>
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
              {(p.sector || p.geography) && (
                <div className={`text-xs mt-1 ${selected?.slug === p.slug ? 'text-[#C4A882]' : 'text-[#7A5C44]'}`}>
                  {[p.sector, p.geography].filter(Boolean).join(' · ')}
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
            {/* Cube */}
            <div className="h-[50%] border-b border-[#7A5C44]/20 flex flex-col">
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[#2C1A0E]">{selected.name}</span>
                  {loading && isInit.current && (
                    <span className="text-xs text-[#E8A838] animate-pulse">Analysing deployment…</span>
                  )}
                </div>
                <CubeLegend />
              </div>
              <div className="flex-1">
                <Cube3D cubeState={cubeState} onFaceClick={handleFaceClick} />
              </div>
            </div>
            {/* Chat */}
            <div className="h-[50%]">
              <ChatPanel
                messages={messages}
                onSend={handleUserSend}
                loading={loading}
                placeholder="Ask about this deployment…"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
