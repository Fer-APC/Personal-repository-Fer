import { ALL_MUSCLES } from './muscles';
import { blendedMuscleBias, blendPrescription } from './goals';
import { legLoadIndex, overheadIndex, type ExternalLoad } from './activities';
import type { Muscle, Profile } from './types';

/** Weekly hard sets an intermediate lifter can productively take per muscle. */
const BASE_TARGETS: Record<Muscle, number> = {
  chest: 12, front_delts: 4, side_delts: 9, rear_delts: 8, rotator_cuff: 3,
  lats: 11, upper_back: 10, traps: 5, lower_back: 5,
  biceps: 8, triceps: 9, forearms: 4,
  quads: 11, hamstrings: 10, glutes: 9, adductors: 4, calves: 8,
  abs: 8, obliques: 6, hip_flexors: 2,
};

const EXPERIENCE_FACTOR = { beginner: 0.7, intermediate: 1, advanced: 1.15 } as const;

/**
 * How much a muscle's target moves with external sport load.
 * Negative shrinks the gym target (the sport already taxes it), positive grows
 * it (the sport creates an imbalance the gym should offset).
 */
const LEG_LOAD_RESPONSE: Partial<Record<Muscle, number>> = {
  calves: -0.55, quads: -0.4, hip_flexors: -0.5, hamstrings: -0.1, glutes: -0.05,
  adductors: 0.15, lower_back: -0.2,
};

const OVERHEAD_RESPONSE: Partial<Record<Muscle, number>> = {
  front_delts: -0.45, side_delts: -0.2, rear_delts: 0.35, rotator_cuff: 0.6,
  upper_back: 0.15, obliques: -0.1, abs: -0.1,
};

export interface VolumeTargets {
  target: Record<Muscle, number>;
  /** Set-equivalents the sport already supplies, for the balance report. */
  credit: Record<Muscle, number>;
  notes: string[];
}

export interface VolumeInputs {
  profile: Profile;
  load: ExternalLoad;
  /** Sets a muscle came up short last week; partially carried forward. */
  deficits?: Partial<Record<Muscle, number>>;
  /** Reported soreness 0-3 from the most recent sessions. */
  soreness?: Partial<Record<Muscle, number>>;
  deload?: boolean;
}

export function computeVolumeTargets(input: VolumeInputs): VolumeTargets {
  const { profile, load } = input;
  const legs = legLoadIndex(load);
  const overhead = overheadIndex(load);
  const prescription = blendPrescription(profile.goals);
  const experience = EXPERIENCE_FACTOR[profile.experience];
  const avoid = new Set(profile.avoid);
  const notes: string[] = [];

  const target = {} as Record<Muscle, number>;
  const credit = {} as Record<Muscle, number>;

  for (const muscle of ALL_MUSCLES) {
    if (avoid.has(muscle)) {
      target[muscle] = 0;
      credit[muscle] = 0;
      continue;
    }
    let value = BASE_TARGETS[muscle] * experience * prescription.volumeMultiplier;
    value *= blendedMuscleBias(profile.goals, muscle);
    value *= 1 + (LEG_LOAD_RESPONSE[muscle] ?? 0) * legs;
    value *= 1 + (OVERHEAD_RESPONSE[muscle] ?? 0) * overhead;

    const sore = input.soreness?.[muscle] ?? 0;
    if (sore >= 2) value *= sore >= 3 ? 0.6 : 0.8;

    const deficit = input.deficits?.[muscle] ?? 0;
    if (deficit > 0) value += Math.min(4, deficit * 0.4);

    if (input.deload) value *= 0.55;

    target[muscle] = Math.max(0, Math.round(value * 2) / 2);
    // Sport fatigue counts as partial stimulus for endurance-ish qualities only.
    credit[muscle] = Math.round((load.perMuscle[muscle] ?? 0) * 2 * 2) / 2;
  }

  if (legs > 0.35) {
    notes.push(
      `Running and volley are already loading your legs (${Math.round(legs * 100)}% of the ceiling), so calf and quad targets are trimmed and hamstring/glute work is kept as protection.`,
    );
  }
  if (overhead > 0.3) {
    notes.push(
      `Overhead sport load from volley is high, so vertical pressing is reduced and rear delt / rotator cuff volume is raised to balance the shoulder.`,
    );
  }
  if (input.deload) notes.push('Deload week — volume cut by ~45% and target RPE dropped a point.');

  return { target, credit, notes };
}

/** Rough number of working sets a week of gym time can actually hold. */
export function weeklyCapacity(profile: Profile, avgSetsPerExercise: number): number {
  const exercisesPerDay = profile.structures
    .slice(0, profile.daysPerWeek)
    .reduce((sum, s) => sum + s.blocks.reduce((n, b) => n + b.size, 0), 0);
  return exercisesPerDay * avgSetsPerExercise;
}
