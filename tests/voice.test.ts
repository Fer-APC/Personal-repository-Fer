import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { matchExercise, normaliseNumbers, parseDate, parseVoiceInput } from '../src/domain/voice';
import type { Command } from '../src/domain/voice';

const TODAY = '2026-08-27'; // a Thursday

const parse = (text: string) => parseVoiceInput(text, TODAY);
const first = (text: string): Command | undefined => parse(text).commands[0];

test('spoken numbers become digits', () => {
  assert.equal(normaliseNumbers('three sets of eight'), '3 sets of 8');
  assert.equal(normaliseNumbers('twenty five kilos'), '25 kilos');
  assert.equal(normaliseNumbers('a hundred and ten'), '110');
  assert.equal(normaliseNumbers('sixty'), '60');
  assert.equal(normaliseNumbers('no numbers here'), 'no numbers here');
});

test('gym shorthand resolves to real exercises', () => {
  assert.equal(matchExercise('bench press')?.id, 'bb_bench');
  assert.equal(matchExercise('squats')?.id, 'back_squat');
  assert.equal(matchExercise('pull ups')?.id, 'pullup');
  assert.equal(matchExercise('lat pull down')?.id, 'lat_pulldown');
  assert.equal(matchExercise('romanian deadlifts')?.id, 'rdl');
  assert.equal(matchExercise('incline dumbbell press')?.id, 'db_incline_bench');
  assert.equal(matchExercise('seated cable row')?.id, 'cable_row');
  assert.equal(matchExercise('completely unknown movement')?.id, undefined);
});

test('logs an exercise from natural speech', () => {
  const command = first('bench press three sets of eight at sixty kilos');
  assert.equal(command?.kind, 'log_exercise');
  if (command?.kind !== 'log_exercise') return;
  assert.equal(command.exerciseId, 'bb_bench');
  assert.equal(command.sets, 3);
  assert.equal(command.reps, 8);
  assert.equal(command.weightKg, 60);
  assert.equal(command.date, TODAY);
});

test('accepts the shorthand people actually speak', () => {
  const forms = [
    'squat 5 by 5 at 100 kilos',
    'squats 5x5 100kg',
    'squat 5 sets of 5 at 100',
  ];
  for (const form of forms) {
    const command = first(form);
    assert.equal(command?.kind, 'log_exercise', `failed on: ${form}`);
    if (command?.kind !== 'log_exercise') continue;
    assert.equal(command.exerciseId, 'back_squat', form);
    assert.equal(command.sets, 5, form);
    assert.equal(command.reps, 5, form);
    assert.equal(command.weightKg, 100, form);
  }
});

test('bodyweight work records no load', () => {
  const command = first('pull ups four sets of eight bodyweight');
  assert.equal(command?.kind, 'log_exercise');
  if (command?.kind !== 'log_exercise') return;
  assert.equal(command.exerciseId, 'pullup');
  assert.equal(command.weightKg, null);
});

test('several exercises in one breath all get logged', () => {
  const result = parse(
    'bench press 3 sets of 8 at 60 kilos, then lat pulldown 4 sets of 10 at 50, and squats 5 by 5 at 100',
  );
  assert.equal(result.commands.length, 3);
  assert.deepEqual(
    result.commands.map((c) => (c.kind === 'log_exercise' ? c.exerciseId : c.kind)),
    ['bb_bench', 'lat_pulldown', 'back_squat'],
  );
});

test('a day said once carries to everything after it', () => {
  const result = parse('on monday I did bench press 3 sets of 8 at 60, then rows 3 sets of 10 at 40');
  const dates = result.commands.map((c) => (c.kind === 'log_exercise' ? c.date : ''));
  assert.deepEqual(dates, ['2026-08-24', '2026-08-24'], 'both should land on Monday');
});

test('resolves spoken dates backwards from today', () => {
  assert.equal(parseDate('yesterday', TODAY), '2026-08-26');
  assert.equal(parseDate('on monday', TODAY), '2026-08-24');
  assert.equal(parseDate('on thursday', TODAY), TODAY);
  // Friday has not happened yet this week, so it means last Friday.
  assert.equal(parseDate('on friday', TODAY), '2026-08-21');
  assert.equal(parseDate('no day mentioned', TODAY), null);
});

