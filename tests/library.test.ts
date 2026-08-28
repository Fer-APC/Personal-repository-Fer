import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildLibrary, rateExercisesFor, standInsFor } from '../src/domain/library';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { normaliseGoals } from '../src/domain/goals';
import { makeProfile } from './fixtures';
import type { Profile } from '../src/domain/types';

const opts = (profile: Profile = makeProfile()) => ({ profile, logs: [] });

test('ranks compound lifts above isolation for the same muscle', () => {
  const quads = rateExercisesFor('quads', opts());
  const squat = quads.findIndex((r) => r.exercise.id === 'back_squat');
  const extension = quads.findIndex((r) => r.exercise.id === 'leg_extension');
  assert.ok(squat >= 0 && extension >= 0, 'both should be listed');
  assert.ok(squat < extension, 'the squat should outrank the leg extension');
  assert.equal(quads[0]!.tier, 'staple');
});

test('breadth and headroom are scored as described', () => {
  const [squat] = rateExercisesFor('quads', opts()).filter((r) => r.exercise.id === 'back_squat');
  const [extension] = rateExercisesFor('quads', opts()).filter((r) => r.exercise.id === 'leg_extension');
  assert.ok(squat!.breadth > extension!.breadth, 'a squat trains more muscle than an extension');
  assert.equal(squat!.headroom, 1, 'a barbell lift never runs out of load');

  const [plank] = rateExercisesFor('abs', opts()).filter((r) => r.exercise.id === 'plank');
  assert.ok(plank!.headroom < 0.6, 'a timed hold has limited progression');
});

test('rankings follow the goal mix', () => {
  const calisthenics = makeProfile({
    goals: normaliseGoals({ hypertrophy: 0.1, strength: 0.1, calisthenics: 0.7, endurance: 0.05, longevity: 0.05 }),
  });
  const strength = makeProfile({
    goals: normaliseGoals({ hypertrophy: 0, strength: 1, calisthenics: 0, endurance: 0, longevity: 0 }),
  });
  const fitFor = (profile: Profile, id: string) =>
    rateExercisesFor(EXERCISE_BY_ID[id]!.primary[0]!, opts(profile)).find((r) => r.exercise.id === id)!.goalFit;

  assert.ok(fitFor(calisthenics, 'pullup') > fitFor(strength, 'pullup'));
  assert.ok(fitFor(strength, 'deadlift') > fitFor(calisthenics, 'deadlift'));
});

test('every rating explains itself', () => {
  for (const rating of rateExercisesFor('chest', opts())) {
    assert.ok(rating.reasons.length > 0, `${rating.exercise.name} has no reason given`);
    assert.ok(rating.reasons.every((r) => r.length > 0));
  }
});

test('the library covers every muscle and respects equipment', () => {
  const full = buildLibrary({ ...opts(), region: 'all' });
  assert.ok(full.length >= 15, `expected most muscles to have exercises, got ${full.length}`);

  const bodyweightOnly = buildLibrary({ ...opts(makeProfile({ equipment: ['bodyweight'] })), region: 'all' });
  for (const section of bodyweightOnly) {
    for (const { exercise } of section.ratings) {
      assert.deepEqual(exercise.equipment, ['bodyweight'], `${exercise.name} needs kit that isn't there`);
    }
  }
});

test('the library filters by region and search', () => {
  const legs = buildLibrary({ ...opts(), region: 'legs' });
  assert.ok(legs.every((s) => s.region === 'legs'));
  assert.ok(legs.some((s) => s.muscle === 'quads'));

  const search = buildLibrary({ ...opts(), region: 'all', query: 'squat' });
  const names = search.flatMap((s) => s.ratings.map((r) => r.exercise.name.toLowerCase()));
  assert.ok(names.length > 0);
  assert.ok(names.every((n) => n.includes('squat')));
});

test('stand-ins never need the equipment that is busy', () => {
  const rack = EXERCISE_BY_ID['back_squat']!;
  const options = standInsFor(rack, opts());
  assert.ok(options.length > 0, 'there should be something else to do');
  for (const { exercise } of options) {
    assert.ok(!exercise.equipment.includes('barbell'), `${exercise.name} still needs the barbell`);
    assert.ok(
      exercise.primary.some((m) => rack.primary.includes(m)),
      `${exercise.name} does not train what the squat trains`,
    );
  }
});

test('stand-ins for a machine avoid that machine', () => {
  const press = EXERCISE_BY_ID['leg_press']!;
  for (const { exercise } of standInsFor(press, opts())) {
    assert.ok(!exercise.equipment.includes('machine'), `${exercise.name} needs a machine too`);
  }
});

test('a muscle the week is short on lifts its exercises', () => {
  const plan = {
    balance: [
      { muscle: 'side_delts' as const, target: 10, planned: 0, assist: 0, externalCredit: 0, status: 'missing' as const },
      { muscle: 'chest' as const, target: 10, planned: 12, assist: 0, externalCredit: 0, status: 'on' as const },
    ],
  };
  const withPlan = rateExercisesFor('side_delts', { ...opts(), plan: plan as never });
  const withoutPlan = rateExercisesFor('side_delts', opts());
  assert.ok(withPlan[0]!.need > 0, 'the gap should register');
  assert.ok(withPlan[0]!.score > withoutPlan[0]!.score, 'a needed muscle should rank higher');
  assert.ok(withPlan[0]!.reasons.some((r) => r.includes('short on')));
});

test('stand-ins actually replace what the original trains', () => {
  // An overhead press shares only the front delt with an incline chest press;
  // it is not a substitute for it.
  const incline = EXERCISE_BY_ID['db_incline_bench']!;
  const options = standInsFor(incline, opts());
  assert.ok(options.length > 0);
  assert.ok(
    !options.some((r) => r.exercise.id === 'bb_ohp'),
    'an overhead press is not a chest press substitute',
  );
  for (const { exercise } of options) {
    const coversChest = exercise.primary.includes('chest') || exercise.secondary.includes('chest');
    assert.ok(coversChest, `${exercise.name} does not train the chest`);
  }
});

test('the best stand-in is offered first', () => {
  const [best] = standInsFor(EXERCISE_BY_ID['bb_bench']!, opts());
  assert.ok(best, 'there should be an alternative to the bench press');
  assert.ok(best.exercise.primary.includes('chest'), 'the top stand-in should train the chest directly');
});

test('a busy machine is answered with the same movement on other kit', () => {
  // The pulldown station is taken; the answer is a pull-up, not a row.
  const [best] = standInsFor(EXERCISE_BY_ID['lat_pulldown']!, opts());
  assert.equal(best!.exercise.pattern, 'vertical_pull', 'should stay a vertical pull');
  assert.ok(!best!.exercise.equipment.some((e) => ['cable', 'machine'].includes(e)));
});

test('stand-ins offer variety, not one ladder four times', () => {
  const options = standInsFor(EXERCISE_BY_ID['bb_bench']!, opts());
  const families = options.map((r) => r.exercise.progression).filter(Boolean);
  assert.equal(new Set(families).size, families.length, 'each progression family should appear once');
});
