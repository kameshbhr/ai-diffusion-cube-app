'use client';

import { DIMENSIONS, STAGES, STATUS_COLORS, cellKey, densityToStatus, type CellDensity, type GridState, type Stage } from '@/lib/dimensions';

interface Props {
  grid: GridState;
  currentStage?: string;
  onSelect?: (dimensionName: string) => void;
  disabled?: boolean;
}

const STATUS_LEGEND: { status: keyof typeof STATUS_COLORS; label: string }[] = [
  { status: 'green', label: 'High' },
  { status: 'amber', label: 'Medium' },
  { status: 'red', label: 'Critical gap' },
  { status: 'dark', label: 'Not yet covered' },
];

// Port of the pre-revamp app's DimensionList (main:components/DimensionList.tsx)
// — same pill-with-dot visual, four dimensions instead of seven. Shows each
// dimension's status AT THE DEPLOYMENT'S CURRENT STAGE (one column of the
// 4×4 grid, mapped through densityToStatus) rather than the full grid.
export default function DimensionChips({ grid, currentStage, onSelect, disabled }: Props) {
  const stage: Stage = (STAGES as readonly string[]).includes(currentStage ?? '') ? (currentStage as Stage) : 'Explore';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {DIMENSIONS.map((d) => {
          const cell = grid[cellKey(d.code, stage)];
          const density = (cell?.density ?? 0) as CellDensity;
          const status = densityToStatus(density);
          return (
            <button
              key={d.code}
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(d.name)}
              title={disabled ? 'Share some context first to unlock this' : cell?.note || 'Nothing established here yet.'}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                disabled
                  ? 'cursor-not-allowed border-navy/10 bg-navy/5 text-navy/40'
                  : 'border-navy/20 bg-white text-navy hover:border-coral/60'
              }`}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: disabled ? '#1A3A5C' : STATUS_COLORS[status], opacity: disabled ? 0.3 : 1 }}
              />
              {d.name}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">Coverage:</span>
        {STATUS_LEGEND.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1 text-[10px] text-ink-soft">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: STATUS_COLORS[status] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
