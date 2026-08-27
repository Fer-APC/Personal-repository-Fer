import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateWeekPlan } from '../src/domain/planner';
import { adaptRemainingDays, defaultState } from '../src/domain/store';
import { computeWeekProgress, lockedDayIndexes } from '../src/domain/progress';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { makeProfile, RUNS_AND_VOLLEY } from './fixtures';
import { AD_HOC_DAY, type AppState, type LoggedSet, type SessionLog, type WeekPlan } from '../src/domain/types';
import type { Muscle } from '../src/domain/types';

const WEEK = '2026-08-24'; // Monday

function baseState(): AppState {
  const state = defaultState();
  state.profile = makeProfile();
  state.activities = RUNS_AND_VOLLEY;
  state.onboarded = true;
  state.plans[WEEK] = generateWeekPlan({
    profile: state.profile,
    activities: state.activities,
    weekStart: WEEK,
    logs: [],
    seed: 42,
  });
  return state;
}

const doneSet = (reps = 10, weightKg = 40): LoggedSet => ({ reps, weightKg, rpe: 8, done: true });

/** Logs a planned day exactly as prescribed. */
function logPlannedDay(state: AppState, dayIndex: number, completed = true): SessionLog {
  const day = state.plans[WEEK]!.days[dayIndex]!;
  return {
    id: `${WEEK}#${dayIndex}`,
    weekStart: WEEK,
    date: day.date,
    dayIndex,
    title: day.title,
    completed,
    sessionRpe: 8,
    durationMin: 65,
    soreness: {},
    exercises: day.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: Array.from({ length: e.sets }, () => doneSet()),
    })),
  };
}

const setsFor = (plan: WeekPlan, dayIndex: number, muscle: Muscle): number =>
  setsAcross(plan, [dayIndex], [muscle]);

/** Planned sets across the given days whose target is one of these muscles. */
function setsAcross(plan: WeekPlan, days: number[], muscles: Muscle[]): number {
  return days.reduce(
    (total, day) =>
      total +
      plan.days[day]!.exercises.reduce((n, e) => {
        const def = EXERCISE_BY_ID[e.exerciseId]!;
        return n + (def.primary.some((m) => muscles.includes(m)) ? e.sets : 0);
      }, 0),
    0,
  );
}

/**
 * Trains day one to the given extent, then replans. Day one is locked either
 * way, so the only variable is how much work actually got done.
 */
function reviseAfterDayOne({
  mode, soreness = {},
}: {
  mode: 'full' | 'one-set';
  soreness?: Partial<Record<Muscle, number>>;
}): { original: WeekPlan; revised: WeekPlan } {
  const state = baseState();
  const original = state.plans[WEEK]!;
  const day = original.days[0]!;
  const log = logPlannedDay(state, 0);
  log.soreness = soreness;
  if (mode === 'one-set') {
    log.exercises = [{ exerciseId: day.exercises[0]!.exerciseId, sets: [doneSet()] }];
  }
  state.logs.push(log);
  return { original, revised: adaptRemainingDays(state, WEEK, day.date)! };
}

test('days already trained are carried over untouched', () => {
  const state = baseState();
  state.logs.push(logPlannedDay(state, 0));
  const revised = adaptRemainingDays(state, WEEK, state.plans[WEEK]!.days[0]!.date)!;
  assert.ok(revised, 'expected a revised plan');
  assert.deepEqual(
    revised.days[0]!.exercises.map((e) => e.exerciseId),
    state.plans[WEEK]!.days[0]!.exercises.map((e) => e.exerciseId),
    'the trained day must not be rebuilt',
  );
  assert.equal(revised.days.length, state.plans[WEEK]!.days.length);
  assert.deepEqual(revised.days.map((d) => d.date), state.plans[WEEK]!.days.map((d) => d.date));
});

test('work skipped on day one rolls into the days still to come', () => {
  // Same locked day either way — only how much of it was actually done differs.
  const fullyDone = reviseAfterDayOne({ mode: 'full' });
  const barelyDone = reviseAfterDayOne({ mode: 'one-set' });
  const emphasis = fullyDone.original.days[0]!.emphasis;

  const covered = setsAcross(fullyDone.revised, [1, 2], emphasis);
  const owed = setsAcross(barelyDone.revised, [1, 2], emphasis);
  assert.ok(
    owed > covered,
    `skipped work should be picked up later: ${owed} sets after skipping vs ${covered} after doing it`,
  );
});

