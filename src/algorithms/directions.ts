import type {
  DirectionStep,
  Floor,
  Maneuver,
  NavigationEdge,
  NavigationNode,
  RouteDestination,
  RouteSegment,
} from '../models/types';

/**
 * Turn-by-turn direction generation.
 *
 * Pure functions only (no React / browser APIs) so they stay easy to test.
 * Map coordinates are SVG coordinates (x grows to the right, y grows downward),
 * which is why a positive cross product means a clockwise (right) turn.
 */

export interface DirectionOptions {
  floors?: Floor[];
  destination?: RouteDestination;
}

interface Vector {
  x: number;
  y: number;
}

const STRAIGHT_THRESHOLD_DEG = 25;
const SLIGHT_THRESHOLD_DEG = 60;
const UTURN_THRESHOLD_DEG = 150;

export const isVerticalEdge = (edge: NavigationEdge, from?: NavigationNode, to?: NavigationNode): boolean =>
  edge.connectionType === 'elevator' || edge.connectionType === 'stairs' || (!!from && !!to && from.floorId !== to.floorId);

/** Classify the turn between an incoming and outgoing heading. */
export const classifyTurn = (incoming: Vector, outgoing: Vector): Maneuver => {
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  if (cross === 0 && dot === 0) {
    return 'straight';
  }
  const angle = (Math.atan2(cross, dot) * 180) / Math.PI; // positive = right turn
  const magnitude = Math.abs(angle);
  if (magnitude < STRAIGHT_THRESHOLD_DEG) return 'straight';
  if (magnitude < SLIGHT_THRESHOLD_DEG) return angle > 0 ? 'slight-right' : 'slight-left';
  if (magnitude < UTURN_THRESHOLD_DEG) return angle > 0 ? 'right' : 'left';
  return 'u-turn';
};

/** Make labels sound natural when read aloud ("F1 Corridor" -> "Floor 1 Corridor"). */
export const toSpeakable = (text: string): string =>
  text
    .replace(/\bF(\d+)\b/g, 'Floor $1')
    .replace(/(\d+(?:\.\d+)?)\s?m\b/g, '$1 meters')
    .replace(/\s+/g, ' ')
    .trim();

export const formatDistance = (meters: number): string => {
  if (meters <= 0) return '';
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const spokenDistance = (meters: number): string => {
  const rounded = Math.max(1, Math.round(meters));
  return `${rounded} ${rounded === 1 ? 'meter' : 'meters'}`;
};

export const estimateWalkingMinutes = (meters: number, metersPerSecond = 1.3): number =>
  Math.max(1, Math.round(meters / metersPerSecond / 60));

const floorNumber = (floorId: string, floors?: Floor[]): number => {
  const index = floors?.findIndex((floor) => floor.id === floorId) ?? -1;
  if (index >= 0) return index;
  const digits = floorId.match(/\d+/);
  return digits ? Number(digits[0]) : 0;
};

const floorName = (floorId: string, floors?: Floor[]): string =>
  floors?.find((floor) => floor.id === floorId)?.label ?? `Floor ${floorId.replace(/^f/i, '')}`;

const storeNameFromEntrance = (label: string): string => label.replace(/\s+Entrance$/i, '');

const turnPhrase: Record<string, string> = {
  straight: 'Continue straight',
  'slight-left': 'Bear left',
  'slight-right': 'Bear right',
  left: 'Turn left',
  right: 'Turn right',
  'u-turn': 'Make a U-turn',
};

interface RawStep {
  maneuver: Maneuver;
  nodeIndex: number;
  /** Turn hint for store entrances/exits ("bear left", ...). */
  turn?: Maneuver;
  /** Destination floor for elevator/stairs steps. */
  toFloorId?: string;
}

/** Build route segments (with cumulative distances) from a path and the edges used. */
export const buildSegments = (
  path: string[],
  edgesUsed: NavigationEdge[],
  nodeMap: Map<string, NavigationNode>,
): RouteSegment[] => {
  const segments: RouteSegment[] = [];
  let cumulative = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const edge = edgesUsed[index];
    const from = nodeMap.get(path[index]);
    const to = nodeMap.get(path[index + 1]);
    segments.push({
      fromId: path[index],
      toId: path[index + 1],
      edgeId: edge.id,
      weight: edge.weight,
      connectionType: edge.connectionType,
      vertical: isVerticalEdge(edge, from, to),
      startDistance: cumulative,
    });
    cumulative += edge.weight;
  }
  return segments;
};

const headingOf = (segment: RouteSegment, nodeMap: Map<string, NavigationNode>): Vector => {
  const from = nodeMap.get(segment.fromId);
  const to = nodeMap.get(segment.toId);
  if (!from || !to) return { x: 0, y: 0 };
  return { x: to.x - from.x, y: to.y - from.y };
};

