import { ALL_MUSCLES, MUSCLE_REGION, RECOVERY_HOURS } from './muscles';
import { availableExercises } from './exercises';
import { blendPrescription, blendedPatternBias, goalFitScore } from './goals';
import { computeExternalLoad, type ExternalLoad } from './activities';
import { computeVolumeTargets } from './volume';
import { assignSplitToDays, chooseGymDays, chooseSplit, dayConstraints, describeDaySlots, type SplitDay } from './schedule';
import { computeDeficits, decideDeload, ladderStepAllowed, recentSoreness, suggestLoad } from './progression';
import { WEEKDAY_LABEL, addDays, dateOfWeekday } from './date';
import { MUSCLE_LABEL } from './muscles';
import { ACTIVITY_LABEL } from './activities';
import type {
  Activity, BalanceRow, DayStructure, Exercise, Muscle, Pattern, PlannedDay, PlannedExercise,
  Profile, SessionLog, WeekPlan, Weekday,
} from './types';

export const DEFAULT_STRUCTURE: DayStructure = {
  blocks: [
    { kind: 'single', size: 1 },
    { kind: 'single', size: 1 },
    { kind: 'single', size: 1 },
    { kind: 'superset', size: 2 },
    { kind: 'superset', size: 2 },
  ],
};

export function structureSize(structure: DayStructure): number {
  return structure.blocks.reduce((n, b) => n + b.size, 0);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlanInputs {
  profile: Profile;
  activities: Activity[];
  weekStart: string;
  logs: SessionLog[];
  /** Last week's targets, used to carry a volume deficit forward. */
  previousTargets?: Partial<Record<Muscle, number>>;
  /** First week the user ever planned — anchors the deload cadence. */
  anchorWeek?: string | null;
  seed?: number;
}

interface DayBuildState {
  kneeBudget: number;
  shoulderBudget: number;
  maxSystemic: number;
  chosen: Exercise[];
  unmetRequirements: Set<number>;
  /** Hard cap on lower-body exercises, from the split day's leg share. */
  lowerBodyAllowance: number;
}

const LOWER_PATTERNS: Pattern[] = ['squat', 'hinge', 'lunge'];

function isLowerBody(exercise: Exercise): boolean {
  if (LOWER_PATTERNS.includes(exercise.pattern)) return true;
  return exercise.primary.every((m) => MUSCLE_REGION[m] === 'legs');
}

function lowerBodyAllowance(legShare: number, slots: number): number {
  const raw = legShare * slots;
  return legShare >= 0.2 ? Math.ceil(raw) : Math.round(raw);
}

const SET_TIME_SECONDS = 20;

function repsForExercise(
  exercise: Exercise,
  compoundReps: [number, number],
  isolationReps: [number, number],
): [number, number] {
  if (exercise.loadType === 'time') return [20, 45];
  if (exercise.pattern === 'skill') return [4, 8];
  const isolationish = !exercise.compound || exercise.pattern === 'isolation' || exercise.pattern === 'core';
  return isolationish ? isolationReps : compoundReps;
}

function baseSets(exercise: Exercise, setMultiplier: number, deload: boolean): number {
  const base = exercise.compound && exercise.systemicCost >= 1.5 ? 4 : 3;
  const scaled = base * setMultiplier * (deload ? 0.7 : 1);
  return Math.max(2, Math.min(5, Math.round(scaled)));
}

function coverage(exercise: Exercise, sets: number): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const m of exercise.primary) out[m] = (out[m] ?? 0) + sets;
  for (const m of exercise.secondary) out[m] = (out[m] ?? 0) + sets * 0.5;
  return out;
}

function slotLabel(blockIndex: number, position: number, blockSize: number): string {
  const letter = String.fromCharCode(65 + blockIndex);
  return blockSize > 1 ? `${letter}${position + 1}` : letter;
}

/**
 * How far the hard constraints have been loosened to fill a slot. The planner
 * walks up this ladder rather than leaving a hole in the session.
 */
