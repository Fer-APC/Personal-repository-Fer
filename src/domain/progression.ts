import { EXERCISE_BY_ID, progressionFamily } from './exercises';
import { weeksBetween } from './date';
import type { Exercise, Muscle, Profile, SessionLog } from './types';

export interface Performance {
  date: string;
  topWeightKg: number | null;
  minReps: number;
  maxReps: number;
  avgRpe: number | null;
  setsDone: number;
}

/** The most recent completed performance of an exercise. */
export function lastPerformance(logs: SessionLog[], exerciseId: string): Performance | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  for (const log of sorted) {
    for (const entry of log.exercises) {
      if (entry.exerciseId !== exerciseId) continue;
      const done = entry.sets.filter((s) => s.done && (s.reps ?? 0) > 0);
      if (done.length === 0) continue;
      const weights = done.map((s) => s.weightKg).filter((w): w is number => w != null && w > 0);
      const reps = done.map((s) => s.reps ?? 0);
      const rpes = done.map((s) => s.rpe).filter((r): r is number => r != null);
      return {
        date: log.date,
        topWeightKg: weights.length ? Math.max(...weights) : null,
        minReps: Math.min(...reps),
        maxReps: Math.max(...reps),
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
        setsDone: done.length,
      };
    }
  }
  return null;
}

function increment(exercise: Exercise): number {
  if (exercise.equipment.includes('barbell')) {
    return exercise.pattern === 'squat' || exercise.pattern === 'hinge' ? 5 : 2.5;
  }
  if (exercise.equipment.includes('dumbbell') || exercise.equipment.includes('kettlebell')) return 2;
  return 2.5;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Double progression: fill the rep range at a given load, then add load.
 * Bodyweight work progresses in reps until the ladder's next step is earned.
 */
export function suggestLoad(
  exercise: Exercise,
  logs: SessionLog[],
  repRange: [number, number],
  profile: Profile,
): { kg: number | null; note: string } {
  const last = lastPerformance(logs, exercise.id);
  const [low, high] = repRange;

  if (!last) {
    if (exercise.loadType === 'bodyweight' || exercise.loadType === 'time') {
      return { kg: null, note: 'First time logged — find a step you can hold clean form on and record it.' };
    }
    return { kg: null, note: 'No history yet — start at an easy weight and leave 2-3 reps in reserve.' };
  }

  if (exercise.loadType === 'time') {
    return { kg: null, note: `Last time: ${last.maxReps}s. Add 3-5s per set while form holds.` };
  }

  if (exercise.loadType === 'bodyweight' || exercise.loadType === 'assisted') {
    if (last.minReps >= high && (last.avgRpe ?? 8) <= 8.5) {
      const family = exercise.progression ? progressionFamily(exercise.progression) : [];
      const next = family.find((e) => (e.progressionStep ?? 0) > (exercise.progressionStep ?? 0));
      if (next) {
        return { kg: null, note: `You cleared ${last.minReps} clean reps — time to move up to ${next.name}.` };
      }
      return { kg: last.topWeightKg, note: `Top of the range at bodyweight — start adding external load.` };
    }
    return { kg: last.topWeightKg, note: `Last time: ${last.minReps}-${last.maxReps} reps. Aim for one more rep per set.` };
  }

  const weight = last.topWeightKg;
  if (weight == null) {
    return { kg: null, note: 'Log the weight this time so progression can be tracked.' };
  }
  const step = increment(exercise);
  if (last.minReps >= high && (last.avgRpe ?? 8) <= 8.5) {
    return { kg: roundTo(weight + step, 0.5), note: `Cleared ${high} reps at ${weight}${profile.units === 'kg' ? 'kg' : 'kg'} — add ${step}kg.` };
  }
  if (last.minReps < low || (last.avgRpe ?? 0) >= 9.5) {
    return { kg: roundTo(weight * 0.92, 0.5), note: `Last session was a grind (${last.minReps} reps) — back off ~8% and rebuild.` };
  }
  return { kg: weight, note: `Stay at ${weight}kg until every set reaches ${high} reps.` };
}

/** Sets actually completed per muscle in a week (primary 1, secondary 0.5). */
export function completedSetsByMuscle(logs: SessionLog[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const log of logs) {
    for (const entry of log.exercises) {
      const exercise = EXERCISE_BY_ID[entry.exerciseId];
      if (!exercise) continue;
      const sets = entry.sets.filter((s) => s.done).length;
      if (!sets) continue;
      for (const m of exercise.primary) out[m] = (out[m] ?? 0) + sets;
      for (const m of exercise.secondary) out[m] = (out[m] ?? 0) + sets * 0.5;
    }
  }
  return out;
}

/** Muscles the user reported sore in the last 10 days, at their worst rating. */
export function recentSoreness(logs: SessionLog[], today: string): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const log of logs) {
    const daysAgo = (new Date(today).getTime() - new Date(log.date).getTime()) / 86_400_000;
    if (daysAgo < 0 || daysAgo > 10) continue;
    for (const [muscle, value] of Object.entries(log.soreness) as [Muscle, number][]) {
      out[muscle] = Math.max(out[muscle] ?? 0, value);
    }
  }
  return out;
}

