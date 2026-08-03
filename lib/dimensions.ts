// Single source of truth for the AI Diffusion Pathway Framework's structural
// shape (dimensions, sub-categories, stages, stage-weighting, unit types) —
// the substantive content (core questions, insight forms, corpus examples)
// lives in the wiki's framework doc, loaded via loadFrameworkContent() and
// injected into prompts, so editing the wiki changes behavior with no code
// change. This file only fixes the shape the app's JSON state and UI rely on.
//
// Source: "Pathway Framework" doc — four dimensions × four stages, lettered
// sub-categories per dimension, each weighted Primary/Secondary/Dormant per
// stage.

export type DimensionCode = 'persona' | 'solution' | 'institution' | 'ecosystem';

export const STAGES = ['Explore', 'Define', 'Pilot', 'Scale'] as const;
export type Stage = (typeof STAGES)[number];

// Primary = ask/check directly this stage. Secondary = only if relevant or
// surfaced by the core question. Dormant = never initiate; follow only if
// the user raises it unprompted.
export type SubCategoryWeight = 'primary' | 'secondary' | 'dormant';

export interface SubCategory {
  code: string; // 'A', 'B', ...
  name: string;
  weights: Record<Stage, SubCategoryWeight>;
}

export interface Dimension {
  code: DimensionCode;
  name: string;
  centralQuestion: string;
  subCategories: SubCategory[];
}

export const DIMENSIONS: Dimension[] = [
  {
    code: 'persona',
    name: 'Persona',
    centralQuestion: 'Are we solving the right problem for the right person?',
    subCategories: [
      {
        code: 'A',
        name: 'Problem and Persona',
        weights: { Explore: 'primary', Define: 'secondary', Pilot: 'dormant', Scale: 'secondary' },
      },
      {
        code: 'B',
        name: 'Current Journey and Friction',
        weights: { Explore: 'primary', Define: 'secondary', Pilot: 'dormant', Scale: 'dormant' },
      },
      {
        code: 'C',
        name: 'Outcome and Success',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'primary' },
      },
      {
        code: 'D',
        name: 'Scope, Inclusion, and Trust',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'primary' },
      },
    ],
  },
  {
    code: 'solution',
    name: 'Solution',
    centralQuestion: 'Are we building the right system to solve it?',
    subCategories: [
      {
        code: 'A',
        name: 'AI Fit and Comparative Advantage',
        weights: { Explore: 'primary', Define: 'secondary', Pilot: 'dormant', Scale: 'dormant' },
      },
      {
        code: 'B',
        name: 'UX, Channel, and Integration',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'secondary' },
      },
      {
        code: 'C',
        name: 'Model, Architecture, and Infrastructure',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'primary' },
      },
      {
        code: 'D',
        name: 'Data and Knowledge Readiness',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'primary' },
      },
      {
        code: 'E',
        name: 'Performance, Reliability, and Scale',
        weights: { Explore: 'dormant', Define: 'secondary', Pilot: 'primary', Scale: 'primary' },
      },
    ],
  },
  {
    code: 'institution',
    name: 'Institution',
    centralQuestion: 'Can the institution own, absorb, govern, and sustain it?',
    subCategories: [
      {
        code: 'A',
        name: 'Mandate, Ownership, and Decision Rights',
        weights: { Explore: 'primary', Define: 'primary', Pilot: 'secondary', Scale: 'secondary' },
      },
      {
        code: 'B',
        name: 'Workforce and Change',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'primary', Scale: 'primary' },
      },
      {
        code: 'C',
        name: 'Governance, Safety, and Redress',
        weights: { Explore: 'dormant', Define: 'primary', Pilot: 'primary', Scale: 'secondary' },
      },
      {
        code: 'D',
        name: 'Accountability, Liability, and Compliance',
        weights: { Explore: 'dormant', Define: 'secondary', Pilot: 'secondary', Scale: 'primary' },
      },
      {
        code: 'E',
        name: 'Data Stewardship',
        weights: { Explore: 'dormant', Define: 'primary', Pilot: 'secondary', Scale: 'primary' },
      },
      {
        code: 'F',
        name: 'Operating Model and Sustainability',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'secondary', Scale: 'primary' },
      },
      {
        code: 'G',
        name: 'Institutionalisation and Continuous Improvement',
        weights: { Explore: 'dormant', Define: 'dormant', Pilot: 'secondary', Scale: 'primary' },
      },
    ],
  },
  {
    code: 'ecosystem',
    name: 'Ecosystem',
    centralQuestion: 'Can the required network of actors execute and support it?',
    subCategories: [
      {
        code: 'A',
        name: 'Partner Architecture and Roles',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'secondary', Scale: 'secondary' },
      },
      {
        code: 'B',
        name: 'External Data and Infrastructure Dependencies',
        weights: { Explore: 'secondary', Define: 'primary', Pilot: 'secondary', Scale: 'primary' },
      },
      {
        code: 'C',
        name: 'Delivery, Distribution, and Trust',
        weights: { Explore: 'dormant', Define: 'secondary', Pilot: 'secondary', Scale: 'secondary' },
      },
      {
        code: 'D',
        name: 'Coordination, Procurement, and Incentives',
        weights: { Explore: 'dormant', Define: 'secondary', Pilot: 'secondary', Scale: 'secondary' },
      },
      {
        code: 'E',
        name: 'Resilience, Portability, and Contingencies',
        weights: { Explore: 'dormant', Define: 'dormant', Pilot: 'primary', Scale: 'primary' },
      },
      {
        code: 'F',
        name: 'Ecosystem Learning and Diffusion',
        weights: { Explore: 'dormant', Define: 'dormant', Pilot: 'secondary', Scale: 'primary' },
      },
    ],
  },
];

