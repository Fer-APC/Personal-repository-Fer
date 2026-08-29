import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateWeekPlan } from '../src/domain/planner';
import { STATE_VERSION, migrate } from '../src/domain/store';
import { computeWeekProgress } from '../src/domain/progress';
import { makeProfile, RUNS_AND_VOLLEY } from './fixtures';
import type { AppState, WeekPlan } from '../src/domain/types';

const WEEK = '2026-08-24';

/** A plan loosened so release-specific fields can be stripped off it. */
type LoosePlan = Omit<WeekPlan, 'targets' | 'balance' | 'capacity'> & {
  targets?: unknown;
  balance?: unknown;
  capacity?: unknown;
};

function currentPlan(): WeekPlan {
  return generateWeekPlan({
    profile: makeProfile(),
    activities: RUNS_AND_VOLLEY,
    weekStart: WEEK,
    logs: [],
    seed: 3,
    today: WEEK,
  });
}

/** A state as written by the previous release: no targets, no template keys. */
function version1State(): Partial<AppState> {
  const plan = currentPlan() as LoosePlan;
  delete plan.targets;
  const days = plan.days.map((day) => {
    const copy = { ...day } as Partial<typeof day>;
    delete copy.templateKey;
    return copy;
  });
  return {
    version: 1,
    profile: makeProfile(),
    activities: RUNS_AND_VOLLEY,
    logs: [],
    onboarded: true,
    plans: { [WEEK]: { ...plan, days } as WeekPlan },
  };
}

test('a state saved by the previous release loads and renders', () => {
  const migrated = migrate(version1State());
  assert.equal(migrated.version, STATE_VERSION);

  const plan = migrated.plans[WEEK]!;
  assert.ok(plan.targets, 'targets must be reconstructed');
  assert.ok(Object.keys(plan.targets).length > 0, 'targets must not be empty');
  assert.equal(plan.targets.chest, plan.balance.find((b) => b.muscle === 'chest')!.target);
  for (const day of plan.days) {
    assert.equal(typeof day.templateKey, 'string', 'every day needs a template key');
  }

  // The exact call that used to crash on old data.
  const progress = computeWeekProgress(plan, migrated.logs, WEEK, 3);
  assert.ok(progress.muscles.length > 0);
  assert.equal(progress.setsLogged, 0);
});

test('migration keeps logged sessions and settings intact', () => {
  const v1 = version1State();
  v1.logs = [
    {
      id: `${WEEK}#0`,
      weekStart: WEEK,
      date: WEEK,
      dayIndex: 0,
      title: 'Session',
      completed: true,
      sessionRpe: 8,
      durationMin: 60,
      soreness: {},
      exercises: [{ exerciseId: 'bb_bench', sets: [{ reps: 8, weightKg: 60, rpe: 8, done: true }] }],
    },
  ];
  const migrated = migrate(v1);
  assert.equal(migrated.logs.length, 1);
  assert.equal(migrated.logs[0]!.exercises[0]!.exerciseId, 'bb_bench');
  assert.equal(migrated.onboarded, true);
  assert.equal(migrated.activities.length, RUNS_AND_VOLLEY.length);
  assert.equal(migrated.profile.daysPerWeek, makeProfile().daysPerWeek);
});

test('a plan with no balance rows at all still migrates', () => {
  const plan = currentPlan() as LoosePlan;
  delete plan.targets;
  delete plan.balance;
  const migrated = migrate({ plans: { [WEEK]: plan as WeekPlan } });
  assert.deepEqual(migrated.plans[WEEK]!.targets, {});
  assert.deepEqual(migrated.plans[WEEK]!.balance, []);
  assert.doesNotThrow(() => computeWeekProgress(migrated.plans[WEEK]!, [], WEEK, 3));
});

test('empty and partial states fall back to defaults', () => {
  assert.equal(migrate({}).version, STATE_VERSION);
  assert.equal(migrate({}).onboarded, false);
  assert.deepEqual(migrate({}).plans, {});
  assert.equal(migrate({ onboarded: true }).profile.daysPerWeek, 3);
});

test('a plan saved before capacity tracking still loads and renders', () => {
  const plan = currentPlan() as LoosePlan;
  delete plan.capacity;
  const migrated = migrate({ version: 2, plans: { [WEEK]: plan as WeekPlan } });

  const restored = migrated.plans[WEEK]!;
  assert.ok(restored.capacity, 'capacity must be reconstructed');
  assert.ok(restored.capacity.ratio > 0 && restored.capacity.ratio <= 1);
  assert.equal(migrated.version, STATE_VERSION);
  assert.doesNotThrow(() => computeWeekProgress(restored, [], WEEK, 3));
});

test('a stored plan with no targets at all is discarded so the week rebuilds', () => {
  // An earlier release zeroed every target once a week ran out of gym days.
  // Such a plan reports every muscle as satisfied against a target of zero.
  const plan = currentPlan();
  const zeroed = { ...plan, targets: Object.fromEntries(Object.keys(plan.targets).map((m) => [m, 0])) };

  const logs = [
    {
      id: `${WEEK}#0`,
      weekStart: WEEK,
      date: WEEK,
      dayIndex: 0,
      title: 'Session',
      completed: true,
      sessionRpe: 8,
      durationMin: 60,
      soreness: {},
      exercises: [{ exerciseId: 'bb_bench', sets: [{ reps: 8, weightKg: 60, rpe: 8, done: true }] }],
    },
  ];
  const migrated = migrate({ version: 3, plans: { [WEEK]: zeroed as WeekPlan }, logs });
  assert.equal(migrated.plans[WEEK], undefined, 'the unusable plan should not survive the load');
  assert.deepEqual(Object.keys(migrated.plans), [], 'so the week regenerates from scratch');
  // Plans are rebuildable; the training you logged is not.
  assert.equal(migrated.logs.length, 1, 'discarding a plan must never discard logged sessions');
  assert.equal(migrated.logs[0]!.exercises[0]!.exerciseId, 'bb_bench');
});

test('a healthy plan is never discarded', () => {
  const plan = currentPlan();
  const migrated = migrate({ version: 3, plans: { [WEEK]: plan } });
  assert.ok(migrated.plans[WEEK], 'a plan with real targets must be kept');
  assert.deepEqual(migrated.plans[WEEK]!.targets, plan.targets);
});

test('a deload week keeps its reduced but real targets', () => {
  const plan = currentPlan();
  const deloaded = {
    ...plan,
    deload: true,
    targets: Object.fromEntries(Object.entries(plan.targets).map(([m, v]) => [m, (v ?? 0) * 0.5])),
  };
  const migrated = migrate({ version: 3, plans: { [WEEK]: deloaded as WeekPlan } });
  assert.ok(migrated.plans[WEEK], 'a light week is still a usable week');
});
