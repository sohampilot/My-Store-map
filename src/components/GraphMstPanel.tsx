import type { MSTResult } from '../algorithms/kruskal';
import type { StepPlayback } from '../hooks/useStepPlayback';
import { buttonClass } from './ui';

interface GraphMstPanelProps {
  show: boolean;
  onShowChange: (value: boolean) => void;
  mst: MSTResult;
  playback: StepPlayback;
  nodeCount: number;
  edgeCount: number;
}

/** Whole-mall MST of the walkway graph (an algorithm visualisation, not visitor guidance). */
export function GraphMstPanel({ show, onShowChange, mst, playback, nodeCount, edgeCount }: GraphMstPanelProps) {
  const revealed = mst.steps.slice(0, playback.index);
  const accepted = revealed.filter((step) => step.accepted).length;
  const current = playback.index > 0 ? mst.steps[playback.index - 1] : null;

  return (
    <div className="space-y-2 text-xs">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={show} onChange={(event) => onShowChange(event.target.checked)} />
        Show walkway minimum spanning tree
      </label>
      <p className="text-slate-500">Connects every navigation point with the least total walkway length. It is not a visitor route.</p>
      <div className="grid grid-cols-3 gap-1 rounded bg-slate-50 p-2 dark:bg-slate-800/60">
        <div>Nodes: {nodeCount}</div>
        <div>Edges: {edgeCount}</div>
        <div>Groups: {mst.components}</div>
        <div>Tree edges: {mst.edges.length}</div>
        <div className="col-span-2">Tree weight: {mst.totalWeight.toFixed(0)} m</div>
      </div>
      {mst.components > 1 && <p className="text-amber-600">The graph is disconnected, so this is a minimum spanning forest.</p>}
      <div className="flex flex-wrap gap-1">
        <button
          className={buttonClass}
          onClick={() => {
            onShowChange(true);
            playback.toggle();
          }}
        >
          {playback.playing ? 'Pause' : playback.finished ? 'Replay' : 'Play'}
        </button>
        <button className={buttonClass} onClick={playback.previous} disabled={playback.index === 0}>
          Back
        </button>
        <button
          className={buttonClass}
          onClick={() => {
            onShowChange(true);
            playback.next();
          }}
          disabled={playback.finished}
        >
          Next step
        </button>
        <button className={buttonClass} onClick={playback.reset} disabled={playback.index === 0}>
          Reset
        </button>
      </div>
      {current && (
        <p aria-live="polite">
          Step {playback.index} of {mst.steps.length}: {current.edge.id} ({current.edge.weight} m) →{' '}
          {current.accepted ? 'accepted' : 'rejected (cycle)'} · accepted {accepted}, rejected {revealed.length - accepted}
        </p>
      )}
    </div>
  );
}
