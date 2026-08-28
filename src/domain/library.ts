import { EXERCISES, availableExercises, progressionFamily } from './exercises';
import { ALL_MUSCLES, MUSCLE_LABEL, MUSCLE_REGION, type Region } from './muscles';
import { GOAL_LABEL, dominantGoal, goalFitScore } from './goals';
import { ladderStepAllowed } from './progression';
import type { Equipment, Exercise, Muscle, Profile, SessionLog, WeekPlan } from './types';

export interface ExerciseRating {
  exercise: Exercise;
  /** How much muscle one set buys, 0-1. */
  breadth: number;
  /** Fit against the current goal blend, 0-1. */
  goalFit: number;
  /** How long you can keep progressing on it before it runs out, 0-1. */
  headroom: number;
  /** How much this week still wants the muscle it targets, 0-1. */
  need: number;
  score: number;
  tier: 'staple' | 'solid' | 'accessory';
  /** Plain-language justification, strongest first. */
  reasons: string[];
}

/**
 * How much of the body one set trains. A squat pays for six muscles; a leg
 * extension pays for one. Five is about the practical ceiling.
 */
function breadthOf(exercise: Exercise): number {
  return Math.min(1, (exercise.primary.length + exercise.secondary.length * 0.5) / 5);
}

/**
 * Room left to keep getting stronger on it. Externally loaded lifts never run
 * out — you add weight. Bodyweight work runs out when the hardest step of its
 * ladder is clean, unless it can be weighted.
 */
function headroomOf(exercise: Exercise, logs: SessionLog[], profile: Profile): number {
  if (exercise.loadType === 'external') return 1;
  if (exercise.loadType === 'assisted') return 0.65;
  if (exercise.progression) {
    const family = progressionFamily(exercise.progression);
    const step = exercise.progressionStep ?? 1;
    const harder = family.filter((e) => (e.progressionStep ?? 1) > step && ladderStepAllowed(e, logs, profile));
    return Math.min(1, 0.5 + harder.length * 0.15);
  }
  return exercise.loadType === 'time' ? 0.5 : 0.45;
}

/** Muscles this week is short of, as a 0-1 pull per muscle. */
function needByMuscle(plan: WeekPlan | undefined): Partial<Record<Muscle, number>> {
  if (!plan) return {};
  const out: Partial<Record<Muscle, number>> = {};
  for (const row of plan.balance) {
    if (row.target <= 0) continue;
    const covered = (row.planned + row.assist * 0.5) / row.target;
    out[row.muscle] = Math.max(0, Math.min(1, 1 - covered));
  }
  return out;
}

function reasonsFor(rating: Omit<ExerciseRating, 'reasons' | 'tier'>, profile: Profile, need: Partial<Record<Muscle, number>>): string[] {
  const { exercise } = rating;
  const reasons: string[] = [];
  const muscles = exercise.primary.length + exercise.secondary.length;

  // Lead with why it suits this person, then what it buys, then how long it lasts.
  if (rating.goalFit >= 0.8) {
    reasons.push(`Strong fit for ${GOAL_LABEL[dominantGoal(profile.goals)].toLowerCase()}`);
  } else if (rating.goalFit >= 0.65) {
    reasons.push('Well matched to your goal mix');
  }

  if (rating.breadth >= 0.7) {
    reasons.push(`Trains ${muscles} muscles in one movement`);
  } else if (rating.breadth <= 0.25) {
    reasons.push(`Isolates ${MUSCLE_LABEL[exercise.primary[0] ?? 'chest'].toLowerCase()} — useful to top up, not to build a session on`);
  }

  if (rating.headroom >= 0.95) {
    reasons.push('Loads forever — you progress by adding weight');
  } else if (exercise.progression && rating.headroom >= 0.65) {
    reasons.push('Has harder steps above it to grow into');
  } else if (rating.headroom <= 0.5) {
    reasons.push('Runs out of progression once it feels easy');
  }

  const short = exercise.primary.filter((m) => (need[m] ?? 0) > 0.3);
  if (short.length > 0) {
    reasons.push(`Covers ${short.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(' and ')}, which your week is short on`);
  }

  if (exercise.notes) reasons.push(exercise.notes);
  return reasons;
}

export interface RateOptions {
  profile: Profile;
  logs: SessionLog[];
  /** The current week, so "what you need now" can weigh in. */
  plan?: WeekPlan;
  /** Restrict to what the gym actually has. */
  onlyAvailableEquipment?: boolean;
}

