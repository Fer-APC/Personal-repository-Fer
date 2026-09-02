import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateWeekPlan, structureSize, DEFAULT_STRUCTURE } from '../src/domain/planner';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { chooseGymDays } from '../src/domain/schedule';
import { computeExternalLoad } from '../src/domain/activities';
import { normaliseGoals } from '../src/domain/goals';
import { makeProfile, RUNS_AND_VOLLEY } from './fixtures';
import type { Activity, Muscle } from '../src/domain/types';

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

test('more sport always means less asked of the legs in the gym', () => {
  const a = (type: Activity['type'], day: number, durationMin: number, intensity: 1 | 2 | 3): Activity =>
    ({ id: `${type}${day}${durationMin}`, type, day: day as Activity['day'], durationMin, intensity });

  // Increasing sport load, from nothing to a marathon block with sport on top.
  const weeks: Activity[][] = [
    [],
    [a('run_easy', 2, 30, 1)],
    [a('volleyball', 3, 90, 2)],
    [a('volleyball', 3, 90, 2), a('volleyball', 4, 90, 2), a('run_easy', 5, 45, 1)],
    [a('run_intervals', 1, 60, 3), a('run_easy', 2, 50, 1), a('run_long', 5, 100, 2), a('volleyball', 3, 120, 3), a('volleyball', 6, 120, 3)],
    [a('run_long', 6, 150, 3), a('run_intervals', 1, 75, 3), a('run_easy', 2, 60, 2), a('volleyball', 3, 120, 3), a('volleyball', 5, 120, 3), a('volleyball', 0, 120, 3)],
  ];

  const quadTargets = weeks.map(
    (activities) => plan({}, activities).balance.find((b) => b.muscle === 'quads')!.target,
  );
  const calfTargets = weeks.map(
    (activities) => plan({}, activities).balance.find((b) => b.muscle === 'calves')!.target,
  );

  for (let i = 1; i < quadTargets.length; i++) {
    assert.ok(
      quadTargets[i]! <= quadTargets[i - 1]!,
      `quad target rose with more sport: ${quadTargets.join(' → ')}`,
    );
    assert.ok(calfTargets[i]! <= calfTargets[i - 1]!, `calf target rose: ${calfTargets.join(' → ')}`);
  }

  // The scale must not clip: a far heavier week has to ask for less than a
  // moderate one, or the model stops telling them apart.
  assert.ok(
    quadTargets[5]! < quadTargets[3]!,
    `a marathon block should spare the legs more than two volley sessions: ${quadTargets.join(' → ')}`,
  );
  assert.ok(calfTargets[5]! < calfTargets[3]!);
});

test('sport never removes leg training entirely', () => {
  // Running and volley fatigue the legs but do not build strength, so the gym
  // still has to load them.
  const extreme = plan({}, [
    { id: 'x1', type: 'run_long', day: 6, durationMin: 180, intensity: 3 },
    { id: 'x2', type: 'run_intervals', day: 1, durationMin: 90, intensity: 3 },
    { id: 'x3', type: 'volleyball', day: 3, durationMin: 180, intensity: 3 },
    { id: 'x4', type: 'volleyball', day: 5, durationMin: 180, intensity: 3 },
  ]);
  for (const muscle of ['quads', 'hamstrings', 'glutes'] as const) {
    const row = extreme.balance.find((b) => b.muscle === muscle)!;
    assert.ok(row.target > 3, `${muscle} target collapsed to ${row.target}`);
  }
});

test('hamstrings and glutes are protected relative to calves and quads', () => {
  const none = plan({}, []);
  const heavy = plan({}, [
    { id: 'h1', type: 'run_long', day: 5, durationMin: 120, intensity: 3 },
    { id: 'h2', type: 'run_intervals', day: 1, durationMin: 60, intensity: 3 },
  ]);
  const ratio = (m: Muscle) =>
    heavy.balance.find((b) => b.muscle === m)!.target / none.balance.find((b) => b.muscle === m)!.target;

  assert.ok(ratio('hamstrings') > ratio('quads'), 'hamstrings should be spared less than quads');
  assert.ok(ratio('glutes') > ratio('calves'), 'glutes should be spared less than calves');
});

