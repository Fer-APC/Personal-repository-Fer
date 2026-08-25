import { useStore } from '../app/state';
import { ACTIVITY_LABEL } from '../domain/activities';
import { WEEKDAY_LABEL } from '../domain/date';
import { Card, Chip, Field } from './components';
import type { Activity, ActivityType, Weekday } from '../domain/types';

const TYPES: ActivityType[] = ['run_easy', 'run_long', 'run_intervals', 'volleyball', 'other'];

export function ActivityEditor() {
  const store = useStore();
  const { activities } = store.state;

  const add = () => {
    const activity: Activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'run_easy',
      day: 2,
      durationMin: 45,
      intensity: 2,
    };
    store.addActivity(activity);
  };

  return (
    <Card>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Runs & volley</h2>
        <button type="button" className="tiny-btn primary" onClick={add}>+ add</button>
      </div>
      <p className="small muted" style={{ marginTop: 4 }}>
        Everything you already do outside the gym. The planner schedules around these, trims the volume they
        already cover, and adds the work they leave out.
      </p>

      {activities.length === 0 && (
        <p className="small muted">Nothing added yet — the plan will assume the gym is all you do.</p>
      )}

      {activities
        .slice()
        .sort((a, b) => a.day - b.day)
        .map((activity) => (
          <div key={activity.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <Chip tone="accent">{WEEKDAY_LABEL[activity.day]}</Chip>
              <button type="button" className="tiny-btn danger" onClick={() => store.removeActivity(activity.id)}>
                remove
              </button>
            </div>

            <Field label="What">
              <select
                value={activity.type}
                onChange={(e) => store.updateActivity(activity.id, { type: e.target.value as ActivityType })}
              >
                {TYPES.map((type) => <option key={type} value={type}>{ACTIVITY_LABEL[type]}</option>)}
              </select>
            </Field>

            <Field label="Day">
              <select
                value={activity.day}
                onChange={(e) => store.updateActivity(activity.id, { day: Number(e.target.value) as Weekday })}
              >
                {WEEKDAY_LABEL.map((label, index) => <option key={label} value={index}>{label}</option>)}
              </select>
            </Field>

            <div className="row" style={{ gap: 10 }}>
              <Field label="Minutes">
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={activity.durationMin}
                  onChange={(e) => store.updateActivity(activity.id, { durationMin: Number(e.target.value) })}
                />
              </Field>
              <Field label="Effort">
                <select
                  value={activity.intensity}
                  onChange={(e) => store.updateActivity(activity.id, { intensity: Number(e.target.value) as 1 | 2 | 3 })}
                >
                  <option value={1}>Easy</option>
                  <option value={2}>Moderate</option>
                  <option value={3}>Hard</option>
                </select>
              </Field>
            </div>
          </div>
        ))}
    </Card>
  );
}
