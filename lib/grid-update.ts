import type { CellState } from '@/lib/dimensions';

// Step 5 (Generate Output) wraps the Deep Dive Report / Holistic Adoption
// Plan's full markdown in this tag pair — shared between ChatPanel (renders
// a Download PDF card in place of it) and adoption-conversation.ts (which
// stops live-streaming the message body the moment this tag appears, so the
// document reveals as a finished whole rather than typing itself out).
export const DELIVERABLE_START = '<deliverable>';
export const DELIVERABLE_END = '</deliverable>';

// Split out from lib/adoption-conversation.ts so it can be imported from
// server code (app/api/chat/route.ts) without pulling in that file's React
// hooks — Next.js refuses to bundle a route handler that transitively
// imports useState/useEffect.
export interface ParsedGridUpdate {
  cells: Record<string, CellState>;
  meta?: {
    name?: string;
    sector?: string;
    geography?: string;
    stage?: string;
    summary?: string;
    // The model's own working reasoning state — carried forward every turn
    // the same way flowStep is, since none of this survives in replayed
    // message history either (see AdoptionMeta in adoption-conversation.ts).
    hypothesis?: string;
    biggestRisk?: string;
    confidence?: string;
    decision?: string;
    conversationMode?: string;
    // Explorer-only: the Cube's own working stage/coverage read, carried
    // forward the same way — see CubeAssessment in system-prompts.ts.
    cubeAssessment?: {
      currentStage?: string;
      coveredDimensions?: string[];
      partialDimensions?: string[];
      missingDimensions?: string[];
      assessmentConfirmed?: boolean;
    };
  };
  // Pathway slugs the companion actually drew on this turn (see
  // companionSystemPrompt's grid_update contract) — used server-side to tag
  // the adoption_queries log, not rendered anywhere in the UI.
  pathwaysReferenced?: string[];
  // Which numbered step of the explorer/contributor flow the model reports
  // being on (see gridUpdateContract in lib/system-prompts.ts). Persisted
  // into AdoptionMeta.flowStep and re-injected into the prompt every turn —
  // the grid_update block itself is stripped before a message is stored, so
  // the model can't "read back" its own past JSON from history; the app has
  // to carry this state forward explicitly instead.
  flowStep?: number;
}

export function parseGridUpdate(text: string): ParsedGridUpdate | null {
  const match = text.match(/<grid_update>([\s\S]*?)<\/grid_update>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      cells: parsed.cells ?? {},
      meta: parsed.meta,
      pathwaysReferenced: parsed.pathwaysReferenced,
      flowStep: typeof parsed.flowStep === 'number' ? parsed.flowStep : undefined,
    };
  } catch {
    return null;
  }
}

// Cuts at the opening tag rather than matching a closed block, so a
// <grid_update> that has only partially streamed in never renders.
export function stripGridUpdate(text: string): string {
  const idx = text.indexOf('<grid_update');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}
