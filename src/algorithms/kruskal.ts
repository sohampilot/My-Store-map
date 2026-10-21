import { UnionFind } from './unionFind';
import type { NavigationEdge, NavigationNode } from '../models/types';

export interface MSTStep {
  edge: NavigationEdge;
  accepted: boolean;
  reason: 'accepted' | 'cycle';
}

export interface MSTResult {
  edges: NavigationEdge[];
  totalWeight: number;
  components: number;
  sortedEdges: NavigationEdge[];
  steps: MSTStep[];
}

const edgeTieBreaker = (a: NavigationEdge, b: NavigationEdge): number => {
  if (a.weight !== b.weight) {
    return a.weight - b.weight;
  }
  const minA = a.from < a.to ? a.from : a.to;
  const maxA = a.from < a.to ? a.to : a.from;
  const minB = b.from < b.to ? b.from : b.to;
  const maxB = b.from < b.to ? b.to : b.from;
  if (minA !== minB) {
    return minA.localeCompare(minB);
  }
  if (maxA !== maxB) {
    return maxA.localeCompare(maxB);
  }
  return a.id.localeCompare(b.id);
};

export const computeMinimumSpanningForest = (
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  options?: { accessibleOnly?: boolean },
): MSTResult => {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const candidates = edges
    .filter((edge) => validNodeIds.has(edge.from) && validNodeIds.has(edge.to))
    .filter((edge) => !options?.accessibleOnly || edge.accessible)
    .slice()
    .sort(edgeTieBreaker);

  const unionFind = new UnionFind(nodes.map((node) => node.id));
  const chosen: NavigationEdge[] = [];
  const steps: MSTStep[] = [];

  for (const edge of candidates) {
    const accepted = unionFind.union(edge.from, edge.to);
    if (accepted) {
      chosen.push(edge);
      steps.push({ edge, accepted: true, reason: 'accepted' });
    } else {
      steps.push({ edge, accepted: false, reason: 'cycle' });
    }
  }

  return {
    edges: chosen,
    totalWeight: chosen.reduce((sum, edge) => sum + edge.weight, 0),
    components: unionFind.countComponents(),
    sortedEdges: candidates,
    steps,
  };
};
