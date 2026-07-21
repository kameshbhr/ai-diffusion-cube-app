import { createClient } from '@/lib/supabase/server';

const BASE_URL = process.env.GITHUB_WIKI_BASE_URL!;
const TTL_MS = 60 * 60 * 1000; // 1 hour — matches the old `revalidate: 3600` window

// Fast path for a warm serverless instance handling several requests back to
// back — avoids a Supabase round trip when possible. The real fix is the
// Supabase-backed cache below: unlike this Map, it's shared across every
// instance and survives cold starts, so concurrent traffic doesn't cause many
// instances to each cold-fetch the same page from GitHub independently.
const memoryCache = new Map<string, string>();

async function fetchPage(path: string): Promise<string> {
  if (memoryCache.has(path)) return memoryCache.get(path)!;

  const supabase = await createClient();
  const { data: cached } = await supabase
    .from('wiki_cache')
    .select('content, fetched_at')
    .eq('path', path)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS) {
    memoryCache.set(path, cached.content);
    return cached.content;
  }

  const url = `${BASE_URL}/${path}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    // GitHub fetch failed (rate-limited, down, etc.) — fall back to the last
    // known cached copy rather than nothing, even if it's stale.
    if (cached?.content) {
      memoryCache.set(path, cached.content);
      return cached.content;
    }
    return '';
  }

  const text = await res.text();
  memoryCache.set(path, text);

  // Fire-and-forget — never blocks the response on a write, and a failure
  // here (e.g. the migration hasn't been run yet) just means no caching,
  // not a broken page load.
  void supabase
    .from('wiki_cache')
    .upsert({ path, content: text, fetched_at: new Date().toISOString() }, { onConflict: 'path' })
    .then(({ error }) => {
      if (error) console.error('[wiki-loader] Failed to write wiki cache:', error.message);
    });

  return text;
}

// Parse pathway slugs listed in index.md lines like: - [Name](pathways/slug.md)
function parsePathwaySlugs(indexMd: string): string[] {
  const slugs: string[] = [];
  const re = /\(pathways\/([^)]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexMd)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

// The Seven Dimensions Framework doc — dimension definitions, stages, and
// the stage x dimension question bank. Injected into prompts instead of
// hardcoding any of that in system-prompts.ts, so editing the wiki page is
// the only thing needed to change the framework the app uses.
export async function loadFrameworkContent(): Promise<string> {
  return fetchPage('wiki/framework.md');
}

export async function loadWikiContext(pathwaySlug?: string): Promise<string> {
  const index = await fetchPage('wiki/index.md');
  const parts: string[] = [`# Wiki Index\n\n${index}`];

  if (pathwaySlug) {
    const slug = pathwaySlug.endsWith('.md') ? pathwaySlug : `${pathwaySlug}.md`;
    const page = await fetchPage(`wiki/pathways/${slug}`);
    if (page) parts.push(`# Pathway: ${pathwaySlug}\n\n${page}`);
  } else {
    const slugs = parsePathwaySlugs(index);
    const pages = await Promise.all(
      slugs.map(async (slug) => {
        const page = await fetchPage(`wiki/pathways/${slug}`);
        return page ? `# Pathway: ${slug}\n\n${page}` : '';
      })
    );
    parts.push(...pages.filter(Boolean));
  }

  return parts.join('\n\n---\n\n');
}
