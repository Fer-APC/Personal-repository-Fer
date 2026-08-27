import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { applyCommands } from '../src/domain/apply';
import { parseVoiceInput } from '../src/domain/voice';
import { generateWeekPlan } from '../src/domain/planner';
import { defaultState } from '../src/domain/store';
import { computeWeekProgress } from '../src/domain/progress';
import { makeProfile } from './fixtures';
import type { AppState } from '../src/domain/types';

const WEEK = '2026-08-24';
const TODAY = '2026-08-27'; // Thursday

function baseState(): AppState {
  const state = defaultState();
  state.profile = makeProfile();
  state.onboarded = true;
  state.plans[WEEK] = generateWeekPlan({
    profile: state.profile,
    activities: [],
    weekStart: WEEK,
    logs: [],
    seed: 9,
    today: WEEK,
  });
  return state;
}

/** Dictate a phrase into a state, the way the UI does. */
function say(state: AppState, text: string) {
  const { commands } = parseVoiceInput(text, TODAY);
  return applyCommands(state, commands, { today: TODAY });
}

test('dictating a session records the sets against the right day', () => {
  const { state, notes } = say(baseState(), 'on monday I did bench press three sets of eight at sixty kilos');
  const log = state.logs.find((l) => l.date === WEEK);
  assert.ok(log, 'a session should exist for Monday');
  assert.equal(log.exercises.length, 1);
  assert.equal(log.exercises[0]!.exerciseId, 'bb_bench');
  assert.equal(log.exercises[0]!.sets.length, 3);
  assert.ok(log.exercises[0]!.sets.every((s) => s.reps === 8 && s.weightKg === 60 && s.done));
  assert.ok(notes.some((n) => n.includes('Barbell bench press')));
});

test('several exercises land in one session for that day', () => {
  const { state } = say(
    baseState(),
    'yesterday I did squats 5 by 5 at 100, bench press 3 by 8 at 60, and lat pulldown 3 by 10 at 50',
  );
  const logs = state.logs.filter((l) => l.date === '2026-08-26');
  assert.equal(logs.length, 1, 'one session, not three');
  assert.deepEqual(logs[0]!.exercises.map((e) => e.exerciseId), ['back_squat', 'bb_bench', 'lat_pulldown']);
});

test('the same exercise said twice adds sets instead of replacing them', () => {
  const once = say(baseState(), 'bench press 3 sets of 8 at 60');
  const twice = say(once.state, 'bench press 2 sets of 6 at 70');
  const log = twice.state.logs.find((l) => l.date === TODAY)!;
  assert.equal(log.exercises.length, 1);
  assert.equal(log.exercises[0]!.sets.length, 5);
});

test('dictated volume counts toward the week and lightens what is left', () => {
  const before = baseState();
  const { state } = say(before, 'bench press 4 sets of 10 at 60 and cable fly 4 sets of 12 at 20');

  const progress = computeWeekProgress(state.plans[WEEK]!, state.logs, TODAY);
  assert.equal(progress.setsLogged, 8);
  assert.ok(progress.muscles.find((m) => m.muscle === 'chest')!.logged >= 8);
});

test('adjusting a goal shifts the mix and flags the plan as stale', () => {
  const start = baseState();
  const { state, notes } = say(start, 'more calisthenics');
  assert.ok(
    state.profile.goals.calisthenics > start.profile.goals.calisthenics,
    'calisthenics should rise',
  );
  assert.ok(Math.abs(Object.values(state.profile.goals).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'weights stay normalised');
  assert.ok(state.settingsUpdatedAt > start.settingsUpdatedAt, 'settings must be marked changed');
  assert.ok(notes.some((n) => n.includes('rebuild')), 'the user should be told to rebuild');
});

test('schedule changes apply to the profile', () => {
  const { state } = say(baseState(), 'I want to train two days a week and I cant train on tuesday');
  assert.equal(state.profile.daysPerWeek, 2);
  assert.equal(state.profile.structures.length, 2);
  assert.equal(state.profile.availability[1], false);
});

test('adding a run does not duplicate an existing one', () => {
  const once = say(baseState(), 'I run on tuesday for 45 minutes');
  assert.equal(once.state.activities.length, 1);
  const twice = say(once.state, 'I run on tuesday for 60 minutes');
  assert.equal(twice.state.activities.length, 1, 'same run and day should update, not duplicate');
  assert.equal(twice.state.activities[0]!.durationMin, 60);
});

test('soreness attaches to the session being dictated', () => {
  const { state } = say(baseState(), 'bench press 3 sets of 8 at 60 and my chest is sore');
  const log = state.logs.find((l) => l.date === TODAY)!;
  assert.equal(log.soreness.chest, 2);
});

test('soreness with nothing logged says so rather than failing silently', () => {
  const { state, notes } = say(baseState(), 'my quads are sore');
  assert.equal(state.logs.length, 0);
  assert.ok(notes.some((n) => n.includes('log a session first')));
});

test('pain removes that muscle from future plans', () => {
  const { state } = say(baseState(), 'my shoulder hurts');
  assert.ok(state.profile.avoid.includes('front_delts'));
});

test('applying nothing changes nothing', () => {
  const start = baseState();
  const { state, notes } = applyCommands(start, [], { today: TODAY });
  assert.equal(state, start, 'state should be returned untouched');
  assert.equal(notes.length, 0);
});

test('a full mixed dictation applies end to end', () => {
  const { state, notes } = say(
    baseState(),
    'on monday I did squats five sets of five at a hundred kilos bench press three sets of eight at sixty. ' +
      'my hamstrings are sore. more strength. I cant train on friday',
  );
  const log = state.logs.find((l) => l.date === WEEK)!;
  assert.equal(log.exercises.length, 2);
  assert.equal(log.soreness.hamstrings, 2);
  assert.equal(state.profile.availability[4], false);
  assert.ok(notes.length >= 5);
});
