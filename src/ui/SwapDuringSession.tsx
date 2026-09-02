import { useMemo } from 'react';
import { useStore } from '../app/state';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { standInsFor } from '../domain/library';
import { MUSCLE_LABEL } from '../domain/muscles';
import { currentWeek } from '../domain/store';
import { Modal } from './components';

/**
 * The station is busy and you are standing in front of it. Offers movements
 * that train the same muscles with none of the same equipment, and keeps any
 * sets you have already recorded on the original.
 */
export function SwapDuringSession({
  logId, exerciseIndex, onClose,
}: {
  logId: string;
  exerciseIndex: number;
  onClose: () => void;
}) {
  const store = useStore();
  const log = store.logById(logId);
  const entry = log?.exercises[exerciseIndex];
  const exercise = entry ? EXERCISE_BY_ID[entry.exerciseId] : undefined;
  const plan = store.planFor(currentWeek());

  const alternatives = useMemo(
    () =>
      exercise
        ? standInsFor(exercise, {
            profile: store.state.profile,
            logs: store.state.logs,
            ...(plan ? { plan } : {}),
            equipmentBusy: true,
          })
        : [],
    [exercise, store.state.profile, store.state.logs, plan],
  );

  if (!log || !entry || !exercise) return null;
  const loggedSets = entry.sets.filter((s) => s.done).length;

  return (
    <Modal title={`Instead of ${exercise.name}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Same muscles, none of the same equipment — {exercise.equipment.join(', ')} stays free.
      </p>

      {loggedSets > 0 && (
        <div className="banner warn">
          You have already logged {loggedSets} set{loggedSets === 1 ? '' : 's'} here. Swapping keeps those sets
          under the new name, which would misreport them — add the alternative as a separate exercise instead.
        </div>
      )}

      {alternatives.length === 0 && (
        <p className="small muted">Nothing trains this with different equipment. Try the Exercises tab.</p>
      )}

      {alternatives.map((alternative) => (
        <div key={alternative.exercise.id} className="list-item">
          <div className="grow">
            <div className="small">{alternative.exercise.name}</div>
            <div className="tiny muted">
              {alternative.exercise.primary.map((m) => MUSCLE_LABEL[m]).join(', ')} · {alternative.exercise.equipment.join(', ')}
            </div>
          </div>
          <button
            type="button"
            className="tiny-btn"
            onClick={() => {
              if (loggedSets > 0) store.addExerciseToLog(logId, alternative.exercise.id);
              else store.swapExerciseInLog(logId, exerciseIndex, alternative.exercise.id);
              onClose();
            }}
          >
            {loggedSets > 0 ? 'add' : 'use'}
          </button>
        </div>
      ))}
    </Modal>
  );
}
