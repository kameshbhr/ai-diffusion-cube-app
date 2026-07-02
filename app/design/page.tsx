'use client';

import { useCallback, useRef, useState } from 'react';
import Cube3D, { CubeState, FaceState } from '@/components/Cube3D';
import ChatPanel, { Message, UploadStatus } from '@/components/ChatPanel';
import DimensionPanel from '@/components/DimensionPanel';
import CubeIcon from '@/components/CubeIcon';
import { extractTextFromFile, getFileExtension } from '@/lib/extract-text';

interface DesignMeta {
  name: string;
  sector: string;
  geography: string;
  status: string;
  summary: string;
}

interface Design {
  id: string;
  meta: DesignMeta;
  cubeState: CubeState;
  messages: Message[];
  // Counts down the follow-up turns (confirm/correct, then guidance-vs-needs)
  // that must still carry the document-review instruction after an upload.
  documentReviewTurnsLeft: number;
  // Counts down the one follow-up turn (guidance-vs-needs) that must still
  // carry the typed-intro instruction after the user's first typed message.
  typedIntroTurnsLeft: number;
}

const EMPTY_META: DesignMeta = { name: '', sector: '', geography: '', status: '', summary: '' };

const INITIAL_MESSAGE =
  "Hi! I'm here to help you design your AI deployment across six dimensions — from problem framing to operating model.\n\nYou can start in two ways:\n📄 Upload a document — a concept note, proposal, or anything describing what you're building. I'll read it and get us started.\n💬 Just tell me — describe what you're trying to do, the problem you're solving, and who it's for.";

const LEGEND = [
  { color: '#3D8B37', label: 'Well defined' },
  { color: '#E8A838', label: 'Gaps remain' },
  { color: '#D64045', label: 'Critical gap' },
  { color: '#1A3A5C', label: 'Not yet discussed' },
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

const DARK_CUBE: CubeState = Object.fromEntries(
  ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => [c, { status: 'dark', phrase: '' } as FaceState])
);

interface ParsedCubeUpdate {
  cube: Record<string, FaceState>;
  meta?: Partial<DesignMeta>;
}

function parseCubeUpdate(text: string): ParsedCubeUpdate | null {
  const match = text.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const { meta, ...cube } = parsed;
    return { cube, meta };
  } catch {
    return null;
  }
}

// Cuts at the opening tag rather than matching a closed block, so a
// <cube_update> that has only partially streamed in never renders.
function stripCubeUpdate(text: string): string {
  const idx = text.indexOf('<cube_update');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}

