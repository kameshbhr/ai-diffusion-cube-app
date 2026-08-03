'use client';

import { useRef, useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import AttachmentsPanel from '@/components/AttachmentsPanel';
import DimensionChips from '@/components/DimensionChips';
import AdoptionPlanModal from '@/components/AdoptionPlanModal';
import PathwayDraftCanvas from '@/components/PathwayDraftCanvas';
import {
  AdoptionConversation,
  AdoptionFlow,
  extractUploadedFileNames,
  toApiMessages,
  useAdoptionConversation,
} from '@/lib/adoption-conversation';
import {
  DesignDocumentRow,
  DocType,
  formatVersionLabel,
  getLatestDesignDocument,
  hashConversationState,
  insertDesignDocumentVersion,
  listDesignDocumentVersions,
} from '@/lib/design-documents';
import {
  PathwaySubmissionVersionRow,
  getPublishedContentBySubmission,
  insertPathwaySubmissionVersion,
  listPathwaySubmissionVersions,
  upsertPathwaySubmission,
} from '@/lib/pathway-submission-versions';

const DOC_LABELS: Record<DocType, { title: string; mode: string; loadingLabel: string; filenameSuffix: string }> = {
  analysis: {
    title: 'Analysis Doc',
    mode: 'analysis-doc',
    loadingLabel: 'Generating analysis doc…',
    filenameSuffix: 'analysis-doc',
  },
  plan: {
    title: 'Plan Document',
    mode: 'plan-document',
    loadingLabel: 'Generating plan document…',
    filenameSuffix: 'plan-document',
  },
};

interface Props {
  initial: AdoptionConversation | null;
  // Set from a dedicated entry point (/explore or /contribute) — the
  // welcome screen shows a single Start button bound to this flow instead
  // of a picker. Falls back to canExplore/canContribute below if omitted.
  fixedFlow?: AdoptionFlow;
  canExplore?: boolean;
  canContribute?: boolean;
  onCreated?: (c: AdoptionConversation) => void;
  onChange?: (c: AdoptionConversation) => void;
  onBack?: () => void;
}

export default function AdoptionWorkspace({
  initial,
  fixedFlow,
  canExplore = false,
  canContribute = false,
  onCreated,
  onChange,
  onBack,
}: Props) {
  const {
    conversation,
    loading,
    pendingAttachments,
    handleUserSend,
    handleAttachFiles,
    removeAttachment,
  } = useAdoptionConversation({ initial, onCreated, onChange });

  // Resolved once, at the top level, so both the welcome screen's file/drop
  // handlers and its Start button use the exact same flow — a prior bug had
  // this computed only inside the JSX below, which the file-upload path
  // (drag-drop and the attach button) never saw, so uploads silently created
  // the row with an empty flow regardless of /explore vs /contribute.
  const defaultFlow: AdoptionFlow = fixedFlow ?? (canExplore ? 'explorer' : canContribute ? 'contributor' : '');

  const [welcomeInput, setWelcomeInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeDocType, setActiveDocType] = useState<DocType | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docMarkdown, setDocMarkdown] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [docVersionNumber, setDocVersionNumber] = useState<number | null>(null);
  const [docVersionRows, setDocVersionRows] = useState<DesignDocumentRow[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [pathwayDraftOpen, setPathwayDraftOpen] = useState(false);
  const [pathwayDraftMarkdown, setPathwayDraftMarkdown] = useState('');
  const [pathwayDraftLoading, setPathwayDraftLoading] = useState(false);
  const [pathwayDraftError, setPathwayDraftError] = useState<string | null>(null);
  const [pathwaySubmissionId, setPathwaySubmissionId] = useState<string | null>(null);
  const [pathwayVersions, setPathwayVersions] = useState<PathwaySubmissionVersionRow[]>([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | undefined>(undefined);
  const [diffBaseline, setDiffBaseline] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Drafts (or revises) the conversation as a would-be corpus pathway page
  // (Sections 0-6 + Provenance appendix, same structure as the real corpus)
  // for the Contributor to review, revise conversationally, and push — see
  // PathwayDraftModal. Each call is a new version.
  async function handleOpenPathwayDraft(revisionInstruction?: string) {
    if (!conversation) return;
    setPathwayDraftOpen(true);
    setPathwayDraftLoading(true);
    setPathwayDraftError(null);

    const trailingMessage = revisionInstruction
      ? `Please revise the pathway draft as follows: ${revisionInstruction}. Return the full revised document in the same Sections 0-6 + Provenance appendix format.`
      : 'Draft my adoption as a pathway page now.';

    try {
      const priorDraft = pathwayDraftMarkdown ? [{ role: 'assistant', content: pathwayDraftMarkdown }] : [];
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...toApiMessages(conversation.messages), ...priorDraft, { role: 'user', content: trailingMessage }],
          mode: 'pathway-draft',
          grid: conversation.grid,
          meta: conversation.meta,
        }),
      });
      if (!res.body) throw new Error('No response from the server.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      setPathwayDraftMarkdown('');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setPathwayDraftMarkdown(text);
      }

      const submission = await upsertPathwaySubmission(conversation.id, text);
      if (submission) {
        setPathwaySubmissionId(submission.id);
        const versions = await listPathwaySubmissionVersions(submission.id);
        const previousVersionNumber = versions[0]?.version_number ?? 0;
        const newVersion = await insertPathwaySubmissionVersion(
          submission.id,
          text,
          revisionInstruction ?? 'Initial draft',
          previousVersionNumber
        );
        const updatedVersions = newVersion ? [newVersion, ...versions] : versions;
        setPathwayVersions(updatedVersions);
        setSelectedVersionNumber(newVersion?.version_number ?? previousVersionNumber);

        const published = await getPublishedContentBySubmission(submission.id);
        setDiffBaseline(published ?? versions[0]?.content ?? '');
      }
    } catch {
      setPathwayDraftError('Could not draft this pathway page. Try again.');
    } finally {
      setPathwayDraftLoading(false);
    }
  }

  function handleSelectPathwayVersion(versionNumber: number) {
    const row = pathwayVersions.find((v) => v.version_number === versionNumber);
    if (!row) return;
    setSelectedVersionNumber(row.version_number);
    setPathwayDraftMarkdown(row.content);
  }

  // Pushes the submission straight to the public wiki — see
  // app/api/pathway-submissions/push/route.ts (contributor self-serve, no
  // separate admin approval step; admins keep full visibility via /admin).
  async function handlePushPathwayDraft(commitMessage: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
    if (!pathwaySubmissionId) return { ok: false, error: 'Nothing to push yet.' };
    try {
      const res = await fetch('/api/pathway-submissions/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: pathwaySubmissionId, commit_message: commitMessage }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true, slug: data.slug };
    } catch {
      return { ok: false, error: 'Could not reach the server. Try again.' };
    }
  }

  // Handles both documents — same flow, different mode. Cache-checked
  // against the conversation's current content hash; only calls the model
  // on a miss, then stores the result as the next version.
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
      const contentHash = hashConversationState(conversation.messages, conversation.grid);
      const latest = await getLatestDesignDocument(conversation.id, docType);
      const allVersions = await listDesignDocumentVersions(conversation.id, docType);
      setDocVersionRows(allVersions);

      if (latest && latest.content_hash === contentHash) {
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
          grid: conversation.grid,
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

  function handleWelcomeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) handleAttachFiles(files, defaultFlow);
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
    if (files.length) handleAttachFiles(files, defaultFlow);
  }

  if (!conversation) {
    const hasBlockingAttachment = pendingAttachments.some((a) => a.state !== 'ready');
    const hasReadyAttachment = pendingAttachments.some((a) => a.state === 'ready');
    const canSend = !loading && !hasBlockingAttachment && (welcomeInput.trim().length > 0 || hasReadyAttachment);

    function handleWelcomeSend(flow: AdoptionFlow) {
      if (!canSend) return;
      const text = welcomeInput.trim();
      setWelcomeInput('');
      void handleUserSend(text, flow);
    }

    function handleWelcomeKey(e: React.KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey && defaultFlow) {
        e.preventDefault();
        handleWelcomeSend(defaultFlow);
      }
    }

    return (
      <div
        className="relative flex-1 flex flex-col items-center justify-center bg-paper p-4 sm:p-8"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-4 border-dashed border-coral bg-paper/90">
            <p className="text-sm font-medium text-ink-soft">Drop files to share them</p>
          </div>
        )}

        <div className="w-full max-w-2xl animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-coral">
            {fixedFlow === 'contributor' ? 'Contribute a Pathway' : fixedFlow === 'explorer' ? 'Explore Your Adoption' : 'Adoption Companion'}
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium leading-[1.15] tracking-tight text-navy sm:text-4xl">
            {fixedFlow === 'contributor' ? (
              <>
                Turn your deployment into a <span className="font-serif italic text-coral">pathway</span>
              </>
            ) : (
              <>
                Where does your adoption <span className="font-serif italic text-coral">actually</span> stand?
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            {fixedFlow === 'contributor'
              ? "Share the write-up you have. I'll remap it into the four-dimension pathway format, flag the open gaps, and help you push it to the wiki once you're ready."
              : 'Share the documents you have, or just start talking. Everything you hear back is grounded in what real deployments learned.'}
          </p>

          <div className="mt-8">
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-col gap-1">
                {pendingAttachments.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                      a.state === 'error'
                        ? 'border-coral/40 bg-coral-soft text-coral'
                        : 'border-navy/15 bg-white text-ink-soft'
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
                      className="flex-shrink-0 text-ink-soft transition hover:text-navy disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="glow-input flex items-end gap-2 rounded-2xl border border-navy/10 bg-white p-2">
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
                className="p-2 text-ink-soft transition hover:text-navy"
                aria-label="Attach files"
              >
                📎
              </button>
              <textarea
                className="flex-1 resize-none bg-transparent py-2 text-sm text-ink placeholder-ink-soft focus:outline-none"
                rows={1}
                value={welcomeInput}
                onChange={(e) => setWelcomeInput(e.target.value)}
                onKeyDown={handleWelcomeKey}
                placeholder="Describe your adoption, or drop a document…"
                disabled={loading}
              />
              {fixedFlow && (
                <button
                  onClick={() => handleWelcomeSend(fixedFlow)}
                  disabled={!canSend}
                  className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-coral disabled:opacity-40"
                >
                  Start
                </button>
              )}
            </div>

            {!fixedFlow &&
              (canExplore || canContribute ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canExplore && (
                    <button
                      onClick={() => handleWelcomeSend('explorer')}
                      disabled={!canSend}
                      className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-coral disabled:opacity-40"
                    >
                      Explore my adoption
                    </button>
                  )}
                  {canContribute && (
                    <button
                      onClick={() => handleWelcomeSend('contributor')}
                      disabled={!canSend}
                      className="rounded-xl border border-navy/20 px-4 py-2 text-sm font-medium text-navy transition hover:border-coral hover:text-coral disabled:opacity-40"
                    >
                      Contribute a pathway
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-soft">
                  Ask an admin to grant you Explorer or Contributor access to get started.
                </p>
              ))}
          </div>
        </div>
      </div>
    );
  }

  const flow = conversation.meta.flow;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-paper">
      {/* Workspace header: title, sector/geography/stage, summary, dimension chips */}
      <div className="border-b border-navy/10 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {onBack ? (
            <button onClick={onBack} className="text-xs font-medium text-ink-soft transition hover:text-coral">
              ← All adoptions
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={() => setFilesOpen(true)}
              className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-coral hover:text-coral md:hidden"
            >
              📎 Files
            </button>
            {flow === 'contributor' && (
              <button
                onClick={() => handleOpenPathwayDraft()}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-coral hover:text-coral"
              >
                Remap to Pathway Doc
              </button>
            )}
            <button
              onClick={() => handleGenerateDocument('plan')}
              className="rounded-lg border border-navy/20 px-3.5 py-1.5 text-xs font-medium text-navy transition hover:border-coral hover:text-coral"
            >
              Plan Document
            </button>
            <button
              onClick={() => handleGenerateDocument('analysis')}
              className="rounded-lg bg-navy px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-coral"
            >
              Analysis Doc
            </button>
          </div>
        </div>

        {flow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">
            {flow === 'contributor' ? 'Contributor' : 'Explorer'}
          </p>
        )}
        <button
          onClick={() => setHeaderExpanded((v) => !v)}
          className="mt-0.5 flex items-center gap-1.5 text-left"
          aria-expanded={headerExpanded}
        >
          <h2 className="font-display text-lg font-medium tracking-tight text-navy">
            {conversation.meta.name || 'New adoption'}
          </h2>
          <span
            className={`text-ink-soft transition-transform ${headerExpanded ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {headerExpanded && (
          <>
            {[conversation.meta.sector, conversation.meta.geography, conversation.meta.stage].some(Boolean) && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                {[conversation.meta.sector, conversation.meta.geography, conversation.meta.stage]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {conversation.meta.summary && (
              <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink">
                {conversation.meta.summary}
              </p>
            )}
          </>
        )}
        <div className="mt-3">
          <DimensionChips
            grid={conversation.grid}
            currentStage={conversation.meta.stage}
            onSelect={(name) => handleUserSend(`Tell me about the ${name} dimension of my adoption.`, flow)}
          />
        </div>
      </div>

      {/* Chat + files (+ the pathway draft canvas, alongside chat rather than over it) */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className={`min-w-0 flex-1 ${pathwayDraftOpen ? 'lg:max-w-[420px] lg:flex-shrink-0' : ''}`}>
          <ChatPanel
            messages={conversation.messages}
            onSend={handleUserSend}
            pendingAttachments={pendingAttachments}
            loading={loading}
            placeholder="Ask, share, or think out loud…"
          />
        </div>

        {pathwayDraftOpen && (
          <div className="fixed inset-0 z-50 bg-paper lg:static lg:z-auto lg:min-w-0 lg:flex-1 lg:border-l lg:border-navy/10">
            <PathwayDraftCanvas
              markdown={pathwayDraftMarkdown}
              loading={pathwayDraftLoading}
              error={pathwayDraftError}
              onRevise={(instruction) => handleOpenPathwayDraft(instruction)}
              onPush={handlePushPathwayDraft}
              versions={pathwayVersions}
              selectedVersionNumber={selectedVersionNumber}
              onSelectVersion={handleSelectPathwayVersion}
              diffAgainst={diffBaseline}
              onClose={() => setPathwayDraftOpen(false)}
            />
          </div>
        )}

        {!pathwayDraftOpen && (
          <div className="hidden w-[260px] flex-shrink-0 overflow-y-auto border-l border-navy/10 p-3 md:block">
            <AttachmentsPanel
              attachments={pendingAttachments}
              uploadedFileNames={extractUploadedFileNames(conversation.messages)}
              onAttachFiles={handleAttachFiles}
              onRemoveAttachment={removeAttachment}
            />
          </div>
        )}

        {filesOpen && (
          <div className="fixed inset-0 z-40 flex items-end bg-navy/40 md:hidden" onClick={() => setFilesOpen(false)}>
            <div
              className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-paper p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => setFilesOpen(false)}
                  aria-label="Close"
                  className="px-1 text-lg leading-none text-ink-soft transition hover:text-navy"
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
