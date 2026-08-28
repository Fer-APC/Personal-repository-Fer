import { generateWeekPlan } from '../src/domain/planner';
import { computeExternalLoad, legLoadIndex, overheadIndex } from '../src/domain/activities';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { makeProfile, RUNS_AND_VOLLEY } from '../tests/fixtures';

const load = computeExternalLoad(RUNS_AND_VOLLEY);
console.log('legIdx', legLoadIndex(load).toFixed(2), 'overheadIdx', overheadIndex(load).toFixed(2));
const plan = generateWeekPlan({ profile: makeProfile(), activities: RUNS_AND_VOLLEY, weekStart: '2026-08-24', logs: [], seed: 7, today: '2026-08-24' });
console.log('split:', plan.splitName);
for (const day of plan.days) {
  console.log(`\n${day.title}`);
  for (const e of day.exercises) {
    const d = EXERCISE_BY_ID[e.exerciseId]!;
    console.log(`   ${e.slot.padEnd(3)} ${d.name.padEnd(30)} [${d.pattern}] shoulderStress=${d.shoulderStress}`);
  }
  day.notes.forEach((n) => console.log('    !', n));
}