test('adjusts goals', () => {
  const more = first('more hypertrophy');
  assert.equal(more?.kind, 'adjust_goal');
  if (more?.kind === 'adjust_goal') {
    assert.equal(more.goal, 'hypertrophy');
    assert.equal(more.direction, 'more');
  }
  const less = first('less strength please');
  if (less?.kind === 'adjust_goal') assert.equal(less.direction, 'less');
  const focus = first('focus on calisthenics');
  if (focus?.kind === 'adjust_goal') {
    assert.equal(focus.goal, 'calisthenics');
    assert.equal(focus.direction, 'focus');
  }
});

test('changes schedule settings', () => {
  const days = first('I want to train two days a week');
  assert.equal(days?.kind, 'set_days');
  if (days?.kind === 'set_days') assert.equal(days.days, 2);

  const length = first('make my sessions 45 minutes');
  assert.equal(length?.kind, 'set_session_minutes');
  if (length?.kind === 'set_session_minutes') assert.equal(length.minutes, 45);

  const off = first('I cant train on tuesday');
  assert.equal(off?.kind, 'set_availability');
  if (off?.kind === 'set_availability') {
    assert.equal(off.weekday, 1);
    assert.equal(off.available, false);
  }
});

test('adds runs and volley', () => {
  const run = first('I run on tuesday for 45 minutes');
  assert.equal(run?.kind, 'add_activity');
  if (run?.kind === 'add_activity') {
    assert.equal(run.activityType, 'run_easy');
    assert.equal(run.weekday, 1);
    assert.equal(run.durationMin, 45);
  }

  const volley = first('beach volley on thursday for two hours');
  if (volley?.kind === 'add_activity') {
    assert.equal(volley.activityType, 'volleyball');
    assert.equal(volley.weekday, 3);
    assert.equal(volley.durationMin, 120);
  }

  const intervals = first('intervals on wednesday');
  if (intervals?.kind === 'add_activity') assert.equal(intervals.activityType, 'run_intervals');
});

test('records soreness', () => {
  const sore = first('my hamstrings are sore');
  assert.equal(sore?.kind, 'set_soreness');
  if (sore?.kind === 'set_soreness') {
    assert.equal(sore.muscle, 'hamstrings');
    assert.equal(sore.level, 2);
  }
  const bad = first('my quads are really sore');
  if (bad?.kind === 'set_soreness') assert.equal(bad.level, 3);
});

test('mixes logging and settings in one dictation', () => {
  const result = parse(
    'on monday I did bench press 3 sets of 8 at 60 kilos. my chest is sore. more hypertrophy',
  );
  assert.deepEqual(result.commands.map((c) => c.kind), ['log_exercise', 'set_soreness', 'adjust_goal']);
  assert.equal(result.unrecognised.length, 0);
});

test('reports what it could not understand instead of guessing', () => {
  const result = parse('bench press 3 sets of 8, and something totally unintelligible');
  assert.equal(result.commands.length, 1);
  assert.ok(result.unrecognised.length >= 1, 'the unparsed fragment should be surfaced');
});

test('every command carries a summary the user can check', () => {
  const result = parse('squats 5 by 5 at 100 kilos, more strength, I cant train on friday');
  assert.equal(result.commands.length, 3);
  for (const command of result.commands) {
    assert.ok(command.summary.length > 0, `${command.kind} needs a summary`);
  }
  assert.match(result.commands[0]!.summary, /Back squat — 5×5 100kg/);
});

test('unpunctuated dictation keeps each set with its own exercise', () => {
  // Speech recognition returns no commas, so this is one continuous string.
  const result = parse(
    'bench press three sets of eight at sixty kilos lat pulldown four sets of ten at fifty squats five by five at a hundred',
  );
  assert.equal(result.commands.length, 3);
  assert.deepEqual(
    result.commands.map((c) => (c.kind === 'log_exercise' ? [c.exerciseId, c.sets, c.reps, c.weightKg] : null)),
    [
      ['bb_bench', 3, 8, 60],
      ['lat_pulldown', 4, 10, 50],
      ['back_squat', 5, 5, 100],
    ],
    'numbers must stay attached to the exercise they were spoken with',
  );
});

