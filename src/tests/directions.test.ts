import { describe, expect, it } from 'vitest';
import sampleMallData from '../data/sampleMallData.json';
import { findShortestRoute } from '../algorithms/dijkstra';
import {
  classifyTurn,
  formatDistance,
  positionAlongRoute,
  stepIndexAtDistance,
  toSpeakable,
} from '../algorithms/directions';
import { routeOverview } from '../hooks/useGuidance';
import { sortVoices } from '../hooks/useSpeech';
import type { MallDataset } from '../models/types';

const dataset = sampleMallData as unknown as MallDataset;
const nodeMap = new Map(dataset.graph.nodes.map((node) => [node.id, node]));

const route = (from: string, to: string, accessibleOnly = true) =>
  findShortestRoute(dataset.graph.nodes, dataset.graph.edges, from, to, accessibleOnly, {
    floors: dataset.floors,
    destination: { itemName: 'Laptop Pro 14', storeName: 'Tech Haven', sectionName: 'Front Section', aisleLabel: 'Aisle 2' },
  });

describe('classifyTurn (SVG coordinates, y grows downward)', () => {
  const east = { x: 1, y: 0 };
  it('detects straight, left, right, slight turns and U-turns', () => {
    expect(classifyTurn(east, { x: 1, y: 0.1 })).toBe('straight');
    expect(classifyTurn(east, { x: 0, y: -1 })).toBe('left');
    expect(classifyTurn(east, { x: 0, y: 1 })).toBe('right');
    expect(classifyTurn(east, { x: 1, y: -1 })).toBe('slight-left');
    expect(classifyTurn(east, { x: 1, y: 1 })).toBe('slight-right');
    expect(classifyTurn(east, { x: -1, y: 0.05 })).toBe('u-turn');
  });
});

describe('buildDirections', () => {
  it('produces Google-Maps-style steps for a same-floor route', () => {
    const result = route('n-ent-east', 'n-s-tech-sec-a');
    expect(result).not.toBeNull();
    const maneuvers = result!.steps.map((step) => step.maneuver);
    expect(maneuvers).toEqual(['depart', 'left', 'enter-store', 'arrive']);
    expect(result!.steps[1].instruction).toBe('Turn left at F1 Corridor East toward Tech Haven Entrance');
    expect(result!.steps[0].distance).toBe(35);
    expect(result!.steps.at(-1)!.spoken).toContain('Laptop Pro 14 is in Aisle 2');
    expect(result!.instructions).toHaveLength(result!.steps.length);
  });

  it('merges straight corridor segments into one step', () => {
    const result = route('n-ent-east', 'n-s-books-sec-a');
    const depart = result!.steps[0];
    // East entrance -> corridor east -> center -> market -> west: all straight.
    expect(depart.distance).toBe(35 + 40 + 38 + 36);
    expect(result!.steps[1].maneuver).toBe('left');
  });

  it('announces elevator rides with the destination floor on accessible routes', () => {
    const result = route('n-ent-east', 'n-s-toys-sec-b');
    const maneuvers = result!.steps.map((step) => step.maneuver);
    expect(maneuvers).toContain('elevator-up');
    expect(maneuvers).toContain('exit-elevator');
    expect(maneuvers).not.toContain('stairs-up');
    const ride = result!.steps.find((step) => step.maneuver === 'elevator-up')!;
    expect(ride.instruction).toBe('Take the elevator up to Floor 2');
    expect(result!.walkingDistance).toBe(result!.totalWeight - 24);
  });

  it('uses stairs going down when accessibility is off', () => {
    const result = route('n-f2-info', 'n-f1-restroom', false);
    expect(result!.steps.map((step) => step.maneuver)).toContain('stairs-down');
  });

  it('describes leaving a store', () => {
    const result = route('n-s-books-sec-a', 'n-s-tech-sec-b');
    expect(result!.steps[1].maneuver).toBe('exit-store');
    expect(result!.steps[1].instruction).toContain('Leave Page Turners');
  });

  it('handles start equal to destination', () => {
    const result = route('n-s-tech-sec-a', 'n-s-tech-sec-a');
    expect(result!.steps).toHaveLength(1);
    expect(result!.steps[0].maneuver).toBe('arrive');
    expect(result!.steps[0].spoken).toMatch(/already here/);
  });

  it('spoken text expands abbreviations for text-to-speech', () => {
    const result = route('n-ent-east', 'n-s-tech-sec-a');
    expect(result!.steps[1].spoken).toContain('Floor 1 Corridor East');
    expect(result!.steps[1].spoken).toContain('12 meters');
  });
});

describe('guidance helpers', () => {
  it('tracks the active step and walker position along the route', () => {
    const result = route('n-ent-east', 'n-s-toys-sec-b')!;
    expect(stepIndexAtDistance(result.steps, 0)).toBe(0);
    expect(stepIndexAtDistance(result.steps, result.totalWeight)).toBe(result.steps.length - 1);

    const start = positionAlongRoute(result.segments, nodeMap, 0)!;
    expect(start).toMatchObject({ floorId: 'f1', x: 20, y: 250 });
    const halfwayFirstCorridor = positionAlongRoute(result.segments, nodeMap, 17.5)!;
    expect(halfwayFirstCorridor.x).toBeCloseTo(70);
    const end = positionAlongRoute(result.segments, nodeMap, result.totalWeight)!;
    expect(end.floorId).toBe('f2');
  });

  it('formats distances and spoken text', () => {
    expect(formatDistance(0)).toBe('');
    expect(formatDistance(12.4)).toBe('12 m');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(toSpeakable('Walk 5 m to F2 Corridor')).toBe('Walk 5 meters to Floor 2 Corridor');
  });

  it('summarises a route for the voice overview', () => {
    const result = route('n-ent-east', 'n-s-tech-sec-a')!;
    expect(routeOverview(result, 'Laptop Pro 14')).toBe('Route to Laptop Pro 14: 55 meters, about 1 minute on foot.');
  });

  it('sorts voices so the preferred language comes first', () => {
    const voice = (name: string, lang: string) => ({ name, lang, voiceURI: name, localService: true, default: false }) as SpeechSynthesisVoice;
    const sorted = sortVoices([voice('Hindi', 'hi-IN'), voice('US', 'en-US'), voice('India English', 'en-IN')], 'en-IN');
    expect(sorted.map((entry) => entry.name)).toEqual(['India English', 'US', 'Hindi']);
  });
});
