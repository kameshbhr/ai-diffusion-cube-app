import Anthropic from '@anthropic-ai/sdk';
import { loadWikiContext, loadFrameworkContent } from '@/lib/wiki-loader';
import {
  exploreSystemPrompt,
  exploreInitSystemPrompt,
  explorePathwayCopySystemPrompt,
  designSystemPrompt,
  adoptionPlanSystemPrompt,
  planDocumentSystemPrompt,
} from '@/lib/system-prompts';
import { logConversation } from '@/lib/logger';
import { hashContent, getPathwayCache, upsertPathwayCubeState, upsertPathwayCopy } from '@/lib/pathway-cache';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { messages, mode, pathwaySlug, cubeState, meta, versionNumber } = await req.json();

  const [wikiContent, frameworkContent] = await Promise.all([
    loadWikiContext(pathwaySlug),
    loadFrameworkContent(),
  ]);

  // Shared cache for the two silent, per-pathway calls (explore-init's
  // dimension scoring, explore-copy's card/summary) — every user opening the
  // same pathway would otherwise re-trigger identical Claude calls for
  // identical wiki content. Keyed by a hash of that content (plus the
  // framework doc, which explore-init's scoring also depends on), so a wiki
  // or framework edit invalidates it automatically.
  if ((mode === 'explore-init' || mode === 'explore-copy') && pathwaySlug) {
    const contentHash = hashContent(wikiContent + '\n---\n' + frameworkContent);
    const cached = await getPathwayCache(pathwaySlug, contentHash);

    if (mode === 'explore-init' && cached?.cube_state) {
      return new Response(`<cube_update>\n${JSON.stringify(cached.cube_state)}\n</cube_update>`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    if (mode === 'explore-copy' && cached?.card && cached?.summary) {
      return new Response(
        `<pathway_copy>\n${JSON.stringify({ card: cached.card, summary: cached.summary })}\n</pathway_copy>`,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }
  }

  let systemPrompt: string;
  if (mode === 'design') systemPrompt = designSystemPrompt(wikiContent, frameworkContent);
  else if (mode === 'design-adoption-plan') {
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    systemPrompt = adoptionPlanSystemPrompt(wikiContent, frameworkContent, cubeState ?? {}, meta ?? {}, generatedAt);
  }
  else if (mode === 'design-plan-document') {
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    systemPrompt = planDocumentSystemPrompt(wikiContent, frameworkContent, cubeState ?? {}, meta ?? {}, generatedAt, versionNumber ?? 1);
  }
  else if (mode === 'explore-init') systemPrompt = exploreInitSystemPrompt(wikiContent, frameworkContent);
  else if (mode === 'explore-copy') systemPrompt = explorePathwayCopySystemPrompt(wikiContent);
  else systemPrompt = exploreSystemPrompt(wikiContent, frameworkContent, cubeState ?? undefined);

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: mode === 'design-adoption-plan' || mode === 'design-plan-document' ? 4096 : 2048,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          fullResponse += chunk.delta.text;
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();

      // Fire-and-forget — never blocks the response
      logConversation({ mode, pathwaySlug, messages, response: fullResponse });

      if (pathwaySlug && (mode === 'explore-init' || mode === 'explore-copy')) {
        const contentHash = hashContent(wikiContent + '\n---\n' + frameworkContent);
        if (mode === 'explore-init') {
          const match = fullResponse.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
          if (match) {
            try {
              void upsertPathwayCubeState(pathwaySlug, contentHash, JSON.parse(match[1]));
            } catch {
              // Malformed model output — nothing to cache, next request just regenerates.
            }
          }
        } else {
          const match = fullResponse.match(/<pathway_copy>([\s\S]*?)<\/pathway_copy>/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.card && parsed.summary) {
                void upsertPathwayCopy(pathwaySlug, contentHash, parsed.card, parsed.summary);
              }
            } catch {
              // Malformed model output — nothing to cache, next request just regenerates.
            }
          }
        }
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
