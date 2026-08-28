import { generateWeekPlan } from '../src/domain/planner';
import { computeWeekProgress } from '../src/domain/progress';
import { makeProfile } from '../tests/fixtures';
import type { Activity, Weekday } from '../src/domain/types';

const activities: Activity[] = [
  { id: 'v1', type: 'volleyball', day: 3, durationMin: 90, intensity: 2 },
  { id: 'v2', type: 'volleyball', day: 4, durationMin: 90, intensity: 2 },
];
const WEEK = '2026-08-24';
// Gym only on weekdays — a very ordinary setup.
const availability: Record<Weekday, boolean> = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: false, 6: false };

for (const today of ['2026-08-28', '2026-08-29', '2026-08-30']) {
  const plan = generateWeekPlan({
    profile: makeProfile({ daysPerWeek: 2, availability }), activities, weekStart: WEEK, logs: [], seed: 5, today,
  });
  const targetTotal = Object.values(plan.targets).reduce((s, v) => s + (v ?? 0), 0);
  const rows = plan.balance.filter((r) => r.target > 0 || r.planned > 0).length;
  const progress = computeWeekProgress(plan, [], today, 2);
  console.log(
    `${today} (${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(new Date(today).getDay()+6)%7]}): ` +
    `days=${plan.days.length} ratio=${plan.capacity.ratio.toFixed(2)} targetTotal=${targetTotal} ` +
    `balanceRows=${rows} pushPull=${plan.ratios.pushPull} covered=${progress.covered}`,
  );
  if (plan.warnings.length) console.log('    warning:', plan.warnings[0]);
}
