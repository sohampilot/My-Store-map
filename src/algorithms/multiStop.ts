import { findShortestRoute } from './dijkstra';
import type { DirectionOptions } from './directions';
import { toSpeakable } from './directions';
import { computeMinimumSpanningForest } from './kruskal';
import type { DirectionStep, NavigationEdge, NavigationNode, RouteDestination, RouteResult, RouteSegment } from '../models/types';

/**
 * Multi-stop trip planning.
 *
 * 1. Every stop (and the start) becomes a "terminal". Stops that share the same navigation
 *    node are grouped into one terminal, so you only walk there once.
 * 2. The real walking distance between every pair of terminals is computed with Dijkstra
 *    (respecting the accessible-only option). This is the "metric closure" of the mall graph.
 * 3. Kruskal's algorithm builds a minimum spanning tree over those distances, step by step.
 * 4. A depth-first walk of that tree from the start (nearest branch first) gives the visiting
 *    order - the classic MST-based tour that is at most twice the optimal length.
 * 4b. Optionally, a 2-opt pass then reverses parts of that order whenever doing so makes
 *    the total walk shorter (it never makes it longer).
 * 5. The legs between consecutive terminals are stitched into one turn-by-turn route.
 */

export interface TripStopInput {
  /** Unique id for this stop, e.g. `${itemId}:${locationId}`. */
  id: string;
  nodeId: string;
  itemName: string;
  storeName: string;
  sectionName: string;
  aisleLabel: string;
}

export interface Terminal {
  id: string;
  nodeId: string;
  label: string;
  isStart: boolean;
  stops: TripStopInput[];
}

export interface TerminalPair {
  id: string;
  from: string;
  to: string;
  distance: number;
}

export interface TripMstStep {
  pair: TerminalPair;
  accepted: boolean;
}

export interface TripLeg {
  from: Terminal;
  to: Terminal;
  distance: number;
}

export interface TripPlan {
  start: Terminal;
  terminals: Terminal[];
  /** Candidate pairs sorted the way Kruskal considers them (shortest first). */
  pairs: TerminalPair[];
  mstEdges: TerminalPair[];
  mstSteps: TripMstStep[];
  mstWeight: number;
  /** Stop terminals in visiting order (start excluded). */
  order: Terminal[];
  /** Order produced directly by walking the MST (before any 2-opt improvement). */
  treeOrder: Terminal[];
  /** Total trip cost (meters) of the tree order and of the final order. */
  treeOrderDistance: number;
  orderDistance: number;
  improvedBy2Opt: boolean;
  legs: TripLeg[];
  /** Stops that cannot be reached from the start with the current options. */
  unreachable: Terminal[];
  route: RouteResult | null;
  returnToStart: boolean;
}

export interface PlanTripOptions extends DirectionOptions {
  accessibleOnly?: boolean;
  returnToStart?: boolean;
  /** Run 2-opt on the MST order (default true). */
  improveOrder?: boolean;
}

const START_ID = 'start';

