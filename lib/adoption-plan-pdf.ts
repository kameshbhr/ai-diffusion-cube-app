import jsPDF from 'jspdf';
import { parsePlanMarkdown, splitInlineBold } from '@/lib/adoption-plan-markdown';

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
    const lines: string[] = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, marginX + indent, y);
      y += size + 4;
    }
    y += gapAfter;
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
          writeLines(`•  ${flatten(item)}`, 11, 'normal', 8, 2);
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
