import { DIMENSIONS, DIMENSION_COLORS, STAGES, cellKey, type GridState } from '@/lib/dimensions';

interface Props {
  grid: GridState;
}

// The full 4×4 grid, styled after 100pathways.com's own dimension × stage
// table (colored accent bar + dimension name, stage names as column
// headers). Each cell shows what's actually been established for this
// adoption (the note), not the framework's core question. Rendered inline
// in the chat by ChatPanel wherever the model emits a <cube_grid/> marker —
// see the model's own grid-first instruction in Step 3 of the Explorer
// prompt (lib/system-prompts.ts).
export default function HeatmapGrid({ grid }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-navy/10">
            <th className="w-32 px-4 py-3 text-left" />
            {STAGES.map((s) => (
              <th
                key={s}
                className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-navy"
              >
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map((d) => (
            <tr key={d.code} className="border-b border-navy/10 last:border-b-0">
              <td className="px-4 py-4 align-top" style={{ borderLeft: `4px solid ${DIMENSION_COLORS[d.code]}` }}>
                <span className="font-serif text-base italic" style={{ color: DIMENSION_COLORS[d.code] }}>
                  {d.name}
                </span>
              </td>
              {STAGES.map((s) => {
                const cell = grid[cellKey(d.code, s)];
                const hasContent = Boolean(cell?.note);
                return (
                  <td
                    key={s}
                    className="max-w-[240px] px-4 py-4 align-top text-sm leading-relaxed"
                    style={{ background: hasContent ? `${DIMENSION_COLORS[d.code]}0d` : undefined }}
                  >
                    {hasContent ? (
                      <span className="text-ink">{cell!.note}</span>
                    ) : (
                      <span className="text-ink-soft/60 italic">Not yet discussed</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
