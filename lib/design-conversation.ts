import { useCallback, useRef, useState } from 'react';
import { CubeState, FaceState } from '@/components/Cube3D';
import { Message } from '@/components/ChatPanel';
import { createClient } from '@/lib/supabase/client';
import { extractTextFromFile, fileToImageBlock, getFileExtension, isImageFile } from '@/lib/extract-text';

export interface DesignMeta {
  name: string;
  sector: string;
  geography: string;
  status: string;
  summary: string;
}

export const EMPTY_META: DesignMeta = { name: '', sector: '', geography: '', status: '', summary: '' };

export const DARK_CUBE: CubeState = Object.fromEntries(
  ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => [c, { status: 'dark', phrase: '' } as FaceState])
);

const UPLOAD_LINE = /(?:📄|🖼️)\s*Uploaded\s+\*\*(.+?)\*\*/g;

// Files already sent in past turns aren't tracked separately — they're
// embedded in each upload message's displayContent (e.g. "📄 Uploaded
// **name**"), so this recovers the list for display in the files panel.
export function extractUploadedFileNames(messages: Message[]): string[] {
  const names: string[] = [];
  for (const m of messages) {
    if (!m.displayContent) continue;
    for (const match of m.displayContent.matchAll(UPLOAD_LINE)) {
      names.push(match[1]);
    }
  }
  return names;
}

export const DIMENSION_NAMES: Record<string, string> = {
  A: 'Problem Orientation',
  B: 'Architecture',
  C: 'Institution',
  D: 'Ecosystem',
  E: 'Workforce',
  F: 'Operating Model',
};

// The six-dimension framework is internal (see designSystemPrompt) — never
// surfaced to the user. Clicking a dimension shortcut in the UI sends one of
// these instead of the internal label, so the request reads like something a
// person would actually say.
const DIMENSION_TOPIC_PROMPTS: Record<string, string> = {
  A: "I want to talk through the problem we're solving and who it's for.",
  B: "I want to dig into how we're planning to build this.",
  C: "I want to talk about who's driving this internally and who owns it.",
  D: 'I want to talk about who else needs to be involved to make this work.',
  E: "I want to talk about the people who'll actually use or run this day to day.",
  F: 'I want to talk about how this keeps running after launch.',
};

export const INITIAL_MESSAGE =
  "Hi, I'm Jude. I'm here to help you design your AI deployment across six dimensions — from problem framing to operating model.\n\nYou can start in two ways:\n📄 Upload a document or image — a concept note, proposal, slide deck, spreadsheet, or a photo of one. I'll read it and get us started.\n💬 Just tell me — describe what you're trying to do, the problem you're solving, and who it's for.";

// A staged attachment carries its extracted payload once processed, so it can
// be folded into the actual API message once the user presses Enter.
export interface StagedAttachment {
  id: string;
  name: string;
  state: 'reading' | 'ready' | 'error';
  error?: string;
  kind?: 'image' | 'text';
  text?: string;
  image?: { mediaType: string; base64: string };
}

export interface DesignConversation {
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
  updatedAt: string;
}

// Shape of a row in the `designs` table (see supabase/migrations/0001_designs.sql).
interface DesignRow {
  id: string;
  meta: DesignMeta;
  cube_state: CubeState;
  messages: Message[];
  document_review_turns_left: number;
  typed_intro_turns_left: number;
  updated_at: string;
}

export function rowToConversation(row: DesignRow): DesignConversation {
  return {
    id: row.id,
    meta: row.meta ?? EMPTY_META,
    cubeState: row.cube_state ?? DARK_CUBE,
    messages: row.messages ?? [],
    documentReviewTurnsLeft: row.document_review_turns_left ?? 0,
    typedIntroTurnsLeft: row.typed_intro_turns_left ?? 0,
    updatedAt: row.updated_at,
  };
}

