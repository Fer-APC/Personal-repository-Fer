import { generateWeekPlan } from '../src/domain/planner';
import { makeProfile } from '../tests/fixtures';
import type { Activity, DayStructure } from '../src/domain/types';
const activities: Activity[] = [
  { id: 'v1', type: 'volleyball', day: 3, durationMin: 90, intensity: 2 },
  { id: 'v2', type: 'volleyball', day: 4, durationMin: 90, intensity: 2 },
  { id: 'r1', type: 'run_easy', day: 5, durationMin: 45, intensity: 1 },
];
const wide = (n: number): DayStructure => ({ blocks: Array.from({ length: n }, () => ({ kind: 'single' as const, size: 1 })) });
for (const [label, days, per] of [['2 days x 5', 2, 5], ['2 days x 7', 2, 7], ['2 days x 9', 2, 9], ['3 days x 7', 3, 7]] as [string, 2|3, number][]) {
  const plan = generateWeekPlan({
    profile: makeProfile({ daysPerWeek: days, structures: Array.from({ length: days }, () => wide(per)) }),
    activities, weekStart: '2026-08-24', logs: [], seed: 6, today: '2026-08-24',
  });
  const target = plan.balance.reduce((s, r) => s + r.target, 0);
  const delivered = plan.balance.reduce((s, r) => s + r.planned + r.assist * 0.5, 0);
  const sets = plan.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0);
  console.log(`${label.padEnd(12)} ${String(sets).padStart(3)} working sets → ${Math.round((delivered / target) * 100)}% of target`);
}
