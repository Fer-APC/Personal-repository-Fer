import { useEffect, useState } from 'react';
import { useStore } from '../app/state';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { MUSCLE_LABEL } from '../domain/muscles';
import { lastPerformance } from '../domain/progression';
import { formatDayLabel } from '../domain/date';
import { Card, Chip, NumberInput } from './components';
import type { Muscle } from '../domain/types';

const SORENESS_CHECK: Muscle[] = ['quads', 'hamstrings', 'calves', 'glutes', 'chest', 'lats', 'front_delts', 'lower_back'];

export function SessionView({
  weekStart, dayIndex, onBack,
}: {
  weekStart: string;
  dayIndex: number;
  onBack: () => void;
}) {
  const store = useStore();
  const plan = store.planFor(weekStart);
  const day = plan?.days[dayIndex];
  const log = store.logFor(weekStart, dayIndex);
  const [showSoreness, setShowSoreness] = useState(false);
  const hasPlannedDay = !!day;

  useEffect(() => {
    if (hasPlannedDay) store.startSession(weekStart, dayIndex);
  }, [hasPlannedDay, weekStart, dayIndex, store]);

  if (!day || !plan) {
    return (
      <div className="empty">
        That session is no longer in the plan.
        <div style={{ marginTop: 12 }}><button type="button" onClick={onBack}>Back</button></div>
      </div>
    );
  }

  if (!log) return <div className="empty">Preparing your session…</div>;

  const totalSets = log.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = log.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const volume = log.exercises.reduce(
    (sum, entry) => sum + entry.sets.filter((s) => s.done).reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0),
    0,
  );

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{formatDayLabel(day.date)}</h1>
          <div className="sub">{day.title}</div>
        </div>
        <button type="button" className="tiny-btn" onClick={onBack}>Done</button>
      </div>

      <Card>
        <div className="row between">
          <div>
            <div className="small muted">Progress</div>
            <strong>{doneSets} / {totalSets} sets</strong>
          </div>
          <div>
            <div className="small muted">Tonnage</div>
            <strong>{Math.round(volume)} kg</strong>
          </div>
          <button type="button" className="tiny-btn" onClick={() => setShowSoreness((v) => !v)}>
            {showSoreness ? 'Hide' : 'Soreness'}
          </button>
        </div>

        {showSoreness && (
          <div style={{ marginTop: 12 }}>
            <h3>How sore are you today?</h3>
            <p className="tiny muted" style={{ marginTop: -4 }}>
              Anything you mark 2+ gets less volume in next week's plan.
            </p>
            {SORENESS_CHECK.map((muscle) => (
              <div key={muscle} className="row between" style={{ padding: '4px 0' }}>
                <span className="small">{MUSCLE_LABEL[muscle]}</span>
                <div className="row" style={{ gap: 4 }}>
                  {[0, 1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="toggle tiny-btn"
                      aria-pressed={(log.soreness[muscle] ?? 0) === level}
                      onClick={() => store.updateLog(log.id, { soreness: { ...log.soreness, [muscle]: level } })}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {log.exercises.map((entry, exerciseIndex) => {
        const planned = day.exercises[exerciseIndex];
        const definition = EXERCISE_BY_ID[entry.exerciseId];
        const timed = definition?.loadType === 'time';
        const history = lastPerformance(
          store.state.logs.filter((l) => l.id !== log.id),
          entry.exerciseId,
        );
        return (
          <Card key={`${entry.exerciseId}-${exerciseIndex}`}>
            <div className="row between" style={{ marginBottom: 2 }}>
              <strong>{definition?.name ?? entry.exerciseId}</strong>
              {planned && <Chip tone="accent">{planned.slot}</Chip>}
            </div>
            {planned && (
              <div className="small muted" style={{ marginBottom: 8 }}>
                Target {planned.sets} × {planned.repRange[0]}-{planned.repRange[1]}{timed ? 's' : ''} @ RPE {planned.rpe}
                {planned.load.kg != null ? ` · ${planned.load.kg}kg` : ''}
              </div>
            )}
            {history && (
              <div className="tiny muted" style={{ marginBottom: 8 }}>
                Last time ({history.date}): {history.setsDone} sets, {history.minReps}-{history.maxReps}
                {timed ? 's' : ' reps'}{history.topWeightKg ? ` @ ${history.topWeightKg}kg` : ''}
              </div>
            )}

            <div className="set-labels">
              <span />
              <span>{timed ? 'seconds' : 'reps'}</span>
              <span>kg</span>
              <span>RPE</span>
              <span>done</span>
            </div>

            {entry.sets.map((set, setIndex) => (
              <div key={setIndex} className={`set-row ${set.done ? 'done' : ''}`}>
                <span className="index">{setIndex + 1}</span>
                <NumberInput
                  value={set.reps}
                  onChange={(value) => store.updateSet(log.id, exerciseIndex, setIndex, { reps: value })}
                  placeholder={planned ? String(planned.repRange[1]) : ''}
                />
                <NumberInput
                  value={set.weightKg}
                  step={0.5}
                  onChange={(value) => store.updateSet(log.id, exerciseIndex, setIndex, { weightKg: value })}
                  placeholder={planned?.load.kg != null ? String(planned.load.kg) : '—'}
                />
                <NumberInput
                  value={set.rpe}
                  step={0.5}
                  onChange={(value) => store.updateSet(log.id, exerciseIndex, setIndex, { rpe: value })}
                  placeholder={planned ? String(planned.rpe) : ''}
                />
                <div className="check">
                  <input
                    type="checkbox"
                    checked={set.done}
                    aria-label={`Set ${setIndex + 1} done`}
                    onChange={(e) =>
                      store.updateSet(log.id, exerciseIndex, setIndex, {
                        done: e.target.checked,
                        // Tapping done with an empty field means "as prescribed".
                        reps: set.reps ?? (e.target.checked && planned ? planned.repRange[1] : set.reps),
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button type="button" className="tiny-btn" onClick={() => store.addSet(log.id, exerciseIndex)}>+ set</button>
              <button type="button" className="tiny-btn" onClick={() => store.removeSet(log.id, exerciseIndex)}>− set</button>
            </div>
          </Card>
        );
      })}

      <Card>
        <h3>Finish</h3>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span>Session RPE</span>
            <NumberInput
              value={log.sessionRpe}
              step={0.5}
              onChange={(value) => store.updateLog(log.id, { sessionRpe: value })}
              placeholder="8"
            />
          </label>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span>Minutes</span>
            <NumberInput
              value={log.durationMin}
              onChange={(value) => store.updateLog(log.id, { durationMin: value })}
              placeholder={String(day.estimatedMinutes)}
            />
          </label>
        </div>
        <button
          type="button"
          className="wide primary"
          style={{ marginTop: 12 }}
          onClick={() => {
            store.updateLog(log.id, { completed: !log.completed });
            if (!log.completed) onBack();
          }}
        >
          {log.completed ? 'Reopen session' : 'Mark session complete'}
        </button>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          {completionHint(log.sessionRpe)}
        </p>
      </Card>
    </>
  );
}

function completionHint(sessionRpe: number | null): string {
  if (sessionRpe == null) return 'Logging session RPE lets the planner spot when you need a lighter week.';
  if (sessionRpe >= 9) return 'That was hard. Three of these in a row and next week is automatically a deload.';
  if (sessionRpe <= 6) return 'That was easy — loads will step up next week.';
  return 'Right in the productive range.';
}
