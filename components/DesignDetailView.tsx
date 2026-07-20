'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ChatPanel from '@/components/ChatPanel';
import AttachmentsPanel from '@/components/AttachmentsPanel';
import DimensionList from '@/components/DimensionList';
import AdoptionPlanModal from '@/components/AdoptionPlanModal';
import { DesignConversation, extractUploadedFileNames, toApiMessages, useDesignConversation } from '@/lib/design-conversation';
import { Pathway, fetchPathways } from '@/lib/pathways';
import {
  DesignDocumentRow,
  DocType,
  formatVersionLabel,
  getLatestDesignDocument,
  hashConversationState,
  insertDesignDocumentVersion,
  listDesignDocumentVersions,
} from '@/lib/design-documents';

// Default height (px) matching the old rows={1} textarea, and the cap before it scrolls.
const WELCOME_TEXTAREA_MIN_HEIGHT = 36;
const WELCOME_TEXTAREA_MAX_HEIGHT = 200;

const DOC_LABELS: Record<DocType, { title: string; mode: string; loadingLabel: string; filenameSuffix: string }> = {
  analysis: {
    title: 'Analysis Doc',
    mode: 'design-adoption-plan',
    loadingLabel: 'Generating analysis doc…',
    filenameSuffix: 'analysis-doc',
  },
  plan: {
    title: 'Plan Document',
    mode: 'design-plan-document',
    loadingLabel: 'Generating plan document…',
    filenameSuffix: 'plan-document',
  },
};

interface Props {
  initial: DesignConversation | null;
  onCreated?: (c: DesignConversation) => void;
  onChange?: (c: DesignConversation) => void;
  onBack?: () => void;
}

