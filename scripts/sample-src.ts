import { migrate } from '../src/domain/store';
import { generateWeekPlan } from '../src/domain/planner';
import { makeProfile } from '../tests/fixtures';
import type { AppState, Weekday, WeekPlan } from '../src/domain/types';

const WEEK = '2026-08-24';
const availability: Record<Weekday, boolean> = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: false, 6: false };
const profile = makeProfile({ daysPerWeek: 2, availability });

// A plan as the previous release stored it: generated on a Saturday, when the
// old code multiplied every target by zero remaining gym days.
const plan = generateWeekPlan({ profile, activities: [], weekStart: WEEK, logs: [], seed: 5, today: '2026-08-29' });
const stale: WeekPlan = { ...plan, targets: Object.fromEntries(Object.keys(plan.targets).map((m) => [m, 0])) };

console.log('stored plan target total:', Object.values(stale.targets).reduce((s, v) => s + (v ?? 0), 0));

const state: Partial<AppState> = { version: 3, profile, plans: { [WEEK]: stale }, logs: [], activities: [] };
const loaded = migrate(state);
const after = loaded.plans[WEEK]!;
console.log('after loading with the fixed code:', after ? `target total ${Object.values(after.targets).reduce((s, v) => s + (v ?? 0), 0)}` : 'plan discarded');
console.log('=> every muscle would read "target 0" and be marked done:', Object.values(after?.targets ?? {}).every((v) => (v ?? 0) === 0));
