/** Prints the exercise library ranking — handy when tuning the ratings. */
import { rateExercisesFor, standInsFor } from '../src/domain/library';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { MUSCLE_LABEL, ALL_MUSCLES } from '../src/domain/muscles';
import { makeProfile } from '../tests/fixtures';

const options = { profile: makeProfile(), logs: [] };
for (const muscle of ALL_MUSCLES) {
  const rated = rateExercisesFor(muscle, options);
  if (rated.length === 0) continue;
  console.log(`${MUSCLE_LABEL[muscle].padEnd(14)} ${rated.filter((r) => r.tier === 'staple').map((r) => r.exercise.name).join(', ')}`);
}
console.log('\nStand-ins when the station is busy:');
for (const id of ['bb_bench', 'back_squat', 'lat_pulldown']) {
  const ex = EXERCISE_BY_ID[id]!;
  console.log(`  ${ex.name} → ${standInsFor(ex, options).map((r) => r.exercise.name).join(', ')}`);
}
