import type { AppSettings } from '../hooks/useAppSettings';
import type { SpeechController } from '../hooks/useSpeech';
import { Section, buttonClass } from './ui';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  speech: SpeechController;
  onOpenEditor: () => void;
}

const row = 'flex items-center justify-between gap-3 text-sm';

export function SettingsPanel({ settings, onChange, speech, onOpenEditor }: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <Section title="Routes">
        <label className={row}>
          <span>
            Accessible routes only
            <span className="block text-xs text-slate-500">Use the elevator, never stairs</span>
          </span>
          <input type="checkbox" checked={settings.accessibleOnly} onChange={(event) => onChange({ accessibleOnly: event.target.checked })} />
        </label>
        <label className={row}>
          <span>Trips return to the start</span>
          <input type="checkbox" checked={settings.returnToStart} onChange={(event) => onChange({ returnToStart: event.target.checked })} />
        </label>
        <label className={row}>
          <span>
            Shorten trip order (2-opt)
            <span className="block text-xs text-slate-500">After the tree is built, swap stops when it makes the walk shorter</span>
          </span>
          <input type="checkbox" checked={settings.improveTripOrder} onChange={(event) => onChange({ improveTripOrder: event.target.checked })} />
        </label>
      </Section>

      <Section title="Voice guidance">
        {!speech.supported ? (
          <p className="text-xs text-amber-700">This browser does not support text-to-speech.</p>
        ) : (
          <>
            <label className={row}>
              <span>Voice on</span>
              <input type="checkbox" checked={speech.settings.enabled} onChange={(event) => speech.updateSettings({ enabled: event.target.checked })} />
            </label>
            <label className="block text-sm">
              Voice
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={speech.settings.voiceURI ?? ''}
                onChange={(event) => speech.updateSettings({ voiceURI: event.target.value || null })}
              >
                <option value="">Default voice</option>
                {speech.voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang}){voice.localService ? '' : ' · online'}
                  </option>
                ))}
              </select>
            </label>
            {speech.voicesLoaded && speech.voices.length === 0 && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                No voices found. On Arch Linux run <code>sudo pacman -S speech-dispatcher espeak-ng</code> and restart the browser.
              </p>
            )}
            <label className="block text-sm">
              Speaking rate: {speech.settings.rate.toFixed(1)}×
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.1}
                value={speech.settings.rate}
                onChange={(event) => speech.updateSettings({ rate: Number(event.target.value) })}
                className="w-full"
              />
            </label>
            <label className="block text-sm">
              Volume: {Math.round(speech.settings.volume * 100)}%
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={speech.settings.volume}
                onChange={(event) => speech.updateSettings({ volume: Number(event.target.value) })}
                className="w-full"
              />
            </label>
            <label className={row}>
              <span>Read the first instruction when a route is created</span>
              <input
                type="checkbox"
                checked={speech.settings.autoAnnounce}
                onChange={(event) => speech.updateSettings({ autoAnnounce: event.target.checked })}
              />
            </label>
            <button className={buttonClass} onClick={() => speech.speak('Voice guidance is ready. In 10 meters, turn left toward Tech Haven.')}>
              Test voice
            </button>
          </>
        )}
      </Section>

      <Section title="Simulated walk">
        <label className={row}>
          <span>
            Simulate walking
            <span className="block text-xs text-slate-500">Moves a "you are here" dot and speaks each turn</span>
          </span>
          <input type="checkbox" checked={settings.simulateWalk} onChange={(event) => onChange({ simulateWalk: event.target.checked })} />
        </label>
        <label className={row}>
          <span>Walking speed</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={settings.speedMultiplier}
            onChange={(event) => onChange({ speedMultiplier: Number(event.target.value) })}
            disabled={!settings.simulateWalk}
          >
            {[1, 2, 3, 5, 8].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Map">
        <label className={row}>
          <span>Show walkways</span>
          <input type="checkbox" checked={settings.showWalkways} onChange={(event) => onChange({ showWalkways: event.target.checked })} />
        </label>
        <label className={row}>
          <span>Tree animation speed</span>
          <select className="rounded border px-2 py-1 text-sm" value={settings.playbackMs} onChange={(event) => onChange({ playbackMs: Number(event.target.value) })}>
            <option value={1400}>Slow</option>
            <option value={800}>Normal</option>
            <option value={350}>Fast</option>
          </select>
        </label>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2" role="radiogroup" aria-label="Theme">
          {(['light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              role="radio"
              aria-checked={settings.theme === theme}
              className={`${buttonClass} flex-1 py-1.5 text-sm capitalize ${settings.theme === theme ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : ''}`}
              onClick={() => onChange({ theme })}
            >
              {theme}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Mall data">
        <p className="text-xs text-slate-500">Edit items, stores, sections and walkways, or import / export the dataset (stored in this browser only).</p>
        <button className={buttonClass} onClick={onOpenEditor}>
          Open demo editor
        </button>
      </Section>
    </div>
  );
}