/** Single-source Dijkstra returning the distance to every node. */
export const shortestDistancesFrom = (
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  sourceId: string,
  accessibleOnly = false,
): Map<string, number> => {
  const adjacency = new Map<string, Array<{ to: string; weight: number }>>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (accessibleOnly && !edge.accessible) continue;
    adjacency.get(edge.from)?.push({ to: edge.to, weight: edge.weight });
    adjacency.get(edge.to)?.push({ to: edge.from, weight: edge.weight });
  }
  const distances = new Map<string, number>();
  if (!adjacency.has(sourceId)) return distances;
  distances.set(sourceId, 0);
  const visited = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [{ id: sourceId, distance: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    for (const neighbor of adjacency.get(current.id) ?? []) {
      const candidate = current.distance + neighbor.weight;
      if (candidate < (distances.get(neighbor.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.to, candidate);
        queue.push({ id: neighbor.to, distance: candidate });
      }
    }
  }
  return distances;
};

const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const terminalDestination = (terminal: Terminal): RouteDestination => {
  const first = terminal.stops[0];
  if (!first) return {};
  const pickups = terminal.stops.map((stop) => `${stop.itemName} (${stop.aisleLabel})`);
  return {
    itemName: joinNames(terminal.stops.map((stop) => stop.itemName)),
    storeName: first.storeName,
    sectionName: first.sectionName,
    aisleLabel: first.aisleLabel,
    arrivalNote: `Pick up ${joinNames(pickups)}.`,
  };
};

/** Group stops by navigation node so one walk covers several items in the same section. */
export const buildTerminals = (startNodeId: string, stops: TripStopInput[], nodeMap: Map<string, NavigationNode>): Terminal[] => {
  const start: Terminal = {
    id: START_ID,
    nodeId: startNodeId,
    label: nodeMap.get(startNodeId)?.label ?? startNodeId,
    isStart: true,
    stops: [],
  };
  const byNode = new Map<string, Terminal>();
  for (const stop of stops) {
    const existing = byNode.get(stop.nodeId);
    if (existing) {
      existing.stops.push(stop);
      continue;
    }
    byNode.set(stop.nodeId, {
      id: `t-${stop.nodeId}`,
      nodeId: stop.nodeId,
      label: `${stop.storeName}, ${stop.sectionName}`,
      isStart: false,
      stops: [stop],
    });
  }
  return [start, ...byNode.values()];
};

/** Cost of visiting `sequence` (indices into the distance matrix) starting from index 0. */
export const sequenceCost = (sequence: number[], distance: (a: number, b: number) => number, returnToStart: boolean): number => {
  let total = 0;
  for (let index = 0; index < sequence.length - 1; index += 1) total += distance(sequence[index], sequence[index + 1]);
  if (returnToStart && sequence.length > 1) total += distance(sequence[sequence.length - 1], sequence[0]);
  return total;
};

/**
 * 2-opt local search with the first element fixed (the start).
 * Repeatedly reverses a slice of the order when that shortens the trip.
 */
export const twoOpt = (sequence: number[], distance: (a: number, b: number) => number, returnToStart: boolean): number[] => {
  let best = sequence.slice();
  let bestCost = sequenceCost(best, distance, returnToStart);
  let improved = true;
  let guard = 0;
  while (improved && guard < 1000) {
    improved = false;
    guard += 1;
    for (let i = 1; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const cost = sequenceCost(candidate, distance, returnToStart);
        if (cost < bestCost - 1e-9) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
};

const pseudoNode = (terminal: Terminal): NavigationNode => ({
  id: terminal.id,
  label: terminal.label,
  type: 'intersection',
  floorId: '',
  x: 0,
  y: 0,
});

/** Strip the leading "Start at X." sentence so a leg can be appended after a waypoint. */
const continuationOf = (spoken: string): string => {
  const trimmed = spoken.replace(/^Start at [^.]*\.\s*/, '');
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
};

/** Stitch per-leg routes into one route whose intermediate arrivals become waypoints. */
export const combineLegRoutes = (legs: Array<{ route: RouteResult; to: Terminal }>, totalStops: number): RouteResult | null => {
  if (legs.length === 0) return null;
  const nodeIds: string[] = [];
  const segments: RouteSegment[] = [];
  const steps: DirectionStep[] = [];
  let offset = 0;
  let walkingDistance = 0;
  let stopNumber = 0;

  legs.forEach(({ route, to }, legIndex) => {
    const isLastLeg = legIndex === legs.length - 1;
    route.nodeIds.forEach((id, index) => {
      if (index === 0 && nodeIds.length > 0) return;
      nodeIds.push(id);
    });
    route.segments.forEach((segment) => segments.push({ ...segment, startDistance: segment.startDistance + offset }));

    route.steps.forEach((original, index) => {
      const step: DirectionStep = { ...original, startDistance: original.startDistance + offset };
      const previous = steps[steps.length - 1];

      // Merge the beginning of this leg into the previous waypoint (same place, same moment).
      if (index === 0 && previous?.maneuver === 'waypoint' && original.maneuver !== 'arrive') {
        previous.spoken = toSpeakable(`${previous.spoken} Next, ${continuationOf(original.spoken)}`);
        previous.distance = original.distance;
        return;
      }

      if (original.maneuver === 'arrive') {
        if (to.isStart) {
          step.instruction = `Back at the start: ${to.label}`;
          step.spoken = toSpeakable(`You are back at ${to.label}. Your trip is complete.`);
          step.preview = toSpeakable(`return to ${to.label}`);
        } else {
          stopNumber += 1;
          const finalStop = isLastLeg;
          step.maneuver = finalStop ? 'arrive' : 'waypoint';
          step.instruction = `Stop ${stopNumber}: ${to.label}`;
          step.spoken = toSpeakable(
            `Stop ${stopNumber} of ${totalStops}. ${original.spoken}${finalStop ? ' This is your last stop. Your trip is complete.' : ''}`,
          );
          step.preview = toSpeakable(`arrive at stop ${stopNumber}, ${to.label}`);
        }
      }
      steps.push(step);
    });

    offset += route.totalWeight;
    walkingDistance += route.walkingDistance;
  });

  const indexed = steps.map((step, index) => ({ ...step, index }));
  return {
    nodeIds,
    totalWeight: offset,
    walkingDistance,
    instructions: indexed.map((step) => step.instruction),
    steps: indexed,
    segments,
  };
};

export const planTrip = (
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  startNodeId: string,
  stops: TripStopInput[],
  options: PlanTripOptions = {},
): TripPlan => {
  const { accessibleOnly = false, returnToStart = false, improveOrder = true, floors } = options;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const terminals = buildTerminals(startNodeId, stops, nodeMap);
  const start = terminals[0];
  const terminalById = new Map(terminals.map((terminal) => [terminal.id, terminal]));

  // All-pairs walking distances between terminals.
  const pairs: TerminalPair[] = [];
  const distanceTables = terminals.map((terminal) => shortestDistancesFrom(nodes, edges, terminal.nodeId, accessibleOnly));
  for (let i = 0; i < terminals.length; i += 1) {
    for (let j = i + 1; j < terminals.length; j += 1) {
      const distance = distanceTables[i].get(terminals[j].nodeId);
      if (distance === undefined || !Number.isFinite(distance)) continue;
      pairs.push({ id: `${terminals[i].id}~${terminals[j].id}`, from: terminals[i].id, to: terminals[j].id, distance });
    }
  }

  // Kruskal over the complete distance graph (reuses the app's union-find implementation).
  const pairById = new Map(pairs.map((pair) => [pair.id, pair]));
  const mst = computeMinimumSpanningForest(
    terminals.map(pseudoNode),
    pairs.map(
      (pair): NavigationEdge => ({
        id: pair.id,
        from: pair.from,
        to: pair.to,
        // Zero-length pairs (a stop at the start point) must still be valid edges.
        weight: pair.distance,
        accessible: true,
        connectionType: 'corridor',
      }),
    ),
  );
  const mstSteps = mst.steps.map((step) => ({ pair: pairById.get(step.edge.id)!, accepted: step.accepted }));
  const mstEdges = mst.edges.map((edge) => pairById.get(edge.id)!);

  // Depth-first walk of the tree from the start, visiting the nearest branch first.
  const adjacency = new Map<string, TerminalPair[]>();
  for (const terminal of terminals) adjacency.set(terminal.id, []);
  for (const pair of mstEdges) {
    adjacency.get(pair.from)!.push(pair);
    adjacency.get(pair.to)!.push(pair);
  }
  const visited = new Set<string>();
  const orderIds: string[] = [];
  const visit = (id: string) => {
    visited.add(id);
    orderIds.push(id);
    const neighbors = adjacency
      .get(id)!
      .map((pair) => ({ id: pair.from === id ? pair.to : pair.from, distance: pair.distance }))
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) visit(neighbor.id);
    }
  };
  visit(start.id);

  const treeOrder = orderIds.slice(1).map((id) => terminalById.get(id)!);

  // Optional 2-opt improvement using the same walking-distance matrix.
  const indexOf = new Map(terminals.map((terminal, index) => [terminal.id, index]));
  const matrix = (a: number, b: number) => distanceTables[a].get(terminals[b].nodeId) ?? Number.POSITIVE_INFINITY;
  const treeSequence = orderIds.map((id) => indexOf.get(id)!);
  const finalSequence = improveOrder ? twoOpt(treeSequence, matrix, returnToStart) : treeSequence;
  const treeOrderDistance = sequenceCost(treeSequence, matrix, returnToStart);
  const orderDistance = sequenceCost(finalSequence, matrix, returnToStart);
  const order = finalSequence.slice(1).map((index) => terminals[index]);
  const unreachable = terminals.filter((terminal) => !terminal.isStart && !visited.has(terminal.id));

  // Turn-by-turn route for the whole trip.
  const sequence = [start, ...order, ...(returnToStart && order.length > 0 ? [start] : [])];
  const legRoutes: Array<{ route: RouteResult; to: Terminal }> = [];
  const legs: TripLeg[] = [];
  for (let index = 0; index < sequence.length - 1; index += 1) {
    const from = sequence[index];
    const to = sequence[index + 1];
    const route = findShortestRoute(nodes, edges, from.nodeId, to.nodeId, accessibleOnly, {
      floors,
      destination: to.isStart ? {} : terminalDestination(to),
    });
    if (!route) continue;
    legRoutes.push({ route, to });
    legs.push({ from, to, distance: route.walkingDistance });
  }

  return {
    start,
    terminals,
    pairs: mst.sortedEdges.map((edge) => pairById.get(edge.id)!),
    mstEdges,
    mstSteps,
    mstWeight: mst.totalWeight,
    order,
    treeOrder,
    treeOrderDistance,
    orderDistance,
    improvedBy2Opt: orderDistance < treeOrderDistance - 1e-9,
    legs,
    unreachable,
    route: combineLegRoutes(legRoutes, order.length),
    returnToStart,
  };
};
