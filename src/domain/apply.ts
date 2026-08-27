import { normaliseGoals } from './goals';
import { EXERCISE_BY_ID } from './exercises';
import { MUSCLE_LABEL } from './muscles';
import { ACTIVITY_LABEL } from './activities';
import { WEEKDAY_LABEL, formatDayLabel, fromISODate, weekStartISO } from './date';
import { adaptRemainingDays } from './store';
import type { Command } from './voice';
import { AD_HOC_DAY, type AppState, type LoggedSet, type SessionLog } from './types';

export interface ApplyResult {
  state: AppState;
  /** What actually happened, shown back to the user after applying. */
  notes: string[];
}

export interface ApplyOptions {
  today: string;
  /** Session to log into, when dictating inside an open session. */
  targetLogId?: string;
}

function loggedSet(reps: number, weightKg: number | null): LoggedSet {
  return { reps, weightKg, rpe: null, done: true };
}

/** The session a dictated exercise should land in, creating one if needed. */
function sessionForDate(state: AppState, date: string, targetLogId?: string): { state: AppState; logId: string } {
  if (targetLogId && state.logs.some((l) => l.id === targetLogId)) {
    return { state, logId: targetLogId };
  }
  const weekStart = weekStartISO(fromISODate(date));
  // Reuse a dictated session already started for that day.
  const existing = state.logs.find((l) => l.date === date && l.dayIndex === AD_HOC_DAY);
  if (existing) return { state, logId: existing.id };

  const log: SessionLog = {
    id: `${weekStart}#extra-${date}-${Math.random().toString(36).slice(2, 7)}`,
    weekStart,
    date,
    dayIndex: AD_HOC_DAY,
    title: 'Dictated session',
    completed: true,
    sessionRpe: null,
    durationMin: null,
    soreness: {},
    exercises: [],
  };
  return { state: { ...state, logs: [...state.logs, log] }, logId: log.id };
}

function updateLog(state: AppState, logId: string, change: (log: SessionLog) => SessionLog): AppState {
  return { ...state, logs: state.logs.map((l) => (l.id === logId ? change(l) : l)) };
}

/**
 * Applies dictated commands to the app state. Pure, so the same call can drive
 * both the preview and the save, and every branch is testable without a browser.
 */
export function applyCommands(state: AppState, commands: Command[], options: ApplyOptions): ApplyResult {
  let next = state;
  const notes: string[] = [];
  const touchedWeeks = new Set<string>();
  let lastLogId: string | undefined = options.targetLogId;

  for (const command of commands) {
    switch (command.kind) {
      case 'log_exercise': {
        const exercise = EXERCISE_BY_ID[command.exerciseId];
        if (!exercise) break;
        const session = sessionForDate(next, command.date, options.targetLogId);
        next = session.state;
        lastLogId = session.logId;
        touchedWeeks.add(weekStartISO(fromISODate(command.date)));
        const sets = Array.from({ length: command.sets }, () => loggedSet(command.reps, command.weightKg));
        next = updateLog(next, session.logId, (log) => {
          const at = log.exercises.findIndex((e) => e.exerciseId === command.exerciseId);
          // Saying the same exercise twice adds sets rather than replacing them.
          const exercises = at >= 0
            ? log.exercises.map((e, i) => (i === at ? { ...e, sets: [...e.sets, ...sets] } : e))
            : [...log.exercises, { exerciseId: command.exerciseId, sets }];
          return { ...log, exercises };
        });
        notes.push(`Logged ${exercise.name} ${command.sets}×${command.reps} on ${formatDayLabel(command.date)}`);
        break;
      }

      case 'adjust_goal': {
        const current = next.profile.goals;
        const delta = command.direction === 'less' ? -0.15 : command.direction === 'focus' ? 0.4 : 0.15;
        const raw = { ...current, [command.goal]: Math.max(0, current[command.goal] + delta) };
        next = { ...next, profile: { ...next.profile, goals: normaliseGoals(raw) } };
        const now = Math.round(normaliseGoals(raw)[command.goal] * 100);
        notes.push(`${command.summary} — now ${now}% of your goal mix`);
        break;
      }

      case 'set_days': {
        const structures = Array.from(
          { length: command.days },
          (_, i) => next.profile.structures[i] ?? next.profile.structures[0]!,
        );
        next = { ...next, profile: { ...next.profile, daysPerWeek: command.days, structures } };
        notes.push(command.summary);
        break;
      }

      case 'set_availability': {
        next = {
          ...next,
          profile: {
            ...next.profile,
            availability: { ...next.profile.availability, [command.weekday]: command.available },
          },
        };
        notes.push(command.summary);
        break;
      }

      case 'set_session_minutes': {
        next = { ...next, profile: { ...next.profile, sessionMinutes: command.minutes } };
        notes.push(command.summary);
        break;
      }

      case 'add_activity': {
        const existing = next.activities.find(
          (a) => a.type === command.activityType && a.day === command.weekday,
        );
        if (existing) {
          next = {
            ...next,
            activities: next.activities.map((a) =>
              a.id === existing.id ? { ...a, durationMin: command.durationMin } : a,
            ),
          };
          notes.push(`Updated ${ACTIVITY_LABEL[command.activityType].toLowerCase()} on ${WEEKDAY_LABEL[command.weekday]} to ${command.durationMin} min`);
        } else {
          next = {
            ...next,
            activities: [
              ...next.activities,
              {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: command.activityType,
                day: command.weekday,
                durationMin: command.durationMin,
                intensity: 2,
              },
            ],
          };
          notes.push(command.summary);
        }
        break;
      }

      case 'set_soreness': {
        // Soreness rides on a session; use the one being dictated into, else
        // the most recent, since that is what the planner reads back.
        const target = lastLogId
          ? next.logs.find((l) => l.id === lastLogId)
          : [...next.logs].sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!target) {
          notes.push(`Could not record ${MUSCLE_LABEL[command.muscle].toLowerCase()} soreness — log a session first`);
          break;
        }
        next = updateLog(next, target.id, (log) => ({
          ...log,
          soreness: { ...log.soreness, [command.muscle]: command.level },
        }));
        touchedWeeks.add(target.weekStart);
        notes.push(command.summary);
        break;
      }

      case 'avoid_muscle': {
        const avoid = command.avoid
          ? [...new Set([...next.profile.avoid, command.muscle])]
          : next.profile.avoid.filter((m) => m !== command.muscle);
        next = { ...next, profile: { ...next.profile, avoid } };
        notes.push(command.summary);
        break;
      }
    }
  }

  // Anything logged changes what the rest of those weeks should look like.
  for (const week of touchedWeeks) {
    const revised = adaptRemainingDays(next, week, options.today);
    if (revised) next = { ...next, plans: { ...next.plans, [week]: revised } };
  }

  const changedSettings = commands.some((c) =>
    c.kind === 'adjust_goal' || c.kind === 'set_days' || c.kind === 'set_availability' ||
    c.kind === 'set_session_minutes' || c.kind === 'add_activity' || c.kind === 'avoid_muscle');
  if (changedSettings) {
    next = { ...next, settingsUpdatedAt: new Date().toISOString() };
    notes.push('Settings changed — rebuild the week to see it applied');
  }

  return { state: next, notes };
}
