import { standInsFor, rateExercisesFor } from '../src/domain/library';
import { EXERCISE_BY_ID } from '../src/domain/exercises';
import { makeProfile } from '../tests/fixtures';

const options = { profile: makeProfile({ limitedSpace: true }), logs: [], equipmentBusy: false, limit: 8 };
const ex = EXERCISE_BY_ID['trap_bar_dl']!;
console.log('trap-bar deadlift primary:', ex.primary.join(', '));
const alts = standInsFor(ex, options);
console.log('stand-ins returned:', alts.length, alts.map((r) => r.exercise.name));

console.log('\ncandidate pool per primary muscle:');
for (const m of ex.primary) {
  const rated = rateExercisesFor(m, options);
  console.log(`  ${m}: ${rated.length} rated`);
}

// Reproduce the overlap filter by hand.
const overlap = (c: typeof ex) =>
  ex.primary.reduce((s, m) => s + (c.primary.includes(m) ? 1 : c.secondary.includes(m) ? 0.5 : 0), 0) / ex.primary.length;
for (const id of ['back_squat', 'bulgarian_split_squat', 'rdl', 'leg_press', 'deadlift']) {
  const c = EXERCISE_BY_ID[id]!;
  console.log(`  overlap(${c.name}) = ${overlap(c).toFixed(2)}  pattern=${c.pattern} vs ${ex.pattern}`);
}
