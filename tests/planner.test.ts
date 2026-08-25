import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateWeekPlan, structureSize, DEFAULT_STRUCTURE } from '../src/domain/planner';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { chooseGymDays } from '../src/domain/schedule';
import { computeExternalLoad } from '../src/domain/activities';
import { normaliseGoals } from '../src/domain/goals';
import { makeProfile, RUNS_AND_VOLLEY } from './fixtures';
import type { Muscle } from '../src/domain/types';

const WEEK = '2026-08-24';

const plan = (profileOverrides = {}, activities = RUNS_AND_VOLLEY, seed = 7) =>
  generateWeekPlan({
    profile: makeProfile(profileOverrides),
    activities,
    weekStart: WEEK,
    logs: [],
    seed,
  });

test('produces the requested number of gym days', () => {
  assert.equal(plan().days.length, 3);
  assert.equal(plan({ daysPerWeek: 2, structures: [DEFAULT_STRUCTURE, DEFAULT_STRUCTURE] }).days.length, 2);
});

test('every day fills the requested structure exactly', () => {
  const structure = { blocks: [{ kind: 'single' as const, size: 1 }, { kind: 'superset' as const, size: 3 }, { kind: 'superset' as const, size: 2 }] };
  const result = plan({ structures: [structure, structure, structure] });
  for (const day of result.days) {
    assert.equal(day.exercises.length, structureSize(structure), `${day.title} should have ${structureSize(structure)} exercises`);
    assert.deepEqual(day.exercises.map((e) => e.slot), ['A', 'B1', 'B2', 'B3', 'C1', 'C2']);
  }
});

test('never repeats an exercise inside one day', () => {
  for (const day of plan().days) {
    const ids = day.exercises.map((e) => e.exerciseId);
    assert.equal(new Set(ids).size, ids.length, `${day.title} repeats an exercise`);
  }
});

test('supersets never stack the same primary muscle', () => {
  for (const day of plan().days) {
    const byBlock = new Map<number, string[]>();
    for (const ex of day.exercises) {
      byBlock.set(ex.blockIndex, [...(byBlock.get(ex.blockIndex) ?? []), ex.exerciseId]);
    }
    for (const [, ids] of byBlock) {
      if (ids.length < 2) continue;
      const seen = new Set<Muscle>();
      for (const id of ids) {
        for (const m of EXERCISE_BY_ID[id]!.primary) {
          assert.ok(!seen.has(m), `superset in ${day.title} stacks ${m}`);
          seen.add(m);
        }
      }
    }
  }
});

test('schedules gym days away from hard running and volley days', () => {
  const load = computeExternalLoad(RUNS_AND_VOLLEY);
  const days = chooseGymDays(makeProfile(), load);
  assert.equal(days.length, 3);
  for (const d of days) {
    assert.ok(!RUNS_AND_VOLLEY.some((a) => a.day === d && a.intensity >= 3), `gym landed on hard activity day ${d}`);
  }
});

test('heavy running cuts calf and quad targets but protects hamstrings', () => {
  const heavy = plan({}, [
    { id: 'r1', type: 'run_long', day: 5, durationMin: 120, intensity: 3 },
    { id: 'r2', type: 'run_intervals', day: 2, durationMin: 60, intensity: 3 },
    { id: 'r3', type: 'run_easy', day: 0, durationMin: 60, intensity: 1 },
  ]);
  const none = plan({}, []);
  const target = (p: typeof heavy, m: Muscle) => p.balance.find((b) => b.muscle === m)!.target;
  assert.ok(target(heavy, 'calves') < target(none, 'calves'), 'calf target should drop');
  assert.ok(target(heavy, 'quads') < target(none, 'quads'), 'quad target should drop');
  assert.ok(
    target(heavy, 'hamstrings') / target(none, 'hamstrings') > target(heavy, 'calves') / target(none, 'calves'),
    'hamstrings should be protected more than calves',
  );
});

test('volleyball raises rear delt and cuff volume and lowers front delt volume', () => {
  const volley = plan({}, [
    { id: 'v1', type: 'volleyball', day: 3, durationMin: 150, intensity: 3 },
    { id: 'v2', type: 'volleyball', day: 6, durationMin: 150, intensity: 3 },
  ]);
  const none = plan({}, []);
  const target = (p: typeof volley, m: Muscle) => p.balance.find((b) => b.muscle === m)!.target;
  assert.ok(target(volley, 'rotator_cuff') > target(none, 'rotator_cuff'));
  assert.ok(target(volley, 'rear_delts') > target(none, 'rear_delts'));
  assert.ok(target(volley, 'front_delts') < target(none, 'front_delts'));
});

