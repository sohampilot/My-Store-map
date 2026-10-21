import { describe, expect, it } from 'vitest';
import { computeMinimumSpanningForest } from '../algorithms/kruskal';
import type { NavigationEdge, NavigationNode } from '../models/types';

const nodes: NavigationNode[] = [
  { id: 'a', label: 'A', type: 'intersection', floorId: 'f1', x: 0, y: 0 },
  { id: 'b', label: 'B', type: 'intersection', floorId: 'f1', x: 1, y: 0 },
  { id: 'c', label: 'C', type: 'intersection', floorId: 'f1', x: 2, y: 0 },
  { id: 'd', label: 'D', type: 'intersection', floorId: 'f1', x: 3, y: 0 },
];

const edges: NavigationEdge[] = [
  { id: 'e1', from: 'a', to: 'b', weight: 1, accessible: true, connectionType: 'corridor' },
  { id: 'e2', from: 'b', to: 'c', weight: 2, accessible: true, connectionType: 'corridor' },
  { id: 'e3', from: 'c', to: 'd', weight: 3, accessible: true, connectionType: 'corridor' },
  { id: 'e4', from: 'a', to: 'd', weight: 10, accessible: true, connectionType: 'corridor' },
  { id: 'e5', from: 'a', to: 'c', weight: 2, accessible: true, connectionType: 'corridor' },
];

describe('computeMinimumSpanningForest', () => {
  it('returns expected total weight for known graph', () => {
    const result = computeMinimumSpanningForest(nodes, edges);
    expect(result.totalWeight).toBe(6);
    expect(result.edges).toHaveLength(3);
    expect(result.components).toBe(1);
  });

  it('rejects cycle edges during step mode', () => {
    const result = computeMinimumSpanningForest(nodes, edges);
    expect(result.steps.some((step) => !step.accepted && step.reason === 'cycle')).toBe(true);
  });

  it('uses deterministic tie-breaking with equal weights', () => {
    const tieEdges: NavigationEdge[] = [
      { id: 'e3', from: 'a', to: 'c', weight: 1, accessible: true, connectionType: 'corridor' },
      { id: 'e2', from: 'a', to: 'b', weight: 1, accessible: true, connectionType: 'corridor' },
      { id: 'e1', from: 'b', to: 'c', weight: 1, accessible: true, connectionType: 'corridor' },
    ];
    const result = computeMinimumSpanningForest(nodes.slice(0, 3), tieEdges);
    expect(result.sortedEdges.map((edge) => edge.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('returns forest details for disconnected graphs', () => {
    const disconnected = computeMinimumSpanningForest(
      nodes,
      [{ id: 'e1', from: 'a', to: 'b', weight: 1, accessible: true, connectionType: 'corridor' }],
    );
    expect(disconnected.components).toBe(3);
    expect(disconnected.edges).toHaveLength(1);
  });

  it('handles empty and single-node graphs', () => {
    const empty = computeMinimumSpanningForest([], []);
    expect(empty.edges).toHaveLength(0);
    expect(empty.components).toBe(0);

    const single = computeMinimumSpanningForest(
      [{ id: 'solo', label: 'Solo', type: 'intersection', floorId: 'f1', x: 0, y: 0 }],
      [],
    );
    expect(single.edges).toHaveLength(0);
    expect(single.components).toBe(1);
  });
});