export default function DesignPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFace, setActiveFace] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});
  const nextId = useRef(1);

  const selected = designs.find((d) => d.id === selectedId) ?? null;

  const updateDesign = useCallback((id: string, updater: (d: Design) => Design) => {
    setDesigns((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));
  }, []);

  function createNew() {
    const id = `design-${nextId.current++}`;
    const newDesign: Design = {
      id,
      meta: EMPTY_META,
      cubeState: DARK_CUBE,
      messages: [{ role: 'assistant', content: INITIAL_MESSAGE }],
      documentReviewTurnsLeft: 0,
      typedIntroTurnsLeft: 0,
    };
    setDesigns((prev) => [...prev, newDesign]);
    setSelectedId(id);
    setActiveFace(null);
  }

  function selectDesign(id: string) {
    setSelectedId(id);
    setActiveFace(null);
  }

  const sendMessage = useCallback(
    async (id: string, history: Message[], userMessage: Message, opts?: { documentUpload?: boolean; typedIntro?: boolean }) => {
      const next: Message[] = [...history, userMessage];
      updateDesign(id, (d) => ({ ...d, messages: next }));
      setLoading(true);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          mode: 'design',
          documentUpload: opts?.documentUpload,
          typedIntro: opts?.typedIntro,
        }),
      });

      if (!res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      updateDesign(id, (d) => ({ ...d, messages: [...d.messages, { role: 'assistant', content: '' }] }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });

        const update = parseCubeUpdate(assistantText);
        if (update) {
          updateDesign(id, (d) => {
            const nextCube = { ...d.cubeState };
            for (const [code, face] of Object.entries(update.cube)) {
              if (face) nextCube[code] = face;
            }
            const m = update.meta;
            const nextMeta: DesignMeta = m
              ? {
                  name: m.name || d.meta.name,
                  sector: m.sector || d.meta.sector,
                  geography: m.geography || d.meta.geography,
                  status: m.status || d.meta.status,
                  summary: m.summary || d.meta.summary,
                }
              : d.meta;
            return { ...d, cubeState: nextCube, meta: nextMeta };
          });
        }

        updateDesign(id, (d) => {
          const msgs = [...d.messages];
          msgs[msgs.length - 1] = { role: 'assistant', content: stripCubeUpdate(assistantText) };
          return { ...d, messages: msgs };
        });
      }

      setLoading(false);
    },
    [updateDesign]
  );

  function handleUserSend(text: string) {
    if (!selected) return;
    const continuesDocReview = selected.documentReviewTurnsLeft > 0;
    const continuesTypedIntro = !continuesDocReview && selected.typedIntroTurnsLeft > 0;
    // The very first message of a design (right after the greeting) starts the
    // typed-intro sequence, unless a document upload already claimed that role.
    const startsTypedIntro = !continuesDocReview && !continuesTypedIntro && selected.messages.length === 1;

    if (continuesDocReview) {
      updateDesign(selected.id, (d) => ({ ...d, documentReviewTurnsLeft: d.documentReviewTurnsLeft - 1 }));
    } else if (continuesTypedIntro) {
      updateDesign(selected.id, (d) => ({ ...d, typedIntroTurnsLeft: d.typedIntroTurnsLeft - 1 }));
    } else if (startsTypedIntro) {
      updateDesign(selected.id, (d) => ({ ...d, typedIntroTurnsLeft: 1 }));
    }

    sendMessage(
      selected.id,
      selected.messages,
      { role: 'user', content: text },
      { documentUpload: continuesDocReview, typedIntro: continuesTypedIntro || startsTypedIntro }
    );
  }

  async function handleUploadFile(file: File) {
    if (!selected) return;
    const id = selected.id;

    if (!getFileExtension(file.name)) {
      setUploadStatus((s) => ({ ...s, [id]: { state: 'error', error: 'Unsupported file type — use .pdf, .txt, or .md.' } }));
      return;
    }

    setUploadStatus((s) => ({ ...s, [id]: { state: 'reading', fileName: file.name } }));

    let text: string;
    try {
      text = await extractTextFromFile(file);
    } catch {
      setUploadStatus((s) => ({ ...s, [id]: { state: 'error', error: `Could not read ${file.name}. Try a different file.` } }));
      return;
    }

    if (!text) {
      setUploadStatus((s) => ({ ...s, [id]: { state: 'error', error: 'No readable text found — it may be a scanned/image PDF.' } }));
      return;
    }

    setUploadStatus((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });

    // This upload consumes turn 1 (summary + confirm); 2 more turns
    // (reusable know-how, then gaps) still need the instruction.
    updateDesign(id, (d) => ({ ...d, documentReviewTurnsLeft: 2 }));

    sendMessage(
      id,
      selected.messages,
      { role: 'user', content: text, displayContent: `📄 Uploaded **${file.name}**` },
      { documentUpload: true }
    );
  }

  function handleFaceClick(code: string) {
    setActiveFace((prev) => (prev === code ? null : code));
  }

  return (
    <div className="flex h-screen bg-[#F5EFE6] text-[#2C1A0E] overflow-hidden">
      {/* Left panel — deployments in progress */}
      <aside className="w-[30%] border-r border-[#7A5C44]/20 flex flex-col">
        <div className="p-4 border-b border-[#7A5C44]/20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CubeIcon size={18} />
              <h1 className="text-lg font-semibold leading-none">AI Diffusion Cube</h1>
            </div>
            <p className="text-[#7A5C44] text-xs mt-1">Design your deployment</p>
          </div>
          <a href="/" className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] border border-[#7A5C44]/30 rounded-lg px-3 py-1.5 transition-colors">
            ← Back
          </a>
        </div>

        {designs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-[#7A5C44] text-sm">You haven&apos;t started designing a deployment yet.</p>
            <button
              onClick={createNew}
              className="px-6 py-3 bg-[#2C1A0E] hover:bg-[#3a2414] text-white rounded-xl text-sm font-medium transition-colors"
            >
              + Create New
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {designs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDesign(d.id)}
                  className={`w-full text-left rounded-xl p-4 border transition-colors ${
                    selectedId === d.id
                      ? 'bg-[#2C1A0E] text-white border-[#E8A838]'
                      : 'bg-white border-[#7A5C44]/20 hover:border-[#7A5C44]/50 text-[#2C1A0E]'
                  }`}
                >
                  <div className="font-medium text-sm">{d.meta.name || 'New deployment'}</div>
                  {(d.meta.sector || d.meta.geography) && (
                    <div className={`text-xs mt-1 ${selectedId === d.id ? 'text-[#C4A882]' : 'text-[#7A5C44]'}`}>
                      {[d.meta.sector, d.meta.geography].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[#7A5C44]/20">
              <button
                onClick={createNew}
                className="w-full px-4 py-2 border border-[#7A5C44]/30 hover:border-[#7A5C44]/60 text-[#2C1A0E] rounded-lg text-sm font-medium transition-colors"
              >
                + Create New
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Right panel — deployment info + chat + cube */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[#7A5C44]">
            Create a new deployment to begin
          </div>
        ) : (
          <>
            {/* Deployment info — full width */}
            <div className="h-[25%] border-b border-[#7A5C44]/20 overflow-y-auto p-4">
              <h2 className="text-lg font-bold text-[#2C1A0E]">{selected.meta.name || 'New deployment'}</h2>
              {[selected.meta.sector, selected.meta.geography, selected.meta.status].some(Boolean) && (
                <p className="text-xs text-[#7A5C44] mt-1">
                  {[selected.meta.sector, selected.meta.geography, selected.meta.status].filter(Boolean).join(' · ')}
                </p>
              )}
              {selected.meta.summary && (
                <p className="text-sm text-[#2C1A0E] mt-2 leading-relaxed whitespace-pre-line">
                  {selected.meta.summary}
                </p>
              )}
            </div>
            {/* Chat + cube */}
            <div className="h-[75%] flex overflow-hidden">
              <div className="flex-1 min-w-0">
                <ChatPanel
                  messages={selected.messages}
                  onSend={handleUserSend}
                  onUploadFile={handleUploadFile}
                  uploadStatus={uploadStatus[selected.id] ?? null}
                  loading={loading}
                  placeholder="Describe your deployment context…"
                />
              </div>
              <div className="w-[220px] flex-shrink-0 border-l border-[#7A5C44]/20 flex flex-col items-center gap-3 p-3 overflow-y-auto">
                <div style={{ width: 160, height: 160 }}>
                  <Cube3D cubeState={selected.cubeState} onFaceClick={handleFaceClick} size={120} />
                </div>
                <CubeLegend />
                {activeFace && (
                  <DimensionPanel
                    code={activeFace}
                    face={selected.cubeState[activeFace]}
                    onClose={() => setActiveFace(null)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
