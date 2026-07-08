'use client';

import { useEffect, useRef, useState } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Shown in the chat bubble instead of `content` — used for uploads, where
  // `content` carries the full extracted document text sent to the agent.
  displayContent?: string;
  // Set when the message carries one or more uploaded images — `content` then
  // holds a short instruction (plus any text-attachment content) and this
  // carries the actual bytes sent to the model.
  images?: Array<{ mediaType: string; base64: string }>;
}

// A file the user has attached but not sent yet — staged (see AttachmentsPanel)
// until they press Enter, at which point it's folded into one user message.
export interface PendingAttachment {
  id: string;
  name: string;
  state: 'reading' | 'ready' | 'error';
  error?: string;
}

// Renders **bold** spans; everything else is shown as plain text.
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

interface Props {
  messages: Message[];
  onSend: (text: string) => void;
  // Only used to gate sending (block while an attachment is mid-read or
  // errored) — rendering the attachments themselves lives in AttachmentsPanel.
  pendingAttachments?: PendingAttachment[];
  loading: boolean;
  placeholder?: string;
}

export default function ChatPanel({ messages, onSend, pendingAttachments = [], loading, placeholder }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasBlockingAttachment = pendingAttachments.some((a) => a.state !== 'ready');
  const hasReadyAttachment = pendingAttachments.some((a) => a.state === 'ready');
  const canSend = !loading && !hasBlockingAttachment && (input.trim().length > 0 || hasReadyAttachment);

  function handleSend() {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    onSend(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F5EFE6]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#2C1A0E] text-white'
                  : 'bg-white text-[#2C1A0E] border border-[#7A5C44]/20'
              }`}
            >
              {renderInlineMarkdown(m.displayContent ?? m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-[#7A5C44] border border-[#7A5C44]/20 rounded-lg px-4 py-2 text-sm animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#7A5C44]/20 p-3">
        <div className="flex gap-2">
        <textarea
          className="flex-1 bg-white text-[#2C1A0E] border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#E8A838] placeholder-[#7A5C44]"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? 'Type a message…'}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
        </div>
      </div>
    </div>
  );
}