interface Relaxation {
  /** Allow exercises outside the day's leg share. */
  lowerBody: boolean;
  /** Score exercises the week no longer needs, on a small floor. */
  demandFloor: boolean;
  /** Allow exercises above the day's systemic-cost cap. */
  systemic: boolean;
}

const RELAXATION_LADDER: Relaxation[] = [
  { lowerBody: false, demandFloor: false, systemic: false },
  { lowerBody: false, demandFloor: true, systemic: false },
  { lowerBody: true, demandFloor: true, systemic: false },
  { lowerBody: true, demandFloor: true, systemic: true },
];

/** Marginal value of an exercise given what the day and week still need. */
function scoreExercise(
  exercise: Exercise,
  demand: Partial<Record<Muscle, number>>,
  ctx: {
    profile: Profile;
    template: SplitDay;
    state: DayBuildState;
    blockProgress: number; // 0 = first block, 1 = last block
    blockMates: Exercise[];
    usedThisWeek: Set<string>;
    usedLastWeek: Set<string>;
    /** Ladder family -> the step already used this week. */
    familyStepThisWeek: Map<string, number>;
    bodyweightBias: number;
    relax: Relaxation;
    rng: () => number;
  },
): number {
  const { profile, template, state, blockProgress, blockMates, relax } = ctx;

  if (exercise.systemicCost > state.maxSystemic && !relax.systemic) return -Infinity;
  if (state.chosen.some((e) => e.id === exercise.id)) return -Infinity;
  if (profile.excludedExercises.includes(exercise.id)) return -Infinity;
  if (exercise.primary.some((m) => profile.avoid.includes(m))) return -Infinity;
  if (profile.experience === 'beginner' && exercise.skill === 3) return -Infinity;
  if (
    !relax.lowerBody &&
    isLowerBody(exercise) &&
    state.chosen.filter(isLowerBody).length >= state.lowerBodyAllowance
  ) {
    return -Infinity;
  }

  let demandScore = 0;
  for (const m of exercise.primary) demandScore += (demand[m] ?? 0) * (template.emphasis[m] ?? 1);
  for (const m of exercise.secondary) demandScore += 0.5 * (demand[m] ?? 0) * (template.emphasis[m] ?? 1);
  if (demandScore <= 0) {
    if (!relax.demandFloor) return -Infinity;
    // Nothing is owed any more; fall back to the day's emphasis alone.
    demandScore = exercise.primary.reduce((sum, m) => sum + 0.2 * (template.emphasis[m] ?? 1), 0);
  }

  let score = demandScore;
  score *= 0.35 + goalFitScore(exercise.goalFit, profile.goals);
  score *= blendedPatternBias(profile.goals, exercise.pattern);

  // Heavy compounds belong at the start; isolation earns its place at the end.
  // Skill work is technical rather than heavy, but still needs a fresh nervous
  // system, so it is ordered like a compound.
  const wantsFreshness = exercise.compound || exercise.pattern === 'skill';
  score *= wantsFreshness ? 1.25 - 0.5 * blockProgress : 0.8 + 0.45 * blockProgress;

  if (exercise.loadType === 'bodyweight' || exercise.loadType === 'assisted') {
    score *= 0.6 + 0.4 * ctx.bodyweightBias;
  }
  if (exercise.skill === 3 && profile.experience === 'intermediate') score *= 0.7;

  // Joint budgets: exceeding what's left for the day makes it a bad pick.
  if (exercise.kneeStress > state.kneeBudget) score *= 0.15;
  if (exercise.shoulderStress > state.shoulderBudget) score *= 0.2;

  // Superset legality: never stack the same muscle, prefer opposing regions.
  if (blockMates.length > 0) {
    const mateMuscles = new Set(blockMates.flatMap((e) => e.primary));
    if (exercise.primary.some((m) => mateMuscles.has(m))) score *= 0.12;
    const mateRegions = new Set(blockMates.flatMap((e) => e.primary.map((m) => MUSCLE_REGION[m])));
    const ownRegions = new Set(exercise.primary.map((m) => MUSCLE_REGION[m]));
    const opposed =
      (mateRegions.has('push') && ownRegions.has('pull')) ||
      (mateRegions.has('pull') && ownRegions.has('push')) ||
      (mateRegions.has('legs') && (ownRegions.has('push') || ownRegions.has('pull')));
    if (opposed) score *= 1.3;
    if (exercise.systemicCost >= 2.2) score *= 0.3; // don't pair two spine-loading lifts
  }

  // Requirement urgency: guarantee movement-pattern coverage before variety.
  const meetsRequirement = [...state.unmetRequirements].some((i) =>
    template.required[i]?.includes(exercise.pattern),
  );
  if (meetsRequirement) score *= 1.9;

  if (exercise.progression) {
    // One rung per ladder per session, and per week — mixing scapular pull-ups
    // into a week of chin-ups just muddies the progression signal.
    if (state.chosen.some((e) => e.progression === exercise.progression)) score *= 0.25;
    const weekStep = ctx.familyStepThisWeek.get(exercise.progression);
    if (weekStep != null && weekStep !== (exercise.progressionStep ?? 1)) score *= 0.25;
  }

  if (ctx.usedThisWeek.has(exercise.id)) score *= 0.6;
  if (ctx.usedLastWeek.has(exercise.id)) score *= 0.82 + 0.18 * profile.goals.strength;

  return score * (0.94 + 0.12 * ctx.rng());
}

