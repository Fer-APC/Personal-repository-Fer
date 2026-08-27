import { ALL_MUSCLES, LOWER, MUSCLE_REGION } from './muscles';
import { dominantGoal } from './goals';
import { legLoadIndex, overheadIndex, type ExternalLoad } from './activities';
import { WEEKDAY_LABEL } from './date';
import type { Muscle, Pattern, Profile, Weekday } from './types';

export interface SplitDay {
  key: string;
  title: string;
  /** Per-muscle priority multipliers; missing muscles use 1. */
  emphasis: Partial<Record<Muscle, number>>;
  /** Patterns the day should contain at least one of, in priority order. */
  required: Pattern[][];
  /** Fraction of the day's exercises that should be lower body. */
  legShare: number;
}

const suppress = (muscles: Muscle[], factor: number): Partial<Record<Muscle, number>> =>
  Object.fromEntries(muscles.map((m) => [m, factor]));

const boost = (muscles: Muscle[], factor: number): Partial<Record<Muscle, number>> =>
  Object.fromEntries(muscles.map((m) => [m, factor]));

const PUSH: Muscle[] = ALL_MUSCLES.filter((m) => MUSCLE_REGION[m] === 'push');
const PULL: Muscle[] = ALL_MUSCLES.filter((m) => MUSCLE_REGION[m] === 'pull');

const fullBodyA: SplitDay = {
  key: 'full_a',
  title: 'Full body A — squat & horizontal',
  emphasis: { quads: 1.35, glutes: 1.2, chest: 1.25, upper_back: 1.25, triceps: 1.1, biceps: 1.05 },
  required: [['squat', 'lunge'], ['horizontal_push'], ['horizontal_pull'], ['hinge', 'core']],
  legShare: 0.4,
};

const fullBodyB: SplitDay = {
  key: 'full_b',
  title: 'Full body B — hinge & vertical',
  emphasis: { hamstrings: 1.4, glutes: 1.25, lats: 1.3, front_delts: 1.2, side_delts: 1.15, abs: 1.15 },
  required: [['hinge'], ['vertical_pull'], ['vertical_push'], ['lunge', 'squat', 'core']],
  legShare: 0.35,
};

const fullBodyC: SplitDay = {
  key: 'full_c',
  title: 'Full body C — unilateral & carry',
  emphasis: { glutes: 1.3, adductors: 1.3, obliques: 1.3, rear_delts: 1.2, rotator_cuff: 1.2, forearms: 1.2, calves: 1.15 },
  required: [['lunge', 'squat'], ['horizontal_pull', 'vertical_pull'], ['horizontal_push', 'vertical_push'], ['carry', 'core']],
  legShare: 0.35,
};

const upperA: SplitDay = {
  key: 'upper_a',
  title: 'Upper body A — press focus',
  emphasis: { ...suppress(LOWER, 0.12), chest: 1.35, triceps: 1.25, side_delts: 1.2, upper_back: 1.15, lats: 1.1 },
  required: [['horizontal_push'], ['horizontal_pull', 'vertical_pull'], ['vertical_push', 'isolation'], ['core']],
  legShare: 0.05,
};

const upperB: SplitDay = {
  key: 'upper_b',
  title: 'Upper body B — pull focus',
  emphasis: { ...suppress(LOWER, 0.12), lats: 1.4, upper_back: 1.3, biceps: 1.25, rear_delts: 1.3, rotator_cuff: 1.2 },
  required: [['vertical_pull'], ['horizontal_pull'], ['horizontal_push', 'vertical_push'], ['core']],
  legShare: 0.05,
};

const lower: SplitDay = {
  key: 'lower',
  title: 'Lower body & core',
  emphasis: { ...suppress([...PUSH, ...PULL], 0.25), quads: 1.4, hamstrings: 1.4, glutes: 1.35, calves: 1.2, adductors: 1.2, abs: 1.2 },
  required: [['squat', 'lunge'], ['hinge'], ['lunge', 'isolation'], ['core', 'carry']],
  legShare: 0.75,
};

const pushDay: SplitDay = {
  key: 'push',
  title: 'Push & skill',
  emphasis: { ...suppress([...LOWER, ...PULL.filter((m) => m !== 'rotator_cuff')], 0.2), chest: 1.35, triceps: 1.3, front_delts: 1.2, side_delts: 1.2 },
  required: [['horizontal_push'], ['vertical_push'], ['skill', 'isolation'], ['core']],
  legShare: 0.05,
};

