import { generateWeekPlan } from '../src/domain/planner';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { normaliseGoals } from '../src/domain/goals';
import { makeProfile, RUNS_AND_VOLLEY } from '../tests/fixtures';
import { WEEKDAY_LABEL } from '../src/domain/date';

const goals = normaliseGoals({ hypertrophy: 0.1, strength: 0.1, calisthenics: 0.7, endurance: 0.05, longevity: 0.05 });
const plan = generateWeekPlan({ profile: makeProfile({ goals }), activities: RUNS_AND_VOLLEY, weekStart: '2026-08-24', logs: [], seed: 7 });
console.log('SPLIT:', plan.splitName);
for (const day of plan.days) {
  console.log(`── ${WEEKDAY_LABEL[day.weekday]} · ${day.title}`);
  for (const e of day.exercises) {
    const ex = EXERCISE_BY_ID[e.exerciseId]!;
    console.log(`   ${e.slot.padEnd(3)} ${ex.name.padEnd(32)} [${ex.pattern}] load=${ex.loadType}`);
  }
}