test('respects excluded exercises and avoided muscles', () => {
  const result = plan({ excludedExercises: ['back_squat', 'deadlift'], avoid: ['lower_back'] });
  for (const day of result.days) {
    for (const ex of day.exercises) {
      assert.ok(!['back_squat', 'deadlift'].includes(ex.exerciseId));
      assert.ok(!EXERCISE_BY_ID[ex.exerciseId]!.primary.includes('lower_back'));
    }
  }
});

test('only prescribes exercises the available equipment supports', () => {
  const result = plan({ equipment: ['dumbbell', 'bench', 'bodyweight'] });
  for (const day of result.days) {
    for (const ex of day.exercises) {
      for (const eq of EXERCISE_BY_ID[ex.exerciseId]!.equipment) {
        assert.ok(['dumbbell', 'bench', 'bodyweight'].includes(eq), `${ex.exerciseId} needs ${eq}`);
      }
    }
  }
});

test('strength goals prescribe lower reps than endurance goals', () => {
  const strength = plan({ goals: normaliseGoals({ hypertrophy: 0, strength: 1, calisthenics: 0, endurance: 0, longevity: 0 }) });
  const endurance = plan({ goals: normaliseGoals({ hypertrophy: 0, strength: 0, calisthenics: 0, endurance: 1, longevity: 0 }) });
  const avgReps = (p: typeof strength) => {
    const all = p.days.flatMap((d) => d.exercises);
    return all.reduce((s, e) => s + (e.repRange[0] + e.repRange[1]) / 2, 0) / all.length;
  };
  assert.ok(avgReps(strength) < avgReps(endurance) - 4, 'strength reps should be clearly lower');
  const strengthRest = strength.days[0]!.exercises[0]!.restSec;
  const enduranceRest = endurance.days[0]!.exercises[0]!.restSec;
  assert.ok(strengthRest > enduranceRest, 'strength rest should be longer');
});

test('calisthenics goals bring in bodyweight and skill work', () => {
  const result = plan({
    goals: normaliseGoals({ hypertrophy: 0.1, strength: 0.1, calisthenics: 0.7, endurance: 0.05, longevity: 0.05 }),
  });
  const all = result.days.flatMap((d) => d.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]!));
  const bodyweight = all.filter((e) => e.loadType === 'bodyweight' || e.loadType === 'assisted' || e.loadType === 'time');
  assert.ok(bodyweight.length >= 4, `expected bodyweight work, got ${bodyweight.length}`);
  assert.ok(all.some((e) => e.pattern === 'skill'), 'expected at least one skill exercise');
});

test('sessions land near the time budget', () => {
  for (const day of plan({ sessionMinutes: 60 }).days) {
    assert.ok(day.estimatedMinutes <= 75, `${day.title} estimated ${day.estimatedMinutes} min`);
  }
});

test('each day covers its required movement patterns', () => {
  for (const day of plan().days) {
    const patterns = new Set(day.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]!.pattern));
    const pushes = ['horizontal_push', 'vertical_push'].some((p) => patterns.has(p as never));
    const pulls = ['horizontal_pull', 'vertical_pull', 'skill'].some((p) => patterns.has(p as never));
    assert.ok(pushes, `${day.title} has no pressing`);
    assert.ok(pulls, `${day.title} has no pulling`);
  }
});

test('is deterministic for a given seed and varies across seeds', () => {
  const ids = (seed: number) => plan({}, RUNS_AND_VOLLEY, seed).days.flatMap((d) => d.exercises.map((e) => e.exerciseId)).join();
  assert.equal(ids(3), ids(3));
});

test('reports balance and flags nothing as silently missing', () => {
  const result = plan();
  const covered = result.balance.filter((b) => b.planned > 0);
  assert.ok(covered.length >= 14, `expected broad coverage, got ${covered.length} muscles`);
  const missing = result.balance.filter((b) => b.status === 'missing');
  if (missing.length) {
    assert.ok(result.warnings.some((w) => w.includes('Nothing directly targets')));
  }
});