function estimateMinutes(exercises: PlannedExercise[]): number {
  let seconds = 8 * 60; // warm-up
  for (const ex of exercises) {
    const avgReps = (ex.repRange[0] + ex.repRange[1]) / 2;
    seconds += ex.sets * (SET_TIME_SECONDS + avgReps * 3 + ex.restSec);
  }
  return Math.round(seconds / 60);
}

/** Drops sets from the tail of the session until it fits the time budget. */
function fitToTimeBudget(exercises: PlannedExercise[], budgetMinutes: number, notes: string[]): void {
  let guard = 0;
  while (estimateMinutes(exercises) > budgetMinutes + 8 && guard < 40) {
    guard++;
    const trimmable = [...exercises].reverse().find((e) => e.sets > 2);
    if (!trimmable) break;
    trimmable.sets -= 1;
  }
  if (guard > 0) {
    notes.push(`Trimmed ${guard} set${guard > 1 ? 's' : ''} to keep the session near your ${budgetMinutes} minute budget.`);
  }
}

export function generateWeekPlan(input: PlanInputs): WeekPlan {
  const { profile, activities, weekStart, logs } = input;
  const rng = mulberry32(input.seed ?? 1);
  const load: ExternalLoad = computeExternalLoad(activities);
  const prescription = blendPrescription(profile.goals);

  const lastWeekStart = addDays(weekStart, -7);
  const pastLogs = logs.filter((l) => l.weekStart < weekStart);
  const previousWeekLogs = logs.filter((l) => l.weekStart === lastWeekStart);
  const deloadDecision = decideDeload(profile, input.anchorWeek ?? null, weekStart, pastLogs);
  const soreness = recentSoreness(logs, weekStart);
  const deficits = computeDeficits(input.previousTargets, previousWeekLogs);

  const volume = computeVolumeTargets({
    profile,
    load,
    deficits,
    soreness,
    deload: deloadDecision.deload,
  });

  const gymDays = chooseGymDays(profile, load);
  const slots = describeDaySlots(gymDays, load);
  const split = chooseSplit(profile, load);
  const assignment = assignSplitToDays(split, slots);

  const pool = availableExercises(profile.equipment).filter((e) => ladderStepAllowed(e, logs, profile));
  const warnings: string[] = [];
  const reasoning: string[] = [];

  if (gymDays.length < profile.daysPerWeek) {
    warnings.push(
      `You asked for ${profile.daysPerWeek} gym days but only ${gymDays.length} weekday${gymDays.length === 1 ? ' is' : 's are'} marked available.`,
    );
  }

  // Demand vector consumed as the week is built.
  const remaining: Partial<Record<Muscle, number>> = { ...volume.target };
  /** Sets where the muscle is the target. */
  const plannedPrimaryByMuscle: Partial<Record<Muscle, number>> = {};
  /** Sets where the muscle only assists. */
  const plannedAssistByMuscle: Partial<Record<Muscle, number>> = {};
  const usedThisWeek = new Set<string>();
  const familyStepThisWeek = new Map<string, number>();
  const usedLastWeek = new Set<string>(
    previousWeekLogs.flatMap((l) => l.exercises.map((e) => e.exerciseId)),
  );
  /** weekday -> muscles hit hard, for recovery spacing inside the week. */
  const hitOn: { weekday: Weekday; muscles: Muscle[] }[] = [];

  const days: PlannedDay[] = assignment.map(({ slot, template }, dayIndex) => {
    const constraints = dayConstraints(slot, load);
    const structure = profile.structures[dayIndex] ?? DEFAULT_STRUCTURE;
    const notes = [...constraints.notes];
    const state: DayBuildState = {
      kneeBudget: constraints.kneeBudget,
      shoulderBudget: constraints.shoulderBudget,
      maxSystemic: constraints.maxSystemic,
      chosen: [],
      unmetRequirements: new Set(template.required.map((_, i) => i)),
      lowerBodyAllowance: lowerBodyAllowance(template.legShare, structureSize(structure)),
    };

    // Day demand = weekly demand, shaped by emphasis, recovery and today's sport.
    const dayDemand: Partial<Record<Muscle, number>> = {};
    for (const muscle of ALL_MUSCLES) {
      let value = remaining[muscle] ?? 0;
      for (const hit of hitOn) {
        const hoursSince = (slot.weekday - hit.weekday) * 24;
        if (hoursSince > 0 && hoursSince < RECOVERY_HOURS[muscle] && hit.muscles.includes(muscle)) {
          value *= 0.3;
        }
      }
      const sameDaySport = load.byDay[slot.weekday][muscle] ?? 0;
      if (sameDaySport > 0.3) value *= 0.55;
      dayDemand[muscle] = value;
    }

    const totalSlots = structureSize(structure);
    const exercises: PlannedExercise[] = [];
    let filled = 0;

    structure.blocks.forEach((block, blockIndex) => {
      const blockMates: Exercise[] = [];
      const isSuperset = block.size > 1;
      for (let position = 0; position < block.size; position++) {
        const blockProgress = totalSlots > 1 ? filled / (totalSlots - 1) : 0;
        const remainingSlots = totalSlots - filled;
        // With few slots left, only exercises covering an unmet pattern qualify.
        const mustCover = remainingSlots <= state.unmetRequirements.size;

        let best: Exercise | null = null;
        for (const relax of RELAXATION_LADDER) {
          for (const requireCoverage of mustCover ? [true, false] : [false]) {
            let bestScore = -Infinity;
            for (const candidate of pool) {
              if (requireCoverage) {
                const covers = [...state.unmetRequirements].some((i) =>
                  template.required[i]?.includes(candidate.pattern),
                );
                if (!covers) continue;
              }
              const score = scoreExercise(candidate, dayDemand, {
                profile,
                template,
                state,
                blockProgress,
                blockMates,
                usedThisWeek,
                usedLastWeek,
                familyStepThisWeek,
                bodyweightBias: prescription.bodyweightBias,
                relax,
                rng,
              });
              if (score > bestScore) {
                bestScore = score;
                best = candidate;
              }
            }
            if (best) break;
          }
          if (best) break;
        }
        if (!best) continue;

        const sets = baseSets(best, prescription.setMultiplier, deloadDecision.deload);
        const repRange = repsForExercise(best, prescription.compoundReps, prescription.isolationReps);
        const isLastOfBlock = position === block.size - 1;
        const restSec = isSuperset && !isLastOfBlock
          ? 20
          : best.compound
            ? prescription.restCompound
            : prescription.restIsolation;
        const rpe = Math.max(6, prescription.rpe - (deloadDecision.deload ? 1.5 : 0));

        const rationale = buildRationale(best, dayDemand, template);
        exercises.push({
          exerciseId: best.id,
          slot: slotLabel(blockIndex, position, block.size),
          blockIndex,
          sets,
          repRange,
          restSec,
          rpe,
          load: suggestLoad(best, logs, repRange, profile),
          rationale,
        });

        // Consume budgets and demand.
        state.chosen.push(best);
        blockMates.push(best);
        state.kneeBudget -= best.kneeStress;
        state.shoulderBudget -= best.shoulderStress;
        for (const [i, patterns] of template.required.entries()) {
          if (patterns.includes(best.pattern)) state.unmetRequirements.delete(i);
        }
        usedThisWeek.add(best.id);
        if (best.progression && !familyStepThisWeek.has(best.progression)) {
          familyStepThisWeek.set(best.progression, best.progressionStep ?? 1);
        }
        for (const [muscle, amount] of Object.entries(coverage(best, sets)) as [Muscle, number][]) {
          remaining[muscle] = Math.max(0, (remaining[muscle] ?? 0) - amount);
          dayDemand[muscle] = Math.max(0, (dayDemand[muscle] ?? 0) - amount * 1.6);
        }
        for (const muscle of best.primary) {
          plannedPrimaryByMuscle[muscle] = (plannedPrimaryByMuscle[muscle] ?? 0) + sets;
        }
        for (const muscle of best.secondary) {
          plannedAssistByMuscle[muscle] = (plannedAssistByMuscle[muscle] ?? 0) + sets;
        }
        filled++;
      }
    });

    hitOn.push({
      weekday: slot.weekday,
      muscles: state.chosen.flatMap((e) => e.primary),
    });

    fitToTimeBudget(exercises, profile.sessionMinutes, notes);

    const sameDayActivities = activities.filter((a) => a.day === slot.weekday);
    for (const activity of sameDayActivities) {
      notes.push(`Same day as ${ACTIVITY_LABEL[activity.type].toLowerCase()} (${activity.durationMin} min) — lift first if you can, or leave 6 hours between.`);
    }

    const emphasis = topMuscles(state.chosen, 4);
    return {
      date: dateOfWeekday(weekStart, slot.weekday),
      weekday: slot.weekday,
      title: template.title,
      emphasis,
      exercises,
      estimatedMinutes: estimateMinutes(exercises),
      notes,
    } satisfies PlannedDay;
  });

  const balance = buildBalance(volume.target, plannedPrimaryByMuscle, plannedAssistByMuscle, volume.credit);
  const ratios = computeRatios(plannedPrimaryByMuscle);

  // Warnings the user can act on.
  const missing = balance.filter((b) => b.status === 'missing').map((b) => MUSCLE_LABEL[b.muscle]);
  if (missing.length) {
    warnings.push(`Nothing directly targets: ${missing.join(', ')}. Add an exercise slot or a third day if that matters to you.`);
  }
  if (ratios.pushPull > 1.35) warnings.push('Push volume is running well ahead of pull volume this week.');
  if (ratios.pushPull < 0.7) warnings.push('Pull volume is running well ahead of push volume this week.');

  const totalTarget = Object.values(volume.target).reduce((a, b) => a + b, 0);
  const totalPlanned = balance.reduce((sum, row) => sum + row.planned + row.assist * 0.5, 0);
  if (totalPlanned < totalTarget * 0.75) {
    warnings.push(
      `Your structure fits about ${Math.round((totalPlanned / totalTarget) * 100)}% of the weekly volume your goals suggest. More exercises per day, or a third day, would close the gap.`,
    );
  }

  reasoning.push(
    `Gym on ${gymDays.map((d) => WEEKDAY_LABEL[d]).join(', ')} — chosen to sit as far as possible from your ${describeActivities(activities)}.`,
  );
  reasoning.push(`Split: ${split.name}. ${splitReason(split.name, load)}`);
  reasoning.push(...volume.notes);
  if (deloadDecision.reason) reasoning.push(deloadDecision.reason);

  return {
    weekStart,
    generatedAt: new Date().toISOString(),
    deload: deloadDecision.deload,
    splitName: split.name,
    days,
    balance,
    ratios,
    warnings,
    reasoning,
  };
}