test('extra volume logged this week reduces what the remaining days schedule', () => {
  const state = baseState();
  const original = state.plans[WEEK]!;

  // A big unplanned chest session on top of day one.
  state.logs.push(logPlannedDay(state, 0));
  state.logs.push({
    id: `${WEEK}#extra-1`,
    weekStart: WEEK,
    date: original.days[0]!.date,
    dayIndex: AD_HOC_DAY,
    title: 'Extra chest work',
    completed: true,
    sessionRpe: 8,
    durationMin: 40,
    soreness: {},
    exercises: [
      { exerciseId: 'bb_bench', sets: Array.from({ length: 6 }, () => doneSet()) },
      { exerciseId: 'cable_fly', sets: Array.from({ length: 6 }, () => doneSet()) },
    ],
  });

  const revised = adaptRemainingDays(state, WEEK, original.days[0]!.date)!;
  const chestBefore = setsFor(original, 1, 'chest') + setsFor(original, 2, 'chest');
  const chestAfter = setsFor(revised, 1, 'chest') + setsFor(revised, 2, 'chest');
  assert.ok(chestAfter < chestBefore, `chest work should drop, was ${chestBefore} now ${chestAfter}`);
});

test('an unplanned session counts toward the week even with no planned day logged', () => {
  const state = baseState();
  const original = state.plans[WEEK]!;
  state.logs.push({
    id: `${WEEK}#extra-2`,
    weekStart: WEEK,
    date: original.days[0]!.date,
    dayIndex: AD_HOC_DAY,
    title: 'Improvised pull session',
    completed: true,
    sessionRpe: 8,
    durationMin: 50,
    soreness: {},
    exercises: [
      { exerciseId: 'pullup', sets: Array.from({ length: 5 }, () => doneSet(8, 0)) },
      { exerciseId: 'cable_row', sets: Array.from({ length: 5 }, () => doneSet()) },
    ],
  });

  const progress = computeWeekProgress(original, state.logs, original.days[0]!.date);
  const lats = progress.muscles.find((m) => m.muscle === 'lats')!;
  assert.ok(lats.logged >= 5, `lat work should be counted, got ${lats.logged}`);
  assert.equal(progress.setsLogged, 10);
  assert.equal(progress.sessionsDone, 1);
});

test('soreness reported during the week lightens the days still to come', () => {
  const rested = reviseAfterDayOne({ mode: 'full' });
  const sore = reviseAfterDayOne({ mode: 'full', soreness: { hamstrings: 3, quads: 3 } });
  const legs: Muscle[] = ['hamstrings', 'quads'];

  assert.ok(
    (sore.revised.targets.hamstrings ?? 0) < (rested.revised.targets.hamstrings ?? 0),
    'a sore hamstring should lower its weekly target',
  );
  const before = setsAcross(rested.revised, [1, 2], legs);
  const after = setsAcross(sore.revised, [1, 2], legs);
  assert.ok(after < before, `leg volume should drop when sore: was ${before}, now ${after}`);
});

test('volume already banked shrinks the sessions still to come', () => {
  const fullyDone = reviseAfterDayOne({ mode: 'full' });
  const barelyDone = reviseAfterDayOne({ mode: 'one-set' });
  const totalSets = (plan: WeekPlan) =>
    [1, 2].reduce((n, d) => n + plan.days[d]!.exercises.reduce((m, e) => m + e.sets, 0), 0);

  assert.ok(
    totalSets(fullyDone.revised) < totalSets(barelyDone.revised),
    'a completed session should leave less work for the rest of the week',
  );
  // The shape of the week is fixed, so it gives way in sets, never in slots.
  for (const day of [1, 2]) {
    assert.equal(
      fullyDone.revised.days[day]!.exercises.length,
      barelyDone.revised.days[day]!.exercises.length,
    );
  }
});

test('past days lock even when nothing was logged, and their work rolls forward', () => {
  const state = baseState();
  const plan = state.plans[WEEK]!;
  // Stand on the last day: the first two are in the past and untrained.
  const locked = lockedDayIndexes(plan, state.logs, plan.days[2]!.date);
  assert.deepEqual(locked, [0, 1]);

  const revised = adaptRemainingDays(state, WEEK, plan.days[2]!.date)!;
  assert.deepEqual(
    revised.days[0]!.exercises.map((e) => e.exerciseId),
    plan.days[0]!.exercises.map((e) => e.exerciseId),
  );
  assert.ok(revised.days[2]!.adaptedFrom, 'the remaining day should be marked as adapted');
});

