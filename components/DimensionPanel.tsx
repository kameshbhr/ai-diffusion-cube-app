'use client';

import { FaceState, FaceStatus } from './Cube3D';

const DIMENSION_NAMES: Record<string, string> = {
  A: 'Problem Orientation',
  B: 'Architecture',
  C: 'Institution',
  D: 'Ecosystem',
  E: 'Workforce',
  F: 'Operating Model',
};

const STATUS_LABELS: Record<FaceStatus, string> = {
  dark: 'Not yet discussed',
  amber: 'Partially understood',
  green: 'Well defined',
  red: 'Critical gap / risk',
};

const STATUS_COLORS: Record<FaceStatus, string> = {
  dark: 'bg-[#1A3A5C] text-gray-300',
  amber: 'bg-amber-600 text-white',
  green: 'bg-green-700 text-white',
  red: 'bg-red-600 text-white',
};

interface Props {
  code: string;
  face: FaceState;
  onClose: () => void;
}

export default function DimensionPanel({ code, face, onClose }: Props) {
  return (
    <div className="bg-white border border-[#7A5C44]/20 rounded-xl p-5 mt-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-[#2C1A0E] mr-2">{code}</span>
          <span className="text-[#7A5C44] font-medium">{DIMENSION_NAMES[code]}</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#7A5C44] hover:text-[#2C1A0E] text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <span
        className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mb-3 ${STATUS_COLORS[face.status]}`}
      >
        {STATUS_LABELS[face.status]}
      </span>

      {face.phrase ? (
        <p className="text-[#2C1A0E] text-sm leading-relaxed">{face.phrase}</p>
      ) : (
        <p className="text-[#7A5C44] text-sm italic">No information captured yet for this dimension.</p>
      )}
    </div>
  );
}
