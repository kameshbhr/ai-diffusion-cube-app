'use client';

import { useCallback, useState } from 'react';
import Cube3D, { CubeState, FaceState } from '@/components/Cube3D';
import ChatPanel, { Message } from '@/components/ChatPanel';
import DimensionPanel from '@/components/DimensionPanel';

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

function parseCubeUpdate(text: string): Partial<CubeState> | null {
  const match = text.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function stripCubeUpdate(text: string): string {
  return text.replace(/<cube_update>[\s\S]*?<\/cube_update>/g, '').trim();
}

export default function DesignPage() {
  const [cubeState, setCubeState] = useState<CubeState>(DARK_CUBE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFace, setActiveFace] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string, history: Message[]) => {
    const next: Message[] = [...history, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next, mode: 'design' }),
    });

    if (!res.body) { setLoading(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });

      const update = parseCubeUpdate(assistantText);
      if (update) {
        setCubeState((prev) => {
          const next = { ...prev };
          for (const [code, face] of Object.entries(update)) {
            if (face) next[code] = face as FaceState;
          }
          return next;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: stripCubeUpdate(assistantText),
        };
        return updated;
      });
    }

    setLoading(false);
  }, []);

  function handleUserSend(text: string) {
    sendMessage(text, messages);
  }

  function handleFaceClick(code: string) {
    setActiveFace((prev) => (prev === code ? null : code));
  }

  return (
    <div className="flex h-screen bg-[#F5EFE6] text-[#2C1A0E] overflow-hidden flex-col sm:flex-row">
      {/* Left panel — chat */}
      <div className="w-full sm:w-[40%] border-b sm:border-b-0 sm:border-r border-[#7A5C44]/20 flex flex-col h-[50vh] sm:h-full">
        <div className="p-4 border-b border-[#7A5C44]/20 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">AI Diffusion Cube</h1>
            <p className="text-[#7A5C44] text-xs mt-1">Design your deployment</p>
          </div>
          <a href="/" className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] border border-[#7A5C44]/30 rounded-lg px-3 py-1.5 transition-colors">
            ← Back
          </a>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={
              messages.length === 0
                ? [
                    {
                      role: 'assistant',
                      content:
                        "Hi! I'm here to help you design your AI deployment. Let's start with the basics — what problem are you trying to solve with AI, and who are the intended beneficiaries?",
                    },
                  ]
                : messages
            }
            onSend={handleUserSend}
            loading={loading}
            placeholder="Describe your deployment context…"
          />
        </div>
      </div>

      {/* Right panel — cube + dimension detail */}
      <div className="flex-1 flex flex-col overflow-hidden h-[50vh] sm:h-full">
        <div className="flex justify-end px-4 pt-4">
          <CubeLegend />
        </div>
        <div className="flex-1 min-h-0">
          <Cube3D cubeState={cubeState} onFaceClick={handleFaceClick} />
        </div>

        {activeFace && (
          <div className="px-4 pb-4 overflow-y-auto max-h-64">
            <DimensionPanel
              code={activeFace}
              face={cubeState[activeFace]}
              onClose={() => setActiveFace(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
