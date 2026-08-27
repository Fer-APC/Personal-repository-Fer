import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/state';
import { parseVoiceInput, type Command } from '../domain/voice';
import { toISODate } from '../domain/date';
import { useSpeech } from './useSpeech';
import { Modal } from './components';

const EXAMPLES = [
  'Bench press three sets of eight at sixty kilos',
  'On Monday I did squats five by five at a hundred',
  'My hamstrings are sore',
  'I can’t train on Tuesday',
  'More hypertrophy, less strength',
  'I run on Tuesday for forty five minutes',
];

/**
 * Dictate changes and past sessions. Nothing is saved until the parsed result
 * is confirmed — speech recognition misfires, and silently writing the wrong
 * weight into a training log is worse than not logging it at all.
 */
export function VoiceCommand({ targetLogId, onClose }: { targetLogId?: string; onClose: () => void }) {
  const store = useStore();
  const today = toISODate(new Date());
  const [text, setText] = useState('');
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<string[] | null>(null);
  const speech = useSpeech();

  // Recognised words flow into the same box you can type in, so anything
  // misheard can be corrected before it is applied.
  useEffect(() => {
    if (speech.transcript) setText(speech.transcript.trim());
  }, [speech.transcript]);

  const parsed = useMemo(() => parseVoiceInput(text, today), [text, today]);
  const chosen: Command[] = parsed.commands.filter((_, i) => !skipped.has(i));

  const toggle = (index: number) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const apply = () => {
    speech.stop();
    setApplied(store.applyVoice(chosen, { today, ...(targetLogId ? { targetLogId } : {}) }));
  };

  if (applied) {
    return (
      <Modal title="Saved" onClose={onClose}>
        {applied.map((note) => (
          <div key={note} className="list-item"><span className="small">{note}</span></div>
        ))}
        {applied.length === 0 && <p className="small muted">Nothing was changed.</p>}
        <button type="button" className="wide primary" style={{ marginTop: 12 }} onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title="Say what changed" onClose={onClose}>
      {speech.supported ? (
        <button
          type="button"
          className={`wide ${speech.listening ? '' : 'primary'}`}
          onClick={speech.listening ? speech.stop : speech.start}
        >
          {speech.listening ? '● Listening — tap to stop' : '🎤 Start talking'}
        </button>
      ) : (
        <p className="small muted" style={{ marginTop: 0 }}>
          This browser has no built-in dictation. Type below — or use the microphone on your phone’s keyboard,
          which works the same way.
        </p>
      )}

      {speech.error && <div className="banner warn" style={{ marginTop: 10 }}>{speech.error}</div>}

      <textarea
        value={text + (speech.interim ? ` ${speech.interim}` : '')}
        rows={4}
        placeholder="Bench press three sets of eight at sixty kilos…"
        onChange={(e) => {
          setText(e.target.value);
          setSkipped(new Set());
        }}
        style={{ marginTop: 10 }}
      />

      {text.trim() === '' && (
        <div style={{ marginTop: 12 }}>
          <h3>Things you can say</h3>
          {EXAMPLES.map((example) => (
            <div key={example} className="list-item">
              <span className="small muted">“{example}”</span>
              <button type="button" className="tiny-btn" onClick={() => setText(example)}>try</button>
            </div>
          ))}
        </div>
      )}

      {parsed.commands.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3>What I understood</h3>
          {parsed.commands.map((command, index) => (
            <div key={`${command.kind}-${index}`} className="list-item">
              <label className="row grow" style={{ gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!skipped.has(index)}
                  onChange={() => toggle(index)}
                  aria-label={`Include: ${command.summary}`}
                />
                <span className="small">{command.summary}</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {parsed.unrecognised.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3>Not understood</h3>
          {parsed.unrecognised.map((fragment) => (
            <div key={fragment} className="tiny muted">“{fragment}” — ignored</div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="wide primary"
        style={{ marginTop: 14 }}
        disabled={chosen.length === 0}
        onClick={apply}
      >
        {chosen.length === 0 ? 'Nothing to save yet' : `Save ${chosen.length} change${chosen.length === 1 ? '' : 's'}`}
      </button>
    </Modal>
  );
}
