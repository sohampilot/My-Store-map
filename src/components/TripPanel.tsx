import { estimateWalkingMinutes, formatDistance } from '../algorithms/directions';
import type { Terminal, TripPlan } from '../algorithms/multiStop';
import { WALKING_SPEED } from '../hooks/useGuidance';
import type { StepPlayback } from '../hooks/useStepPlayback';
import type { NavigationNode, SearchResult } from '../models/types';
import { SearchBox } from './SearchBox';
import { resultKey } from '../utils/resultKey';
import { StartPointSelect } from './StartPointSelect';
import { Section, buttonClass, primaryButtonClass } from './ui';

export const MAX_TRIP_STOPS = 12;

interface TripPanelProps {
  stops: SearchResult[];
  search: (query: string) => SearchResult[];
  onAddStop: (result: SearchResult) => void;
  onRemoveStop: (key: string) => void;
  onClearStops: () => void;
  onFocusStop: (result: SearchResult) => void;
  startNodeId: string;
  startCandidates: NavigationNode[];
  onStartChange: (nodeId: string) => void;
  returnToStart: boolean;
  onReturnToStartChange: (value: boolean) => void;
  accessibleOnly: boolean;
  improveOrder: boolean;
  onImproveOrderChange: (value: boolean) => void;
  plan: TripPlan | null;
  onPlan: () => void;
  onClearPlan: () => void;
  onStartNavigation: () => void;
  playback: StepPlayback;
  floorLabel: (floorId: string) => string;
  nodeFloor: (nodeId: string) => string;
}

const terminalName = (terminal: Terminal | undefined) =>
  !terminal ? '?' : terminal.isStart ? `Start (${terminal.label})` : terminal.label;

