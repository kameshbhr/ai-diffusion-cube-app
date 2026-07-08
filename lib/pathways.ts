export interface Pathway {
  slug: string;
  name: string;
  description: string;
}

// Parse pathways from the index.md "## Pathways" table:
// | [Name](pathways/slug.md) | Summary text |
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

export async function fetchPathways(): Promise<Pathway[]> {
  const base = process.env.NEXT_PUBLIC_GITHUB_WIKI_BASE_URL ?? '';
  const res = await fetch(`${base}/wiki/index.md`);
  const md = await res.text();
  return parsePathways(md);
}