/** Volume a muscle came up short by, relative to last week's target. */
export function computeDeficits(
  lastWeekTargets: Partial<Record<Muscle, number>> | undefined,
  lastWeekLogs: SessionLog[],
): Partial<Record<Muscle, number>> {
  if (!lastWeekTargets) return {};
  const done = completedSetsByMuscle(lastWeekLogs);
  const out: Partial<Record<Muscle, number>> = {};
  for (const [muscle, target] of Object.entries(lastWeekTargets) as [Muscle, number][]) {
    const gap = target - (done[muscle] ?? 0);
    if (gap > 1) out[muscle] = gap;
  }
  return out;
}

const LADDER_CEILING = { beginner: 2, intermediate: 4, advanced: 5 } as const;

/**
 * Keeps calisthenics ladders near the user's actual level. Without history the
 * only limit is an experience ceiling — entry steps of a hard skill (a tuck
 * front lever) are a legitimate starting point for anyone. Once a family has
 * been logged, the window narrows to one step either side of the best effort,
 * so nobody gets prescribed incline push-ups after repping archer push-ups.
 */
export function ladderStepAllowed(exercise: Exercise, logs: SessionLog[], profile: Profile): boolean {
  if (!exercise.progression) return true;
  const step = exercise.progressionStep ?? 1;
  const logged = logs
    .flatMap((l) => l.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]))
    .filter((e): e is Exercise => !!e && e.progression === exercise.progression)
    .map((e) => e.progressionStep ?? 1);

  if (logged.length === 0) return step <= LADDER_CEILING[profile.experience];
  const best = Math.max(...logged);
  return step >= Math.max(1, best - 1) && step <= best + 1;
}

export interface DeloadDecision {
  deload: boolean;
  reason: string | null;
}

/**
 * Deload on the configured cadence, or early when the last three sessions all
 * came in at RPE 9+ — the usual sign that recovery is losing the race.
 */
export function decideDeload(
  profile: Profile,
  anchorWeek: string | null,
  weekStart: string,
  logs: SessionLog[],
): DeloadDecision {
  if (profile.deloadEveryWeeks > 0 && anchorWeek) {
    const index = weeksBetween(anchorWeek, weekStart);
    if (index > 0 && (index + 1) % profile.deloadEveryWeeks === 0) {
      return { deload: true, reason: `Scheduled deload (every ${profile.deloadEveryWeeks} weeks).` };
    }
  }
  const recent = [...logs]
    .filter((l) => l.completed && l.sessionRpe != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (recent.length === 3 && recent.every((l) => (l.sessionRpe ?? 0) >= 9)) {
    return { deload: true, reason: 'Last three sessions all came in at RPE 9+ — taking a lighter week.' };
  }
  return { deload: false, reason: null };
}
