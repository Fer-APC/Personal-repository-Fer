import { rateExercisesFor } from '../src/domain/library';
import { MUSCLE_LABEL } from '../src/domain/muscles';
import { makeProfile } from '../tests/fixtures';
import type { Muscle } from '../src/domain/types';

const muscles: Muscle[] = ['chest','front_delts','side_delts','rear_delts','lats','upper_back','biceps','triceps','quads','hamstrings','glutes','abs','obliques','lower_back'];
for (const [label, preferNoQueue] of [['MACHINES FINE', false], ['AVOIDING MACHINES', true]] as [string, boolean][]) {
  console.log(`\n=== ${label} ===`);
  const options = { profile: makeProfile({ preferNoQueue, limitedSpace: true }), logs: [] };
  for (const m of muscles) {
    const top = rateExercisesFor(m, options).slice(0, 3);
    console.log(`${MUSCLE_LABEL[m].padEnd(13)} ${top.map((r) => r.exercise.name).join('  ·  ')}`);
  }
}