/**
 * Convert a node path into Google-Maps-style turn-by-turn steps.
 * Consecutive straight corridor segments are merged into a single "continue" step.
 */
export const buildDirections = (
  path: string[],
  segments: RouteSegment[],
  nodeMap: Map<string, NavigationNode>,
  options: DirectionOptions = {},
): DirectionStep[] => {
  const { floors, destination } = options;
  const label = (nodeId: string) => nodeMap.get(nodeId)?.label ?? nodeId;
  const lastNodeId = path[path.length - 1];
  const destinationLabel =
    destination?.storeName && destination?.sectionName
      ? `${destination.storeName}, ${destination.sectionName}`
      : label(lastNodeId);

  const arrivalSentence = (): { instruction: string; spoken: string } => {
    const base = `Arrive at ${destinationLabel}`;
    const itemPart =
      destination?.itemName && destination?.aisleLabel
        ? ` ${destination.itemName} is in ${destination.aisleLabel}.`
        : destination?.itemName
          ? ` Look for ${destination.itemName}.`
          : '';
    return {
      instruction: base,
      spoken: `You have arrived at ${destinationLabel}.${itemPart}`,
    };
  };

  if (path.length <= 1) {
    const arrival = arrivalSentence();
    const node = nodeMap.get(path[0]);
    return [
      {
        index: 0,
        maneuver: 'arrive',
        nodeId: path[0],
        floorId: node?.floorId ?? '',
        instruction: arrival.instruction,
        spoken: `You are already here. ${arrival.spoken}`,
        preview: 'arrive at your destination',
        distance: 0,
        startDistance: 0,
      },
    ];
  }

  // 1. Decide where maneuvers happen.
  const finalFloorOfVerticalRun = (segmentIndex: number): string => {
    let cursor = segmentIndex;
    while (cursor + 1 < segments.length && segments[cursor + 1].vertical) cursor += 1;
    return nodeMap.get(segments[cursor].toId)?.floorId ?? '';
  };

  const verticalManeuver = (segmentIndex: number): RawStep => {
    const segment = segments[segmentIndex];
    const edgeIsStairs = segment.connectionType === 'stairs' || nodeMap.get(segment.fromId)?.type === 'stairs';
    const fromFloor = nodeMap.get(segment.fromId)?.floorId ?? '';
    const toFloor = finalFloorOfVerticalRun(segmentIndex);
    const up = floorNumber(toFloor, floors) > floorNumber(fromFloor, floors);
    const kind = edgeIsStairs ? 'stairs' : 'elevator';
    return {
      maneuver: `${kind}-${up ? 'up' : 'down'}` as Maneuver,
      nodeIndex: segmentIndex,
      toFloorId: toFloor,
    };
  };

  const raw: RawStep[] = [];
  raw.push(segments[0].vertical ? { ...verticalManeuver(0), nodeIndex: 0 } : { maneuver: 'depart', nodeIndex: 0 });

  for (let nodeIndex = 1; nodeIndex < path.length - 1; nodeIndex += 1) {
    const incoming = segments[nodeIndex - 1];
    const outgoing = segments[nodeIndex];
    const node = nodeMap.get(path[nodeIndex]);

    if (incoming.vertical && outgoing.vertical) continue; // still riding the elevator
    if (outgoing.vertical) {
      raw.push(verticalManeuver(nodeIndex));
      continue;
    }
    if (incoming.vertical) {
      const arrivedVia = raw[raw.length - 1]?.maneuver.startsWith('stairs') ? 'exit-stairs' : 'exit-elevator';
      raw.push({ maneuver: arrivedVia, nodeIndex });
      continue;
    }

    const turn = classifyTurn(headingOf(incoming, nodeMap), headingOf(outgoing, nodeMap));
    const nextNode = nodeMap.get(outgoing.toId);
    const previousNode = nodeMap.get(incoming.fromId);
    if (node?.type === 'storeEntrance' && nextNode?.type === 'sectionAccess') {
      raw.push({ maneuver: 'enter-store', nodeIndex, turn });
    } else if (node?.type === 'storeEntrance' && previousNode?.type === 'sectionAccess') {
      raw.push({ maneuver: 'exit-store', nodeIndex, turn });
    } else if (turn !== 'straight') {
      raw.push({ maneuver: turn, nodeIndex });
    }
  }
  raw.push({ maneuver: 'arrive', nodeIndex: path.length - 1 });

  // 2. Turn maneuvers into human-friendly sentences.
  const startDistanceAt = (nodeIndex: number): number =>
    nodeIndex < segments.length
      ? segments[nodeIndex].startDistance
      : segments[segments.length - 1].startDistance + segments[segments.length - 1].weight;

  const walkingBetween = (fromNodeIndex: number, toNodeIndex: number): number =>
    segments
      .slice(fromNodeIndex, toNodeIndex)
      .filter((segment) => !segment.vertical)
      .reduce((sum, segment) => sum + segment.weight, 0);

  return raw.map((step, index): DirectionStep => {
    const nodeId = path[step.nodeIndex];
    const node = nodeMap.get(nodeId);
    const next = raw[index + 1];
    const distance = next ? walkingBetween(step.nodeIndex, next.nodeIndex) : 0;
    const target = next ? (next.maneuver === 'arrive' ? destinationLabel : label(path[next.nodeIndex])) : destinationLabel;
    const here = label(nodeId);
    const walk = distance > 0 ? ` and walk ${spokenDistance(distance)}` : '';

    let instruction: string;
    let spoken: string;
    let preview: string;

    switch (step.maneuver) {
      case 'depart':
        instruction = `Head toward ${target}`;
        spoken = `Start at ${here}. Head toward ${target}${walk}.`;
        preview = `head toward ${target}`;
        break;
      case 'elevator-up':
      case 'elevator-down':
      case 'stairs-up':
      case 'stairs-down': {
        const [kind, direction] = step.maneuver.split('-');
        const destinationFloor = floorName(step.toFloorId ?? '', floors);
        instruction = `Take the ${kind} ${direction} to ${destinationFloor}`;
        spoken =
          index === 0
            ? `Start at ${here}. Take the ${kind} ${direction} to ${destinationFloor}.`
            : `Take the ${kind} ${direction} to ${destinationFloor}.`;
        preview = `take the ${kind} ${direction} to ${destinationFloor}`;
        break;
      }
      case 'exit-elevator':
      case 'exit-stairs': {
        const kind = step.maneuver === 'exit-stairs' ? 'stairs' : 'elevator';
        const currentFloor = floorName(node?.floorId ?? '', floors);
        instruction = `Exit the ${kind} on ${currentFloor} and head toward ${target}`;
        spoken = `You are now on ${currentFloor}. Exit the ${kind} and head toward ${target}${walk}.`;
        preview = `exit the ${kind} and head toward ${target}`;
        break;
      }
      case 'enter-store': {
        const store = storeNameFromEntrance(here);
        const hint = step.turn && step.turn !== 'straight' ? `, then ${turnPhrase[step.turn].toLowerCase()}` : '';
        instruction = `Enter ${store}${hint} toward ${target}`;
        spoken = `Enter ${store}${hint} toward ${target}${walk}.`;
        preview = `enter ${store}`;
        break;
      }
      case 'exit-store': {
        const store = storeNameFromEntrance(here);
        instruction = `Leave ${store} and head toward ${target}`;
        spoken = `Leave ${store} and head toward ${target}${walk}.`;
        preview = `leave ${store}`;
        break;
      }
      case 'arrive': {
        const arrival = arrivalSentence();
        instruction = arrival.instruction;
        spoken = arrival.spoken;
        preview = `arrive at ${destinationLabel}`;
        break;
      }
      default: {
        const phrase = turnPhrase[step.maneuver] ?? 'Continue';
        instruction = `${phrase} at ${here} toward ${target}`;
        spoken = `${phrase} at ${here} toward ${target}${walk}.`;
        preview = `${phrase.toLowerCase()} toward ${target}`;
      }
    }

    return {
      index,
      maneuver: step.maneuver,
      nodeId,
      floorId: node?.floorId ?? '',
      instruction,
      spoken: toSpeakable(spoken),
      preview: toSpeakable(preview),
      distance,
      startDistance: startDistanceAt(step.nodeIndex),
    };
  });
};

