'use client';

import { CubeState, FaceStatus } from '@/components/Cube3D';

const DIMENSION_NAMES: Record<string, string> = {
  A: 'Problem Orientation',
  B: 'Architecture',
  C: 'Institution',
  D: 'Ecosystem',
  E: 'Workforce',
  F: 'Operating Model',
};

const STATUS_COLORS: Record<FaceStatus, string> = {
  dark: '#1A3A5C',
  green: '#3D8B37',
  amber: '#E8A838',
  red: '#D64045',
};

interface Props {
  cubeState: CubeState;
  onSelect?: (code: string) => void;
  disabled?: boolean;
}

export default function DimensionList({ cubeState, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(DIMENSION_NAMES).map((code) => {
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
