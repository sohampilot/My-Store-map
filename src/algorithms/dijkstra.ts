import type { NavigationEdge, NavigationNode, RouteResult } from '../models/types';

interface QueueEntry {
  nodeId: string;
  distance: number;
}

const getNeighbors = (
  nodeId: string,
  edges: NavigationEdge[],
  accessibleOnly: boolean,
): Array<{ nodeId: string; edge: NavigationEdge }> => {
  const neighbors: Array<{ nodeId: string; edge: NavigationEdge }> = [];
  for (const edge of edges) {
    if (accessibleOnly && !edge.accessible) {
      continue;
    }
    if (edge.from === nodeId) {
      neighbors.push({ nodeId: edge.to, edge });
    } else if (edge.to === nodeId) {
      neighbors.push({ nodeId: edge.from, edge });
    }
  }
  return neighbors;
};

export const findShortestRoute = (
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  startNodeId: string,
  endNodeId: string,
  accessibleOnly = false,
): RouteResult | null => {
  if (startNodeId === endNodeId) {
    const label = nodes.find((node) => node.id === startNodeId)?.label ?? startNodeId;
    return {
      nodeIds: [startNodeId],
      totalWeight: 0,
      instructions: [`You are already at ${label}.`],
    };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeMap.has(startNodeId) || !nodeMap.has(endNodeId)) {
    return null;
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const queue: QueueEntry[] = [];

  for (const node of nodes) {
    distances.set(node.id, Number.POSITIVE_INFINITY);
    previous.set(node.id, null);
  }

  distances.set(startNodeId, 0);
  queue.push({ nodeId: startNodeId, distance: 0 });

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance || a.nodeId.localeCompare(b.nodeId));
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.nodeId === endNodeId) {
      break;
    }

    if (current.distance > (distances.get(current.nodeId) ?? Number.POSITIVE_INFINITY)) {
      continue;
    }

    const neighbors = getNeighbors(current.nodeId, edges, accessibleOnly);
    for (const neighbor of neighbors) {
      const candidateDistance = current.distance + neighbor.edge.weight;
      const existing = distances.get(neighbor.nodeId) ?? Number.POSITIVE_INFINITY;
      if (candidateDistance < existing) {
        distances.set(neighbor.nodeId, candidateDistance);
        previous.set(neighbor.nodeId, current.nodeId);
        queue.push({ nodeId: neighbor.nodeId, distance: candidateDistance });
      }
    }
  }

  const finalDistance = distances.get(endNodeId) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(finalDistance)) {
    return null;
  }

  const path: string[] = [];
  let cursor: string | null = endNodeId;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
  }

  const instructions = path.map((nodeId, index) => {
    const node = nodeMap.get(nodeId);
    const floorPart = node ? ` (Floor ${node.floorId.replace('f', '')})` : '';
    if (index === 0) {
      return `Start at ${node?.label ?? nodeId}${floorPart}.`;
    }
    return `Proceed to ${node?.label ?? nodeId}${floorPart}.`;
  });

  return {
    nodeIds: path,
    totalWeight: finalDistance,
    instructions,
  };
};