export const DIMENSION_CODES: DimensionCode[] = DIMENSIONS.map((d) => d.code);

export const DIMENSION_NAMES: Record<DimensionCode, string> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.code, d.name])
) as Record<DimensionCode, string>;

// The five unit types every corpus unit is tagged with (alongside dimension,
// sub-category, stage, and a condition tag).
export const UNIT_TYPES = [
  'Strategic Decision',
  'Tactical Decision',
  'Failure and Fix',
  'Playbook',
  'Toolkit Asset',
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// Per-cell coverage in the user's own 4×4 grid (dimension × stage): how much
// has been established about their adoption from conversation + uploads.
// Mirrors the pathway documents' own Section-2 density notation
// (●●● / ●● / ● / ○), so a user's grid reads in the same visual language as
// the corpus they're drawing on.
export type CellDensity = 0 | 1 | 2 | 3;

export interface CellState {
  density: CellDensity;
  // One-line note on what's actually been established ('' if nothing yet).
  note: string;
}

// Keyed 'persona:Explore', 'solution:Define', ... — all 16 cells present.
export type GridState = Record<string, CellState>;

export function cellKey(dimension: DimensionCode, stage: Stage): string {
  return `${dimension}:${stage}`;
}

export const EMPTY_GRID: GridState = Object.fromEntries(
  DIMENSIONS.flatMap((d) => STAGES.map((s) => [cellKey(d.code, s), { density: 0, note: '' } as CellState]))
) as GridState;

// 100 Pathways brand palette (see globals.css for the full token set).
export const DIMENSION_COLORS: Record<DimensionCode, string> = {
  persona: '#ff6543', // coral
  solution: '#0099ff', // blue
  institution: '#1b1b42', // navy
  ecosystem: '#feda09', // yellow
};

export const DENSITY_SYMBOLS: Record<CellDensity, string> = {
  0: '○',
  1: '●',
  2: '●●',
  3: '●●●',
};

// Coverage-status semantic ported from the pre-revamp app's FaceStatus/
// STATUS_COLORS (main:lib/dimensions.ts) — reused for the dimension status
// chips (components/DimensionChips.tsx), which show ONE status per dimension
// (at the deployment's current stage) rather than the full 4×4 grid.
export type DimensionStatus = 'dark' | 'red' | 'amber' | 'green';

export const STATUS_COLORS: Record<DimensionStatus, string> = {
  dark: '#1A3A5C',
  red: '#D64045',
  amber: '#E8A838',
  green: '#3D8B37',
};

export function densityToStatus(density: CellDensity): DimensionStatus {
  return (['dark', 'red', 'amber', 'green'] as const)[density];
}

// Compact structural summary injected into prompts alongside the wiki's
// framework doc — gives the model the exact dimension codes, sub-category
// letters, and per-stage weights this app's JSON contract uses.
export function frameworkStructureLegend(): string {
  return DIMENSIONS.map((d) => {
    const subs = d.subCategories
      .map((s) => `  ${s.code}. ${s.name} — ${STAGES.map((st) => `${st}: ${s.weights[st]}`).join(', ')}`)
      .join('\n');
    return `${d.name} ("${d.code}") — ${d.centralQuestion}\n${subs}`;
  }).join('\n\n');
}
