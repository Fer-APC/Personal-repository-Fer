import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/state';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { MUSCLE_LABEL } from '../domain/muscles';
import { ACTIVITY_LABEL } from '../domain/activities';
import { alternativesFor } from '../domain/swap';
import { WEEKDAY_LABEL, addDays, formatDayLabel, fromISODate, toISODate, weekStartISO } from '../domain/date';
import { Card, Chip, Modal } from './components';
import type { PlannedDay, PlannedExercise } from '../domain/types';

function formatReps(exercise: PlannedExercise): string {
  const timed = EXERCISE_BY_ID[exercise.exerciseId]?.loadType === 'time';
  const [low, high] = exercise.repRange;
  return timed ? `${low}-${high}s` : `${low}-${high}`;
}

function formatRest(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}min` : `${minutes}min ${rest}s`;
}

export function WeekView({ onOpenSession }: { onOpenSession: (weekStart: string, dayIndex: number) => void }) {
  const store = useStore();
  const [weekStart, setWeekStart] = useState(() => weekStartISO(new Date()));
  const plan = store.planFor(weekStart);
  const today = toISODate(new Date());

  useEffect(() => {
    store.ensurePlan(weekStart);
    // ensurePlan is a no-op once the week exists, so this only runs on new weeks.
  }, [weekStart, store]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const start = fromISODate(weekStart);
    const finish = fromISODate(end);
    return `${start.getDate()}/${start.getMonth() + 1} – ${finish.getDate()}/${finish.getMonth() + 1}`;
  }, [weekStart]);

  if (!plan) {
    return <div className="empty">Building your week…</div>;
  }

  const isThisWeek = weekStart === weekStartISO(new Date());

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{isThisWeek ? 'This week' : weekLabel}</h1>
          <div className="sub">
            {plan.splitName}
            {plan.deload ? ' · deload' : ''}
          </div>
        </div>
        <div className="row">
          <button type="button" className="tiny-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹</button>
          {!isThisWeek && (
            <button type="button" className="tiny-btn" onClick={() => setWeekStart(weekStartISO(new Date()))}>Today</button>
          )}
          <button type="button" className="tiny-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">›</button>
        </div>
      </div>

      {store.isStale(weekStart) && (
        <div className="banner info">
          <div className="row between">
            <span>Your settings changed since this plan was built.</span>
            <button type="button" className="tiny-btn" onClick={() => store.regeneratePlan(weekStart)}>Rebuild</button>
          </div>
        </div>
      )}

      {plan.warnings.map((warning) => (
        <div key={warning} className="banner warn">{warning}</div>
      ))}

      <Card>
        <details className="why-week">
          <summary>Why this week looks like this</summary>
          <ul>
            {plan.reasoning.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </details>
        {store.state.activities.length > 0 && (
          <div className="row wrap" style={{ marginTop: 10 }}>
            {store.state.activities
              .slice()
              .sort((a, b) => a.day - b.day)
              .map((activity) => (
                <Chip key={activity.id}>
                  {WEEKDAY_LABEL[activity.day]} · {ACTIVITY_LABEL[activity.type]}
                </Chip>
              ))}
          </div>
        )}
      </Card>

      {plan.days.map((day, dayIndex) => (
        <DayCard
          key={day.date}
          day={day}
          dayIndex={dayIndex}
          weekStart={weekStart}
          isToday={day.date === today}
          onOpenSession={onOpenSession}
        />
      ))}

      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <button type="button" className="wide" onClick={() => store.regeneratePlan(weekStart)}>
          Shuffle this week
        </button>
      </div>
    </>
  );
}

function DayCard({
  day, dayIndex, weekStart, isToday, onOpenSession,
}: {
  day: PlannedDay;
  dayIndex: number;
  weekStart: string;
  isToday: boolean;
  onOpenSession: (weekStart: string, dayIndex: number) => void;
}) {
  const store = useStore();
  const [swapping, setSwapping] = useState<number | null>(null);
  const log = store.logFor(weekStart, dayIndex);
  const doneSets = log?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0;
  const newLifts = day.exercises.filter((e) => e.load.hint === 'first_time').length;

  return (
    <Card>
      <div className="day-header">
        <div className="weekday">
          {formatDayLabel(day.date)}
          {isToday ? <Chip tone="accent">today</Chip> : null}
        </div>
        <div className="small muted">~{day.estimatedMinutes} min</div>
      </div>
      <div className="small muted" style={{ marginBottom: 8 }}>{day.title}</div>

      <div className="row wrap" style={{ marginBottom: 6 }}>
        {day.emphasis.map((muscle) => <Chip key={muscle}>{MUSCLE_LABEL[muscle]}</Chip>)}
      </div>

      {day.exercises.map((exercise, index) => {
        const previous = day.exercises[index - 1];
        const startsBlock = !previous || previous.blockIndex !== exercise.blockIndex;
        const blockSize = day.exercises.filter((e) => e.blockIndex === exercise.blockIndex).length;
        const definition = EXERCISE_BY_ID[exercise.exerciseId];
        return (
          <div key={`${exercise.slot}-${exercise.exerciseId}`}>
            {startsBlock && blockSize > 1 && (
              <div className="superset-tag">SUPERSET — {blockSize} exercises, minimal rest between</div>
            )}
            <div className="exercise">
              <div className={`slot ${blockSize > 1 ? 'superset' : ''}`}>{exercise.slot}</div>
              <div className="grow">
                <div className="row between">
                  <span className="name">{definition?.name ?? exercise.exerciseId}</span>
                  <button
                    type="button"
                    className="ghost tiny-btn"
                    onClick={() => setSwapping(index)}
                    aria-label={`Swap ${definition?.name ?? ''}`}
                  >
                    swap
                  </button>
                </div>
                <div className="meta">
                  {exercise.sets} × {formatReps(exercise)} · rest {formatRest(exercise.restSec)} · RPE {exercise.rpe}
                  {exercise.load.kg != null ? ` · ${exercise.load.kg}kg` : ''}
                </div>
                {exercise.load.hint !== 'first_time' && <div className="why">{exercise.load.note}</div>}
                <div className="why">{exercise.rationale}</div>
              </div>
            </div>
          </div>
        );
      })}

      {(day.notes.length > 0 || newLifts > 0) && (
        <div className="small muted" style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {newLifts > 0 && (
            <div>
              · {newLifts} lift{newLifts === 1 ? '' : 's'} here {newLifts === 1 ? 'has' : 'have'} no history yet —
              start easy, leave 2-3 reps in reserve, and log what you did.
            </div>
          )}
          {day.notes.map((note) => <div key={note}>· {note}</div>)}
        </div>
      )}

      <button
        type="button"
        className={`wide ${doneSets > 0 ? '' : 'primary'}`}
        style={{ marginTop: 12 }}
        onClick={() => onOpenSession(weekStart, dayIndex)}
      >
        {log?.completed ? 'Session complete — review' : doneSets > 0 ? `Continue (${doneSets} sets logged)` : 'Start session'}
      </button>

      {swapping != null && (
        <SwapModal
          weekStart={weekStart}
          dayIndex={dayIndex}
          exerciseIndex={swapping}
          day={day}
          onClose={() => setSwapping(null)}
        />
      )}
    </Card>
  );
}

function SwapModal({
  weekStart, dayIndex, exerciseIndex, day, onClose,
}: {
  weekStart: string;
  dayIndex: number;
  exerciseIndex: number;
  day: PlannedDay;
  onClose: () => void;
}) {
  const store = useStore();
  const planned = day.exercises[exerciseIndex];
  const current = planned ? EXERCISE_BY_ID[planned.exerciseId] : undefined;
  const options = useMemo(() => {
    if (!current) return [];
    return alternativesFor(
      current,
      store.state.profile,
      store.state.logs,
      day.exercises.map((e) => e.exerciseId),
    );
  }, [current, store.state.profile, store.state.logs, day.exercises]);

  if (!current) return null;

  return (
    <Modal title={`Replace ${current.name}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Same job in the session — these hit {current.primary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(' / ')} or fit the same slot.
      </p>
      {options.map((option) => (
        <div key={option.id} className="list-item">
          <div className="grow">
            <div>{option.name}</div>
            <div className="tiny muted">
              {option.primary.map((m) => MUSCLE_LABEL[m]).join(', ')} · {option.equipment.join(', ')}
            </div>
          </div>
          <button
            type="button"
            className="tiny-btn"
            onClick={() => {
              store.swapExercise(weekStart, dayIndex, exerciseIndex, option.id);
              onClose();
            }}
          >
            use
          </button>
        </div>
      ))}
      <button
        type="button"
        className="wide danger"
        style={{ marginTop: 12 }}
        onClick={() => {
          store.updateProfile({
            excludedExercises: [...store.state.profile.excludedExercises, current.id],
          });
          onClose();
        }}
      >
        Never show {current.name} again
      </button>
      <p className="tiny muted">Banned exercises can be restored from Setup.</p>
    </Modal>
  );
}
