export interface Pathway {
  slug: string;
  name: string;
  description: string;
}

// Parse pathway slugs, order, and fallback descriptions from the index.md
// "## Pathways" table: | [Name](pathways/slug.md) | Summary text |
// The link text is only a placeholder name here — fetchPathways() below
// overrides it with each pathway file's own title, which is the real
// display name.
export function parsePathways(indexMd: string): Pathway[] {
  const results: Pathway[] = [];
  const re = /\|\s*\[([^\]]+)\]\(pathways\/([^)]+)\.md\)\s*\|\s*([^|\n]+?)\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexMd)) !== null) {
    results.push({
      name: m[1].trim(),
      slug: m[2].trim(),
      description: m[3].trim(),
    });
  }
  return results;
}

// A pathway's display name is its own file's title — the first H1 line —
// not the index.md table's link text, since the table entry is just a
// short label and can drift from what the pathway page itself is titled.
export function parsePathwayTitle(pathwayMd: string): string | null {
  const m = pathwayMd.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

// In-memory, session-lifetime caches — several places (Explore page, the
// sidebar's Deployments list, the home page's "already implemented" blocks)
// each independently want the wiki index/pathway content; without this every
// one of them re-fetches the same GitHub file. A hard reload naturally
// clears these, which is fine since the wiki changes rarely. Caching the
// in-flight promise (not just the resolved value) also de-dupes concurrent
// callers on first load instead of firing off several identical fetches.
let pathwaysCache: Promise<Pathway[]> | null = null;
const pathwayMarkdownCache = new Map<string, Promise<string>>();

export async function fetchPathways(): Promise<Pathway[]> {
  if (!pathwaysCache) {
    const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
    pathwaysCache = fetch(`${base}/wiki/index.md`)
      .then((r) => r.text())
      .then(parsePathways)
      .then((list) =>
        Promise.all(
          list.map(async (p) => {
            try {
              const md = await fetchPathwayMarkdown(p.slug);
              const title = parsePathwayTitle(md);
              return title ? { ...p, name: title } : p;
            } catch {
              return p; // fall back to the index.md name if the pathway file can't be fetched
            }
          })
        )
      );
    pathwaysCache.catch(() => {
      pathwaysCache = null; // allow a retry on the next call if this one failed
    });
  }
  return pathwaysCache;
}

export async function fetchPathwayMarkdown(slug: string): Promise<string> {
  if (!pathwayMarkdownCache.has(slug)) {
    const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
    const promise = fetch(`${base}/wiki/pathways/${slug}.md`).then((r) => r.text());
    promise.catch(() => pathwayMarkdownCache.delete(slug));
    pathwayMarkdownCache.set(slug, promise);
  }
  return pathwayMarkdownCache.get(slug)!;
}
