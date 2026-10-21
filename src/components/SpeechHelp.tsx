import type { SpeechController } from '../hooks/useSpeech';

interface SpeechHelpProps {
  speech: SpeechController;
  /** Always show the troubleshooting steps, even if no problem was detected. */
  alwaysShowSteps?: boolean;
}

const code = 'rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10';

const describeProblem = (speech: SpeechController): string | null => {
  const { problem } = speech;
  if (!speech.supported) return 'This browser has no text-to-speech support.';
  if (!problem) return speech.voicesLoaded && speech.voices.length === 0 ? 'No speech voices were found.' : null;
  if (problem.kind === 'no-voices') return 'Nothing was heard because the browser has no speech voices.';
  if (problem.kind === 'no-start') return 'The browser accepted the text but its speech engine never started talking.';
  if (problem.code === 'not-allowed') return 'The browser blocked speech until you interact with the page. Click a button and try again.';
  return `The speech engine reported an error: ${problem.code}.`;
};

/** Explains why voice guidance may be silent, with Linux / Arch-specific fixes. */
export function SpeechHelp({ speech, alwaysShowSteps = false }: SpeechHelpProps) {
  if (!speech.supported) return null;
  const message = describeProblem(speech);
  if (!message && !alwaysShowSteps) return null;
  const chromium = speech.browser === 'chromium';

  return (
    <div
      role={message ? 'alert' : undefined}
      className={`space-y-1.5 rounded p-2 text-xs ${
        message ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100' : 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
      }`}
    >
      {message && <p className="font-semibold">{message}</p>}
      <p>
        Voices: {speech.voices.length}
        {speech.voices.length > 0 && ` (e.g. ${speech.voices[0].name})`} · Browser: {speech.browser}
        {speech.lastSpokeOk && ' · last test started OK'}
      </p>
      <details open={!!message}>
        <summary className="cursor-pointer font-medium">How to fix silent voice on Linux</summary>
        <ol className="ml-4 mt-1 list-decimal space-y-1">
          <li>
            Check your volume and that the right output is selected (for example with <span className={code}>pavucontrol</span>).
          </li>
          <li>
            Install a speech engine: <span className={code}>sudo pacman -S --needed speech-dispatcher espeak-ng</span>
          </li>
          <li>
            Test it outside the browser: <span className={code}>spd-say "hello"</span>. If that is silent, run <span className={code}>spd-conf</span> and
            choose <b>espeak-ng</b> as the default module, then try again.
          </li>
          {chromium ? (
            <li>
              Chromium, Chrome and Brave need a flag on Linux. Fully quit the browser, then start it with{' '}
              <span className={code}>chromium --enable-speech-dispatcher</span> (or add <span className={code}>--enable-speech-dispatcher</span> to{' '}
              <span className={code}>~/.config/chromium-flags.conf</span>, <span className={code}>chrome-flags.conf</span> or{' '}
              <span className={code}>brave-flags.conf</span>). Firefox works without a flag.
            </li>
          ) : (
            <li>
              Firefox: make sure <span className={code}>media.webspeech.synth.enabled</span> is <b>true</b> in <span className={code}>about:config</span>.
            </li>
          )}
          <li>Fully restart the browser after installing, then press Test voice.</li>
        </ol>
      </details>
      {speech.problem && (
        <button className="underline" onClick={speech.dismissProblem}>
          Dismiss
        </button>
      )}
    </div>
  );
}
