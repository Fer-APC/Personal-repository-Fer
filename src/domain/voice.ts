import { EXERCISES } from './exercises';
import { ALL_MUSCLES, MUSCLE_LABEL } from './muscles';
import { ALL_GOALS, GOAL_LABEL } from './goals';
import { ACTIVITY_LABEL } from './activities';
import { WEEKDAY_LABEL, addDays, fromISODate, weekdayOf } from './date';
import type { ActivityType, Exercise, Goal, Muscle, Weekday } from './types';

/* ------------------------------------------------------------------ numbers */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  couple: 2, single: 1,
};
// "a"/"an" only mean one in front of a unit — "a week" is not "1 week".
const ARTICLE_AS_ONE = /\b(?:a|an)\s+(hundred|set|sets|rep|reps|minute|minutes|hour|hours)\b/g;

/**
 * Turns spoken numbers into digits before anything else runs, so every later
 * pattern only has to deal with "3 sets of 8". Handles compounds like
 * "twenty five" and "a hundred and ten".
 */
export function normaliseNumbers(text: string): string {
  const words = text.replace(ARTICLE_AS_ONE, (_, unit: string) => (unit === 'hundred' ? 'hundred' : `1 ${unit}`)).split(' ');
  const out: string[] = [];
  let pending: number | null = null;

  const flush = () => {
    if (pending != null) out.push(String(pending));
    pending = null;
  };

  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value == null) {
      // "and" only joins a compound number ("a hundred and ten").
      if (word === 'and' && pending != null && pending % 100 === 0) continue;
      flush();
      out.push(word);
      continue;
    }
    if (pending == null) {
      pending = value;
    } else if (value === 100) {
      pending *= 100;
    } else if (pending % 100 === 0 || (pending % 10 === 0 && value < 10)) {
      pending += value;
    } else {
      flush();
      pending = value;
    }
  }
  flush();
  return out.join(' ');
}