function describeActivities(activities: Activity[]): string {
  if (activities.length === 0) return 'week';
  const parts = activities.map((a) => `${ACTIVITY_LABEL[a.type].toLowerCase()} on ${WEEKDAY_LABEL[a.day]}`);
  return parts.join(' and ');
}

function splitReason(name: string, load: ExternalLoad): string {
  if (name.startsWith('Upper /')) return 'Legs get one session because running and volley already cover most of their weekly load.';
  if (name.startsWith('Upper+')) return 'Two days is tight, so the legs get hinge work only and the sport handles the rest.';
  if (name.startsWith('Pull /')) return 'Skill work leads each session while you are fresh.';
  if (name.startsWith('Lower /')) return 'A dedicated lower day keeps the heavy compounds away from your run days.';
  if (load.volleyMinutes > 0) return 'Full-body sessions keep frequency high without long recovery debts before volley.';
  return 'Full-body sessions hit every muscle multiple times a week.';
}

function topMuscles(exercises: Exercise[], count: number): Muscle[] {
  const tally: Partial<Record<Muscle, number>> = {};
  for (const e of exercises) {
    for (const m of e.primary) tally[m] = (tally[m] ?? 0) + 1;
    for (const m of e.secondary) tally[m] = (tally[m] ?? 0) + 0.4;
  }
  return (Object.entries(tally) as [Muscle, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([m]) => m);
}

function buildRationale(exercise: Exercise, demand: Partial<Record<Muscle, number>>, template: SplitDay): string {
  const driver = [...exercise.primary].sort((a, b) => (demand[b] ?? 0) - (demand[a] ?? 0))[0];
  const emphasised = driver && (template.emphasis[driver] ?? 1) > 1.1;
  const base = driver ? `Covers ${MUSCLE_LABEL[driver].toLowerCase()}` : 'Rounds out the session';
  const why = emphasised ? ', the day’s emphasis' : ', the biggest remaining gap this week';
  return exercise.notes ? `${base}${why}. ${exercise.notes}` : `${base}${why}.`;
}

/**
 * Muscles that inevitably collect volume as assistants. Flagging them as
 * "over" on every plan would be noise, so they need a bigger overshoot.
 */
const PASSTHROUGH: Muscle[] = ['front_delts', 'forearms', 'hip_flexors', 'lower_back', 'traps', 'abs'];

function buildBalance(
  target: Record<Muscle, number>,
  direct: Partial<Record<Muscle, number>>,
  assist: Partial<Record<Muscle, number>>,
  credit: Record<Muscle, number>,
): BalanceRow[] {
  return ALL_MUSCLES.map((muscle) => {
    const t = target[muscle] ?? 0;
    const d = direct[muscle] ?? 0;
    const a = assist[muscle] ?? 0;
    const effective = d + a * 0.5;
    const overFactor = PASSTHROUGH.includes(muscle) ? 2.2 : 1.3;
    let status: BalanceRow['status'];
    if (effective === 0 && t >= 2) status = 'missing';
    else if (effective > t * overFactor) status = 'over';
    else if (effective >= t * 0.85) status = 'on';
    else status = 'under';
    return { muscle, target: t, planned: d, assist: a, externalCredit: credit[muscle] ?? 0, status };
  });
}

function computeRatios(planned: Partial<Record<Muscle, number>>): { pushPull: number; upperLower: number } {
  let push = 0;
  let pull = 0;
  let upper = 0;
  let lowerTotal = 0;
  for (const muscle of ALL_MUSCLES) {
    const value = planned[muscle] ?? 0;
    const region = MUSCLE_REGION[muscle];
    if (region === 'push') { push += value; upper += value; }
    if (region === 'pull') { pull += value; upper += value; }
    if (region === 'legs') lowerTotal += value;
  }
  return {
    pushPull: pull > 0 ? Math.round((push / pull) * 100) / 100 : 0,
    upperLower: lowerTotal > 0 ? Math.round((upper / lowerTotal) * 100) / 100 : 0,
  };
}

/** Re-exported so the UI can show the same targets the planner used. */
export function weekTargets(profile: Profile, activities: Activity[]): Record<Muscle, number> {
  return computeVolumeTargets({ profile, load: computeExternalLoad(activities) }).target;
}
