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

// A file the user has attached but not sent yet — staged in the compose bar
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
  onAttachFiles?: (files: File[]) => void;
  pendingAttachments?: PendingAttachment[];
  onRemoveAttachment?: (id: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  onAttachFiles,
  pendingAttachments = [],
  onRemoveAttachment,
  loading,
  placeholder,
}: Props) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) onAttachFiles?.(files);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (!onAttachFiles) return;
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    if (!onAttachFiles) return;
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!onAttachFiles) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onAttachFiles(files);
  }

  return (
    <div
      className="relative flex flex-col h-full bg-[#F5EFE6]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && onAttachFiles && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F5EFE6]/90 border-4 border-dashed border-[#E8A838] pointer-events-none">
          <p className="text-[#7A5C44] text-sm font-medium">Drop files to attach</p>
        </div>
      )}
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
        {pendingAttachments.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {pendingAttachments.map((a) => (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-2 text-xs rounded-lg px-2.5 py-1.5 border ${
                  a.state === 'error'
                    ? 'border-red-300 text-red-600 bg-red-50'
                    : 'border-[#7A5C44]/30 text-[#7A5C44] bg-white'
                }`}
              >
                <span className="truncate">
                  {a.state === 'reading' ? '⏳' : a.state === 'error' ? '⚠️' : '📎'} {a.name}
                  {a.state === 'error' && a.error ? ` — ${a.error}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment?.(a.id)}
                  disabled={a.state === 'reading'}
                  className="flex-shrink-0 text-[#7A5C44] hover:text-[#2C1A0E] disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {onAttachFiles && (
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors"
            >
              📎 Attach files, or drag and drop
            </button>
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
