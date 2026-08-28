import { generateWeekPlan } from '../src/domain/planner';
import { computeWeekProgress } from '../src/domain/progress';
import { MUSCLE_LABEL } from '../src/domain/muscles';
import { makeProfile } from '../tests/fixtures';
import type { Activity, DayStructure, SessionLog } from '../src/domain/types';

const activities: Activity[] = [
  { id: 'v1', type: 'volleyball', day: 3, durationMin: 90, intensity: 2 },
  { id: 'v2', type: 'volleyball', day: 4, durationMin: 90, intensity: 2 },
  { id: 'r1', type: 'run_easy', day: 5, durationMin: 45, intensity: 1 },
];
const wide = (n: number): DayStructure => ({ blocks: Array.from({ length: n }, () => ({ kind: 'single' as const, size: 1 })) });
const WEEK = '2026-08-24';

const plan = generateWeekPlan({
  profile: makeProfile({ daysPerWeek: 2, structures: [wide(5), wide(5)] }),
  activities, weekStart: WEEK, logs: [], seed: 6, today: WEEK,
});

// Do exactly what the plan says.
const logs: SessionLog[] = plan.days.map((day, i) => ({
  id: `${WEEK}#${i}`, weekStart: WEEK, date: day.date, dayIndex: i, title: day.title,
  completed: true, sessionRpe: 8, durationMin: 60, soreness: {},
  exercises: day.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    sets: Array.from({ length: e.sets }, () => ({ reps: e.repRange[1], weightKg: 50, rpe: 8, done: true })),
  })),
}));

const end = '2026-08-31';
const p = computeWeekProgress(plan, logs, end, 2);
console.log(`after doing the whole plan: ${Math.round(p.covered * 100)}% of the week's volume, ${p.setsLogged} sets`);
console.log(`shortfalls remaining: ${p.shortfalls.length}`,
  p.shortfalls.map((s) => `${MUSCLE_LABEL[s.muscle]} -${s.shortfall}`).join(', '));
console.log(`\nfresh-plan shortfalls (nothing logged): ${computeWeekProgress(plan, [], WEEK, 2).shortfalls
  .map((s) => `${MUSCLE_LABEL[s.muscle]} -${s.shortfall}`).join(', ') || 'none'}`);
