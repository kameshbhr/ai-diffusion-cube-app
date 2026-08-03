import Anthropic from '@anthropic-ai/sdk';
import { loadWikiContext, loadFrameworkContent, loadPathwayGenerationPrompt } from '@/lib/wiki-loader';
import {
  explorerSystemPrompt,
  contributorSystemPrompt,
  analysisDocSystemPrompt,
  planDocumentSystemPrompt,
  documentInsightSystemPrompt,
  pathwayDraftSystemPrompt,
} from '@/lib/system-prompts';
import { logConversation } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, hasRole } from '@/lib/roles';
import { EMPTY_GRID } from '@/lib/dimensions';
import { parseGridUpdate } from '@/lib/grid-update';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODES = ['companion', 'analysis-doc', 'plan-document', 'extract-insights', 'pathway-draft'] as const;

function lastUserMessageText(messages: { role: string; content: unknown }[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) {
    const textBlock = last.content.find((b): b is { type: string; text: string } => b?.type === 'text');
    return textBlock?.text ?? '';
  }
  return '';
}

export async function POST(req: Request) {
  const { messages, mode, grid, meta, versionNumber, designId, flow } = await req.json();

  if (!MODES.includes(mode)) {
    return Response.json({ error: 'Unknown mode.' }, { status: 400 });
  }

  // The whole app is the companion now — access requires an approved account
  // (any role at all; "pending" is zero roles). proxy.ts already guarantees a
  // session; this is the real enforcement for the model-calling surface.
  const supabase = await createClient();
  const approved = await hasAnyRole(supabase);
  if (!approved) {
    return Response.json({ error: 'Your account is awaiting approval.' }, { status: 403 });
  }

  // A companion turn's flow is fixed by the adoption's own meta.flow, chosen
  // once on the welcome screen — but the UI showing that choice is not the
  // real enforcement boundary, so re-check it against the caller's actual
  // roles here (same pattern the old `design` mode used for `adopter`).
  if (mode === 'companion') {
    if (flow === 'contributor' && !(await hasRole(supabase, 'pathway_contributor'))) {
      return Response.json({ error: 'The Contributor flow requires the Contributor role.' }, { status: 403 });
    }
    if (flow === 'explorer' && !(await hasRole(supabase, 'adopter'))) {
      return Response.json({ error: 'The Explorer flow requires the Adopter role.' }, { status: 403 });
    }
  }

  const [wikiContent, frameworkContent] = await Promise.all([loadWikiContext(), loadFrameworkContent()]);

  let systemPrompt: string;
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  if (mode === 'analysis-doc') {
    systemPrompt = analysisDocSystemPrompt(wikiContent, frameworkContent, grid ?? EMPTY_GRID, meta ?? {}, generatedAt);
  } else if (mode === 'plan-document') {
    systemPrompt = planDocumentSystemPrompt(
      wikiContent,
      frameworkContent,
      grid ?? EMPTY_GRID,
      meta ?? {},
      generatedAt,
      versionNumber ?? 1
    );
  } else if (mode === 'extract-insights') {
    systemPrompt = documentInsightSystemPrompt(frameworkContent, grid ?? EMPTY_GRID);
  } else if (mode === 'pathway-draft') {
    const generationPromptContent = await loadPathwayGenerationPrompt();
    systemPrompt = pathwayDraftSystemPrompt(
      frameworkContent,
      generationPromptContent,
      grid ?? EMPTY_GRID,
      meta ?? {},
      generatedAt
    );
  } else if (flow === 'contributor') {
    systemPrompt = contributorSystemPrompt(wikiContent, frameworkContent, grid ?? EMPTY_GRID, meta ?? {});
  } else {
    systemPrompt = explorerSystemPrompt(wikiContent, frameworkContent, grid ?? EMPTY_GRID, meta ?? {});
  }

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: mode === 'companion' ? 2048 : mode === 'extract-insights' ? 1024 : mode === 'pathway-draft' ? 6144 : 4096,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text;
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();

      // Fire-and-forget — never blocks the response
      logConversation({ mode, messages, response: fullResponse });

      // Records every companion-mode query, tagged with the pathway slug(s)
      // the response actually drew on (see supabase/migrations/0010 and
      // 0011, and companionSystemPrompt's grid_update contract) — raw
      // material for future cross-adoption insight gathering; nothing reads
      // it yet.
      if (mode === 'companion') {
        const content = lastUserMessageText(messages);
        if (content) {
          const pathwaySlugs = parseGridUpdate(fullResponse)?.pathwaysReferenced ?? [];
          supabase
            .from('adoption_queries')
            .insert({ design_id: designId ?? null, content, pathway_slugs: pathwaySlugs })
            .then(({ error }) => {
              if (error) console.error('[adoption_queries] insert failed:', error);
            });
        }
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
