import { ALL_MUSCLES } from './muscles';
import { EXERCISE_BY_ID } from './exercises';
import { completedSetsByMuscle } from './progression';
import { weekdayOf, fromISODate } from './date';
import type { Muscle, SessionLog, WeekPlan, Weekday } from './types';

export interface MuscleProgress {
  muscle: Muscle;
  /** What the week asks for. */
  target: number;
  /** What you actually logged, primary at full credit and assistance at half. */
  logged: number;
  /** What the sessions you haven't done yet still cover. */
  scheduled: number;
  /** Still uncovered once the rest of the week is done, floored at zero. */
  shortfall: number;
}

export interface WeekProgress {
  muscles: MuscleProgress[];
  /** Sessions actually trained this week, planned or not. */
  sessionsDone: number;
  /** Gym days a week you asked for — what "done" is measured against. */
  sessionsTarget: number;
  /** Planned sessions still ahead of you. */
  sessionsRemaining: number;
  setsLogged: number;
  /** Share of the week's total target already logged, 0-1. */
  covered: number;
  /** Muscles the remaining sessions won't get to, worst first. */
  shortfalls: MuscleProgress[];
}

/** Sessions logged against this week, planned or not. */
export function weekLogs(logs: SessionLog[], weekStart: string): SessionLog[] {
  return logs.filter((l) => l.weekStart === weekStart);
}

export function hasLoggedWork(log: SessionLog | undefined): boolean {
  return !!log && log.exercises.some((e) => e.sets.some((s) => s.done));
}

/**
 * Days that can no longer change: already trained, or in the past. Their work
 * counts for what it was, not what it was supposed to be.
 */
export function lockedDayIndexes(plan: WeekPlan, logs: SessionLog[], today: string): number[] {
  const week = weekLogs(logs, plan.weekStart);
  return plan.days
    .map((day, index) => {
      const log = week.find((l) => l.dayIndex === index);
      return day.date < today || hasLoggedWork(log) ? index : -1;
    })
    .filter((index) => index >= 0);
}

/** Muscles actually worked on each weekday, for recovery spacing when replanning. */
export function workedByWeekday(logs: SessionLog[], weekStart: string): { weekday: Weekday; muscles: Muscle[] }[] {
  return weekLogs(logs, weekStart)
    .filter(hasLoggedWork)
    .map((log) => ({
      weekday: weekdayOf(fromISODate(log.date)),
      muscles: log.exercises
        .filter((entry) => entry.sets.some((s) => s.done))
        .flatMap((entry) => EXERCISE_BY_ID[entry.exerciseId]?.primary ?? []),
    }));
}

/** Volume banked so far this week, in the same units as the weekly targets. */
export function consumedThisWeek(logs: SessionLog[], weekStart: string): Partial<Record<Muscle, number>> {
  return completedSetsByMuscle(weekLogs(logs, weekStart));
}

export function computeWeekProgress(
  plan: WeekPlan,
  logs: SessionLog[],
  today: string,
  sessionsTarget: number,
): WeekProgress {
  const week = weekLogs(logs, plan.weekStart);
  const logged = consumedThisWeek(logs, plan.weekStart);
  const locked = new Set(lockedDayIndexes(plan, logs, today));

  // Only sessions still ahead of you count as scheduled coverage.
  const scheduled: Partial<Record<Muscle, number>> = {};
  plan.days.forEach((day, index) => {
    if (locked.has(index)) return;
    for (const exercise of day.exercises) {
      const definition = EXERCISE_BY_ID[exercise.exerciseId];
      if (!definition) continue;
      for (const muscle of definition.primary) {
        scheduled[muscle] = (scheduled[muscle] ?? 0) + exercise.sets;
      }
      for (const muscle of definition.secondary) {
        scheduled[muscle] = (scheduled[muscle] ?? 0) + exercise.sets * 0.5;
      }
    }
  });

  const round = (n: number) => Math.round(n * 2) / 2;
  const muscles: MuscleProgress[] = ALL_MUSCLES.map((muscle) => {
    const target = plan.targets?.[muscle] ?? 0;
    const done = round(logged[muscle] ?? 0);
    const ahead = round(scheduled[muscle] ?? 0);
    return {
      muscle,
      target,
      logged: done,
      scheduled: ahead,
      shortfall: round(Math.max(0, target - done - ahead)),
    };
  });

  const totalTarget = muscles.reduce((sum, m) => sum + m.target, 0);
  const totalLogged = muscles.reduce((sum, m) => sum + m.logged, 0);
  const setsLogged = week.reduce(
    (n, log) => n + log.exercises.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0),
    0,
  );

  return {
    muscles,
    sessionsDone: week.filter((l) => l.completed || hasLoggedWork(l)).length,
    sessionsTarget,
    sessionsRemaining: plan.days.filter((_, index) => !locked.has(index)).length,
    setsLogged,
    covered: totalTarget > 0 ? Math.min(1, totalLogged / totalTarget) : 0,
    shortfalls: muscles
      .filter((m) => m.shortfall >= 1.5 && m.target >= 2)
      .sort((a, b) => b.shortfall - a.shortfall),
  };
}
