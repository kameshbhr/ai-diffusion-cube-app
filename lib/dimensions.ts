// Single source of truth for the Seven Dimensions Framework's structural
// shape (codes, names, stages) — the substantive definitions, stage
// descriptions, and question bank live in the wiki (wiki/framework.md,
// loaded via loadFrameworkContent) and are injected into prompts instead of
// duplicated here. This file only fixes the letter-code <-> name mapping the
// app's JSON (cube_update) and UI rely on.

export type FaceStatus = 'dark' | 'green' | 'amber' | 'red';

export interface FaceState {
  status: FaceStatus;
  phrase: string;
}

export type CubeState = Record<string, FaceState>;

export interface Dimension {
  code: string;
  name: string;
}

// Order and names follow the framework's numbered dimension table (1-7).
export const DIMENSIONS: Dimension[] = [
  { code: 'A', name: 'Problem & Foundation' },
  { code: 'B', name: 'Architecture' },
  { code: 'C', name: 'Data' },
  { code: 'D', name: 'Institution' },
  { code: 'E', name: 'Ecosystem' },
  { code: 'F', name: 'Workforce' },
  { code: 'G', name: 'Operating Model' },
];

export const DIMENSION_CODES: string[] = DIMENSIONS.map((d) => d.code);

export const DIMENSION_NAMES: Record<string, string> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.code, d.name])
);

// The four stages of the adoption journey (wiki/framework.md's stage table).
export const STAGES = ['Explore', 'Define', 'Pilot', 'Scale'] as const;
export type Stage = (typeof STAGES)[number];

export const STATUS_COLORS: Record<FaceStatus, string> = {
  dark: '#1A3A5C',
  green: '#3D8B37',
  amber: '#E8A838',
  red: '#D64045',
};

export const DARK_CUBE: CubeState = Object.fromEntries(
  DIMENSION_CODES.map((c) => [c, { status: 'dark', phrase: '' } as FaceState])
);

// Bridges the framework doc's numbered dimensions (1-7) to this app's
// lettered cube_update JSON keys — injected into prompts alongside the raw
// framework content so the model knows which letter to emit for each.
export function dimensionCodeLegend(): string {
  return DIMENSIONS.map((d, i) => `${d.code} = Dimension ${i + 1} (${d.name})`).join('\n');
}
