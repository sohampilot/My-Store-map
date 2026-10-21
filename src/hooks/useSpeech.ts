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

export interface SpeakOptions {
  /** Stop whatever is being spoken and say this immediately (default true). */
  interrupt?: boolean;
}

export const useSpeech = () => {
  const supported = isSpeechSupported();
  const [settings, setSettings] = useState<SpeechSettings>(loadSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
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
    // Voices load asynchronously; stop waiting after a few seconds so the UI can show a hint.
    const timeout = window.setTimeout(() => setVoicesLoaded(true), 3000);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      window.clearTimeout(timeout);
      synth.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    liveUtterances.current.clear();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const current = settingsRef.current;
      if (!supported || !current.enabled || !text.trim()) return;
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
      const finish = () => {
        liveUtterances.current.delete(utterance);
        if (liveUtterances.current.size === 0) setSpeaking(false);
      };
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = finish;
      utterance.onerror = finish;
      liveUtterances.current.add(utterance);

      if (interrupt) {
        synth.cancel();
      }
      if (synth.paused) synth.resume();
      synth.speak(utterance);
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

  return { supported, voices, voicesLoaded, speaking, settings, updateSettings, speak, stop };
};

export type SpeechController = ReturnType<typeof useSpeech>;
