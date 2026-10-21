import { useCallback, useEffect, useState } from 'react';

export interface AppSettings {
  theme: 'light' | 'dark';
  accessibleOnly: boolean;
  showWalkways: boolean;
  simulateWalk: boolean;
  speedMultiplier: number;
  /** Delay between MST animation steps in milliseconds. */
  playbackMs: number;
  returnToStart: boolean;
  /** Improve the MST visiting order with 2-opt. */
  improveTripOrder: boolean;
}

const KEY = 'mallmap-settings-v1';
const LEGACY_THEME_KEY = 'mallmap-theme';

const defaults = (): AppSettings => {
  const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return {
    theme: legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : prefersDark ? 'dark' : 'light',
    accessibleOnly: true,
    showWalkways: true,
    simulateWalk: true,
    speedMultiplier: 3,
    playbackMs: 800,
    returnToStart: false,
    improveTripOrder: true,
  };
};

const load = (): AppSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...(JSON.parse(raw) as Partial<AppSettings>) } : defaults();
  } catch {
    return defaults();
  }
};

/** App-wide preferences, persisted in localStorage. */
export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch })), []);

  return { settings, update };
};