/** Rates every exercise that targets `muscle`, best first. */
export function rateExercisesFor(muscle: Muscle, options: RateOptions): ExerciseRating[] {
  const { profile, logs, plan } = options;
  const need = needByMuscle(plan);
  const pool = options.onlyAvailableEquipment === false ? EXERCISES : availableExercises(profile.equipment);

  const rated = pool
    .filter((exercise) => exercise.primary.includes(muscle))
    .map((exercise) => {
      const breadth = breadthOf(exercise);
      const goalFit = goalFitScore(exercise.goalFit, profile.goals);
      const headroom = headroomOf(exercise, logs, profile);
      const muscleNeed = Math.max(...exercise.primary.map((m) => need[m] ?? 0), 0);
      // Goal fit leads: the best side-delt movement is a lateral raise, not
      // whichever exercise happens to list the most muscles. Breadth breaks
      // ties in favour of movements that pay for more of the body per set.
      const score = goalFit * 0.55 + headroom * 0.2 + breadth * 0.15 + muscleNeed * 0.1;
      const base = { exercise, breadth, goalFit, headroom, need: muscleNeed, score };
      return { ...base, reasons: reasonsFor(base, profile, need), tier: 'accessory' as const };
    })
    .sort((a, b) => b.score - a.score);

  // Tiers are relative to the muscle: the best chest movement and the best
  // rotator cuff movement are both staples of their own group.
  return rated.map((rating, index) => ({
    ...rating,
    tier: index < 2 && rating.score >= 0.55 ? 'staple' : index < 5 ? 'solid' : 'accessory',
  }));
}

export interface MuscleSection {
  muscle: Muscle;
  region: Region;
  ratings: ExerciseRating[];
}

/** The whole library, grouped by the muscle each exercise primarily targets. */
export function buildLibrary(options: RateOptions & { region?: Region | 'all'; query?: string }): MuscleSection[] {
  const needle = options.query?.trim().toLowerCase() ?? '';
  return ALL_MUSCLES
    .filter((muscle) => options.region === undefined || options.region === 'all' || MUSCLE_REGION[muscle] === options.region)
    .map((muscle) => ({
      muscle,
      region: MUSCLE_REGION[muscle],
      ratings: rateExercisesFor(muscle, options).filter(
        ({ exercise }) =>
          !needle ||
          exercise.name.toLowerCase().includes(needle) ||
          MUSCLE_LABEL[muscle].toLowerCase().includes(needle),
      ),
    }))
    .filter((section) => section.ratings.length > 0);
}

/**
 * What to do instead when the equipment is taken: same muscles, different
 * implement, ranked the same way and never needing the same station.
 */
export function standInsFor(exercise: Exercise, options: RateOptions, limit = 6): ExerciseRating[] {
  // If the station is taken, every piece it uses is unavailable — suggesting a
  // dumbbell bench press when the bench is occupied helps nobody. Only
  // bodyweight is always free.
  const contested = new Set<Equipment>(exercise.equipment.filter((e) => e !== 'bodyweight'));

  /**
   * How much of what the original trains the candidate actually replaces.
   * Sharing one muscle out of two is not a substitute: an overhead press is no
   * stand-in for an incline chest press just because both hit the front delt.
   */
  const overlap = (candidate: Exercise): number => {
    const covered = exercise.primary.reduce(
      (sum, muscle) =>
        sum + (candidate.primary.includes(muscle) ? 1 : candidate.secondary.includes(muscle) ? 0.5 : 0),
      0,
    );
    return covered / Math.max(1, exercise.primary.length);
  };

  return exercise.primary
    .flatMap((muscle) => rateExercisesFor(muscle, options))
    .filter((rating) => rating.exercise.id !== exercise.id)
    .filter((rating) => !rating.exercise.equipment.some((e) => contested.has(e)))
    .filter((rating, index, all) => all.findIndex((r) => r.exercise.id === rating.exercise.id) === index)
    .filter((rating) => overlap(rating.exercise) >= 0.5)
    // Doing the same kind of movement matters as much as hitting the same
    // muscles: if the pulldown station is busy, the answer is pull-ups, not a
    // row that happens to score well.
    .sort((a, b) => standInRank(b) - standInRank(a))
    // Four rungs of the same ladder are one option, not four. Keep the
    // best-suited rung and spend the rest of the list on real variety.
    .filter((rating, index, all) => {
      const family = rating.exercise.progression;
      return !family || all.findIndex((r) => r.exercise.progression === family) === index;
    })
    .slice(0, limit);

  function standInRank(rating: ExerciseRating): number {
    const samePattern = rating.exercise.pattern === exercise.pattern ? 0.25 : 0;
    return overlap(rating.exercise) * 0.4 + rating.score * 0.4 + samePattern;
  }
}