export default function DesignDetailView({ initial, onCreated, onChange, onBack }: Props) {
  const {
    conversation,
    loading,
    pendingAttachments,
    handleUserSend,
    handleAttachFiles,
    removeAttachment,
    handleDimensionClick,
  } = useDesignConversation({ initial, onCreated, onChange });

  const [welcomeInput, setWelcomeInput] = useState('');
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [examplePathways, setExamplePathways] = useState<Pathway[]>([]);
  const [activeDocType, setActiveDocType] = useState<DocType | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docMarkdown, setDocMarkdown] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [docVersionNumber, setDocVersionNumber] = useState<number | null>(null);
  const [docVersionRows, setDocVersionRows] = useState<DesignDocumentRow[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Handles both "Generate Analysis Doc" and "Generate Plan Document" — same
  // shape, different system prompt/mode. Checks for a cached version matching
  // the conversation's current state first (same hash = nothing's changed
  // since the last generation), and only calls the model on a cache miss,
  // then stores the result as the next version (v0.1, v0.2, ...).
  async function handleGenerateDocument(docType: DocType) {
    if (!conversation) return;
    const { title, mode } = DOC_LABELS[docType];

    setActiveDocType(docType);
    setDocLoading(true);
    setDocError(null);
    setDocMarkdown('');
    setDocVersionNumber(null);
    setDocVersionRows([]);

    try {
      const contentHash = hashConversationState(conversation.messages, conversation.cubeState);
      const latest = await getLatestDesignDocument(conversation.id, docType);
      const allVersions = await listDesignDocumentVersions(conversation.id, docType);
      setDocVersionRows(allVersions);

      if (latest && latest.content_hash === contentHash) {
        // Cache hit — nothing's changed in the conversation since this
        // version was generated, so serve it directly with no model call.
        setDocMarkdown(latest.content);
        setDocVersionNumber(latest.version_number);
        setDocLoading(false);
        return;
      }

      const nextVersionNumber = (latest?.version_number ?? 0) + 1;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...toApiMessages(conversation.messages), { role: 'user', content: `Generate the ${title.toLowerCase()} now.` }],
          mode,
          cubeState: conversation.cubeState,
          meta: conversation.meta,
          versionNumber: nextVersionNumber,
        }),
      });

      if (!res.body) throw new Error('No response from the server.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setDocMarkdown(text);
      }

      const saved = await insertDesignDocumentVersion(
        conversation.id,
        docType,
        contentHash,
        text,
        latest?.version_number ?? 0
      );
      if (saved) {
        setDocVersionNumber(saved.version_number);
        setDocVersionRows((prev) => [saved, ...prev]);
      }
    } catch {
      setDocError(`Could not generate the ${title.toLowerCase()}. Try again.`);
    } finally {
      setDocLoading(false);
    }
  }

  function handleSelectVersion(versionNumber: number) {
    const row = docVersionRows.find((v) => v.version_number === versionNumber);
    if (!row) return;
    setDocVersionNumber(row.version_number);
    setDocMarkdown(row.content);
  }

  // Only relevant for the welcome (not-yet-created) screen — `initial` is
  // stable for the lifetime of this component instance (the parent remounts
  // it via `key` when switching conversations).
  useEffect(() => {
    if (initial) return;
    fetchPathways()
      .then((list) => setExamplePathways(list.slice(0, 3)))
      .catch(() => {});
  }, [initial]);

  useEffect(() => {
    const el = welcomeTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, WELCOME_TEXTAREA_MIN_HEIGHT), WELCOME_TEXTAREA_MAX_HEIGHT)}px`;
  }, [welcomeInput]);

  function handleWelcomeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) handleAttachFiles(files);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) handleAttachFiles(files);
  }

  if (!conversation) {
    const hasBlockingAttachment = pendingAttachments.some((a) => a.state !== 'ready');
    const hasReadyAttachment = pendingAttachments.some((a) => a.state === 'ready');
    const canSend = !loading && !hasBlockingAttachment && (welcomeInput.trim().length > 0 || hasReadyAttachment);

    function handleWelcomeSend() {
      if (!canSend) return;
      const text = welcomeInput.trim();
      setWelcomeInput('');
      void handleUserSend(text);
    }

    function handleWelcomeKey(e: React.KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleWelcomeSend();
      }
    }

    return (
      <div
        className="relative flex-1 flex flex-col items-center justify-center bg-[#F5EFE6] text-[#2C1A0E] p-4 sm:p-8"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F5EFE6]/90 border-4 border-dashed border-[#E8A838] pointer-events-none">
            <p className="text-[#7A5C44] text-sm font-medium">Drop files to attach</p>
          </div>
        )}
        <h1 className="text-3xl font-bold mb-2 text-center">Hi, I&apos;m Jude 👋</h1>
        <p className="text-[#7A5C44] text-sm mb-6 text-center max-w-md">
          Tell me about the AI deployment you&apos;re planning, or upload a document to get started.
        </p>

        <div className="w-full max-w-xl">
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
                    onClick={() => removeAttachment(a.id)}
                    disabled={a.state === 'reading'}
                    className="flex-shrink-0 text-[#7A5C44] hover:text-[#2C1A0E] disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end bg-white border border-[#7A5C44]/30 rounded-2xl p-2 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={handleWelcomeFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#7A5C44] hover:text-[#2C1A0E] transition-colors"
              aria-label="Attach files"
            >
              📎
            </button>
            <textarea
              ref={welcomeTextareaRef}
              className="flex-1 resize-none focus:outline-none text-sm py-2 bg-transparent placeholder-[#7A5C44] overflow-y-auto"
              style={{ height: WELCOME_TEXTAREA_MIN_HEIGHT, maxHeight: WELCOME_TEXTAREA_MAX_HEIGHT }}
              value={welcomeInput}
              onChange={(e) => setWelcomeInput(e.target.value)}
              onKeyDown={handleWelcomeKey}
              placeholder="Describe your deployment, or drop a file…"
              disabled={loading}
            />
            <button
              onClick={handleWelcomeSend}
              disabled={!canSend}
              className="px-4 py-2 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        {examplePathways.length > 0 && (
          <div className="w-full max-w-3xl mt-8">
            <p className="text-[10px] uppercase tracking-wide text-[#7A5C44]/70 mb-2 text-center">
              Already implemented — explore these
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {examplePathways.map((p) => (
                <Link
                  key={p.slug}
                  href={`/explore?pathway=${p.slug}`}
                  className="text-left rounded-xl border border-[#7A5C44]/20 bg-white hover:border-[#7A5C44]/50 hover:shadow-sm transition-all p-4 flex flex-col gap-1"
                >
                  <div className="text-sm font-semibold text-[#2C1A0E]">{p.name}</div>
                  <p className="text-xs text-[#7A5C44] leading-relaxed">{p.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const dimensionsUnlocked = Object.values(conversation.cubeState).some((f) => f.status !== 'dark');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5EFE6] text-[#2C1A0E]">
      {/* Deployment info */}
      <div className="border-b border-[#7A5C44]/20 p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          {onBack ? (
            <button onClick={onBack} className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors">
              ← All deployments
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setFilesOpen(true)}
              className="md:hidden text-xs font-medium px-3 py-1.5 border border-[#7A5C44]/30 text-[#7A5C44] rounded-lg transition-colors"
            >
              📎 Files
            </button>
            <button
              onClick={() => handleGenerateDocument('plan')}
              className="text-xs font-medium px-3.5 py-1.5 border border-[#2C1A0E]/30 text-[#2C1A0E] hover:bg-[#2C1A0E]/5 rounded-lg transition-colors"
            >
              📋 Generate Plan Document
            </button>
            <button
              onClick={() => handleGenerateDocument('analysis')}
              className="text-xs font-medium px-3.5 py-1.5 bg-[#2C1A0E] hover:bg-[#3a2414] text-white rounded-lg shadow-sm transition-colors"
            >
              📄 Generate Analysis Doc
            </button>
          </div>
        </div>
        <h2 className="text-lg font-bold text-[#2C1A0E]">{conversation.meta.name || 'New deployment'}</h2>
        {[conversation.meta.sector, conversation.meta.geography, conversation.meta.status].some(Boolean) && (
          <p className="text-xs text-[#7A5C44] mt-1">
            {[conversation.meta.sector, conversation.meta.geography, conversation.meta.status].filter(Boolean).join(' · ')}
          </p>
        )}
        {conversation.meta.summary && (
          <p className="text-sm text-[#2C1A0E] mt-2 leading-relaxed whitespace-pre-line max-h-24 overflow-y-auto">
            {conversation.meta.summary}
          </p>
        )}
        <div className="mt-3">
          <DimensionList cubeState={conversation.cubeState} onSelect={handleDimensionClick} disabled={!dimensionsUnlocked} />
          {!dimensionsUnlocked && (
            <p className="text-[10px] text-[#7A5C44] mt-1.5">
              Upload a document or start describing your deployment to unlock these.
            </p>
          )}
        </div>
      </div>
      {/* Chat + files */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 min-w-0">
          <ChatPanel
            messages={conversation.messages}
            onSend={handleUserSend}
            pendingAttachments={pendingAttachments}
            loading={loading}
            placeholder="Describe your deployment context…"
          />
        </div>
        <div className="hidden md:block w-[260px] flex-shrink-0 border-l border-[#7A5C44]/20 p-3 overflow-y-auto">
          <AttachmentsPanel
            attachments={pendingAttachments}
            uploadedFileNames={extractUploadedFileNames(conversation.messages)}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachment={removeAttachment}
          />
        </div>

        {filesOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 flex items-end"
            onClick={() => setFilesOpen(false)}
          >
            <div
              className="bg-[#F5EFE6] w-full max-h-[70vh] rounded-t-2xl p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setFilesOpen(false)}
                  aria-label="Close"
                  className="text-[#7A5C44] hover:text-[#2C1A0E] text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
              <AttachmentsPanel
                attachments={pendingAttachments}
                uploadedFileNames={extractUploadedFileNames(conversation.messages)}
                onAttachFiles={handleAttachFiles}
                onRemoveAttachment={removeAttachment}
              />
            </div>
          </div>
        )}
      </div>

      {activeDocType && (
        <AdoptionPlanModal
          title={DOC_LABELS[activeDocType].title}
          loadingLabel={DOC_LABELS[activeDocType].loadingLabel}
          filenameSuffix={DOC_LABELS[activeDocType].filenameSuffix}
          markdown={docMarkdown}
          loading={docLoading}
          error={docError}
          deploymentName={conversation.meta.name}
          version={docVersionNumber != null ? formatVersionLabel(docVersionNumber) : undefined}
          versions={docVersionRows}
          selectedVersionNumber={docVersionNumber ?? undefined}
          onSelectVersion={handleSelectVersion}
          onClose={() => setActiveDocType(null)}
        />
      )}
    </div>
  );
}