/** Index of the step that is active after travelling `traveled` meters along the route. */
export const stepIndexAtDistance = (steps: DirectionStep[], traveled: number): number => {
  let current = 0;
  for (let index = 0; index < steps.length; index += 1) {
    if (steps[index].startDistance <= traveled + 1e-9) current = index;
  }
  return current;
};

/** Interpolated walker position after travelling `traveled` meters along the route. */
export const positionAlongRoute = (
  segments: RouteSegment[],
  nodeMap: Map<string, NavigationNode>,
  traveled: number,
): { floorId: string; x: number; y: number } | null => {
  if (segments.length === 0) return null;
  const clamp = Math.max(0, traveled);
  for (const segment of segments) {
    if (clamp <= segment.startDistance + segment.weight) {
      const from = nodeMap.get(segment.fromId);
      const to = nodeMap.get(segment.toId);
      if (!from || !to) return null;
      const t = segment.weight > 0 ? (clamp - segment.startDistance) / segment.weight : 1;
      if (segment.vertical) {
        // Stay at the elevator/stairs, switching floors halfway through the ride.
        const node = t < 0.5 ? from : to;
        return { floorId: node.floorId, x: node.x, y: node.y };
      }
      return { floorId: from.floorId, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
  }
  const last = nodeMap.get(segments[segments.length - 1].toId);
  return last ? { floorId: last.floorId, x: last.x, y: last.y } : null;
};
