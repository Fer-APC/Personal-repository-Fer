import { DEFAULT_GOALS } from './goals';
import { DEFAULT_STRUCTURE, generateWeekPlan } from './planner';
import { weekStartISO } from './date';
import type { AppState, Muscle, Profile, SessionLog, WeekPlan } from './types';

const STORAGE_KEY = 'training-tracker/v1';

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
    excludedExercises: [],
    deloadEveryWeeks: 6,
  };
}

export function defaultState(): AppState {
  return {
    version: 1,
    profile: defaultProfile(),
    activities: [],
    plans: {},
    logs: [],
    onboarded: false,
    settingsUpdatedAt: new Date(0).toISOString(),
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      plans: parsed.plans ?? {},
      logs: parsed.logs ?? [],
      activities: parsed.activities ?? [],
    };
  } catch {
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
  return Object.fromEntries(plan.balance.map((b) => [b.muscle, b.target]));
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

export function findLog(state: AppState, weekStart: string, dayIndex: number): SessionLog | undefined {
  return state.logs.find((l) => l.id === sessionIdFor(weekStart, dayIndex));
}

export function currentWeek(): string {
  return weekStartISO(new Date());
}