export function normalise(text: string): string {
  return normaliseNumbers(
    text
      .toLowerCase()
      .replace(/[’']/g, '')
      // Keep the punctuation that separates one instruction from the next.
      .replace(/[^a-z0-9.,;\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/* ---------------------------------------------------------------- exercises */

/** Gym shorthand that no amount of name matching would resolve on its own. */
const ALIASES: Record<string, string> = {
  bench: 'bb_bench', 'bench press': 'bb_bench', 'barbell bench': 'bb_bench',
  'incline bench': 'bb_incline_bench', 'dumbbell bench': 'db_bench',
  squat: 'back_squat', squats: 'back_squat', 'back squats': 'back_squat',
  'front squats': 'front_squat',
  deadlift: 'deadlift', deadlifts: 'deadlift', 'conventional deadlift': 'deadlift',
  rdl: 'rdl', 'romanian deadlifts': 'rdl', 'stiff leg deadlift': 'rdl',
  ohp: 'bb_ohp', 'overhead press': 'bb_ohp', 'military press': 'bb_ohp', 'shoulder press': 'db_shoulder_press',
  pullup: 'pullup', pullups: 'pullup', 'pull up': 'pullup', 'pull ups': 'pullup',
  chinup: 'chinup', chinups: 'chinup', 'chin up': 'chinup', 'chin ups': 'chinup',
  dips: 'dip', dip: 'dip',
  pushup: 'pushup', pushups: 'pushup', 'push up': 'pushup', 'push ups': 'pushup',
  row: 'bb_row', rows: 'bb_row', 'barbell rows': 'bb_row', 'dumbbell rows': 'db_row',
  'cable rows': 'cable_row', 'seated row': 'cable_row',
  pulldown: 'lat_pulldown', 'lat pulldown': 'lat_pulldown', 'lat pull down': 'lat_pulldown',
  curls: 'bb_curl', curl: 'bb_curl', 'bicep curls': 'bb_curl', 'barbell curls': 'bb_curl',
  'hammer curls': 'hammer_curl',
  pushdown: 'rope_pushdown', pushdowns: 'rope_pushdown', 'tricep pushdown': 'rope_pushdown',
  'tricep extension': 'overhead_ext', 'skull crushers': 'skullcrusher',
  'leg press': 'leg_press', 'leg curls': 'lying_leg_curl', 'leg curl': 'lying_leg_curl',
  'leg extensions': 'leg_extension', 'leg extension': 'leg_extension',
  'calf raises': 'standing_calf_raise', 'calf raise': 'standing_calf_raise',
  'lateral raises': 'lateral_raise', 'lateral raise': 'lateral_raise', 'side raises': 'lateral_raise',
  'face pulls': 'face_pull', 'face pull': 'face_pull',
  'hip thrusts': 'hip_thrust', 'hip thrust': 'hip_thrust',
  lunges: 'walking_lunge', lunge: 'walking_lunge',
  'bulgarians': 'bulgarian_split_squat', 'split squats': 'bulgarian_split_squat',
  plank: 'plank', planks: 'plank',
  'leg raises': 'hanging_leg_raise', 'leg raise': 'hanging_leg_raise',
  'ab wheel': 'ab_wheel', 'hip thrusters': 'hip_thrust',
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'on', 'at', 'for', 'with', 'and', 'to', 'my', 'some', 'did', 'i', 'we',
  'yesterday', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

function tokens(text: string): string[] {
  return text.split(' ').filter((t) => t && !STOP_WORDS.has(t));
}

/**
 * Resolves a spoken phrase to an exercise. Aliases win outright; otherwise the
 * best token overlap decides, so "incline dumbbell press" finds its exercise
 * even though nobody says the catalogue name exactly.
 */
export function matchExercise(phrase: string): Exercise | null {
  const cleaned = normalise(phrase).replace(/\b(\d+)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const aliasId = ALIASES[cleaned];
  if (aliasId) return EXERCISES.find((e) => e.id === aliasId) ?? null;

  const spoken = tokens(cleaned);
  if (spoken.length === 0) return null;

  // "on monday i did squats" reduces to "squats", which is a known alias.
  const trimmedAlias = ALIASES[spoken.join(' ')];
  if (trimmedAlias) return EXERCISES.find((e) => e.id === trimmedAlias) ?? null;

  let best: { exercise: Exercise; score: number } | null = null;
  for (const exercise of EXERCISES) {
    const name = tokens(normalise(exercise.name));
    const shared = spoken.filter((t) => name.some((n) => n === t || (t.length > 4 && n.startsWith(t.slice(0, 5)))));
    if (shared.length === 0) continue;
    // Reward covering the spoken words and not padding with extra ones.
    const score = shared.length / spoken.length + shared.length / name.length;
    if (!best || score > best.score) best = { exercise, score };
  }
  return best && best.score >= 1 ? best.exercise : null;
}

/* ----------------------------------------------------------------- commands */

export type Command =
  | { kind: 'log_exercise'; summary: string; exerciseId: string; sets: number; reps: number; weightKg: number | null; date: string }
  | { kind: 'adjust_goal'; summary: string; goal: Goal; direction: 'more' | 'less' | 'focus' }
  | { kind: 'set_days'; summary: string; days: 2 | 3 }
  | { kind: 'set_availability'; summary: string; weekday: Weekday; available: boolean }
  | { kind: 'set_session_minutes'; summary: string; minutes: number }
  | { kind: 'add_activity'; summary: string; activityType: ActivityType; weekday: Weekday; durationMin: number }
  | { kind: 'set_soreness'; summary: string; muscle: Muscle; level: number }
  | { kind: 'avoid_muscle'; summary: string; muscle: Muscle; avoid: boolean };

export interface ParseResult {
  commands: Command[];
  /** Fragments that matched nothing, shown so the user knows what was dropped. */
  unrecognised: string[];
  /**
   * A request to look at something rather than change it. Kept apart from
   * commands because it alters nothing — it just says which week to open.
   */
  navigate?: { weekOffset: number; summary: string };
}

/** "show me next week", "what's my routine", "give me this week's plan". */
function parseNavigation(clause: string): { weekOffset: number; summary: string } | null {
  const asking = /\b(show|give|see|view|open|display|what|which|tell|where|go to)\b/.test(clause);
  const subject = /\b(week|routine|plan|program|programme|schedule|workout|session)\b/.test(clause);
  if (!asking || !subject) return null;

  // Anything that also sets something is a change, not a request to look.
  if (/\b(sets? of|reps?|kilos?|kg|sore|hurts?|cant|cannot)\b/.test(clause)) return null;

  if (/\bnext\b/.test(clause)) return { weekOffset: 1, summary: 'Open next week' };
  if (/\b(last|previous|past)\b/.test(clause)) return { weekOffset: -1, summary: 'Open last week' };
  return { weekOffset: 0, summary: 'Open this week' };
}

const WEEKDAY_WORDS: Record<string, Weekday> = {
  monday: 0, mon: 0, tuesday: 1, tue: 1, tues: 1, wednesday: 2, wed: 2,
  thursday: 3, thu: 3, thurs: 3, friday: 4, fri: 4, saturday: 5, sat: 5, sunday: 6, sun: 6,
};

/** Resolves "on monday", "yesterday", "today" to a date, looking backwards. */
export function parseDate(clause: string, today: string): string | null {
  if (/\byesterday\b/.test(clause)) return addDays(today, -1);
  if (/\btoday\b/.test(clause)) return today;
  for (const [word, weekday] of Object.entries(WEEKDAY_WORDS)) {
    if (!new RegExp(`\\b${word}\\b`).test(clause)) continue;
    const current = weekdayOf(fromISODate(today));
    // A named day means the most recent one, today included.
    const back = (current - weekday + 7) % 7;
    return addDays(today, -back);
  }
  return null;
}

function parseWeekday(clause: string): Weekday | null {
  for (const [word, weekday] of Object.entries(WEEKDAY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(clause)) return weekday;
  }
  return null;
}

const MUSCLE_WORDS: [RegExp, Muscle][] = [
  [/\blower backs?\b/, 'lower_back'],
  [/\brotator cuffs?\b/, 'rotator_cuff'],
  [/\brear delts?\b/, 'rear_delts'],
  [/\bhamstrings?\b|\bhams\b/, 'hamstrings'],
  [/\bquads?\b|\bquadriceps\b/, 'quads'],
  [/\bglutes?\b/, 'glutes'],
  [/\bcalves\b|\bcalf\b/, 'calves'],
  [/\bshoulders?\b/, 'front_delts'],
  [/\bdelts\b/, 'side_delts'],
  [/\bupper backs?\b/, 'upper_back'],
  [/\blats?\b/, 'lats'],
  [/\babs\b|\bcore\b|\bstomach\b/, 'abs'],
  [/\bbiceps?\b/, 'biceps'],
  [/\btriceps?\b/, 'triceps'],
  [/\bpecs\b|\bchest\b/, 'chest'],
  [/\btraps\b/, 'traps'],
  [/\bforearms?\b/, 'forearms'],
  [/\bobliques?\b/, 'obliques'],
  [/\badductors?\b|\bgroin\b/, 'adductors'],
  [/\bback\b/, 'upper_back'],
];

/** Every muscle named in a clause — "hamstrings and quads are sore" means both. */
function matchMuscles(clause: string): Muscle[] {
  const found = new Set<Muscle>();
  for (const [pattern, muscle] of MUSCLE_WORDS) {
    if (pattern.test(clause)) found.add(muscle);
  }
  if (found.size === 0) {
    for (const muscle of ALL_MUSCLES) {
      if (clause.includes(MUSCLE_LABEL[muscle].toLowerCase())) found.add(muscle);
    }
  }
  return [...found];
}

function matchGoal(clause: string): Goal | null {
  const extra: Record<string, Goal> = {
    size: 'hypertrophy', muscle: 'hypertrophy', mass: 'hypertrophy', hypertrophy: 'hypertrophy',
    strength: 'strength', strong: 'strength', power: 'strength',
    calisthenics: 'calisthenics', callisthenics: 'calisthenics', bodyweight: 'calisthenics',
    endurance: 'endurance', resistance: 'endurance', stamina: 'endurance', conditioning: 'endurance',
    longevity: 'longevity', health: 'longevity', mobility: 'longevity', joints: 'longevity',
  };
  for (const [word, goal] of Object.entries(extra)) {
    if (new RegExp(`\\b${word}\\b`).test(clause)) return goal;
  }
  return null;
}

function matchActivity(clause: string): ActivityType | null {
  if (/\b(volley|volleyball|beach volley)\b/.test(clause)) return 'volleyball';
  if (/\b(intervals?|tempo|sprints?|track)\b/.test(clause)) return 'run_intervals';
  if (/\blong run\b/.test(clause)) return 'run_long';
  if (/\b(run|running|jog|jogging)\b/.test(clause)) return 'run_easy';
  return null;
}

/** Where the sets-and-reps phrase sits, so the name and the leftovers can be split off it. */
function locateSetsAndReps(clause: string): { sets: number; reps: number; start: number; end: number } | null {
  const setsOf = clause.match(/(\d+)\s*(?:sets?|x|by)\s*(?:of\s*)?(\d+)/);
  if (setsOf?.index != null) {
    return { sets: Number(setsOf[1]), reps: Number(setsOf[2]), start: setsOf.index, end: setsOf.index + setsOf[0].length };
  }
  const repsFor = clause.match(/(\d+)\s*reps?\s*(?:for|in)?\s*(\d+)\s*sets?/);
  if (repsFor?.index != null) {
    return { sets: Number(repsFor[2]), reps: Number(repsFor[1]), start: repsFor.index, end: repsFor.index + repsFor[0].length };
  }
  return null;
}

/** How far the load phrase extends past the reps, if one was spoken. */
function locateWeight(clause: string, from: number): { weightKg: number | null; end: number } | null {
  const tail = clause.slice(from);
  const bodyweight = tail.match(/^\s*(?:reps?\s*)?(?:at\s*)?(bodyweight|body weight|no weight|unweighted)\b/);
  if (bodyweight?.index != null) return { weightKg: null, end: from + bodyweight[0].length };
  const weighted = tail.match(/^\s*(?:reps?\s*)?(?:at|with)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)?/);
  if (weighted && weighted[1] != null) return { weightKg: Number(weighted[1]), end: from + weighted[0].length };
  return null;
}

/** Every phrase that can start an exercise, longest first so "bench press" wins over "bench". */
const EXERCISE_TRIGGERS: string[] = [
  ...Object.keys(ALIASES),
  ...EXERCISES.map((e) => normalise(e.name)),
].sort((a, b) => b.length - a.length);

const SETS_REPS_GLOBAL = /(\d+)\s*(?:sets?|x|by)\s*(?:of\s*)?(\d+)/g;

function countSetsReps(clause: string): number {
  SETS_REPS_GLOBAL.lastIndex = 0;
  return [...clause.matchAll(SETS_REPS_GLOBAL)].length;
}

/** Indices where a recognised exercise name begins, non-overlapping. */
function exerciseStarts(clause: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < clause.length; i++) {
    if (i > 0 && clause[i - 1] !== ' ') continue; // word starts only
    const trigger = EXERCISE_TRIGGERS.find((phrase) => {
      if (!clause.startsWith(phrase, i)) return false;
      const after = clause[i + phrase.length];
      return after === undefined || after === ' ';
    });
    if (trigger) {
      starts.push(i);
      i += trigger.length; // don't match inside a name we already took
    }
  }
  return starts;
}

/**
 * Speech arrives without punctuation, so "bench press 3x8 at 60 lat pulldown
 * 4x10 at 50" is one string. Cutting it at each exercise name keeps every set
 * attached to the exercise it belongs to — combining them would log real
 * numbers against the wrong lift.
 */
export function splitExerciseRuns(clause: string): string[] {
  if (countSetsReps(clause) < 2) return [clause];
  const starts = exerciseStarts(clause);
  if (starts.length < 2) return [clause];

  const segments: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const segment = clause.slice(starts[i], starts[i + 1]).trim();
    if (segment) segments.push(segment);
  }
  // Anything before the first exercise is context ("on monday i did") and
  // belongs to the first instruction, not to a segment of its own.
  const prefix = starts[0]! > 0 ? clause.slice(0, starts[0]).trim() : '';
  if (prefix && segments[0]) segments[0] = `${prefix} ${segments[0]}`;

  // Only accept the split if every piece is exactly one complete instruction.
  return segments.length > 1 && segments.every((seg) => countSetsReps(seg) === 1) ? segments : [clause];
}

const SEPARATORS = /\s*(?:,|;|\.|\band then\b|\bthen\b|\balso\b|\bafter that\b|\bplus\b|\band\b)\s*/;

export function parseVoiceInput(text: string, today: string): ParseResult {
  const normalised = normalise(text);
  if (!normalised) return { commands: [], unrecognised: [] };

  const commands: Command[] = [];
  const unrecognised: string[] = [];
  let navigate: ParseResult['navigate'];
  // A date said once ("on monday I did …") applies to everything after it.
  let contextDate: string | null = null;

  const clauses = normalised
    .split(SEPARATORS)
    .map((c) => c.trim())
    .filter(Boolean)
    .flatMap(splitExerciseRuns);

  for (let i = 0; i < clauses.length; i++) {
    let rest = clauses[i]!;
    let guard = 0;

    while (rest.trim() && guard++ < 8) {
      let parsed = parseClause(rest.trim(), today, contextDate);

      // Splitting on "and" can cut a single instruction in half ("my hamstrings
      // and quads are sore"). If a fragment means nothing alone, try it joined
      // to the next one before giving up on it.
      if (parsed.commands.length === 0 && guard === 1 && i + 1 < clauses.length) {
        const merged = parseClause(`${rest.trim()} ${clauses[i + 1]}`, today, contextDate);
        if (merged.commands.length > 0) {
          parsed = merged;
          i++;
        }
      }

      if (parsed.commands.length === 0) {
        // Before giving up, see whether this is a request to look at something.
        const asked = parseNavigation(rest.trim());
        if (asked) {
          navigate = asked;
        } else {
          unrecognised.push(rest.trim());
        }
        break;
      }
      for (const command of parsed.commands) {
        if (command.kind === 'log_exercise') contextDate = command.date;
        commands.push(command);
      }
      rest = parsed.remainder;
    }
  }

  return navigate ? { commands, unrecognised, navigate } : { commands, unrecognised };
}

interface ClauseParse {
  commands: Command[];
  /** Speech after the part this matcher consumed, to be parsed in turn. */
  remainder: string;
}

const nothing: ClauseParse = { commands: [], remainder: '' };

function parseClause(clause: string, today: string, contextDate: string | null): ClauseParse {
  const out: Command[] = [];

  // 1. Logging an exercise — the most specific shape, so it goes first. The
  // name is whatever precedes the numbers, which keeps trailing speech from
  // diluting the match, and that trailing speech is handed back to be parsed.
  const setsReps = locateSetsAndReps(clause);
  if (setsReps) {
    const exercise = matchExercise(clause.slice(0, setsReps.start));
    if (exercise) {
      const weight = locateWeight(clause, setsReps.end);
      const date = parseDate(clause.slice(0, setsReps.start), today) ?? contextDate ?? today;
      const weightKg = weight?.weightKg ?? null;
      const load = weight == null ? 'no weight given' : weightKg == null ? 'bodyweight' : `${weightKg}kg`;
      out.push({
        kind: 'log_exercise',
        exerciseId: exercise.id,
        sets: setsReps.sets,
        reps: setsReps.reps,
        weightKg,
        date,
        summary: `${exercise.name} — ${setsReps.sets}×${setsReps.reps} ${load}`,
      });
      return { commands: out, remainder: clause.slice(weight?.end ?? setsReps.end) };
    }
  }

  // 2. Soreness.
  const soreMatch = clause.match(/\b(sore|aching|aches|tight|stiff|painful|hurts?|injured)\b/);
  if (soreMatch?.index != null) {
    const spoken = clause.slice(0, soreMatch.index + soreMatch[0].length);
    const muscles = matchMuscles(spoken);
    if (muscles.length > 0) {
      const severe = /\b(very|really|super|extremely|badly)\b/.test(spoken);
      const injured = /\b(hurts?|painful|injur)/.test(spoken);
      for (const muscle of muscles) {
        if (injured) {
          out.push({
            kind: 'avoid_muscle', muscle, avoid: true,
            summary: `Work around ${MUSCLE_LABEL[muscle].toLowerCase()} — exercises targeting it are dropped`,
          });
        } else {
          const level = severe ? 3 : 2;
          out.push({
            kind: 'set_soreness', muscle, level,
            summary: `${MUSCLE_LABEL[muscle]} sore (${level}/3) — less volume for it`,
          });
        }
      }
      return { commands: out, remainder: clause.slice(soreMatch.index + soreMatch[0].length) };
    }
  }

  // 3. Days per week.
  const days = clause.match(/(\d+)\s*(?:days?|times?|sessions?)\s*(?:a|per)?\s*week/);
  if (days) {
    const value = Number(days[1]);
    if (value === 2 || value === 3) {
      out.push({ kind: 'set_days', days: value, summary: `Train ${value} days a week` });
      return { commands: out, remainder: '' };
    }
  }

  // 4. Session length.
  const minutes = clause.match(/(\d+)\s*(?:minutes?|mins?)/);
  if (minutes && /\b(sessions?|workouts?|training|train|long|length|lasts?)\b/.test(clause) && !matchActivity(clause)) {
    out.push({
      kind: 'set_session_minutes', minutes: Number(minutes[1]),
      summary: `Sessions of ${minutes[1]} minutes`,
    });
    return { commands: out, remainder: '' };
  }

  // 5. Runs and volley.
  const activityType = matchActivity(clause);
  if (activityType) {
    const weekday = parseWeekday(clause);
    if (weekday != null) {
      const duration = minutes ? Number(minutes[1]) : hoursIn(clause) ?? defaultDuration(activityType);
      out.push({
        kind: 'add_activity', activityType, weekday, durationMin: duration,
        summary: `${ACTIVITY_LABEL[activityType]} on ${WEEKDAY_LABEL[weekday]}, ${duration} min`,
      });
      return { commands: out, remainder: '' };
    }
  }

  // 6. Availability.
  const weekday = parseWeekday(clause);
  if (weekday != null && /\b(cant|cannot|no|not|never|skip|busy|off|free|can)\b/.test(clause)) {
    const available = !/\b(cant|cannot|no|not|never|skip|busy|off)\b/.test(clause);
    out.push({
      kind: 'set_availability', weekday, available,
      summary: `${available ? 'Can' : 'Cannot'} train on ${WEEKDAY_LABEL[weekday]}`,
    });
    return { commands: out, remainder: '' };
  }

  // 7. Goals.
  const goal = matchGoal(clause);
  if (goal) {
    const direction = /\b(less|reduce|drop|lower|fewer)\b/.test(clause)
      ? 'less'
      : /\b(only|focus|all|purely|just)\b/.test(clause)
        ? 'focus'
        : 'more';
    const wording = direction === 'focus' ? 'Focus on' : direction === 'less' ? 'Less' : 'More';
    out.push({ kind: 'adjust_goal', goal, direction, summary: `${wording} ${GOAL_LABEL[goal].toLowerCase()}` });
    return { commands: out, remainder: '' };
  }

  return nothing;
}

function hoursIn(clause: string): number | null {
  const hours = clause.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/);
  return hours ? Math.round(Number(hours[1]) * 60) : null;
}

function defaultDuration(type: ActivityType): number {
  return type === 'volleyball' ? 90 : type === 'run_long' ? 90 : 45;
}

/** Human-readable list of what the parser understood, for the confirm step. */
export function describeCommands(commands: Command[]): string[] {
  return commands.map((c) => c.summary);
}

export { ALL_GOALS };
