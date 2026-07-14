'use client';

import { InlineRun, parsePlanMarkdown, splitInlineBold } from '@/lib/adoption-plan-markdown';
import { downloadPlanAsPdf } from '@/lib/adoption-plan-pdf';

interface Props {
  markdown: string;
  loading: boolean;
  error: string | null;
  deploymentName: string;
  onClose: () => void;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {splitInlineBold(text).map((run: InlineRun, i) =>
        run.bold ? <strong key={i}>{run.text}</strong> : <span key={i}>{run.text}</span>
      )}
    </>
  );
}

export default function AdoptionPlanModal({ markdown, loading, error, deploymentName, onClose }: Props) {
  const blocks = parsePlanMarkdown(markdown);

  function handleDownload() {
    const safeName = (deploymentName || 'deployment').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadPlanAsPdf(markdown, `${safeName}-adoption-plan.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
      <div className="bg-[#F5EFE6] text-[#2C1A0E] rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#7A5C44]/20 flex-shrink-0">
          <h2 className="text-lg font-bold">Adoption Journey Plan</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={loading || !markdown}
              className="px-3 py-1.5 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="text-[#7A5C44] hover:text-[#2C1A0E] text-lg leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="text-[#D64045] text-sm">{error}</p>}

          {!error && blocks.length === 0 && loading && (
            <p className="text-[#7A5C44] text-sm animate-pulse">Generating adoption plan…</p>
          )}

          {!error &&
            blocks.map((block, i) => {
              switch (block.type) {
                case 'h2':
                  return (
                    <h2 key={i} className="text-xl font-bold mt-2 mb-2">
                      <InlineText text={block.text} />
                    </h2>
                  );
                case 'h3':
                  return (
                    <h3 key={i} className="text-base font-bold mt-5 mb-1.5">
                      <InlineText text={block.text} />
                    </h3>
                  );
                case 'italic':
                  return (
                    <p key={i} className="text-sm italic text-[#7A5C44] mb-1">
                      <InlineText text={block.text} />
                    </p>
                  );
                case 'paragraph':
                  return (
                    <p key={i} className="text-sm leading-relaxed mb-3">
                      <InlineText text={block.text} />
                    </p>
                  );
                case 'bullets':
                  return (
                    <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
                      {block.items.map((item, j) => (
                        <li key={j} className="text-sm leading-relaxed">
                          <InlineText text={item} />
                        </li>
                      ))}
                    </ul>
                  );
                case 'numbered':
                  return (
                    <ol key={i} className="list-decimal pl-5 mb-3 space-y-1">
                      {block.items.map((item, j) => (
                        <li key={j} className="text-sm leading-relaxed">
                          <InlineText text={item} />
                        </li>
                      ))}
                    </ol>
                  );
                default:
                  return null;
              }
            })}

          {!error && loading && blocks.length > 0 && (
            <p className="text-[#7A5C44] text-xs mt-2 animate-pulse">Generating…</p>
          )}
        </div>
      </div>
    </div>
  );
}
