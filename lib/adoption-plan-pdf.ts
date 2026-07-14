import jsPDF from 'jspdf';
import { parsePlanMarkdown, parseStatusBullet, splitInlineBold } from '@/lib/adoption-plan-markdown';
import { STATUS_COLORS } from '@/lib/dimensions';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Flattens inline **bold** markers to plain text — jsPDF's plain text() calls
// don't support mixed bold/normal runs within a single line, so the PDF
// export trades that emphasis for simplicity (the on-screen modal keeps it).
function flatten(text: string): string {
  return splitInlineBold(text)
    .map((run) => run.text)
    .join('');
}

export function downloadPlanAsPdf(markdown: string, filename: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  }

  function writeLines(text: string, size: number, style: 'normal' | 'bold' | 'italic', indent: number, gapAfter: number) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    const lines: string[] = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, marginX + indent, y);
      y += size + 4;
    }
    y += gapAfter;
  }

  // Draws a real vector-filled circle instead of relying on an emoji glyph —
  // jsPDF's default Helvetica font doesn't reliably include color emoji, so
  // this is how the "At a Glance" status tags actually render in the PDF.
  function writeStatusBullet(text: string, color: string) {
    const indent = 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines: string[] = doc.splitTextToSize(text, maxWidth - indent);
    const { r, g, b } = hexToRgb(color);
    lines.forEach((line, idx) => {
      ensureSpace(15);
      if (idx === 0) {
        doc.setFillColor(r, g, b);
        doc.circle(marginX + 4, y - 3, 3, 'F');
      }
      doc.setTextColor(0, 0, 0);
      doc.text(line, marginX + indent, y);
      y += 15;
    });
    y += 2;
  }

  for (const block of parsePlanMarkdown(markdown)) {
    switch (block.type) {
      case 'h2':
        y += 8;
        writeLines(flatten(block.text), 18, 'bold', 0, 10);
        break;
      case 'h3':
        y += 6;
        writeLines(flatten(block.text), 13, 'bold', 0, 6);
        break;
      case 'italic':
        writeLines(flatten(block.text), 10, 'italic', 0, 4);
        break;
      case 'paragraph':
        writeLines(flatten(block.text), 11, 'normal', 0, 8);
        break;
      case 'bullets':
        for (const item of block.items) {
          const { status, text } = parseStatusBullet(item);
          if (status) {
            writeStatusBullet(flatten(text), STATUS_COLORS[status]);
          } else {
            writeLines(`•  ${flatten(item)}`, 11, 'normal', 8, 2);
          }
        }
        y += 6;
        break;
      case 'numbered':
        block.items.forEach((item, idx) => {
          writeLines(`${idx + 1}.  ${flatten(item)}`, 11, 'normal', 8, 4);
        });
        y += 6;
        break;
    }
  }

  doc.save(filename);
}