// Converts our Message[] into the Anthropic content shape, expanding any
// attached images into content blocks — shared by the main chat turn and the
// one-off "Generate Brief" call so they build requests identically.
export function toApiMessages(messages: Message[]) {
  return messages.map(({ role, content, images }) => ({
    role,
    content:
      images && images.length > 0
        ? [
            { type: 'text', text: content },
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
            })),
          ]
        : content,
  }));
}

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

interface UseDesignConversationOptions {
  // Pass an already-loaded row, or null to create the row lazily on the
  // first message/attachment the user actually sends.
  initial: DesignConversation | null;
  onCreated?: (conversation: DesignConversation) => void;
  onChange?: (conversation: DesignConversation) => void;
}

export function useDesignConversation({ initial, onCreated, onChange }: UseDesignConversationOptions) {
  const [conversation, setConversation] = useState<DesignConversation | null>(initial);
  const conversationRef = useRef<DesignConversation | null>(initial);
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<StagedAttachment[]>([]);

  const update = useCallback(
    (updater: (c: DesignConversation) => DesignConversation) => {
      setConversation((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        conversationRef.current = next;
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  async function persist(c: DesignConversation) {
    const updatedAt = new Date().toISOString();
    const supabase = createClient();
    await supabase
      .from('designs')
      .update({
        meta: c.meta,
        cube_state: c.cubeState,
        messages: c.messages,
        document_review_turns_left: c.documentReviewTurnsLeft,
        typed_intro_turns_left: c.typedIntroTurnsLeft,
        updated_at: updatedAt,
      })
      .eq('id', c.id);
    update((cur) => ({ ...cur, updatedAt }));
  }

  const sendMessage = useCallback(
    async (id: string, history: Message[], userMessage: Message, opts?: { documentUpload?: boolean; typedIntro?: boolean }) => {
      const next: Message[] = [...history, userMessage];
      update((c) => ({ ...c, messages: next }));
      setLoading(true);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: toApiMessages(next),
          mode: 'design',
          documentUpload: opts?.documentUpload,
          typedIntro: opts?.typedIntro,
        }),
      });

      if (!res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      update((c) => ({ ...c, messages: [...c.messages, { role: 'assistant', content: '' }] }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });

        const parsedUpdate = parseCubeUpdate(assistantText);
        if (parsedUpdate) {
          update((c) => {
            const nextCube = { ...c.cubeState };
            for (const [code, face] of Object.entries(parsedUpdate.cube)) {
              if (face) nextCube[code] = face;
            }
            const m = parsedUpdate.meta;
            const nextMeta: DesignMeta = m
              ? {
                  name: m.name || c.meta.name,
                  sector: m.sector || c.meta.sector,
                  geography: m.geography || c.meta.geography,
                  status: m.status || c.meta.status,
                  summary: m.summary || c.meta.summary,
                }
              : c.meta;
            return { ...c, cubeState: nextCube, meta: nextMeta };
          });
        }

        update((c) => {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { role: 'assistant', content: stripCubeUpdate(assistantText) };
          return { ...c, messages: msgs };
        });
      }

      setLoading(false);

      if (conversationRef.current && conversationRef.current.id === id) {
        void persist(conversationRef.current);
      }
    },
    [update]
  );

  // Creates the row on first use; a no-op if the conversation already exists.
  async function ensureCreated(): Promise<DesignConversation> {
    if (conversationRef.current) return conversationRef.current;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('designs')
      .insert({
        meta: EMPTY_META,
        cube_state: DARK_CUBE,
        messages: [{ role: 'assistant', content: INITIAL_MESSAGE }],
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Could not start a new deployment. Try again.');
    }

    const created = rowToConversation(data as DesignRow);
    conversationRef.current = created;
    setConversation(created);
    onCreated?.(created);
    return created;
  }

  const handleUserSend = useCallback(
    async (text: string) => {
      const readyAttachments = pendingAttachments.filter((a) => a.state === 'ready');
      const c = await ensureCreated();

      // Attaching a file always starts a fresh document-review sequence for
      // this turn, same as a bare upload used to — regardless of any typed-intro
      // sequencing already in progress.
      if (readyAttachments.length > 0) {
        const images = readyAttachments.filter((a) => a.kind === 'image').map((a) => a.image!);
        const textParts = readyAttachments
          .filter((a) => a.kind === 'text')
          .map((a) => `--- Uploaded: ${a.name} ---\n${a.text}`);

        const baseText =
          text || 'Please look at the attached file(s) and extract everything relevant to designing this deployment.';
        const content = [baseText, ...textParts].join('\n\n');
        const displayLines = [
          ...(text ? [text] : []),
          ...readyAttachments.map((a) => `${a.kind === 'image' ? '🖼️' : '📄'} Uploaded **${a.name}**`),
        ];

        setPendingAttachments([]);
        update((cur) => ({ ...cur, documentReviewTurnsLeft: 2 }));

        sendMessage(
          c.id,
          c.messages,
          { role: 'user', content, displayContent: displayLines.join('\n'), images: images.length ? images : undefined },
          { documentUpload: true }
        );
        return;
      }

      const continuesDocReview = c.documentReviewTurnsLeft > 0;
      const continuesTypedIntro = !continuesDocReview && c.typedIntroTurnsLeft > 0;
      // The very first message of a design (right after the greeting) starts the
      // typed-intro sequence, unless a document upload already claimed that role.
      const startsTypedIntro = !continuesDocReview && !continuesTypedIntro && c.messages.length === 1;

      if (continuesDocReview) {
        update((cur) => ({ ...cur, documentReviewTurnsLeft: cur.documentReviewTurnsLeft - 1 }));
      } else if (continuesTypedIntro) {
        update((cur) => ({ ...cur, typedIntroTurnsLeft: cur.typedIntroTurnsLeft - 1 }));
      } else if (startsTypedIntro) {
        update((cur) => ({ ...cur, typedIntroTurnsLeft: 1 }));
      }

      sendMessage(
        c.id,
        c.messages,
        { role: 'user', content: text },
        { documentUpload: continuesDocReview, typedIntro: continuesTypedIntro || startsTypedIntro }
      );
    },
    [pendingAttachments, sendMessage, update]
  );

  function handleDimensionClick(code: string) {
    void handleUserSend(DIMENSION_TOPIC_PROMPTS[code]);
  }

  function handleAttachFiles(files: File[]) {
    for (const file of files) {
      const attachmentId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      if (!getFileExtension(file.name)) {
        setPendingAttachments((s) => [
          ...s,
          {
            id: attachmentId,
            name: file.name,
            state: 'error',
            error: 'Unsupported type — use .pdf, .docx, .xlsx, .xls, .pptx, .txt, .md, or an image.',
          },
        ]);
        continue;
      }

      setPendingAttachments((s) => [...s, { id: attachmentId, name: file.name, state: 'reading' }]);

      (async () => {
        try {
          if (isImageFile(file.name)) {
            const image = await fileToImageBlock(file);
            setPendingAttachments((s) =>
              s.map((a) => (a.id === attachmentId ? { ...a, state: 'ready', kind: 'image', image } : a))
            );
          } else {
            const text = await extractTextFromFile(file);
            if (!text) throw new Error('No readable text found — it may be a scanned/image PDF.');
            setPendingAttachments((s) =>
              s.map((a) => (a.id === attachmentId ? { ...a, state: 'ready', kind: 'text', text } : a))
            );
          }
        } catch (err) {
          setPendingAttachments((s) =>
            s.map((a) =>
              a.id === attachmentId
                ? { ...a, state: 'error', error: err instanceof Error ? err.message : `Could not read ${file.name}.` }
                : a
            )
          );
        }
      })();
    }
  }

  function removeAttachment(attachmentId: string) {
    setPendingAttachments((s) => s.filter((a) => a.id !== attachmentId));
  }

  return {
    conversation,
    loading,
    pendingAttachments,
    handleUserSend,
    handleAttachFiles,
    removeAttachment,
    handleDimensionClick,
  };
}
