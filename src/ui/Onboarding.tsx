import { useState } from 'react';
import { useStore } from '../app/state';
import { ALL_GOALS, GOAL_BLURB, GOAL_LABEL, normaliseGoals } from '../domain/goals';
import { WEEKDAY_LABEL } from '../domain/date';
import { ActivityEditor } from './ActivityEditor';
import { Card, Chip, Field, FieldGroup, Segmented, Toggles } from './components';
import type { Goal, Weekday } from '../domain/types';

export function Onboarding() {
  const store = useStore();
  const { profile } = store.state;
  const [step, setStep] = useState(0);

  const setGoal = (goal: Goal, value: number) =>
    store.updateProfile({ goals: normaliseGoals({ ...profile.goals, [goal]: value }) });

  const steps = [
    {
      title: 'What are you training for?',
      body: (
        <Card>
          <p className="small muted" style={{ marginTop: 0 }}>
            Mix them however you like. You can change this any week — the plan follows.
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
        </Card>
      ),
    },
    {
      title: 'When can you lift?',
      body: (
        <Card>
          <FieldGroup label="Gym days per week">
            <Segmented
              options={[{ value: 2 as const, label: '2 days' }, { value: 3 as const, label: '3 days' }]}
              value={profile.daysPerWeek}
              onChange={(daysPerWeek) => {
                const structures = Array.from(
                  { length: daysPerWeek },
                  (_, i) => profile.structures[i] ?? profile.structures[0]!,
                );
                store.updateProfile({ daysPerWeek, structures });
              }}
            />
          </FieldGroup>
          <FieldGroup label="Days the gym is possible" hint="pick generously, the planner narrows it down">
            <Toggles
              options={WEEKDAY_LABEL.map((label, index) => ({ value: index as Weekday, label }))}
              selected={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((d) => profile.availability[d])}
              onToggle={(day: Weekday) =>
                store.updateProfile({ availability: { ...profile.availability, [day]: !profile.availability[day] } })
              }
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
        </Card>
      ),
    },
    {
      title: 'What else do you already do?',
      body: <ActivityEditor />,
    },
  ];

  const current = steps[step]!;
  const isLast = step === steps.length - 1;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{current.title}</h1>
          <div className="sub">Step {step + 1} of {steps.length}</div>
        </div>
      </div>

      {current.body}

      <div className="row" style={{ gap: 8 }}>
        {step > 0 && (
          <button type="button" className="grow" onClick={() => setStep(step - 1)}>Back</button>
        )}
        <button
          type="button"
          className="grow primary"
          onClick={() => (isLast ? store.completeOnboarding() : setStep(step + 1))}
        >
          {isLast ? 'Build my week' : 'Next'}
        </button>
      </div>
      {!isLast && (
        <button type="button" className="wide ghost" style={{ marginTop: 8 }} onClick={store.completeOnboarding}>
          Skip — use sensible defaults
        </button>
      )}
    </>
  );
}
