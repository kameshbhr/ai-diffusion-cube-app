// A small, purpose-built parser for the Adoption Journey Plan's markdown
// subset (##/### headings, *italic* lines, **bold** runs, bullet and
// numbered lists) — shared by the on-screen renderer and the PDF export so
// both stay in sync with a single parse.

export type PlanBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'paragraph'; text: string };

function isBlockStart(line: string): boolean {
  return (
    line.startsWith('## ') ||
    line.startsWith('### ') ||
    line.startsWith('- ') ||
    line.startsWith('● ') ||
    /^\d+\.\s/.test(line) ||
    (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) ||
    /^([-*_])\1{2,}$/.test(line)
  );
}

export function parsePlanMarkdown(markdown: string): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Blank lines and horizontal rules are just visual spacing — the JSX
    // renderer already separates sections with margin, and the PDF export
    // adds its own gaps between blocks.
    if (!line || /^([-*_])\1{2,}$/.test(line)) {
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push({ type: 'italic', text: line.slice(1, -1).trim() });
      i++;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('● ')) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith('- ') || l.startsWith('● ')) {
          items.push(l.slice(2).trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'bullets', items });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const m = l.match(/^\d+\.\s+(.*)/);
        if (m) {
          items.push(m[1].trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'numbered', items });
      continue;
    }

    // Plain paragraph — accumulate wrapped lines until a blank line or the
    // start of a new block type.
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l) {
        i++;
        break;
      }
      if (isBlockStart(l)) break;
      paraLines.push(l);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

export interface InlineRun {
  text: string;
  bold: boolean;
}

// Splits a line into plain/bold runs for inline **bold** rendering.
export function splitInlineBold(text: string): InlineRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false }
    );
}
