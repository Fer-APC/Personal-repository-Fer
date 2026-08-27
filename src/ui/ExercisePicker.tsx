import { useMemo, useState } from 'react';
import { EXERCISES } from '../domain/exercises';
import { MUSCLE_LABEL, MUSCLE_REGION, type Region } from '../domain/muscles';
import { Modal } from './components';
import type { Equipment, Exercise } from '../domain/types';

const REGIONS: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
];

/** Free-form exercise search, for logging whatever you actually did. */
export function ExercisePicker({
  equipment, exclude, onPick, onClose,
}: {
  equipment: Equipment[];
  exclude: string[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(() => {
    const have = new Set<Equipment>([...equipment, 'bodyweight']);
    const needle = query.trim().toLowerCase();
    return EXERCISES.filter((exercise) => {
      if (exclude.includes(exercise.id)) return false;
      if (!showAll && !exercise.equipment.every((e) => have.has(e))) return false;
      if (region !== 'all' && !exercise.primary.some((m) => MUSCLE_REGION[m] === region)) return false;
      if (!needle) return true;
      return (
        exercise.name.toLowerCase().includes(needle) ||
        exercise.primary.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(needle))
      );
    }).slice(0, 60);
  }, [query, region, showAll, equipment, exclude]);

  return (
    <Modal title="What did you do?" onClose={onClose}>
      <input
        autoFocus
        type="search"
        value={query}
        placeholder="Search exercises or muscles"
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="toggle-group" style={{ margin: '10px 0' }}>
        {REGIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="toggle"
            aria-pressed={region === option.value}
            onClick={() => setRegion(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {results.length === 0 && (
        <p className="small muted">
          Nothing matches. {!showAll && 'Some exercises may need equipment your gym is not set up with.'}
        </p>
      )}

      {results.map((exercise) => (
        <div key={exercise.id} className="list-item">
          <div className="grow">
            <div className="small">{exercise.name}</div>
            <div className="tiny muted">{exercise.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
          </div>
          <button type="button" className="tiny-btn" onClick={() => onPick(exercise)}>add</button>
        </div>
      ))}

      <button
        type="button"
        className="wide ghost"
        style={{ marginTop: 12 }}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'Only show what my gym has' : 'Show exercises beyond my equipment'}
      </button>
    </Modal>
  );
}
