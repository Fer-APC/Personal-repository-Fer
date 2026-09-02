import { DEFAULT_GOALS } from './goals';
import { DEFAULT_STRUCTURE, generateWeekPlan } from './planner';
import { consumedThisWeek, lockedDayIndexes, workedByWeekday } from './progress';
import { toISODate, weekStartISO } from './date';
import type { AppState, Muscle, Profile, SessionLog, WeekPlan } from './types';

const STORAGE_KEY = 'training-tracker/v1';
/** Bumped whenever stored data needs upgrading; see `migrate`. */
export const STATE_VERSION = 3;

export const FULL_GYM: Profile['equipment'] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bench', 'pullup_bar', 'dip_bars', 'kettlebell', 'bands', 'bodyweight',
];

export function defaultProfile(): Profile {
  return {
    goals: { ...DEFAULT_GOALS },
    daysPerWeek: 3,
    availability: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
    sessionMinutes: 70,
    equipment: [...FULL_GYM],
    experience: 'intermediate',
    units: 'kg',
    bodyweightKg: 75,
    structures: [DEFAULT_STRUCTURE, DEFAULT_STRUCTURE, DEFAULT_STRUCTURE],
    avoid: [],
    limitedSpace: false,
    excludedExercises: [],
    deloadEveryWeeks: 6,
  };
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    profile: defaultProfile(),
    activities: [],
    plans: {},
    logs: [],
    onboarded: false,
    settingsUpdatedAt: new Date(0).toISOString(),
  };
}

/**
 * Brings a stored plan up to the current shape. Plans are derived data, so
 * anything missing is rebuilt from what the plan does carry rather than
 * discarded — losing a week's plan would take its logged sessions' context
 * with it.
 */
function migratePlan(plan: WeekPlan): WeekPlan {
  const balance = plan.balance ?? [];
  const targets = plan.targets ?? Object.fromEntries(balance.map((row) => [row.muscle, row.target]));
  // v2 plans predate the capacity summary. Their targets were the unscaled
  // ideal, so derive the ratio from what the plan delivered; the week is
  // rebuilt against scaled targets as soon as it is regenerated.
  const delivered = balance.reduce((sum, row) => sum + row.planned + row.assist * 0.5, 0);
  const ideal = Object.values(targets).reduce((sum: number, value) => sum + (value ?? 0), 0);
  return {
    ...plan,
    balance,
    targets,
    // v1 days predate template keys; an empty key falls back to position.
    days: (plan.days ?? []).map((day) => ({ ...day, templateKey: day.templateKey ?? '' })),
    capacity: plan.capacity ?? {
      delivered: Math.round(delivered),
      ideal: Math.round(ideal),
      ratio: ideal > 0 ? Math.min(1, delivered / ideal) : 1,
    },
  };
}

/**
 * A plan whose every target is zero cannot be read or acted on: nothing has a
 * yardstick and every muscle reports as satisfied. An earlier release could
 * produce one when a week ran out of gym days. Plans are derived data, so the
 * repair is to drop it and let the week rebuild.
 */
function isUnusable(plan: WeekPlan): boolean {
  const targets = Object.values(plan.targets ?? {});
  return targets.length > 0 && targets.every((value) => (value ?? 0) === 0);
}

export function migrate(parsed: Partial<AppState>): AppState {
  const base = defaultState();
  const plans = Object.fromEntries(
    Object.entries(parsed.plans ?? {})
      .map(([week, plan]) => [week, migratePlan(plan)] as const)
      .filter(([, plan]) => !isUnusable(plan)),
  );
  return {
    ...base,
    ...parsed,
    version: STATE_VERSION,
    profile: { ...base.profile, ...parsed.profile },
    plans,
    logs: parsed.logs ?? [],
    activities: parsed.activities ?? [],
  };
}

export function loadState(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaultState(); // Storage blocked entirely; run for this session only.
  }
  if (!raw) return defaultState();

  try {
    return migrate(JSON.parse(raw) as Partial<AppState>);
  } catch {
    // Never silently overwrite data we failed to read — park it so it can be
    // recovered by hand, and start clean.
    try {
      localStorage.setItem(`${STORAGE_KEY}.unreadable`, raw);
    } catch {
      // Nothing further to do; the original is still in place until saved over.
    }
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota — the app still works for this session.
  }
}

export function anchorWeek(state: AppState): string | null {
  const weeks = Object.keys(state.plans).sort();
  return weeks[0] ?? null;
}

function targetsOf(plan: WeekPlan | undefined): Partial<Record<Muscle, number>> | undefined {
  if (!plan) return undefined;
  return plan.targets ?? Object.fromEntries(plan.balance.map((b) => [b.muscle, b.target]));
}

/** Builds (or rebuilds) the plan for a week from current profile and activities. */
export function planWeek(state: AppState, weekStart: string, seed?: number): WeekPlan {
  const previousWeek = Object.keys(state.plans).filter((w) => w < weekStart).sort().pop();
  return generateWeekPlan({
    profile: state.profile,
    activities: state.activities,
    weekStart,
    logs: state.logs,
    previousTargets: targetsOf(previousWeek ? state.plans[previousWeek] : undefined),
    anchorWeek: anchorWeek(state) ?? weekStart,
    seed: seed ?? hashSeed(weekStart),
    today: toISODate(new Date()),
  });
}

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sessionIdFor(weekStart: string, dayIndex: number): string {
  return `${weekStart}#${dayIndex}`;
}

/**
 * Rebuilds the days you haven't trained yet from what you actually logged.
 * Sessions already done are carried over untouched; everything still ahead is
 * planned against the volume genuinely left to do, so skipped work gets picked
 * up and extra work is not repeated.
 */
export function adaptRemainingDays(state: AppState, weekStart: string, today = toISODate(new Date())): WeekPlan | null {
  const plan = state.plans[weekStart];
  if (!plan) return null;

  const locked = lockedDayIndexes(plan, state.logs, today);
  if (locked.length >= plan.days.length) return null; // nothing left to rebuild

  const previousWeek = Object.keys(state.plans).filter((w) => w < weekStart).sort().pop();
  return generateWeekPlan({
    profile: state.profile,
    activities: state.activities,
    weekStart,
    logs: state.logs,
    previousTargets: targetsOf(previousWeek ? state.plans[previousWeek] : undefined),
    anchorWeek: anchorWeek(state) ?? weekStart,
    seed: hashSeed(`${weekStart}:adapt:${state.logs.length}`),
    today,
    basePlan: plan,
    lockedDayIndexes: locked,
    consumed: consumedThisWeek(state.logs, weekStart),
    workedByWeekday: workedByWeekday(state.logs, weekStart),
  });
}

export function findLog(state: AppState, weekStart: string, dayIndex: number): SessionLog | undefined {
  return state.logs.find((l) => l.id === sessionIdFor(weekStart, dayIndex));
}

export function currentWeek(): string {
  return weekStartISO(new Date());
}
