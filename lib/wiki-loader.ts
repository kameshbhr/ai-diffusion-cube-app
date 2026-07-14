const BASE_URL = process.env.GITHUB_WIKI_BASE_URL!;

// In-memory cache: url -> markdown text
const cache = new Map<string, string>();

async function fetchPage(path: string): Promise<string> {
  const url = `${BASE_URL}/${path}`;
  if (cache.has(url)) return cache.get(url)!;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return '';
  const text = await res.text();
  cache.set(url, text);
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
