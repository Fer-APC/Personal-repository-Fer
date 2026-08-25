import type { Goal, GoalWeights, Muscle, Pattern } from './types';

export const ALL_GOALS: Goal[] = ['hypertrophy', 'strength', 'calisthenics', 'endurance', 'longevity'];

export const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  calisthenics: 'Calisthenics',
  endurance: 'Resistance / endurance',
  longevity: 'Longevity',
};

export const GOAL_BLURB: Record<Goal, string> = {
  hypertrophy: 'Muscle size. Moderate reps, high total volume, short-ish rest.',
  strength: 'Maximal force. Heavy compounds, low reps, long rest.',
  calisthenics: 'Bodyweight mastery. Skill work first, ring and bar progressions.',
  endurance: 'Muscular stamina. High reps, short rest, circuit-friendly.',
  longevity: 'Joints, posture, balance. Moderate load, quality reps, low junk fatigue.',
};

export interface GoalProfile {
  compoundReps: [number, number];
  isolationReps: [number, number];
  /** Multiplier on the baseline set count per exercise. */
  setMultiplier: number;
  /** Multiplier on total weekly volume. */
  volumeMultiplier: number;
  restCompound: number;
  restIsolation: number;
  rpe: number;
  /** Per-muscle emphasis multipliers layered on the baseline targets. */
  muscleBias: Partial<Record<Muscle, number>>;
  /** Per-pattern preference used when scoring exercise candidates. */
  patternBias: Partial<Record<Pattern, number>>;
  /** Preference for bodyweight-loaded work. */
  bodyweightBias: number;
}

export const GOAL_PROFILES: Record<Goal, GoalProfile> = {
  hypertrophy: {
    compoundReps: [6, 10],
    isolationReps: [10, 15],
    setMultiplier: 1.1,
    volumeMultiplier: 1.15,
    restCompound: 150,
    restIsolation: 75,
    rpe: 8.5,
    muscleBias: { chest: 1.15, lats: 1.15, side_delts: 1.2, biceps: 1.2, triceps: 1.2, quads: 1.1, hamstrings: 1.1 },
    patternBias: { isolation: 1.15, horizontal_push: 1.05, vertical_pull: 1.05 },
    bodyweightBias: 0.9,
  },
  strength: {
    compoundReps: [3, 6],
    isolationReps: [6, 10],
    setMultiplier: 1.15,
    volumeMultiplier: 0.95,
    restCompound: 210,
    restIsolation: 120,
    rpe: 8,
    muscleBias: { quads: 1.2, glutes: 1.15, hamstrings: 1.1, lower_back: 1.2, chest: 1.1, upper_back: 1.15, forearms: 1.1 },
    patternBias: { squat: 1.35, hinge: 1.35, horizontal_push: 1.25, vertical_push: 1.15, horizontal_pull: 1.15, isolation: 0.7, carry: 1.15 },
    bodyweightBias: 0.75,
  },
  calisthenics: {
    compoundReps: [5, 10],
    isolationReps: [8, 14],
    setMultiplier: 1.0,
    volumeMultiplier: 1.0,
    restCompound: 165,
    restIsolation: 75,
    rpe: 8,
    muscleBias: { lats: 1.3, upper_back: 1.2, abs: 1.35, obliques: 1.2, triceps: 1.15, chest: 1.1, forearms: 1.25, rotator_cuff: 1.2 },
    patternBias: { skill: 2.2, vertical_pull: 1.35, vertical_push: 1.2, core: 1.3, isolation: 0.75, squat: 0.85 },
    bodyweightBias: 1.6,
  },
  endurance: {
    compoundReps: [12, 18],
    isolationReps: [15, 22],
    setMultiplier: 0.95,
    volumeMultiplier: 1.0,
    restCompound: 75,
    restIsolation: 45,
    rpe: 7.5,
    muscleBias: { calves: 1.1, hamstrings: 1.15, glutes: 1.15, abs: 1.15, upper_back: 1.1 },
    patternBias: { isolation: 1.05, lunge: 1.15, carry: 1.2, core: 1.15 },
    bodyweightBias: 1.15,
  },
  longevity: {
    compoundReps: [6, 12],
    isolationReps: [10, 15],
    setMultiplier: 0.9,
    volumeMultiplier: 0.85,
    restCompound: 120,
    restIsolation: 75,
    rpe: 7,
    muscleBias: {
      glutes: 1.3, hamstrings: 1.2, rear_delts: 1.35, rotator_cuff: 1.5, upper_back: 1.3,
      abs: 1.2, obliques: 1.25, lower_back: 1.2, calves: 1.2, adductors: 1.2, forearms: 1.2,
    },
    patternBias: { carry: 1.4, lunge: 1.25, core: 1.25, hinge: 1.1, isolation: 0.95 },
    bodyweightBias: 1.05,
  },
};