test('a leading date survives the split into separate exercises', () => {
  const result = parse(
    'on monday i did squats five sets of five at a hundred kilos bench press four sets of six at seventy',
  );
  assert.equal(result.commands.length, 2);
  const [squat, bench] = result.commands;
  assert.equal(squat?.kind === 'log_exercise' && squat.exerciseId, 'back_squat');
  assert.equal(bench?.kind === 'log_exercise' && bench.exerciseId, 'bb_bench');
  for (const command of result.commands) {
    assert.equal(command.kind === 'log_exercise' && command.date, '2026-08-24');
  }
});

test('never merges two exercises into one wrong entry', () => {
  // The failure that matters: one exercise's name with another's numbers.
  const result = parse('squats 5 by 5 at 100 bench press 3 by 10 at 60');
  const logs = result.commands.filter((c) => c.kind === 'log_exercise');
  assert.equal(logs.length, 2);
  const squat = logs.find((c) => c.kind === 'log_exercise' && c.exerciseId === 'back_squat');
  assert.ok(squat?.kind === 'log_exercise' && squat.reps === 5 && squat.weightKg === 100);
});

test('names several sore muscles at once', () => {
  const result = parse('my hamstrings and quads are sore');
  assert.equal(result.commands.length, 2);
  assert.deepEqual(
    result.commands.map((c) => (c.kind === 'set_soreness' ? c.muscle : null)).sort(),
    ['hamstrings', 'quads'],
  );
});

test('pain is treated as something to work around, not just soreness', () => {
  const command = first('my shoulder hurts');
  assert.equal(command?.kind, 'avoid_muscle');
  if (command?.kind === 'avoid_muscle') {
    assert.equal(command.muscle, 'front_delts');
    assert.equal(command.avoid, true);
  }
});

test('one continuous dictation yields every instruction in it', () => {
  // Exactly what speech recognition hands over: no punctuation, four
  // instructions of three different kinds run together.
  const result = parse(
    'on monday i did squats five sets of five at a hundred kilos bench press three sets of ' +
      'eight at sixty kilos my hamstrings are sore more calisthenics',
  );
  assert.deepEqual(
    result.commands.map((c) => c.kind),
    ['log_exercise', 'log_exercise', 'set_soreness', 'adjust_goal'],
  );
  assert.equal(result.unrecognised.length, 0);
  const [squat, bench] = result.commands;
  assert.ok(squat?.kind === 'log_exercise' && squat.exerciseId === 'back_squat' && squat.weightKg === 100);
  assert.ok(bench?.kind === 'log_exercise' && bench.exerciseId === 'bb_bench' && bench.weightKg === 60);
});

test('speech after an exercise is still parsed, not swallowed', () => {
  const result = parse('bench press three sets of eight at sixty kilos and my chest is sore');
  assert.deepEqual(result.commands.map((c) => c.kind), ['log_exercise', 'set_soreness']);
});

test('back-to-back bodyweight work keeps its own reps', () => {
  const result = parse('pull ups four sets of eight bodyweight dips three sets of twelve bodyweight');
  assert.deepEqual(
    result.commands.map((c) => (c.kind === 'log_exercise' ? [c.exerciseId, c.sets, c.reps, c.weightKg] : null)),
    [['pullup', 4, 8, null], ['dip', 3, 12, null]],
  );
});

test('two settings in one sentence both apply', () => {
  const result = parse('i cant train on tuesday and i want to train two days a week');
  assert.deepEqual(result.commands.map((c) => c.kind), ['set_availability', 'set_days']);
});

test('large spoken loads survive', () => {
  const command = first('yesterday i did leg press four sets of twelve at one hundred and forty kilos');
  assert.ok(command?.kind === 'log_exercise' && command.weightKg === 140);
  assert.equal(command.kind === 'log_exercise' && command.date, '2026-08-26');
});
