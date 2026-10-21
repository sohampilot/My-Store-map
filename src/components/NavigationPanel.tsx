import { useEffect, useRef } from 'react';
import { estimateWalkingMinutes, formatDistance } from '../algorithms/directions';
import type { GuidanceController } from '../hooks/useGuidance';
import { routeOverview, WALKING_SPEED } from '../hooks/useGuidance';
import type { SpeechController } from '../hooks/useSpeech';
import type { RouteResult } from '../models/types';
import { ManeuverIcon } from './ManeuverIcon';

interface NavigationPanelProps {
  route: RouteResult;
  guidance: GuidanceController;
  speech: SpeechController;
  destinationName?: string;
  floorLabel: (floorId: string) => string;
  onOpenSettings: () => void;
  /** Short label for the route, e.g. "Laptop Pro 14" or "Trip: 3 stops". */
  title?: string;
}

const btn =
  'rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';

const isVerticalManeuver = (maneuver: string) => maneuver.startsWith('elevator') || maneuver.startsWith('stairs');

export function NavigationPanel({ route, guidance, speech, destinationName, floorLabel, onOpenSettings, title }: NavigationPanelProps) {
  const { status, steps, stepIndex, currentStep } = guidance;
  const minutes = estimateWalkingMinutes(route.walkingDistance, WALKING_SPEED);
  const isActive = status === 'guiding';
  const upcoming = steps[stepIndex + 1];
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the active step visible in the list while guidance advances.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    active?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [stepIndex]);

  const readAll = () => {
    speech.speak(routeOverview(route, destinationName));
    steps.forEach((step, index) => speech.speak(`Step ${index + 1}. ${step.spoken}`, { interrupt: false }));
  };

  return (
    <section aria-label="Turn-by-turn directions">
      {/* Current instruction and controls stay pinned while the step list scrolls. */}
      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 border-b border-slate-200 bg-white px-3 pb-1 pt-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate font-semibold">{title ?? 'Directions'}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {formatDistance(route.walkingDistance) || '0 m'} · about {minutes} min walk
        </p>
      </div>

      {currentStep && (
        <div
          className={`mb-2 rounded-lg p-3 text-white ${status === 'arrived' ? 'bg-emerald-600' : currentStep.maneuver === 'waypoint' ? 'bg-indigo-600' : 'bg-sky-700'}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-start gap-3">
            <ManeuverIcon maneuver={currentStep.maneuver} className="mt-0.5 h-8 w-8 flex-none" />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug">{currentStep.instruction}</p>
              <p className="mt-1 text-xs text-sky-100">
                {status === 'arrived'
                  ? 'You have arrived.'
                  : isVerticalManeuver(currentStep.maneuver)
                    ? `Then continue on ${floorLabel(upcoming?.floorId ?? currentStep.floorId)}`
                    : upcoming
                      ? `${formatDistance(status === 'idle' ? currentStep.distance : guidance.distanceToNextManeuver)} · then ${upcoming.preview}`
                      : ''}
              </p>
              <p className="mt-1 text-[11px] text-sky-100">
                Step {stepIndex + 1} of {steps.length} · {floorLabel(currentStep.floorId)}
                {status !== 'idle' && status !== 'arrived' && ` · ${formatDistance(guidance.remainingDistance)} left`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        {isActive ? (
          <button className={`${btn} border-amber-500 font-medium`} onClick={guidance.pause}>
            Pause guidance
          </button>
        ) : (
          <button className={`${btn} border-sky-600 bg-sky-600 font-medium text-white hover:bg-sky-700 dark:hover:bg-sky-700`} onClick={guidance.start}>
            {status === 'paused' ? 'Resume guidance' : status === 'arrived' ? 'Restart guidance' : 'Start voice guidance'}
          </button>
        )}
        <button className={btn} onClick={guidance.previous} disabled={stepIndex === 0}>
          Back
        </button>
        <button className={btn} onClick={guidance.repeat} disabled={!speech.supported || !speech.settings.enabled}>
          Repeat
        </button>
        <button className={btn} onClick={guidance.next} disabled={stepIndex >= steps.length - 1}>
          Next
        </button>
        <button className={btn} onClick={guidance.stop} disabled={status === 'idle'}>
          Stop
        </button>
        <button className={btn} onClick={readAll} disabled={!speech.supported || !speech.settings.enabled}>
          Read all
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={speech.settings.enabled}
            onChange={(event) => speech.updateSettings({ enabled: event.target.checked })}
            disabled={!speech.supported}
          />
          Voice on
        </label>
        <span className="text-slate-500">{guidance.simulateWalk ? 'Simulated walk on' : 'Step-by-step mode'}</span>
        <button className="text-sky-700 underline dark:text-sky-300" onClick={onOpenSettings}>
          Voice & walk settings
        </button>
        {speech.speaking && <span className="text-sky-700 dark:text-sky-300">Speaking…</span>}
      </div>

      </div>

      {!speech.supported && (
        <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          This browser does not support text-to-speech. Directions are still shown on screen.
        </p>
      )}
      {speech.supported && speech.voicesLoaded && speech.voices.length === 0 && (
        <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          No speech voices were found. On Linux, install a speech engine (for example on Arch:{' '}
          <code>sudo pacman -S speech-dispatcher espeak-ng</code>) and restart the browser.
        </p>
      )}

      <ol ref={listRef} className="space-y-1 text-xs">
        {steps.map((step) => {
          const active = step.index === stepIndex;
          const done = step.index < stepIndex && status !== 'idle';
          return (
            <li key={`${step.index}-${step.nodeId}`}>
              <div
                className={`flex items-start gap-2 rounded border p-2 ${
                  active
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30'
                    : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                } ${done ? 'opacity-60' : ''}`}
              >
                <button className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={() => guidance.goToStep(step.index)} aria-current={active ? 'step' : undefined}>
                  <ManeuverIcon maneuver={step.maneuver} className="mt-0.5 h-4 w-4 flex-none" />
                  <span className="min-w-0">
                    <span className="block font-medium">{step.instruction}</span>
                    {step.distance > 0 && <span className="text-slate-500 dark:text-slate-400">{formatDistance(step.distance)}</span>}
                  </span>
                </button>
                <button
                  className="flex-none rounded px-1 text-slate-500 hover:text-sky-700 disabled:opacity-30 dark:text-slate-400"
                  onClick={() => speech.speak(step.spoken)}
                  disabled={!speech.supported || !speech.settings.enabled}
                  aria-label={`Listen to step ${step.index + 1}`}
                  title="Listen to this step"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5 6 9H2v6h4l5 4z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

    </section>
  );
}