export const DEFAULT_GOALS: GoalWeights = {
  hypertrophy: 0.4,
  strength: 0.2,
  calisthenics: 0.15,
  endurance: 0.1,
  longevity: 0.15,
};

/** Renormalises raw slider values into weights summing to 1. */
export function normaliseGoals(raw: GoalWeights): GoalWeights {
  const total = ALL_GOALS.reduce((sum, g) => sum + Math.max(0, raw[g]), 0);
  if (total <= 0) return { ...DEFAULT_GOALS };
  const out = {} as GoalWeights;
  for (const g of ALL_GOALS) out[g] = Math.max(0, raw[g]) / total;
  return out;
}

function blendNumber(goals: GoalWeights, pick: (p: GoalProfile) => number): number {
  return ALL_GOALS.reduce((sum, g) => sum + goals[g] * pick(GOAL_PROFILES[g]), 0);
}

export interface BlendedPrescription {
  compoundReps: [number, number];
  isolationReps: [number, number];
  setMultiplier: number;
  volumeMultiplier: number;
  restCompound: number;
  restIsolation: number;
  rpe: number;
  bodyweightBias: number;
}

export function blendPrescription(goals: GoalWeights): BlendedPrescription {
  const round = (n: number) => Math.round(n);
  const cLow = blendNumber(goals, (p) => p.compoundReps[0]);
  const cHigh = blendNumber(goals, (p) => p.compoundReps[1]);
  const iLow = blendNumber(goals, (p) => p.isolationReps[0]);
  const iHigh = blendNumber(goals, (p) => p.isolationReps[1]);
  return {
    compoundReps: [Math.max(2, round(cLow)), Math.max(4, round(cHigh))],
    isolationReps: [Math.max(5, round(iLow)), Math.max(8, round(iHigh))],
    setMultiplier: blendNumber(goals, (p) => p.setMultiplier),
    volumeMultiplier: blendNumber(goals, (p) => p.volumeMultiplier),
    restCompound: round(blendNumber(goals, (p) => p.restCompound) / 15) * 15,
    restIsolation: round(blendNumber(goals, (p) => p.restIsolation) / 15) * 15,
    rpe: Math.round(blendNumber(goals, (p) => p.rpe) * 2) / 2,
    bodyweightBias: blendNumber(goals, (p) => p.bodyweightBias),
  };
}

export function blendedMuscleBias(goals: GoalWeights, muscle: Muscle): number {
  return ALL_GOALS.reduce(
    (sum, g) => sum + goals[g] * (GOAL_PROFILES[g].muscleBias[muscle] ?? 1),
    0,
  );
}

export function blendedPatternBias(goals: GoalWeights, pattern: Pattern): number {
  return ALL_GOALS.reduce(
    (sum, g) => sum + goals[g] * (GOAL_PROFILES[g].patternBias[pattern] ?? 1),
    0,
  );
}

/** How well an exercise's goalFit vector matches the user's goal blend. */
export function goalFitScore(fit: Partial<Record<Goal, number>>, goals: GoalWeights): number {
  return ALL_GOALS.reduce((sum, g) => sum + goals[g] * (fit[g] ?? 0.4), 0);
}

/** The goal with the largest weight — used to pick a split and label the week. */
export function dominantGoal(goals: GoalWeights): Goal {
  return ALL_GOALS.reduce((best, g) => (goals[g] > goals[best] ? g : best), ALL_GOALS[0]!);
}
