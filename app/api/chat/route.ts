import Anthropic from '@anthropic-ai/sdk';
import { loadWikiContext } from '@/lib/wiki-loader';
import {
  exploreSystemPrompt,
  exploreInitSystemPrompt,
  explorePathwayCopySystemPrompt,
  designSystemPrompt,
  designBriefSystemPrompt,
} from '@/lib/system-prompts';
import { logConversation } from '@/lib/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { messages, mode, pathwaySlug, cubeState, documentUpload, typedIntro, meta } = await req.json();

  const wikiContent = await loadWikiContext(pathwaySlug);
  let systemPrompt: string;
  if (mode === 'design') systemPrompt = designSystemPrompt(wikiContent, { documentUpload, typedIntro });
  else if (mode === 'design-brief') {
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    systemPrompt = designBriefSystemPrompt(wikiContent, cubeState ?? {}, meta ?? {}, generatedAt);
  }
  else if (mode === 'explore-init') systemPrompt = exploreInitSystemPrompt(wikiContent);
  else if (mode === 'explore-copy') systemPrompt = explorePathwayCopySystemPrompt(wikiContent);
  else systemPrompt = exploreSystemPrompt(wikiContent, cubeState ?? undefined);

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: mode === 'design-brief' ? 4096 : 2048,
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
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
