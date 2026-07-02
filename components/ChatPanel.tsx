'use client';

import { useEffect, useRef, useState } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Shown in the chat bubble instead of `content` — used for uploads, where
  // `content` carries the full extracted document text sent to the agent.
  displayContent?: string;
}

export interface UploadStatus {
  state: 'reading' | 'error';
  fileName?: string;
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
  onUploadFile?: (file: File) => void;
  uploadStatus?: UploadStatus | null;
  loading: boolean;
  placeholder?: string;
}

export default function ChatPanel({ messages, onSend, onUploadFile, uploadStatus, loading, placeholder }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUploadFile?.(file);
  }

  const uploadDisabled = loading || uploadStatus?.state === 'reading';

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
        {onUploadFile && (
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDisabled}
              className="flex items-center gap-1 text-xs text-[#7A5C44] hover:text-[#2C1A0E] disabled:opacity-40 transition-colors"
            >
              📎 Upload document
            </button>
            {uploadStatus?.state === 'reading' && (
              <span className="text-xs text-[#7A5C44] animate-pulse">Reading {uploadStatus.fileName}…</span>
            )}
            {uploadStatus?.state === 'error' && (
              <span className="text-xs text-red-600">{uploadStatus.error}</span>
            )}
          </div>
        )}
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
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
        </div>
      </div>
    </div>
  );
}
