import type { Weekday } from './types';

export const WEEKDAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** ISO yyyy-mm-dd in local time (not UTC — a plan is anchored to the user's day). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(d: Date): Weekday {
  return ((d.getDay() + 6) % 7) as Weekday;
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - weekdayOf(copy));
  return copy;
}

export function weekStartISO(d: Date = new Date()): string {
  return toISODate(startOfWeek(d));
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function dateOfWeekday(weekStart: string, weekday: Weekday): string {
  return addDays(weekStart, weekday);
}

export function weeksBetween(aISO: string, bISO: string): number {
  const ms = fromISODate(bISO).getTime() - fromISODate(aISO).getTime();
  return Math.round(ms / (7 * 24 * 3600 * 1000));
}

export function formatDayLabel(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAY_LONG[weekdayOf(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
}
