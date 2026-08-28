import { useMemo, useState } from 'react';
import { useStore } from '../app/state';
import { buildLibrary, standInsFor, type ExerciseRating } from '../domain/library';
import { MUSCLE_LABEL, type Region } from '../domain/muscles';
import { currentWeek } from '../domain/store';
import { Card, Chip, Modal } from './components';
import type { Muscle } from '../domain/types';

const REGIONS: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
];

const TIER_LABEL = { staple: 'staple', solid: 'solid', accessory: 'accessory' } as const;

export function LibraryView() {
  const store = useStore();
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [query, setQuery] = useState('');
  const [anyEquipment, setAnyEquipment] = useState(false);
  const [open, setOpen] = useState<Muscle | null>(null);
  const [detail, setDetail] = useState<ExerciseRating | null>(null);

  const plan = store.planFor(currentWeek());
  const sections = useMemo(
    () =>
      buildLibrary({
        profile: store.state.profile,
        logs: store.state.logs,
        ...(plan ? { plan } : {}),
        onlyAvailableEquipment: !anyEquipment,
        region,
        query,
      }),
    [store.state.profile, store.state.logs, plan, anyEquipment, region, query],
  );

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Exercises</h1>
          <div className="sub">Ranked for your goals, by the muscle they train</div>
        </div>
      </div>

      <Card>
        <input
          type="search"
          value={query}
          placeholder="Search exercises or muscles"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="toggle-group" style={{ marginTop: 10 }}>
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
        <button
          type="button"
          className="wide ghost tiny-btn"
          style={{ marginTop: 10 }}
          onClick={() => setAnyEquipment((v) => !v)}
        >
          {anyEquipment ? 'Showing everything — limit to my gym' : 'Showing what my gym has — show everything'}
        </button>
      </Card>

      {sections.length === 0 && <div className="empty">Nothing matches that.</div>}

      {sections.map((section) => {
        const isOpen = open === section.muscle || query.trim() !== '';
        const staples = section.ratings.filter((r) => r.tier === 'staple');
        return (
          <Card key={section.muscle}>
            <button
              type="button"
              className="ghost wide"
              style={{ justifyContent: 'space-between', display: 'flex', textAlign: 'left', padding: '4px 0' }}
              onClick={() => setOpen(isOpen && !query ? null : section.muscle)}
            >
              <span>
                <strong>{MUSCLE_LABEL[section.muscle]}</strong>
                <span className="small muted"> · {section.ratings.length} exercises</span>
              </span>
              <span className="muted">{isOpen ? '−' : '+'}</span>
            </button>

            {!isOpen && staples.length > 0 && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Best: {staples.map((r) => r.exercise.name).join(', ')}
              </div>
            )}

            {isOpen && (
              <div style={{ marginTop: 8 }}>
                {section.ratings.map((rating) => (
                  <button
                    key={rating.exercise.id}
                    type="button"
                    className="ghost list-item"
                    style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid var(--border)' }}
                    onClick={() => setDetail(rating)}
                  >
                    <span className="grow">
                      <span className="small">{rating.exercise.name}</span>
                      <span className="tiny muted" style={{ display: 'block' }}>{rating.reasons[0]}</span>
                    </span>
                    {rating.tier !== 'accessory' && (
                      <Chip tone={rating.tier === 'staple' ? 'accent' : 'default'}>{TIER_LABEL[rating.tier]}</Chip>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {detail && <ExerciseDetail rating={detail} onPick={setDetail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="balance-row" style={{ gridTemplateColumns: '110px 1fr auto' }}>
      <span className="label small">{label}</span>
      <div className="bar"><div className="fill" style={{ width: `${Math.round(value * 100)}%` }} /></div>
      <span className="tiny muted">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ExerciseDetail({
  rating, onPick, onClose,
}: {
  rating: ExerciseRating;
  onPick: (rating: ExerciseRating) => void;
  onClose: () => void;
}) {
  const store = useStore();
  const { exercise } = rating;
  const plan = store.planFor(currentWeek());
  const banned = store.state.profile.excludedExercises.includes(exercise.id);

  const alternatives = useMemo(
    () =>
      standInsFor(exercise, {
        profile: store.state.profile,
        logs: store.state.logs,
        ...(plan ? { plan } : {}),
      }),
    [exercise, store.state.profile, store.state.logs, plan],
  );

  return (
    <Modal title={exercise.name} onClose={onClose}>
      <div className="row wrap" style={{ marginBottom: 10 }}>
        {exercise.primary.map((m: Muscle) => <Chip key={m} tone="accent">{MUSCLE_LABEL[m]}</Chip>)}
        {exercise.secondary.map((m: Muscle) => <Chip key={m}>{MUSCLE_LABEL[m]}</Chip>)}
      </div>
      <div className="small muted" style={{ marginBottom: 12 }}>
        Needs: {exercise.equipment.join(', ')}
      </div>

      <h3>Why it rates where it does</h3>
      <Meter label="Fit for goals" value={rating.goalFit} />
      <Meter label="Muscle per set" value={rating.breadth} />
      <Meter label="Room to grow" value={rating.headroom} />
      <ul className="small muted" style={{ paddingLeft: 18, marginTop: 8 }}>
        {rating.reasons.map((reason) => <li key={reason} style={{ marginBottom: 4 }}>{reason}</li>)}
      </ul>

      <h3 style={{ marginTop: 14 }}>If it’s taken</h3>
      <p className="tiny muted" style={{ marginTop: -4 }}>
        Trains the same muscles and needs none of the same equipment.
      </p>
      {alternatives.length === 0 && <p className="small muted">No stand-in with different kit.</p>}
      {alternatives.map((alternative) => (
        <button
          key={alternative.exercise.id}
          type="button"
          className="ghost list-item"
          style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid var(--border)' }}
          onClick={() => onPick(alternative)}
        >
          <span className="grow">
            <span className="small">{alternative.exercise.name}</span>
            <span className="tiny muted" style={{ display: 'block' }}>{alternative.exercise.equipment.join(', ')}</span>
          </span>
          <span className="tiny muted">view</span>
        </button>
      ))}

      <button
        type="button"
        className={`wide ${banned ? '' : 'danger'}`}
        style={{ marginTop: 14 }}
        onClick={() =>
          store.updateProfile({
            excludedExercises: banned
              ? store.state.profile.excludedExercises.filter((id: string) => id !== exercise.id)
              : [...store.state.profile.excludedExercises, exercise.id],
          })
        }
      >
        {banned ? 'Allow this exercise again' : 'Never plan this for me'}
      </button>
    </Modal>
  );
}

