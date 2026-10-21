import { describe, expect, it } from 'vitest';
import sampleMallData from '../data/sampleMallData.json';
import { planTrip, sequenceCost, shortestDistancesFrom, twoOpt, type TripStopInput } from '../algorithms/multiStop';
import { findShortestRoute } from '../algorithms/dijkstra';
import type { MallDataset } from '../models/types';

const dataset = sampleMallData as unknown as MallDataset;
const { nodes, edges } = dataset.graph;

const stop = (nodeId: string, itemName: string, aisleLabel = 'Aisle 1'): TripStopInput => ({
  id: `${itemName}:${nodeId}`,
  nodeId,
  itemName,
  storeName: nodeId.replace(/^n-s-|-sec-.$/g, ''),
  sectionName: nodeId.endsWith('a') ? 'Front Section' : 'Back Section',
  aisleLabel,
});

const plan = (stops: TripStopInput[], options = {}) =>
  planTrip(nodes, edges, 'n-ent-east', stops, { accessibleOnly: true, floors: dataset.floors, ...options });

describe('shortestDistancesFrom', () => {
  it('matches point-to-point Dijkstra', () => {
    const table = shortestDistancesFrom(nodes, edges, 'n-ent-east', true);
    for (const target of ['n-s-tech-sec-a', 'n-s-toys-sec-b', 'n-f2-info']) {
      expect(table.get(target)).toBe(findShortestRoute(nodes, edges, 'n-ent-east', target, true)!.totalWeight);
    }
  });
});

describe('planTrip', () => {
  const stops = [
    stop('n-s-toys-sec-b', 'Lego'),
    stop('n-s-tech-sec-a', 'Laptop', 'Aisle 2'),
    stop('n-s-books-sec-a', 'Novel'),
    stop('n-s-tech-sec-a', 'Mouse', 'Aisle 3'),
    stop('n-s-cosmetics-sec-a', 'Lipstick'),
  ];

  it('groups items in the same section into one stop', () => {
    const result = plan(stops);
    expect(result.terminals).toHaveLength(5); // start + 4 distinct sections
    const tech = result.terminals.find((terminal) => terminal.nodeId === 'n-s-tech-sec-a')!;
    expect(tech.stops.map((entry) => entry.itemName)).toEqual(['Laptop', 'Mouse']);
  });

  it('builds a spanning tree over all terminals with Kruskal steps in distance order', () => {
    const result = plan(stops);
    expect(result.mstEdges).toHaveLength(result.terminals.length - 1);
    const distances = result.mstSteps.map((step) => step.pair.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(result.mstSteps.filter((step) => step.accepted)).toHaveLength(result.terminals.length - 1);
    expect(result.mstWeight).toBe(result.mstEdges.reduce((sum, pair) => sum + pair.distance, 0));
    // Complete graph on 5 terminals = 10 candidate pairs.
    expect(result.pairs).toHaveLength(10);
  });

  it('visits every stop exactly once and the route ends at the last stop', () => {
    const result = plan(stops);
    expect(new Set(result.order.map((terminal) => terminal.id)).size).toBe(4);
    expect(result.route).not.toBeNull();
    expect(result.route!.nodeIds[0]).toBe('n-ent-east');
    expect(result.route!.nodeIds.at(-1)).toBe(result.order.at(-1)!.nodeId);
    const waypoints = result.route!.steps.filter((step) => step.maneuver === 'waypoint');
    expect(waypoints).toHaveLength(3);
    expect(result.route!.steps.at(-1)!.maneuver).toBe('arrive');
    expect(result.route!.steps.at(-1)!.spoken).toContain('last stop');
    expect(result.route!.steps.map((step) => step.index)).toEqual(result.route!.steps.map((_, index) => index));
  });

  it('announces pickups for grouped items at a waypoint and continues to the next stop', () => {
    const result = plan(stops);
    const techStep = result.route!.steps.find((step) => step.nodeId === 'n-s-tech-sec-a')!;
    expect(techStep.spoken).toContain('Pick up Laptop (Aisle 2) and Mouse (Aisle 3)');
    if (techStep.maneuver === 'waypoint') expect(techStep.spoken).toContain('Next,');
  });

  it('2-opt never makes the order longer than the tree order', () => {
    const improved = plan(stops);
    const treeOnly = plan(stops, { improveOrder: false });
    expect(improved.orderDistance).toBeLessThanOrEqual(improved.treeOrderDistance);
    expect(treeOnly.orderDistance).toBe(treeOnly.treeOrderDistance);
    expect(treeOnly.order.map((terminal) => terminal.id)).toEqual(treeOnly.treeOrder.map((terminal) => terminal.id));
  });

  it('can return to the start', () => {
    const result = plan(stops.slice(0, 2), { returnToStart: true });
    expect(result.route!.nodeIds.at(-1)).toBe('n-ent-east');
    expect(result.route!.steps.at(-1)!.instruction).toMatch(/Back at the start/);
  });

  it('reports stops that cannot be reached', () => {
    const blocked = edges.filter((edge) => edge.connectionType !== 'elevator');
    const result = planTrip(nodes, blocked, 'n-ent-east', [stop('n-s-tech-sec-a', 'Laptop'), stop('n-s-toys-sec-a', 'Lego')], {
      accessibleOnly: true,
    });
    expect(result.unreachable.map((terminal) => terminal.nodeId)).toEqual(['n-s-toys-sec-a']);
    expect(result.order.map((terminal) => terminal.nodeId)).toEqual(['n-s-tech-sec-a']);
  });

  it('handles a single stop', () => {
    const result = plan([stop('n-s-tech-sec-a', 'Laptop')]);
    expect(result.order).toHaveLength(1);
    expect(result.route!.steps.at(-1)!.maneuver).toBe('arrive');
  });
});

describe('twoOpt', () => {
  it('fixes a crossing order on a line', () => {
    // Points on a line at positions 0, 1, 2, 3 visited as 0 -> 2 -> 1 -> 3.
    const position = [0, 1, 2, 3];
    const distance = (a: number, b: number) => Math.abs(position[a] - position[b]);
    const improved = twoOpt([0, 2, 1, 3], distance, false);
    expect(improved).toEqual([0, 1, 2, 3]);
    expect(sequenceCost(improved, distance, false)).toBe(3);
  });
});
