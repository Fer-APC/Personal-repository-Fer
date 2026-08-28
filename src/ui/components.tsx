import { useEffect, type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

/**
 * A card that starts collapsed. Long settings screens are far easier to scan
 * as a list of headings than as one continuous column of controls.
 */
export function CollapsibleCard({
  title, summary, defaultOpen = false, children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <details open={defaultOpen}>
        <summary className="card-summary">
          <span>
            <strong>{title}</strong>
            {summary ? <span className="small muted"> · {summary}</span> : null}
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </summary>
        <div style={{ marginTop: 14 }}>{children}</div>
      </details>
    </section>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'good' | 'warn' | 'danger' }) {
  return <span className={`chip ${tone === 'default' ? '' : tone}`}>{children}</span>;
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggles<T extends string | number>({
  options, selected, onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="toggle-group">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className="toggle"
          aria-pressed={selected.includes(option.value)}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Caption plus a single form control — the caption labels the control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <span className="muted"> · {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/**
 * Caption plus a set of controls (toggles, segmented buttons). A <label> may
 * only wrap one labellable control, and wrapping buttons in one swallows their
 * accessible names, so this renders a labelled group instead.
 */
export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span>
        {label}
        {hint ? <span className="muted"> · {hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <strong>{title}</strong>
          <button type="button" className="ghost tiny-btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NumberInput({
  value, onChange, placeholder, step = 1, min = 0,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}
