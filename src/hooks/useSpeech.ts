import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper around the browser's built-in Web Speech API (speechSynthesis).
 * Free, offline-capable on most systems, and needs no API keys.
 */

export interface SpeechSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
  /** Read the route overview and first instruction as soon as a route is generated. */
  autoAnnounce: boolean;
}

const SETTINGS_KEY = 'mallmap-voice-settings-v1';

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  enabled: true,
  voiceURI: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  autoAnnounce: false,
};

const loadSettings = (): SpeechSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SPEECH_SETTINGS, ...(JSON.parse(raw) as Partial<SpeechSettings>) } : DEFAULT_SPEECH_SETTINGS;
  } catch {
    return DEFAULT_SPEECH_SETTINGS;
  }
};

export const isSpeechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

/** Sort voices so the user's language comes first, then other English voices, then the rest. */
export const sortVoices = (voices: SpeechSynthesisVoice[], preferredLang = 'en'): SpeechSynthesisVoice[] => {
  const base = preferredLang.toLowerCase().split('-')[0];
  const score = (voice: SpeechSynthesisVoice) => {
    const lang = voice.lang.toLowerCase();
    if (lang === preferredLang.toLowerCase()) return 0;
    if (lang.startsWith(base)) return 1;
    if (lang.startsWith('en')) return 2;
    return 3;
  };
  return voices.slice().sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
};

export type SpeechProblem =
  | { kind: 'no-voices' }
  | { kind: 'no-start' }
  | { kind: 'error'; code: string };

export type BrowserFamily = 'firefox' | 'chromium' | 'safari' | 'other';

export const detectBrowser = (userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): BrowserFamily => {
  if (/firefox|fxios/i.test(userAgent)) return 'firefox';
  if (/chrome|chromium|crios|edg\//i.test(userAgent)) return 'chromium';
  if (/safari/i.test(userAgent)) return 'safari';
  return 'other';
};

/** How long to wait for `onstart` before assuming the speech engine is silent. */
export const START_TIMEOUT_MS = 4000;
/** Delay between cancel() and speak(); Chromium + speech-dispatcher can drop an utterance queued right after cancel. */
export const CANCEL_GAP_MS = 120;

export interface SpeakOptions {
  /** Stop whatever is being spoken and say this immediately (default true). */
  interrupt?: boolean;
  /** Speak even when voice guidance is switched off (used by "Test voice"). */
  force?: boolean;
}

export const useSpeech = () => {
  const supported = isSpeechSupported();
  const [settings, setSettings] = useState<SpeechSettings>(loadSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [problem, setProblem] = useState<SpeechProblem | null>(null);
  const [lastSpokeOk, setLastSpokeOk] = useState(false);
  const pendingTimer = useRef<number | null>(null);
  const pendingQueue = useRef<Array<() => void>>([]);
  const lastCancelAt = useRef(0);
  // Keep references to live utterances: some Chromium builds garbage-collect them and never fire `onend`.
  const liveUtterances = useRef(new Set<SpeechSynthesisUtterance>());
  const settingsRef = useRef(settings);
  const voicesRef = useRef(voices);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const update = () => {
      const list = synth.getVoices();
      setVoices(sortVoices(list, navigator.language || 'en-US'));
      if (list.length > 0) setVoicesLoaded(true);
    };
    update();
    synth.addEventListener('voiceschanged', update);
    // Voices load asynchronously and some Linux builds never fire `voiceschanged`,
    // so poll for a while as well. Stop waiting after a few seconds so the UI can show a hint.
    let polls = 0;
    const poll = window.setInterval(() => {
      polls += 1;
      if (synth.getVoices().length > 0 || polls > 20) {
        update();
        window.clearInterval(poll);
      }
    }, 1000);
    const timeout = window.setTimeout(() => setVoicesLoaded(true), 3000);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      synth.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    lastCancelAt.current = performance.now();
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    pendingQueue.current = [];
    liveUtterances.current.clear();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const current = settingsRef.current;
      if (!supported || (!current.enabled && !options.force) || !text.trim()) return;
      const synth = window.speechSynthesis;
      const interrupt = options.interrupt ?? true;

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voicesRef.current.find((candidate) => candidate.voiceURI === current.voiceURI) ?? voicesRef.current[0];
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }
      utterance.rate = current.rate;
      utterance.pitch = current.pitch;
      utterance.volume = current.volume;
      let started = false;
      let watchdog: number | null = null;
      const finish = () => {
        if (watchdog !== null) window.clearTimeout(watchdog);
        liveUtterances.current.delete(utterance);
        if (liveUtterances.current.size === 0) setSpeaking(false);
      };
      utterance.onstart = () => {
        started = true;
        if (watchdog !== null) window.clearTimeout(watchdog);
        setSpeaking(true);
        setProblem(null);
        setLastSpokeOk(true);
      };
      utterance.onend = finish;
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        // "interrupted"/"canceled" are normal when a newer instruction replaces this one.
        if (event.error !== 'interrupted' && event.error !== 'canceled') setProblem({ kind: 'error', code: event.error });
        finish();
      };
      liveUtterances.current.add(utterance);

      const start = () => {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
        // Only the first utterance of a queue is expected to start right away.
        if (interrupt || !synth.speaking) {
          watchdog = window.setTimeout(() => {
            if (!started && liveUtterances.current.has(utterance)) {
              setProblem(voicesRef.current.length === 0 ? { kind: 'no-voices' } : { kind: 'no-start' });
              setLastSpokeOk(false);
              finish();
            }
          }, START_TIMEOUT_MS);
        }
      };

      const flushLater = (delay: number) => {
        if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
        pendingTimer.current = window.setTimeout(() => {
          const queued = pendingQueue.current;
          pendingQueue.current = [];
          pendingTimer.current = null;
          queued.forEach((run) => run());
        }, delay);
      };

      if (interrupt && (synth.speaking || synth.pending || pendingTimer.current !== null)) {
        synth.cancel();
        lastCancelAt.current = performance.now();
        for (const live of liveUtterances.current) if (live !== utterance) liveUtterances.current.delete(live);
        pendingQueue.current = [];
      }
      const sinceCancel = performance.now() - lastCancelAt.current;
      if (pendingTimer.current !== null && !interrupt) {
        // A delayed start is pending; queue behind it so order is preserved.
        pendingQueue.current.push(start);
      } else if (sinceCancel < CANCEL_GAP_MS) {
        // Chromium + speech-dispatcher can silently drop speech queued right after cancel().
        pendingQueue.current = [start];
        flushLater(CANCEL_GAP_MS - sinceCancel);
      } else {
        start();
      }
    },
    [supported],
  );

  const updateSettings = useCallback(
    (patch: Partial<SpeechSettings>) => {
      if (patch.enabled === false) stop();
      setSettings((previous) => ({ ...previous, ...patch }));
    },
    [stop],
  );

  const dismissProblem = useCallback(() => setProblem(null), []);

  return {
    supported,
    voices,
    voicesLoaded,
    speaking,
    settings,
    updateSettings,
    speak,
    stop,
    problem,
    dismissProblem,
    lastSpokeOk,
    browser: detectBrowser(),
  };
};

export type SpeechController = ReturnType<typeof useSpeech>;
