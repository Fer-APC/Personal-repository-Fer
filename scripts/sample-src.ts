import { generateWeekPlan } from '../src/domain/planner';
import { computeWeekProgress } from '../src/domain/progress';
import { defaultState, adaptRemainingDays } from '../src/domain/store';
import { DEFAULT_STRUCTURE } from '../src/domain/planner';
import { makeProfile } from '../tests/fixtures';
import type { AppState, SessionLog } from '../src/domain/types';
import { AD_HOC_DAY } from '../src/domain/types';

const WEEK = '2026-08-24';
const done = () => ({ reps: 10, weightKg: 50, rpe: 8, done: true });

// Mirrors the screenshot: 2 days a week, runs + volley loading the legs,
// two sessions already logged outside the plan (Mon and Wed).
const state: AppState = defaultState();
state.profile = makeProfile({ daysPerWeek: 2, structures: [DEFAULT_STRUCTURE, DEFAULT_STRUCTURE] });
state.activities = [
  { id: 'r1', type: 'run_long', day: 5, durationMin: 90, intensity: 3 },
  { id: 'r2', type: 'run_intervals', day: 1, durationMin: 60, intensity: 3 },
  { id: 'v1', type: 'volleyball', day: 3, durationMin: 120, intensity: 3 },
];
state.onboarded = true;

for (const [date, count] of [['2026-08-24', 7], ['2026-08-26', 6]] as [string, number][]) {
  const log: SessionLog = {
    id: `${WEEK}#extra-${date}`, weekStart: WEEK, date, dayIndex: AD_HOC_DAY,
    title: 'Session I did', completed: true, sessionRpe: 8, durationMin: 60, soreness: {},
    exercises: Array.from({ length: count }, (_, i) => ({
      exerciseId: ['bb_bench', 'bb_row', 'db_shoulder_press', 'lat_pulldown', 'bb_curl', 'rope_pushdown', 'cable_fly'][i]!,
      sets: [done(), done(), done()],
    })),
  };
  state.logs.push(log);
}

for (const today of ['2026-08-27', '2026-08-28', '2026-08-30']) {
  state.plans[WEEK] = generateWeekPlan({
    profile: state.profile, activities: state.activities, weekStart: WEEK, logs: state.logs, seed: 4, today,
  });
  const revised = adaptRemainingDays(state, WEEK, today);
  if (revised) state.plans[WEEK] = revised;
  const plan = state.plans[WEEK]!;
  const p = computeWeekProgress(plan, state.logs, today);
  console.log(`today=${today} split="${plan.splitName}" plannedDays=${plan.days.length}` +
    ` → shows "Sessions ${p.sessionsDone} / ${p.sessionsPlanned}"  (daysPerWeek=${state.profile.daysPerWeek})`);
}