const pullDay: SplitDay = {
  key: 'pull',
  title: 'Pull & skill',
  emphasis: { ...suppress([...LOWER, ...PUSH], 0.2), lats: 1.4, upper_back: 1.3, biceps: 1.3, rear_delts: 1.25, forearms: 1.2 },
  required: [['vertical_pull'], ['horizontal_pull'], ['skill', 'isolation'], ['core']],
  legShare: 0.05,
};

const upperPlus: SplitDay = {
  key: 'upper_plus',
  title: 'Upper body + posterior chain',
  emphasis: { ...suppress(['quads', 'calves'], 0.2), chest: 1.25, lats: 1.3, upper_back: 1.2, hamstrings: 1.15, glutes: 1.15, rear_delts: 1.2 },
  required: [['horizontal_push', 'vertical_push'], ['vertical_pull', 'horizontal_pull'], ['hinge'], ['core', 'isolation']],
  legShare: 0.2,
};

/**
 * Guarantees a skill slot in a session and nudges the supporting muscles up.
 * Applied on top of whichever split was chosen, so a calisthenics goal keeps
 * its skill work even when leg load forces an upper-body-heavy week.
 */
const skillBoost = (day: SplitDay): SplitDay => ({
  ...day,
  key: `${day.key}+skill`,
  emphasis: { ...day.emphasis, ...boost(['abs', 'forearms', 'rotator_cuff'], 1.2) },
  required: [['skill'], ...day.required],
});

export interface Split {
  name: string;
  days: SplitDay[];
}

/** Picks the weekly split from goal blend, day count and how loaded the legs are. */
function baseSplit(profile: Profile, load: ExternalLoad): Split {
  const legs = legLoadIndex(load);
  const goal = dominantGoal(profile.goals);
  const calisthenicsHeavy = profile.goals.calisthenics >= 0.3;

  if (profile.daysPerWeek === 2) {
    if (legs > 0.6) return { name: 'Upper+ / Full body', days: [upperPlus, fullBodyA] };
    return { name: 'Full body A/B', days: [fullBodyA, fullBodyB] };
  }
  if (legs > 0.55) return { name: 'Upper / Full body / Upper', days: [upperA, fullBodyB, upperB] };
  if (calisthenicsHeavy) return { name: 'Pull / Push / Full body', days: [pullDay, pushDay, fullBodyC] };
  if (goal === 'strength') return { name: 'Lower / Upper / Full body', days: [lower, upperA, fullBodyB] };
  if (goal === 'hypertrophy') return { name: 'Upper / Lower / Full body', days: [upperA, lower, fullBodyB] };
  return { name: 'Full body A/B/C', days: [fullBodyA, fullBodyB, fullBodyC] };
}

/** Picks the weekly split, then layers skill work on if the goals ask for it. */
export function chooseSplit(profile: Profile, load: ExternalLoad): Split {
  const split = baseSplit(profile, load);
  if (profile.goals.calisthenics < 0.3) return split;
  return {
    name: `${split.name} (skill-led)`,
    days: split.days.map(skillBoost),
  };
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items as [T, ...T[]];
  return [
    ...combinations(rest, k - 1).map((c) => [head, ...c]),
    ...combinations(rest, k),
  ];
}

/** Circular gaps between chosen days, so Sunday→Monday counts as one day. */
function gaps(days: Weekday[]): number[] {
  const sorted = [...days].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const next = sorted[(i + 1) % sorted.length]!;
    out.push(i === sorted.length - 1 ? next + 7 - current : next - current);
  }
  return out;
}

export interface DaySlot {
  weekday: Weekday;
  /** How suitable this day is for heavy leg work, higher is better. */
  legFriendliness: number;
  sameDayHardness: number;
  nextDayHardness: number;
  prevDayHardness: number;
}