test('replanning leaves the week structurally intact', () => {
  const state = baseState();
  const original = state.plans[WEEK]!;
  state.logs.push(logPlannedDay(state, 0));
  const revised = adaptRemainingDays(state, WEEK, original.days[0]!.date)!;

  for (const [index, day] of revised.days.entries()) {
    assert.equal(day.exercises.length, original.days[index]!.exercises.length, `day ${index} slot count`);
    const ids = day.exercises.map((e) => e.exerciseId);
    assert.equal(new Set(ids).size, ids.length, `day ${index} repeats an exercise`);
  }
  assert.equal(revised.splitName, original.splitName);
});

test('progress reports what the rest of the week will not cover', () => {
  const state = baseState();
  const plan = state.plans[WEEK]!;
  const progress = computeWeekProgress(plan, state.logs, plan.days[0]!.date);
  assert.equal(progress.setsLogged, 0);
  assert.equal(progress.covered, 0);
  for (const muscle of progress.muscles) {
    assert.ok(muscle.shortfall >= 0);
    assert.ok(muscle.logged === 0);
  }
  // With nothing logged, everything the plan covers is still ahead of you.
  assert.ok(progress.muscles.some((m) => m.scheduled > 0));
});

test('a week joined partway through only plans the days still ahead', () => {
  const profile = makeProfile();
  const thursday = '2026-08-27';
  const plan = generateWeekPlan({ profile, activities: [], weekStart: WEEK, logs: [], seed: 5, today: thursday });

  assert.ok(plan.days.length > 0, 'there should still be sessions to do');
  for (const day of plan.days) {
    assert.ok(day.date >= thursday, `${day.date} is in the past`);
  }
});

test('targets scale down when only part of the week is left', () => {
  const profile = makeProfile();
  const full = generateWeekPlan({ profile, activities: [], weekStart: WEEK, logs: [], seed: 5, today: WEEK });
  // Saturday: only two of the three gym days can still happen.
  const partial = generateWeekPlan({ profile, activities: [], weekStart: WEEK, logs: [], seed: 5, today: '2026-08-29' });

  const total = (plan: WeekPlan) => Object.values(plan.targets).reduce((a, b) => a + (b ?? 0), 0);
  assert.ok(partial.days.length < full.days.length, 'fewer sessions should be planned');
  assert.ok(total(partial) < total(full), 'targets should shrink with the shorter week');
  assert.ok(
    plannedWarning(partial),
    'the user should be told the week was shortened',
  );
});

test('joining late does not report the whole week as missed', () => {
  const profile = makeProfile();
  const thursday = '2026-08-27';
  const plan = generateWeekPlan({ profile, activities: [], weekStart: WEEK, logs: [], seed: 5, today: thursday });
  const progress = computeWeekProgress(plan, [], thursday);
  assert.ok(
    progress.shortfalls.length <= 5,
    `a fresh mid-week plan should be broadly achievable, got ${progress.shortfalls.length} shortfalls`,
  );
});

function plannedWarning(plan: WeekPlan): boolean {
  return plan.warnings.some((w) => w.includes('left this week'));
}

test('a session logged for an earlier day counts toward that day\'s week', () => {
  const state = baseState();
  const plan = state.plans[WEEK]!;
  const monday = WEEK;
  const thursday = '2026-08-27';

  // Created on Thursday by default, then moved back to the Monday it happened.
  state.logs.push({
    id: `${WEEK}#extra-late`,
    weekStart: WEEK,
    date: monday,
    dayIndex: AD_HOC_DAY,
    title: 'Monday session',
    completed: true,
    sessionRpe: 8,
    durationMin: 55,
    soreness: {},
    exercises: [
      { exerciseId: 'bb_bench', sets: Array.from({ length: 4 }, () => doneSet()) },
      { exerciseId: 'lat_pulldown', sets: Array.from({ length: 4 }, () => doneSet()) },
    ],
  });

  // Standing on Thursday, Monday is in the past — it must still be counted.
  const progress = computeWeekProgress(plan, state.logs, thursday);
  assert.equal(progress.setsLogged, 8);
  assert.ok(progress.muscles.find((m) => m.muscle === 'chest')!.logged >= 4);
  assert.ok(progress.muscles.find((m) => m.muscle === 'lats')!.logged >= 4);

  // And it must reduce what the days still ahead prescribe.
  const revised = adaptRemainingDays(state, WEEK, thursday)!;
  const bare = adaptRemainingDays({ ...state, logs: [] }, WEEK, thursday)!;
  const chestSets = (plan_: WeekPlan) =>
    plan_.days.reduce(
      (n, day, i) => (day.date >= thursday ? n + setsAcross(plan_, [i], ['chest']) : n),
      0,
    );
  assert.ok(
    chestSets(revised) < chestSets(bare),
    'work logged on a past day should still lighten the days ahead',
  );
});
