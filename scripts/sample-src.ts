/** Prints a generated week to the terminal — handy when tuning the planner. */
import { generateWeekPlan } from '../src/domain/planner';
import { computeWeekProgress } from '../src/domain/progress';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { MUSCLE_LABEL } from '../src/domain/muscles';
import { WEEKDAY_LABEL } from '../src/domain/date';
import { makeProfile, RUNS_AND_VOLLEY } from '../tests/fixtures';

const weekStart = process.argv[2] ?? '2026-08-24';
const plan = generateWeekPlan({
  profile: makeProfile(),
  activities: RUNS_AND_VOLLEY,
  weekStart,
  logs: [],
  seed: 11,
  today: weekStart,
});

console.log(`SPLIT: ${plan.splitName}${plan.deload ? ' (deload)' : ''}`);
plan.reasoning.forEach((line) => console.log(' •', line));

for (const day of plan.days) {
  console.log(`\n── ${WEEKDAY_LABEL[day.weekday]} · ${day.title} · ~${day.estimatedMinutes}min`);
  for (const exercise of day.exercises) {
    const definition = EXERCISE_BY_ID[exercise.exerciseId]!;
    const timed = definition.loadType === 'time' ? 's' : '';
    console.log(
      `   ${exercise.slot.padEnd(3)} ${definition.name.padEnd(32)} ` +
        `${exercise.sets}×${exercise.repRange[0]}-${exercise.repRange[1]}${timed}  rest ${exercise.restSec}s  @RPE${exercise.rpe}`,
    );
  }
  day.notes.forEach((note) => console.log(`       ! ${note}`));
}

const progress = computeWeekProgress(plan, [], weekStart);
console.log('\nSHORTFALLS:', progress.shortfalls.map((s) => `${MUSCLE_LABEL[s.muscle]} -${s.shortfall}`).join(', ') || 'none');
console.log('WARNINGS:', plan.warnings.join(' | ') || 'none');