export function scoreDaySet(days: Weekday[], load: ExternalLoad): number {
  const g = gaps(days);
  const minGap = Math.min(...g);
  const spread = 1 - (Math.max(...g) - minGap) / 7;
  let score = minGap * 3 + spread * 4;

  for (const day of days) {
    const next = ((day + 1) % 7) as Weekday;
    const prev = ((day + 6) % 7) as Weekday;
    score -= load.hardnessByDay[day] * 3.5; // doubling up on an already hard day
    score -= load.hardnessByDay[next] * 1.6; // arriving at a hard session with dead legs
    score -= load.hardnessByDay[prev] * 1.0; // lifting on top of yesterday's fatigue
  }
  return score;
}

/**
 * Picks the gym days. `earliestWeekday` drops days that have already passed,
 * so a week planned on Thursday never schedules a session for Monday.
 */
export function chooseGymDays(profile: Profile, load: ExternalLoad, earliestWeekday = 0): Weekday[] {
  const available = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter(
    (d) => profile.availability[d] && d >= earliestWeekday,
  );
  const k = Math.min(profile.daysPerWeek, available.length);
  if (k === 0) return [];
  const candidates = combinations(available, k);
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const set of candidates) {
    const score = scoreDaySet(set, load);
    if (score > bestScore) {
      bestScore = score;
      best = set;
    }
  }
  return [...best].sort((a, b) => a - b);
}

export function describeDaySlots(days: Weekday[], load: ExternalLoad): DaySlot[] {
  return days.map((weekday) => {
    const next = ((weekday + 1) % 7) as Weekday;
    const prev = ((weekday + 6) % 7) as Weekday;
    const sameDayHardness = load.hardnessByDay[weekday];
    const nextDayHardness = load.hardnessByDay[next];
    const prevDayHardness = load.hardnessByDay[prev];
    return {
      weekday,
      sameDayHardness,
      nextDayHardness,
      prevDayHardness,
      legFriendliness: -(sameDayHardness * 1.2 + nextDayHardness * 1.0 + prevDayHardness * 0.6),
    };
  });
}

/**
 * Assigns split days to calendar slots so the leggiest session lands on the
 * slot with the most room around it.
 */
export function assignSplitToDays(split: Split, slots: DaySlot[]): { slot: DaySlot; template: SplitDay }[] {
  const templatesByLeg = [...split.days].sort((a, b) => b.legShare - a.legShare);
  const slotsByFriendliness = [...slots].sort((a, b) => b.legFriendliness - a.legFriendliness);
  const pairs = new Map<Weekday, SplitDay>();
  templatesByLeg.forEach((template, i) => {
    const slot = slotsByFriendliness[i];
    if (slot) pairs.set(slot.weekday, template);
  });
  return slots
    .filter((s) => pairs.has(s.weekday))
    .map((slot) => ({ slot, template: pairs.get(slot.weekday)! }));
}

export interface DayConstraints {
  /** Cap on a single exercise's systemic cost. */
  maxSystemic: number;
  /** Budget for knee-stressful work across the day. */
  kneeBudget: number;
  /** Budget for overhead / cuff-stressful work across the day. */
  shoulderBudget: number;
  notes: string[];
}

export function dayConstraints(slot: DaySlot, load: ExternalLoad): DayConstraints {
  const notes: string[] = [];
  let maxSystemic = 3;
  let kneeBudget = 3.5;
  let shoulderBudget = 3.5;

  if (slot.nextDayHardness > 0.55) {
    maxSystemic = Math.min(maxSystemic, 2.2);
    kneeBudget = Math.min(kneeBudget, 1.8);
    notes.push(`Hard session on ${WEEKDAY_LABEL[(slot.weekday + 1) % 7]} — heavy, knee-stressful lifting is capped so you arrive fresh.`);
  }
  if (slot.prevDayHardness > 0.6) {
    maxSystemic = Math.min(maxSystemic, 2.4);
    kneeBudget = Math.min(kneeBudget, 2.2);
    notes.push(`Yesterday was hard — spinal and knee load kept moderate today.`);
  }
  if (slot.sameDayHardness > 0.3) {
    maxSystemic = Math.min(maxSystemic, 2);
    kneeBudget = Math.min(kneeBudget, 1.6);
    notes.push('You already train something else today, so this session stays lower in systemic cost.');
  }
  const overhead = overheadIndex(load);
  if (overhead > 0.35) {
    shoulderBudget = Math.max(1.4, 3.5 - overhead * 2.6);
  }
  return { maxSystemic, kneeBudget, shoulderBudget, notes };
}
