'use client';

import { CubeState, DIMENSION_CODES, DIMENSION_NAMES, STATUS_COLORS } from '@/lib/dimensions';

interface Props {
  cubeState: CubeState;
  onSelect?: (code: string) => void;
  disabled?: boolean;
}

export default function DimensionList({ cubeState, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {DIMENSION_CODES.map((code) => {
        const face = cubeState[code];
        const status = face?.status ?? 'dark';
        return (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(code)}
            title={disabled ? 'Share some context first to unlock this' : face?.phrase}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              disabled
                ? 'border-[#7A5C44]/10 bg-[#7A5C44]/5 text-[#7A5C44]/50 cursor-not-allowed'
                : 'border-[#7A5C44]/20 bg-white hover:border-[#7A5C44]/50 text-[#2C1A0E]'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: disabled ? '#7A5C44' : STATUS_COLORS[status], opacity: disabled ? 0.3 : 1 }}
            />
            {DIMENSION_NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}
