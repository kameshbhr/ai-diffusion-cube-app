// Client-side text extraction — runs entirely in the browser so uploaded
// documents never need to hit a server route or hit Vercel's request-size limits.
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md'];

export function getFileExtension(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext && SUPPORTED_EXTENSIONS.includes(ext) ? ext : null;
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(
      content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    );
  }
  return pageTexts.join('\n\n').trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name);
  if (!ext) throw new Error('Unsupported file type. Please upload a .pdf, .txt, or .md file.');
  if (ext === 'pdf') return extractPdfText(file);
  return (await file.text()).trim();
}
