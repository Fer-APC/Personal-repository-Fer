import { Component, type ErrorInfo, type ReactNode } from 'react';

const STORAGE_KEY = 'training-tracker/v1';

interface State {
  error: Error | null;
}

/**
 * Last line of defence for a local-first app: if rendering throws, the user
 * still needs a way to get their training history out and to recover, rather
 * than facing a blank page with their data locked inside the browser.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Training Tracker crashed:', error, info.componentStack);
  }

  private storedData(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  /** Plans can always be regenerated; logged sessions cannot. */
  private rebuildPlans = (): void => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as { plans?: unknown };
        state.plans = {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // If that failed, the full reset below is the remaining option.
    }
    window.location.reload();
  };

  private resetEverything = (): void => {
    if (!confirm('Delete all plans, logs and settings? Copy your data out first if you want to keep it.')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — reloading is still worth trying.
    }
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const data = this.storedData();
    return (
      <div className="app">
        <div className="topbar">
          <div>
            <h1>Something broke</h1>
            <div className="sub">Your training history is still saved in this browser.</div>
          </div>
        </div>

        <section className="card">
          <h3>What happened</h3>
          <p className="small" style={{ marginTop: 0 }}>
            The app hit an error while drawing the screen, so it stopped rather than showing you something wrong.
          </p>
          <pre className="tiny muted" style={{ overflowX: 'auto', margin: 0 }}>{error.message}</pre>
        </section>

        <section className="card">
          <h3>Rescue your data first</h3>
          <p className="small" style={{ marginTop: 0 }}>
            Copy this somewhere safe before trying either fix below.
          </p>
          <textarea
            readOnly
            rows={8}
            value={data}
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 }}
          />
          <button
            type="button"
            className="wide primary"
            style={{ marginTop: 10 }}
            onClick={() => { void navigator.clipboard?.writeText(data); }}
          >
            Copy to clipboard
          </button>
        </section>

        <section className="card">
          <h3>Then try this</h3>
          <p className="small" style={{ marginTop: 0 }}>
            Throwing away the generated plans usually clears it, and keeps every session you logged — plans are
            rebuilt from your goals the moment you reopen the week.
          </p>
          <button type="button" className="wide" onClick={this.rebuildPlans}>
            Discard plans, keep my logged sessions
          </button>
          <button type="button" className="wide danger" style={{ marginTop: 8 }} onClick={this.resetEverything}>
            Reset everything
          </button>
        </section>
      </div>
    );
  }
}
