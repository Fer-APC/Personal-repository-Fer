import { useCallback, useEffect, useRef, useState } from 'react';

/** The slice of the Web Speech API this app uses; it has no lib.dom types. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export interface Speech {
  supported: boolean;
  listening: boolean;
  /** Words confirmed so far this session. */
  transcript: string;
  /** Words still being revised as you speak. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Dictation via the browser's own speech recognition. Unsupported browsers get
 * `supported: false` so the caller can fall back to typing — where the phone
 * keyboard's own microphone still works.
 */
export function useSpeech(onFinalChunk?: (text: string) => void): Speech {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalChunk = useRef(onFinalChunk);
  finalChunk.current = onFinalChunk;

  const supported = recognitionConstructor() !== null;

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    setError(null);

    const instance = new Constructor();
    instance.lang = navigator.language || 'en-US';
    instance.continuous = true;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let settled = '';
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) settled += `${text} `;
        else pending += text;
      }
      if (settled) {
        setTranscript((previous) => `${previous}${settled}`);
        finalChunk.current?.(settled);
      }
      setInterim(pending);
    };

    instance.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was refused. Allow it in your browser settings, or type instead.'
          : event.error === 'no-speech'
            ? "Didn't catch anything — try again, or type it."
            : `Speech recognition stopped: ${event.error}`,
      );
      setListening(false);
    };

    instance.onend = () => setListening(false);

    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone.');
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