export function TripPanel({
  stops,
  search,
  onAddStop,
  onRemoveStop,
  onClearStops,
  onFocusStop,
  startNodeId,
  startCandidates,
  onStartChange,
  returnToStart,
  onReturnToStartChange,
  accessibleOnly,
  improveOrder,
  onImproveOrderChange,
  plan,
  onPlan,
  onClearPlan,
  onStartNavigation,
  playback,
  floorLabel,
  nodeFloor,
}: TripPanelProps) {
  const stopKeys = new Set(stops.map(resultKey));
  const full = stops.length >= MAX_TRIP_STOPS;
  const terminalById = new Map(plan?.terminals.map((terminal) => [terminal.id, terminal]) ?? []);
  const totalSteps = plan?.mstSteps.length ?? 0;
  const currentStep = plan && playback.index > 0 ? plan.mstSteps[playback.index - 1] : null;
  const acceptedSoFar = plan ? plan.mstSteps.slice(0, playback.index).filter((step) => step.accepted) : [];
  const treeSoFar = acceptedSoFar.reduce((sum, step) => sum + step.pair.distance, 0);
  const stopNumberByTerminal = new Map(plan?.order.map((terminal, index) => [terminal.id, index + 1]) ?? []);

  return (
    <div className="space-y-4">
      <Section title="1. Add stops" aside={<span className="text-xs text-slate-500">{stops.length}/{MAX_TRIP_STOPS}</span>}>
        <SearchBox
          search={search}
          placeholder="Search and add items, e.g. laptop, football"
          onSubmit={(result) => !full && !stopKeys.has(resultKey(result)) && onAddStop(result)}
          onResultClick={onFocusStop}
          maxHeightClass="max-h-44"
          renderActions={(result) => {
            const added = stopKeys.has(resultKey(result));
            return (
              <button
                className={`${buttonClass} ${added ? '' : 'border-sky-600 text-sky-700 dark:text-sky-300'}`}
                disabled={added || full}
                onClick={() => onAddStop(result)}
                aria-label={added ? `${result.item.name} already added` : `Add ${result.item.name} to trip`}
              >
                {added ? 'Added' : '+ Add'}
              </button>
            );
          }}
        />
        {stops.length === 0 ? (
          <p className="text-xs text-slate-500">Add two or more items to plan a multi-stop trip.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stops.map((stop) => (
              <li key={resultKey(stop)} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                <button className="min-w-0 flex-1 text-left" onClick={() => onFocusStop(stop)}>
                  <span className="font-medium">{stop.item.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {stop.floor.label} · {stop.store.name} · {stop.location.aisleLabel}
                  </span>
                </button>
                <button className="rounded px-1 text-slate-500 hover:text-red-600" onClick={() => onRemoveStop(resultKey(stop))} aria-label={`Remove ${stop.item.name}`}>
                  ✕
                </button>
              </li>
            ))}
            <li>
              <button className="text-xs text-slate-500 underline hover:text-red-600" onClick={onClearStops}>
                Clear all stops
              </button>
            </li>
          </ul>
        )}
      </Section>

      <Section title="2. Choose start">
        <StartPointSelect id="trip-start" value={startNodeId} nodes={startCandidates} floorLabel={floorLabel} onChange={onStartChange} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={returnToStart} onChange={(event) => onReturnToStartChange(event.target.checked)} />
          Return to the starting point at the end
        </label>
        <p className="text-xs text-slate-500">{accessibleOnly ? 'Step-free routes only (change in Settings).' : 'Stairs allowed (change in Settings).'}</p>
        <div className="flex flex-wrap gap-2">
          <button className={primaryButtonClass} onClick={onPlan} disabled={stops.length === 0}>
            Build trip tree
          </button>
          {plan && (
            <button className={buttonClass} onClick={onClearPlan}>
              Clear trip
            </button>
          )}
        </div>
      </Section>

      {plan && (
        <>
          <Section
            title="3. Minimum spanning tree"
            aside={
              <span className="text-xs text-slate-500">
                Step {playback.index}/{totalSteps}
              </span>
            }
          >
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Kruskal's algorithm joins the start and your stops using the shortest real walking distances, cheapest link first, skipping links that
              would make a loop. Distances count each elevator or stairs ride as part of the cost.
            </p>
            <div className="flex flex-wrap gap-1">
              <button className={buttonClass} onClick={playback.toggle}>
                {playback.playing ? 'Pause' : playback.finished ? 'Replay' : 'Play'}
              </button>
              <button className={buttonClass} onClick={playback.previous} disabled={playback.index === 0}>
                Back
              </button>
              <button className={buttonClass} onClick={playback.next} disabled={playback.finished}>
                Next step
              </button>
              <button className={buttonClass} onClick={playback.showAll} disabled={playback.finished}>
                Show all
              </button>
              <button className={buttonClass} onClick={playback.reset} disabled={playback.index === 0}>
                Reset
              </button>
            </div>
            <div className="rounded bg-slate-50 p-2 text-xs dark:bg-slate-800/60" aria-live="polite">
              {currentStep ? (
                <p>
                  <strong>{terminalName(terminalById.get(currentStep.pair.from))}</strong> ↔{' '}
                  <strong>{terminalName(terminalById.get(currentStep.pair.to))}</strong> ({formatDistance(currentStep.pair.distance) || '0 m'}):{' '}
                  {currentStep.accepted ? (
                    <span className="font-medium text-green-700 dark:text-green-400">added to the tree</span>
                  ) : (
                    <span className="font-medium text-red-700 dark:text-red-400">skipped, would create a loop</span>
                  )}
                </p>
              ) : (
                <p>Press Play or Next step to watch the tree being built.</p>
              )}
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Tree so far: {acceptedSoFar.length} of {Math.max(0, plan.terminals.length - 1 - plan.unreachable.length)} links ·{' '}
                {formatDistance(treeSoFar) || '0 m'}
                {playback.finished && ` · final tree ${formatDistance(plan.mstWeight) || '0 m'}`}
              </p>
            </div>
            <ol className="max-h-40 space-y-0.5 overflow-auto text-xs">
              {plan.mstSteps.map((step, index) => {
                const revealed = index < playback.index;
                const current = index === playback.index - 1;
                return (
                  <li
                    key={step.pair.id}
                    className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${current ? 'bg-sky-100 dark:bg-sky-900/40' : ''} ${revealed ? '' : 'opacity-50'}`}
                  >
                    <span
                      className={`w-4 flex-none text-center font-bold ${
                        !revealed ? 'text-slate-400' : step.accepted ? 'text-green-600' : 'text-red-600'
                      }`}
                      aria-label={!revealed ? 'pending' : step.accepted ? 'accepted' : 'rejected'}
                    >
                      {!revealed ? '·' : step.accepted ? '✓' : '✗'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {terminalName(terminalById.get(step.pair.from))} ↔ {terminalName(terminalById.get(step.pair.to))}
                    </span>
                    <span className="flex-none tabular-nums text-slate-500">{formatDistance(step.pair.distance) || '0 m'}</span>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="4. Visiting order">
            {plan.unreachable.length > 0 && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Can't reach {plan.unreachable.map((terminal) => terminal.label).join(', ')} with the current route options
                {accessibleOnly ? '. Try allowing stairs in Settings.' : '.'}
              </p>
            )}
            {!playback.finished ? (
              <p className="text-xs text-slate-500">The order appears once the tree is complete.</p>
            ) : (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Walk the tree from the start, nearest branch first. An MST tour is never more than twice the best possible length.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={improveOrder} onChange={(event) => onImproveOrderChange(event.target.checked)} />
                  Shorten the order with 2-opt
                </label>
                <p className="rounded bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                  Tree order cost: {formatDistance(plan.treeOrderDistance) || '0 m'}
                  {improveOrder &&
                    (plan.improvedBy2Opt
                      ? ` → 2-opt order: ${formatDistance(plan.orderDistance)} (saves ${formatDistance(plan.treeOrderDistance - plan.orderDistance)})`
                      : ' · already the best order 2-opt can find')}
                </p>
                <ol className="space-y-1 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">S</span>
                    <span>{plan.start.label}</span>
                  </li>
                  {plan.legs.map((leg) => {
                    const number = stopNumberByTerminal.get(leg.to.id);
                    return (
                      <li key={`${leg.from.id}-${leg.to.id}`} className="flex items-start gap-2">
                        <span
                          className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white ${
                            leg.to.isStart ? 'bg-green-600' : 'bg-indigo-600'
                          }`}
                        >
                          {leg.to.isStart ? 'S' : number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{leg.to.isStart ? `Back to ${leg.to.label}` : leg.to.label}</span>
                          {!leg.to.isStart && (
                            <span className="block text-slate-500 dark:text-slate-400">
                              {leg.to.stops.map((stop) => `${stop.itemName} (${stop.aisleLabel})`).join(', ')} · {floorLabel(nodeFloor(leg.to.nodeId))}
                            </span>
                          )}
                        </span>
                        <span className="flex-none tabular-nums text-slate-500">+{formatDistance(leg.distance) || '0 m'}</span>
                      </li>
                    );
                  })}
                </ol>
                {plan.route && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-sky-50 p-2 text-xs dark:bg-sky-900/30">
                    <span>
                      Walking distance {formatDistance(plan.route.walkingDistance) || '0 m'} (plus elevator rides) · about{' '}
                      {estimateWalkingMinutes(plan.route.walkingDistance, WALKING_SPEED)} min · {plan.route.steps.length} directions
                    </span>
                    <button className={primaryButtonClass} onClick={onStartNavigation}>
                      Start navigation
                    </button>
                  </div>
                )}
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
