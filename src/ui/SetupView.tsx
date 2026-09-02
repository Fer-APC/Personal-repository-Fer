import { useState } from 'react';
import { useStore } from '../app/state';
import { ALL_GOALS, GOAL_BLURB, GOAL_LABEL, normaliseGoals } from '../domain/goals';
import { ALL_MUSCLES, MUSCLE_LABEL } from '../domain/muscles';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { DEFAULT_STRUCTURE } from '../domain/planner';
import { WEEKDAY_LABEL } from '../domain/date';
import { ActivityEditor } from './ActivityEditor';
import { StructureEditor } from './StructureEditor';
import { Chip, CollapsibleCard, Field, FieldGroup, Modal, Segmented, Toggles } from './components';
import type { Equipment, Goal, Muscle, Weekday } from '../domain/types';

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'machine', label: 'Machines' },
  { value: 'cable', label: 'Cables' },
  { value: 'bench', label: 'Bench' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'dip_bars', label: 'Dip bars' },
  { value: 'rings', label: 'Rings' },
  { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'bands', label: 'Bands' },
];

export function SetupView() {
  const store = useStore();
  const { profile } = store.state;
  const [exporting, setExporting] = useState(false);

  const setGoal = (goal: Goal, value: number) => {
    const raw = { ...profile.goals, [goal]: value };
    store.updateProfile({ goals: normaliseGoals(raw) });
  };

  const setDays = (days: 2 | 3) => {
    const structures = Array.from({ length: days }, (_, i) => profile.structures[i] ?? DEFAULT_STRUCTURE);
    store.updateProfile({ daysPerWeek: days, structures });
  };

  const toggleDay = (day: Weekday) =>
    store.updateProfile({
      availability: { ...profile.availability, [day]: !profile.availability[day] },
    });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Setup</h1>
          <div className="sub">Everything the planner reasons from</div>
        </div>
      </div>

      <CollapsibleCard title="Goals" summary="what the plan optimises for" defaultOpen>
        <p className="small muted" style={{ marginTop: 0 }}>
          Slide as many as you like — they are balanced against each other, so a bit of everything is a valid
          answer. These drive rep ranges, rest, exercise choice and how much volume each muscle gets.
        </p>
        {ALL_GOALS.map((goal) => (
          <div key={goal} style={{ marginBottom: 14 }}>
            <div className="row between">
              <strong className="small">{GOAL_LABEL[goal]}</strong>
              <Chip tone={profile.goals[goal] > 0.25 ? 'accent' : 'default'}>
                {Math.round(profile.goals[goal] * 100)}%
              </Chip>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(profile.goals[goal] * 100)}
              onChange={(e) => setGoal(goal, Number(e.target.value) / 100)}
            />
            <div className="tiny muted">{GOAL_BLURB[goal]}</div>
          </div>
        ))}
      </CollapsibleCard>

      <CollapsibleCard title="Availability" summary="days, session length, experience">
        <FieldGroup label="Gym days per week">
          <Segmented
            options={[{ value: 2 as const, label: '2 days' }, { value: 3 as const, label: '3 days' }]}
            value={profile.daysPerWeek}
            onChange={setDays}
          />
        </FieldGroup>
        <FieldGroup label="Days the gym is possible" hint="the planner picks the best ones inside this">
          <Toggles
            options={WEEKDAY_LABEL.map((label, index) => ({ value: index as Weekday, label }))}
            selected={(Object.keys(profile.availability) as unknown as string[])
              .filter((d) => profile.availability[Number(d) as Weekday])
              .map((d) => Number(d) as Weekday)}
            onToggle={toggleDay}
          />
        </FieldGroup>
        <Field label={`Session length · ${profile.sessionMinutes} min`}>
          <input
            type="range"
            min={30}
            max={120}
            step={5}
            value={profile.sessionMinutes}
            onChange={(e) => store.updateProfile({ sessionMinutes: Number(e.target.value) })}
          />
        </Field>
        <FieldGroup label="Training experience">
          <Segmented
            options={[
              { value: 'beginner' as const, label: 'Beginner' },
              { value: 'intermediate' as const, label: 'Intermediate' },
              { value: 'advanced' as const, label: 'Advanced' },
            ]}
            value={profile.experience}
            onChange={(experience) => store.updateProfile({ experience })}
          />
        </FieldGroup>
      </CollapsibleCard>

      <ActivityEditor />

      <CollapsibleCard title="Session shape" summary="exercises and supersets per day">
        <p className="small muted" style={{ marginTop: 0 }}>
          How many exercises each day, and which of them run as supersets. Block A is always the freshest slot,
          so the planner puts the heaviest work there.
        </p>
        {profile.structures.slice(0, profile.daysPerWeek).map((structure, index) => (
          <StructureEditor
            key={index}
            title={`Day ${index + 1}`}
            structure={structure}
            onChange={(next) =>
              store.updateProfile({
                structures: profile.structures.map((s, i) => (i === index ? next : s)),
              })
            }
          />
        ))}
        <button
          type="button"
          className="wide"
          onClick={() =>
            store.updateProfile({
              structures: profile.structures.map(() => profile.structures[0] ?? DEFAULT_STRUCTURE),
            })
          }
        >
          Use day 1's shape for every day
        </button>
      </CollapsibleCard>

      <CollapsibleCard title="Equipment" summary="what your gym has">
        <Toggles
          options={EQUIPMENT}
          selected={profile.equipment}
          onToggle={(equipment) =>
            store.updateProfile({
              equipment: profile.equipment.includes(equipment)
                ? profile.equipment.filter((e) => e !== equipment)
                : [...profile.equipment, equipment],
            })
          }
        />
      </CollapsibleCard>

      <CollapsibleCard title="Work around" summary="space, injuries and banned exercises">
        <FieldGroup label="Gym space" hint="drops carries and travelling lunges">
          <button
            type="button"
            className="toggle"
            aria-pressed={profile.limitedSpace}
            onClick={() => store.updateProfile({ limitedSpace: !profile.limitedSpace })}
          >
            {profile.limitedSpace ? 'No room to walk with weight' : 'I have room to walk with weight'}
          </button>
        </FieldGroup>
        <FieldGroup label="Muscles to leave alone" hint="niggles and injuries">
          <Toggles
            options={ALL_MUSCLES.map((muscle) => ({ value: muscle, label: MUSCLE_LABEL[muscle] }))}
            selected={profile.avoid}
            onToggle={(muscle: Muscle) =>
              store.updateProfile({
                avoid: profile.avoid.includes(muscle)
                  ? profile.avoid.filter((m) => m !== muscle)
                  : [...profile.avoid, muscle],
              })
            }
          />
        </FieldGroup>
        {profile.excludedExercises.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>Banned exercises</h3>
            {profile.excludedExercises.map((id) => (
              <div key={id} className="list-item">
                <span className="small">{EXERCISE_BY_ID[id]?.name ?? id}</span>
                <button
                  type="button"
                  className="tiny-btn"
                  onClick={() =>
                    store.updateProfile({
                      excludedExercises: profile.excludedExercises.filter((e) => e !== id),
                    })
                  }
                >
                  restore
                </button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Recovery" summary="deload cadence and bodyweight">
        <FieldGroup label="Deload every" hint="a lighter week on a fixed cadence">
          <Segmented
            options={[
              { value: 0, label: 'Never' },
              { value: 4, label: '4 weeks' },
              { value: 6, label: '6 weeks' },
              { value: 8, label: '8 weeks' },
            ]}
            value={profile.deloadEveryWeeks}
            onChange={(deloadEveryWeeks) => store.updateProfile({ deloadEveryWeeks })}
          />
        </FieldGroup>
        <Field label="Bodyweight (kg)" hint="used for bodyweight-loaded progressions">
          <input
            type="number"
            min={30}
            step={0.5}
            value={profile.bodyweightKg}
            onChange={(e) => store.updateProfile({ bodyweightKg: Number(e.target.value) })}
          />
        </Field>
      </CollapsibleCard>

      <CollapsibleCard title="Data" summary="export and reset">
        <p className="small muted" style={{ marginTop: 0 }}>
          Everything lives in this browser. Export before clearing site data or switching device.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="grow" onClick={() => setExporting(true)}>
            Export JSON
          </button>
          <button
            type="button"
            className="grow danger"
            onClick={() => {
              if (confirm('Delete all plans, logs and settings? This cannot be undone.')) store.resetAll();
            }}
          >
            Reset everything
          </button>
        </div>
      </CollapsibleCard>

      {exporting && <ExportModal json={JSON.stringify(store.state, null, 2)} onClose={() => setExporting(false)} />}
    </>
  );
}

/** Embedded viewers block downloads, so a save button there would do nothing. */
function canSaveFiles(): boolean {
  try {
    return window.self === window.top;
  } catch {
    return false; // Cross-origin frame — definitely embedded.
  }
}

/**
 * The data is always shown in full, ready to copy, so there is a way out even
 * where saving a file is blocked.
 */
function ExportModal({ json, onClose }: { json: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the textarea below is the fallback.
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `training-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Your data" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Every plan, log and setting. Copy it somewhere safe, or save it as a file — keep it if you clear site
        data or move to another browser.
      </p>
      <textarea
        readOnly
        value={json}
        rows={10}
        onFocus={(e) => e.currentTarget.select()}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, resize: 'vertical' }}
      />
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button type="button" className="grow primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
        {canSaveFiles() && (
          <button type="button" className="grow" onClick={download}>Save as file</button>
        )}
      </div>
    </Modal>
  );
}
