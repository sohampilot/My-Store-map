import { describe, expect, it } from 'vitest';
import { findShortestRoute } from '../algorithms/dijkstra';
import type { NavigationEdge, NavigationNode } from '../models/types';

const nodes: NavigationNode[] = [
  { id: 'start', label: 'Start', type: 'entrance', floorId: 'f1', x: 0, y: 0 },
  { id: 'lift1', label: 'Elevator F1', type: 'elevator', floorId: 'f1', x: 1, y: 0 },
  { id: 'stairs1', label: 'Stairs F1', type: 'stairs', floorId: 'f1', x: 2, y: 0 },
  { id: 'lift2', label: 'Elevator F2', type: 'elevator', floorId: 'f2', x: 1, y: 1 },
  { id: 'stairs2', label: 'Stairs F2', type: 'stairs', floorId: 'f2', x: 2, y: 1 },
  { id: 'dest', label: 'Destination', type: 'sectionAccess', floorId: 'f2', x: 3, y: 1 },
];

const edges: NavigationEdge[] = [
  { id: 'e1', from: 'start', to: 'lift1', weight: 10, accessible: true, connectionType: 'corridor' },
  { id: 'e2', from: 'start', to: 'stairs1', weight: 4, accessible: false, connectionType: 'corridor' },
  { id: 'e3', from: 'lift1', to: 'lift2', weight: 12, accessible: true, connectionType: 'elevator' },
  { id: 'e4', from: 'stairs1', to: 'stairs2', weight: 5, accessible: false, connectionType: 'stairs' },
  { id: 'e5', from: 'lift2', to: 'dest', weight: 8, accessible: true, connectionType: 'corridor' },
  { id: 'e6', from: 'stairs2', to: 'dest', weight: 2, accessible: false, connectionType: 'corridor' },
];

describe('findShortestRoute', () => {
  it('finds shortest path on known graph', () => {
    const route = findShortestRoute(nodes, edges, 'start', 'dest', false);
    expect(route?.totalWeight).toBe(11);
    expect(route?.nodeIds).toEqual(['start', 'stairs1', 'stairs2', 'dest']);
  });

  it('returns null for unreachable destination', () => {
    const route = findShortestRoute(nodes, edges.filter((edge) => edge.id !== 'e3' && edge.id !== 'e4'), 'start', 'dest', true);
    expect(route).toBeNull();
  });

  it('handles start equals destination', () => {
    const route = findShortestRoute(nodes, edges, 'start', 'start', true);
    expect(route?.totalWeight).toBe(0);
    expect(route?.nodeIds).toEqual(['start']);
  });

  it('supports accessibility filtering and cross-floor connectivity', () => {
    const route = findShortestRoute(nodes, edges, 'start', 'dest', true);
    expect(route?.nodeIds).toEqual(['start', 'lift1', 'lift2', 'dest']);
    expect(route?.totalWeight).toBe(30);
  });
});
