import { useMemo, useState } from 'react';
import { useStore } from '../app/state';
import { MUSCLE_LABEL, MUSCLE_REGION, type Region } from '../domain/muscles';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { completedSetsByMuscle } from '../domain/progression';
import { addDays, fromISODate, weekStartISO } from '../domain/date';
import { Card, Chip } from './components';
import type { BalanceRow } from '../domain/types';

const REGION_LABEL: Record<Region, string> = {
  push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core & trunk',
};

const STATUS_TONE = { under: 'warn', on: 'good', over: 'accent', missing: 'danger' } as const;

export function BalanceView() {
  const store = useStore();
  const [weekStart] = useState(() => weekStartISO(new Date()));
  const plan = store.planFor(weekStart);

  const weekLogs = useMemo(
    () => store.state.logs.filter((l) => l.weekStart === weekStart),
    [store.state.logs, weekStart],
  );
  const completed = useMemo(() => completedSetsByMuscle(weekLogs), [weekLogs]);
  const loggedSets = useMemo(
    () => weekLogs.reduce((n, l) => n + l.exercises.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0), 0),
    [weekLogs],
  );

  const history = useMemo(() => {
    const weeks: { weekStart: string; sessions: number; sets: number; tonnage: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const week = addDays(weekStart, -7 * i);
      const logs = store.state.logs.filter((l) => l.weekStart === week);
      if (logs.length === 0 && i > 0) continue;
      const sets = logs.reduce((n, l) => n + l.exercises.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0), 0);
      const tonnage = logs.reduce(
        (n, l) => n + l.exercises.reduce(
          (m, e) => m + e.sets.filter((s) => s.done).reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0), 0), 0);
      weeks.push({ weekStart: week, sessions: logs.filter((l) => l.completed).length, sets, tonnage });
    }
    return weeks;
  }, [store.state.logs, weekStart]);

  if (!plan) return <div className="empty">No plan yet for this week.</div>;

  const byRegion = (['push', 'pull', 'legs', 'core'] as Region[]).map((region) => ({
    region,
    rows: plan.balance.filter((row) => MUSCLE_REGION[row.muscle] === region && (row.target > 0 || row.planned > 0)),
  }));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Balance</h1>
          <div className="sub">Weekly sets planned against what your goals ask for</div>
        </div>
      </div>

      <Card>
        <div className="row between">
          <div>
            <div className="small muted">Push : pull</div>
            <strong>{plan.ratios.pushPull.toFixed(2)}</strong>
          </div>
          <div>
            <div className="small muted">Upper : lower</div>
            <strong>{plan.ratios.upperLower.toFixed(2)}</strong>
          </div>
          <div>
            <div className="small muted">Sets logged</div>
            <strong>{loggedSets}</strong>
          </div>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0, marginTop: 10 }}>
          Solid bar is direct work, faded bar is assistance at half credit, and the tick marks the target your
          goals ask for. Targets are already reduced by whatever your runs and volley cover.
        </p>
      </Card>

      {byRegion.map(({ region, rows }) => (
        <Card key={region}>
          <h3>{REGION_LABEL[region]}</h3>
          {rows.map((row) => <BalanceBar key={row.muscle} row={row} logged={completed[row.muscle] ?? 0} />)}
        </Card>
      ))}

      <Card>
        <h3>Recent weeks</h3>
        {history.map((week) => (
          <div key={week.weekStart} className="list-item">
            <div>
              <div className="small">Week of {formatWeek(week.weekStart)}</div>
              <div className="tiny muted">{week.sessions} session{week.sessions === 1 ? '' : 's'} completed</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Chip>{week.sets} set{week.sets === 1 ? '' : 's'}</Chip>
              {week.tonnage > 0 && <Chip>{formatTonnage(week.tonnage)}</Chip>}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <h3>Most trained lifts</h3>
        <TopLifts />
      </Card>
    </>
  );
}

function BalanceBar({ row, logged }: { row: BalanceRow; logged: number }) {
  const effective = row.planned + row.assist * 0.5;
  // Leave headroom so the target tick stays inside the track when volume is low.
  const scale = Math.max(row.target, effective, 1) * 1.08;
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  return (
    <div className="balance-row">
      <span className="label">{MUSCLE_LABEL[row.muscle]}</span>
      <div>
        <div className="bar">
          <div className="fill" style={{ width: pct(row.planned) }} />
          <div className="fill assist" style={{ width: pct(row.assist * 0.5) }} />
          {row.target > 0 && (
            <div className="target-tick" style={{ left: pct(row.target) }} title={`target ${row.target} sets`} />
          )}
        </div>
        <div className="tiny muted" style={{ marginTop: 3 }}>
          {row.planned} direct
          {row.assist > 0 ? ` + ${row.assist} assist` : ''}
          {' · target '}{row.target}
          {row.externalCredit > 0 ? ` · sport adds ~${row.externalCredit}` : ''}
          {logged > 0 ? ` · ${logged} logged` : ''}
        </div>
      </div>
      <Chip tone={STATUS_TONE[row.status]}>{row.status}</Chip>
    </div>
  );
}

function TopLifts() {
  const store = useStore();
  const tally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of store.state.logs) {
      for (const entry of log.exercises) {
        const done = entry.sets.filter((s) => s.done).length;
        if (done) counts.set(entry.exerciseId, (counts.get(entry.exerciseId) ?? 0) + done);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [store.state.logs]);

  if (tally.length === 0) return <p className="small muted" style={{ margin: 0 }}>Nothing logged yet.</p>;

  return (
    <>
      {tally.map(([id, sets]) => (
        <div key={id} className="list-item">
          <span className="small">{EXERCISE_BY_ID[id]?.name ?? id}</span>
          <Chip>{sets} set{sets === 1 ? '' : 's'}</Chip>
        </div>
      ))}
    </>
  );
}

function formatWeek(weekStart: string): string {
  const date = fromISODate(weekStart);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatTonnage(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
}
