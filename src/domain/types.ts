/** Core domain vocabulary for the planner. */

export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'rotator_cuff'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'abs'
  | 'obliques'
  | 'hip_flexors';

export type Pattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'core'
  | 'isolation'
  | 'skill';

export type Goal = 'hypertrophy' | 'strength' | 'calisthenics' | 'endurance' | 'longevity';

export type GoalWeights = Record<Goal, number>;

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bench'
  | 'pullup_bar'
  | 'dip_bars'
  | 'rings'
  | 'kettlebell'
  | 'bands'
  | 'bodyweight';

export type LoadType = 'external' | 'bodyweight' | 'assisted' | 'time';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  /** Muscles doing the work — full credit toward weekly volume. */
  primary: Muscle[];
  /** Muscles meaningfully assisting — half credit. */
  secondary: Muscle[];
  equipment: Equipment[];
  compound: boolean;
  unilateral: boolean;
  /** Whole-body / spinal / CNS cost, 0-3. Drives ordering and superset legality. */
  systemicCost: number;
  /** Impact and shear on the knees, 0-2. Matters when you already run. */
  kneeStress: number;
  /** Overhead / cuff load, 0-2. Matters when you already spike a volleyball. */
  shoulderStress: number;
  /** How well the exercise serves each goal, 0-1. Missing = 0.4 neutral. */
  goalFit: Partial<Record<Goal, number>>;
  /** Technical demand: 1 anyone, 2 some training age, 3 advanced. */
  skill: 1 | 2 | 3;
  /** Needs floor space to travel through — carries, walking lunges. */
  needsSpace?: boolean;
  loadType: LoadType;
  /** Calisthenics ladders: same family id, ordered by step. */
  progression?: string;
  progressionStep?: number;
  notes?: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday

export type ActivityType = 'run_easy' | 'run_long' | 'run_intervals' | 'volleyball' | 'other';

export interface Activity {
  id: string;
  type: ActivityType;
  day: Weekday;
  durationMin: number;
  /** 1 easy, 2 moderate, 3 hard. */
  intensity: 1 | 2 | 3;
  label?: string;
}

/** One entry in a day's shape: a lone exercise, or a superset of `size` exercises. */
export interface StructureBlock {
  kind: 'single' | 'superset';
  size: number;
}

export interface DayStructure {
  blocks: StructureBlock[];
}

export interface Profile {
  goals: GoalWeights;
  daysPerWeek: 2 | 3;
  /** Weekdays the gym is possible at all. */
  availability: Record<Weekday, boolean>;
  sessionMinutes: number;
  equipment: Equipment[];
  experience: 'beginner' | 'intermediate' | 'advanced';
  units: 'kg' | 'lb';
  bodyweightKg: number;
  /** Structure per gym day, index-aligned with the generated days. */
  structures: DayStructure[];
  /** Muscles to work around (niggles, injuries). */
  avoid: Muscle[];
  /** True when the gym has no room to walk a carry or a travelling lunge. */
  limitedSpace: boolean;
  /** Exercises the user has banned. */
  excludedExercises: string[];
  /** Exercises the user likes and wants to see more of. */
  preferredExercises: string[];
  deloadEveryWeeks: number;
}

/** What the load suggestion is telling you to do, for UI emphasis. */
export type LoadHint =
  | 'first_time'
  | 'hold'
  | 'increase'
  | 'backoff'
  | 'progress_step'
  | 'add_time'
  | 'log_weight';

export interface PlannedExercise {
  exerciseId: string;
  /** "A", "B1", "B2" … block letter plus position inside a superset. */
  slot: string;
  blockIndex: number;
  sets: number;
  repRange: [number, number];
  restSec: number;
  rpe: number;
  load: { kg: number | null; note: string; hint: LoadHint };
  rationale: string;
}

export interface PlannedDay {
  date: string; // ISO yyyy-mm-dd
  weekday: Weekday;
  /** Split template this day was built from, so it can be rebuilt in place. */
  templateKey: string;
  title: string;
  emphasis: Muscle[];
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  notes: string[];
  /** Set when the day was rebuilt from work already logged this week. */
  adaptedFrom?: string;
}

export interface BalanceRow {
  muscle: Muscle;
  /** Weekly direct-work target, in sets. */
  target: number;
  /** Sets where this muscle is the target of the exercise. */
  planned: number;
  /** Sets where it only assists; counted at half value toward the target. */
  assist: number;
  /** Set-equivalents your runs and volley already supply. */
  externalCredit: number;
  status: 'under' | 'on' | 'over' | 'missing';
}

export interface WeekPlan {
  weekStart: string; // ISO date of Monday
  generatedAt: string;
  deload: boolean;
  splitName: string;
  days: PlannedDay[];
  balance: BalanceRow[];
  ratios: { pushPull: number; upperLower: number };
  warnings: string[];
  /**
   * Per-muscle weekly targets, scaled to what this week can actually deliver,
   * so full completion reads as 100%. Kept so later revisions reuse them.
   */
  targets: Partial<Record<Muscle, number>>;
  /** How the week you configured compares with an unconstrained ideal. */
  capacity: {
    /** Muscle-sets this week's sessions prescribe. */
    delivered: number;
    /** Muscle-sets your goals would use with unlimited days. */
    ideal: number;
    /** delivered / ideal, capped at 1. */
    ratio: number;
  };
  /** Free-text explanation of the scheduling decisions. */
  reasoning: string[];
}

export interface LoggedSet {
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  done: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  /** Set when the user swapped the planned exercise out. */
  replacedExerciseId?: string;
  sets: LoggedSet[];
  note?: string;
}

/** Day index used by sessions that were logged outside the plan. */
export const AD_HOC_DAY = -1;

export interface SessionLog {
  id: string;
  weekStart: string;
  date: string;
  /** Index into the week's planned days, or AD_HOC_DAY for an unplanned one. */
  dayIndex: number;
  title: string;
  exercises: LoggedExercise[];
  completed: boolean;
  sessionRpe: number | null;
  durationMin: number | null;
  /** Muscle soreness reported at the start of the session, 0-3. */
  soreness: Partial<Record<Muscle, number>>;
  note?: string;
}

export interface AppState {
  version: number;
  profile: Profile;
  activities: Activity[];
  /** Keyed by ISO week-start date. */
  plans: Record<string, WeekPlan>;
  logs: SessionLog[];
  onboarded: boolean;
  /** When settings last changed — plans generated before this are stale. */
  settingsUpdatedAt: string;
}
