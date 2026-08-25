import { useState } from 'react';
import { StoreProvider, useStore } from './app/state';
import { WeekView } from './ui/WeekView';
import { SessionView } from './ui/SessionView';
import { BalanceView } from './ui/BalanceView';
import { SetupView } from './ui/SetupView';
import { Onboarding } from './ui/Onboarding';

type Tab = 'week' | 'balance' | 'setup';

interface OpenSession {
  weekStart: string;
  dayIndex: number;
}

function Shell() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('week');
  const [session, setSession] = useState<OpenSession | null>(null);

  if (!store.state.onboarded) {
    return <div className="app"><Onboarding /></div>;
  }

  if (session) {
    return (
      <div className="app">
        <SessionView
          weekStart={session.weekStart}
          dayIndex={session.dayIndex}
          onBack={() => setSession(null)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="app">
        {tab === 'week' && (
          <WeekView onOpenSession={(weekStart, dayIndex) => setSession({ weekStart, dayIndex })} />
        )}
        {tab === 'balance' && <BalanceView />}
        {tab === 'setup' && <SetupView />}
      </div>

      <nav className="tabbar">
        <TabButton current={tab} value="week" glyph="🗓" label="Week" onSelect={setTab} />
        <TabButton current={tab} value="balance" glyph="📊" label="Balance" onSelect={setTab} />
        <TabButton current={tab} value="setup" glyph="⚙️" label="Setup" onSelect={setTab} />
      </nav>
    </>
  );
}

function TabButton({
  current, value, glyph, label, onSelect,
}: {
  current: Tab;
  value: Tab;
  glyph: string;
  label: string;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <button type="button" aria-pressed={current === value} onClick={() => onSelect(value)}>
      <span className="glyph" aria-hidden="true">{glyph}</span>
      {label}
    </button>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
