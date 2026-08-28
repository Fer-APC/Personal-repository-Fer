import type { Activity, ActivityType, Muscle, Weekday } from './types';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run_easy: 'Easy run',
  run_long: 'Long run',
  run_intervals: 'Intervals / tempo run',
  volleyball: 'Beach volley',
  other: 'Other activity',
};

interface ActivitySignature {
  /** Local fatigue per muscle for a 60 min session at intensity 2. */
  muscles: Partial<Record<Muscle, number>>;
  /** Whole-body cost for the same reference session. */
  systemic: number;
  /** Repeated ground impact — argues against heavy knee-stress lifting nearby. */
  impact: number;
  /** Overhead / cuff exposure — argues against extra vertical pressing. */
  overhead: number;
  /** How much of a hard session it is; drives the day-spacing penalties. */
  hardness: number;
}

const SIGNATURES: Record<ActivityType, ActivitySignature> = {
  run_easy: {
    muscles: { calves: 0.5, quads: 0.3, hamstrings: 0.25, glutes: 0.2, hip_flexors: 0.3 },
    systemic: 0.3, impact: 1, overhead: 0, hardness: 0.35,
  },
  run_long: {
    muscles: { calves: 0.8, quads: 0.55, hamstrings: 0.45, glutes: 0.35, hip_flexors: 0.45, lower_back: 0.2 },
    systemic: 0.85, impact: 2, overhead: 0, hardness: 0.9,
  },
  run_intervals: {
    muscles: { calves: 0.8, quads: 0.6, hamstrings: 0.7, glutes: 0.5, hip_flexors: 0.4 },
    systemic: 0.9, impact: 2, overhead: 0, hardness: 1,
  },
  volleyball: {
    muscles: {
      calves: 0.7, quads: 0.6, glutes: 0.4, hamstrings: 0.3, adductors: 0.35,
      side_delts: 0.4, front_delts: 0.45, rotator_cuff: 0.55, abs: 0.4, obliques: 0.5, lower_back: 0.3,
    },
    systemic: 0.65, impact: 1.5, overhead: 2, hardness: 0.75,
  },
  other: {
    muscles: { quads: 0.2, abs: 0.2 },
    systemic: 0.4, impact: 0.5, overhead: 0.3, hardness: 0.45,
  },
};

function scale(a: Activity): number {
  const duration = a.durationMin / 60;
  const intensity = 0.6 + 0.4 * a.intensity; // 1 -> 1.0, 2 -> 1.4, 3 -> 1.8
  return duration * (intensity / 1.4);
}

export interface ExternalLoad {
  /** Accumulated fatigue per muscle across the week, roughly 0-3. */
  perMuscle: Partial<Record<Muscle, number>>;
  systemic: number;
  impact: number;
  overhead: number;
  /** Per weekday: how hard that day already is. */
  hardnessByDay: Record<Weekday, number>;
  /** Per weekday and muscle: fatigue landing on that specific day. */
  byDay: Record<Weekday, Partial<Record<Muscle, number>>>;
  runMinutes: number;
  volleyMinutes: number;
}

export function emptyExternalLoad(): ExternalLoad {
  const byDay = {} as Record<Weekday, Partial<Record<Muscle, number>>>;
  const hardnessByDay = {} as Record<Weekday, number>;
  for (let d = 0 as Weekday; d < 7; d = (d + 1) as Weekday) {
    byDay[d] = {};
    hardnessByDay[d] = 0;
  }
  return { perMuscle: {}, systemic: 0, impact: 0, overhead: 0, hardnessByDay, byDay, runMinutes: 0, volleyMinutes: 0 };
}

export function computeExternalLoad(activities: Activity[]): ExternalLoad {
  const load = emptyExternalLoad();
  for (const a of activities) {
    const sig = SIGNATURES[a.type];
    const k = scale(a);
    for (const [muscle, value] of Object.entries(sig.muscles) as [Muscle, number][]) {
      load.perMuscle[muscle] = (load.perMuscle[muscle] ?? 0) + value * k;
      const day = load.byDay[a.day];
      day[muscle] = (day[muscle] ?? 0) + value * k;
    }
    load.systemic += sig.systemic * k;
    load.impact += sig.impact * k;
    load.overhead += sig.overhead * k;
    load.hardnessByDay[a.day] += sig.hardness * k;
    if (a.type.startsWith('run')) load.runMinutes += a.durationMin;
    if (a.type === 'volleyball') load.volleyMinutes += a.durationMin;
  }
  return load;
}

/**
 * Compresses an unbounded load into 0-1 without ever clipping. A hard cap
 * would make a couple of sessions a week look identical to a marathon block —
 * both "maximum" — and the gym would then ask the same of the legs in both.
 * This keeps rising, so more sport always means a little less lifting.
 * `half` is the load at which the index reaches 0.5.
 */
function saturate(total: number, half: number): number {
  return total <= 0 ? 0 : total / (total + half);
}

/** 0-1 summary of how beaten up the legs already are before any lifting. */
export function legLoadIndex(load: ExternalLoad): number {
  const legs: Muscle[] = ['quads', 'hamstrings', 'calves', 'glutes'];
  const total = legs.reduce((s, m) => s + (load.perMuscle[m] ?? 0), 0);
  // Roughly two hard sport sessions a week sits at the halfway mark.
  return saturate(total, 6);
}

/** 0-1 summary of overhead shoulder exposure from sport. */
export function overheadIndex(load: ExternalLoad): number {
  return saturate(load.overhead, 4);
}

export function activityDescription(a: Activity): string {
  const intensity = ['', 'easy', 'moderate', 'hard'][a.intensity] ?? '';
  return `${a.label?.trim() || ACTIVITY_LABEL[a.type]} · ${a.durationMin} min · ${intensity}`;
}