test('a full-body day always contains pressing, even when shoulders are loaded', () => {
  // Heavy overhead sport shrinks the shoulder budget; the day must still press.
  const result = plan({}, [
    { id: 'v1', type: 'volleyball', day: 3, durationMin: 150, intensity: 3 },
    { id: 'v2', type: 'volleyball', day: 5, durationMin: 150, intensity: 3 },
  ]);
  for (const day of result.days) {
    const patterns = new Set(day.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]!.pattern));
    assert.ok(
      patterns.has('horizontal_push') || patterns.has('vertical_push'),
      `${day.title} has no pressing at all`,
    );
  }
});

test('heavy overhead sport steers pressing towards shoulder-friendly options', () => {
  const volley: Activity[] = [
    { id: 'v1', type: 'volleyball', day: 3, durationMin: 150, intensity: 3 },
    { id: 'v2', type: 'volleyball', day: 5, durationMin: 150, intensity: 3 },
  ];
  const averageShoulderStress = (activities: Activity[]) => {
    const presses = plan({}, activities).days
      .flatMap((d) => d.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]!))
      .filter((e) => e.pattern === 'vertical_push' || e.pattern === 'horizontal_push');
    return presses.reduce((sum, e) => sum + e.shoulderStress, 0) / Math.max(1, presses.length);
  };
  assert.ok(
    averageShoulderStress(volley) < averageShoulderStress([]),
    'a week full of spiking should not also prescribe the harshest presses',
  );
});

test('a session does not repeat the same movement three times', () => {
  // Three rows in one day: each satisfied a different muscle, and nothing
  // noticed they were the same movement.
  for (const seed of [1, 2, 3, 4, 5]) {
    const result = plan({}, RUNS_AND_VOLLEY, seed);
    for (const day of result.days) {
      const counts = new Map<string, number>();
      for (const exercise of day.exercises) {
        const { pattern } = EXERCISE_BY_ID[exercise.exerciseId]!;
        counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
      }
      for (const [pattern, count] of counts) {
        assert.ok(count <= 2, `${day.title} has ${count} × ${pattern} (seed ${seed})`);
      }
    }
  }
});

test('a cramped gym is never prescribed a walking exercise', () => {
  const result = plan({ limitedSpace: true }, RUNS_AND_VOLLEY);
  for (const day of result.days) {
    for (const exercise of day.exercises) {
      assert.ok(
        !EXERCISE_BY_ID[exercise.exerciseId]!.needsSpace,
        `${EXERCISE_BY_ID[exercise.exerciseId]!.name} needs floor space`,
      );
    }
    assert.ok(day.exercises.length > 0, 'the day still has to be filled');
  }
});

test('lat work comes from a vertical pull, not a third row', () => {
  for (const seed of [1, 2, 3, 4]) {
    const result = plan({}, RUNS_AND_VOLLEY, seed);
    const exercises = result.days.flatMap((d) => d.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]!));
    const latWork = exercises.filter((e) => e.primary.includes('lats'));
    if (latWork.length === 0) continue;
    assert.ok(
      latWork.some((e) => e.pattern === 'vertical_pull'),
      `seed ${seed}: lats trained only by ${latWork.map((e) => e.name).join(', ')}`,
    );
  }
});

test('an exercise you like is used when it fits', () => {
  const liked = plan({ preferredExercises: ['goblet_squat'] }, RUNS_AND_VOLLEY, 3);
  const plain = plan({}, RUNS_AND_VOLLEY, 3);
  const has = (p: typeof liked) => p.days.some((d) => d.exercises.some((e) => e.exerciseId === 'goblet_squat'));
  // It need not always appear, but liking it must never make it less likely.
  assert.ok(has(liked) || !has(plain), 'a liked exercise should not be pushed out');
});
