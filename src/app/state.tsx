import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { adaptRemainingDays, defaultState, findLog, loadState, planWeek, saveState, sessionIdFor } from '../domain/store';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { hasLoggedWork } from '../domain/progress';
import { toISODate } from '../domain/date';
import { AD_HOC_DAY, type Activity, type AppState, type LoggedSet, type Profile, type SessionLog, type WeekPlan } from '../domain/types';

interface Store {
  state: AppState;
  updateProfile: (patch: Partial<Profile>) => void;
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  removeActivity: (id: string) => void;
  planFor: (weekStart: string) => WeekPlan | undefined;
  ensurePlan: (weekStart: string) => void;
  regeneratePlan: (weekStart: string) => void;
  isStale: (weekStart: string) => boolean;
  swapExercise: (weekStart: string, dayIndex: number, exerciseIndex: number, newId: string) => void;
  logFor: (weekStart: string, dayIndex: number) => SessionLog | undefined;
  logById: (id: string) => SessionLog | undefined;
  startSession: (weekStart: string, dayIndex: number) => void;
  /** Logs a session that was never in the plan. Returns its id. */
  addAdHocSession: (weekStart: string, date: string, title: string) => string;
  addExerciseToLog: (id: string, exerciseId: string) => void;
  removeExerciseFromLog: (id: string, exerciseIndex: number) => void;
  /** Rebuilds the days not yet trained from what has actually been logged. */
  adaptRemaining: (weekStart: string) => void;
  updateLog: (id: string, patch: Partial<SessionLog>) => void;
  updateSet: (id: string, exerciseIndex: number, setIndex: number, patch: Partial<LoggedSet>) => void;
  addSet: (id: string, exerciseIndex: number) => void;
  removeSet: (id: string, exerciseIndex: number) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(state), 200);
    return () => window.clearTimeout(saveTimer.current);
  }, [state]);

  const store = useMemo<Store>(() => {
    const touchSettings = (next: AppState): AppState => ({
      ...next,
      settingsUpdatedAt: new Date().toISOString(),
    });

    return {
      state,
      updateProfile: (patch) =>
        setState((s) => touchSettings({ ...s, profile: { ...s.profile, ...patch } })),

      addActivity: (activity) =>
        setState((s) => touchSettings({ ...s, activities: [...s.activities, activity] })),

      updateActivity: (id, patch) =>
        setState((s) =>
          touchSettings({
            ...s,
            activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          }),
        ),

      removeActivity: (id) =>
        setState((s) => touchSettings({ ...s, activities: s.activities.filter((a) => a.id !== id) })),

      planFor: (weekStart) => state.plans[weekStart],

      ensurePlan: (weekStart) =>
        setState((s) => (s.plans[weekStart] ? s : { ...s, plans: { ...s.plans, [weekStart]: planWeek(s, weekStart) } })),

      regeneratePlan: (weekStart) =>
        setState((s) => ({
          ...s,
          plans: { ...s.plans, [weekStart]: planWeek(s, weekStart, Math.floor(Math.random() * 1e9)) },
        })),

      isStale: (weekStart) => {
        const plan = state.plans[weekStart];
        return !!plan && plan.generatedAt < state.settingsUpdatedAt;
      },

      swapExercise: (weekStart, dayIndex, exerciseIndex, newId) =>
        setState((s) => {
          const plan = s.plans[weekStart];
          const day = plan?.days[dayIndex];
          const planned = day?.exercises[exerciseIndex];
          if (!plan || !day || !planned) return s;
          const replacement = EXERCISE_BY_ID[newId];
          if (!replacement) return s;
          const exercises = day.exercises.map((e, i) =>
            i === exerciseIndex
              ? { ...e, exerciseId: newId, rationale: `Swapped in for ${EXERCISE_BY_ID[planned.exerciseId]?.name ?? 'the original'}.` }
              : e,
          );
          const days = plan.days.map((d, i) => (i === dayIndex ? { ...d, exercises } : d));
          return { ...s, plans: { ...s.plans, [weekStart]: { ...plan, days } } };
        }),

      logFor: (weekStart, dayIndex) => findLog(state, weekStart, dayIndex),

      logById: (id) => state.logs.find((l) => l.id === id),

      startSession: (weekStart, dayIndex) =>
        setState((s) => {
          const id = sessionIdFor(weekStart, dayIndex);
          if (s.logs.some((l) => l.id === id)) return s;
          const day = s.plans[weekStart]?.days[dayIndex];
          if (!day) return s;
          const log: SessionLog = {
            id,
            weekStart,
            date: day.date,
            dayIndex,
            title: day.title,
            completed: false,
            sessionRpe: null,
            durationMin: null,
            soreness: {},
            exercises: day.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              sets: Array.from({ length: e.sets }, () => emptySet()),
            })),
          };
          return { ...s, logs: [...s.logs, log] };
        }),

      addAdHocSession: (weekStart, date, title) => {
        const id = `${weekStart}#extra-${Date.now().toString(36)}`;
        setState((s) => ({
          ...s,
          logs: [
            ...s.logs,
            {
              id,
              weekStart,
              date,
              dayIndex: AD_HOC_DAY,
              title,
              completed: false,
              sessionRpe: null,
              durationMin: null,
              soreness: {},
              exercises: [],
            },
          ],
        }));
        return id;
      },

      addExerciseToLog: (id, exerciseId) =>
        setState((s) => ({
          ...s,
          logs: s.logs.map((log) =>
            log.id === id
              ? {
                  ...log,
                  exercises: [
                    ...log.exercises,
                    { exerciseId, sets: Array.from({ length: 3 }, () => emptySet()) },
                  ],
                }
              : log,
          ),
        })),

      removeExerciseFromLog: (id, exerciseIndex) =>
        setState((s) => ({
          ...s,
          logs: s.logs.map((log) =>
            log.id === id
              ? { ...log, exercises: log.exercises.filter((_, i) => i !== exerciseIndex) }
              : log,
          ),
        })),

      adaptRemaining: (weekStart) =>
        setState((s) => {
          const revised = adaptRemainingDays(s, weekStart);
          return revised ? { ...s, plans: { ...s.plans, [weekStart]: revised } } : s;
        }),

      updateLog: (id, patch) =>
        setState((s) => {
          const logs = s.logs.map((l) => (l.id === id ? { ...l, ...patch } : l));
          const log = logs.find((l) => l.id === id);
          // Finishing a session is the moment the rest of the week should
          // react to what actually happened in it.
          if (!log || !patch.completed || !hasLoggedWork(log)) return { ...s, logs };
          const next = { ...s, logs };
          const revised = adaptRemainingDays(next, log.weekStart, toISODate(new Date()));
          return revised ? { ...next, plans: { ...next.plans, [log.weekStart]: revised } } : next;
        }),

      updateSet: (id, exerciseIndex, setIndex, patch) =>
        setState((s) => ({
          ...s,
          logs: s.logs.map((log) =>
            log.id === id
              ? {
                  ...log,
                  exercises: log.exercises.map((entry, i) =>
                    i === exerciseIndex
                      ? { ...entry, sets: entry.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)) }
                      : entry,
                  ),
                }
              : log,
          ),
        })),

      addSet: (id, exerciseIndex) =>
        setState((s) => ({
          ...s,
          logs: s.logs.map((log) =>
            log.id === id
              ? {
                  ...log,
                  exercises: log.exercises.map((entry, i) =>
                    i === exerciseIndex ? { ...entry, sets: [...entry.sets, lastSetTemplate(entry.sets)] } : entry,
                  ),
                }
              : log,
          ),
        })),

      removeSet: (id, exerciseIndex) =>
        setState((s) => ({
          ...s,
          logs: s.logs.map((log) =>
            log.id === id
              ? {
                  ...log,
                  exercises: log.exercises.map((entry, i) =>
                    i === exerciseIndex && entry.sets.length > 1
                      ? { ...entry, sets: entry.sets.slice(0, -1) }
                      : entry,
                  ),
                }
              : log,
          ),
        })),

      completeOnboarding: () => setState((s) => ({ ...s, onboarded: true })),

      resetAll: () => setState(defaultState()),
    };
  }, [state]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function emptySet(): LoggedSet {
  return { reps: null, weightKg: null, rpe: null, done: false };
}

/** A new set starts from the last one logged — usually the same load. */
function lastSetTemplate(sets: LoggedSet[]): LoggedSet {
  const last = sets[sets.length - 1];
  if (!last) return emptySet();
  return { reps: null, weightKg: last.weightKg, rpe: null, done: false };
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
