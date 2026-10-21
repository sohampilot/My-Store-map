import { describe, expect, it } from 'vitest';
import sampleMallData from '../data/sampleMallData.json';
import { validateDataset } from '../utils/validation';
import type { MallDataset } from '../models/types';

const clone = (): MallDataset => structuredClone(sampleMallData as MallDataset);

describe('validateDataset', () => {
  it('accepts valid sample dataset', () => {
    const errors = validateDataset(clone());
    expect(errors).toHaveLength(0);
  });

  it('detects broken references and invalid imports', () => {
    const dataset = clone();
    dataset.items[0].locations[0].navigationNodeId = 'missing-node';
    dataset.graph.edges[0].to = 'missing-node';
    dataset.stores[0].id = dataset.stores[1].id;
    const errors = validateDataset(dataset);
    expect(errors.some((error) => error.path.includes('navigationNodeId'))).toBe(true);
    expect(errors.some((error) => error.path.includes('graph.edges'))).toBe(true);
    expect(errors.some((error) => error.message.includes('Duplicate id'))).toBe(true);
  });
});
