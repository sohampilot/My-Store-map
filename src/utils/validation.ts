import type { MallDataset, ValidationError } from '../models/types';

const assertUniqueIds = (errors: ValidationError[], values: string[], path: string): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push({ path, message: `Duplicate id: ${value}` });
    }
    seen.add(value);
  }
};

export const validateDataset = (dataset: MallDataset): ValidationError[] => {
  const errors: ValidationError[] = [];

  assertUniqueIds(errors, dataset.floors.map((f) => f.id), 'floors');
  assertUniqueIds(errors, dataset.stores.map((s) => s.id), 'stores');
  assertUniqueIds(errors, dataset.sections.map((s) => s.id), 'sections');
  assertUniqueIds(errors, dataset.items.map((i) => i.id), 'items');
  assertUniqueIds(errors, dataset.graph.nodes.map((n) => n.id), 'graph.nodes');
  assertUniqueIds(errors, dataset.graph.edges.map((e) => e.id), 'graph.edges');

  const floorIds = new Set(dataset.floors.map((f) => f.id));
  const storeIds = new Set(dataset.stores.map((s) => s.id));
  const sectionIds = new Set(dataset.sections.map((s) => s.id));
  const nodeIds = new Set(dataset.graph.nodes.map((n) => n.id));

  for (const store of dataset.stores) {
    if (!floorIds.has(store.floorId)) {
      errors.push({ path: `stores.${store.id}.floorId`, message: `Unknown floor ${store.floorId}` });
    }
  }

  for (const section of dataset.sections) {
    if (!storeIds.has(section.storeId)) {
      errors.push({ path: `sections.${section.id}.storeId`, message: `Unknown store ${section.storeId}` });
    }
    if (!floorIds.has(section.floorId)) {
      errors.push({ path: `sections.${section.id}.floorId`, message: `Unknown floor ${section.floorId}` });
    }
    const store = dataset.stores.find((candidate) => candidate.id === section.storeId);
    if (store && store.floorId !== section.floorId) {
      errors.push({
        path: `sections.${section.id}`,
        message: `Section floor ${section.floorId} does not match store floor ${store.floorId}`,
      });
    }
    if (!Number.isFinite(section.marker.x) || !Number.isFinite(section.marker.y)) {
      errors.push({ path: `sections.${section.id}.marker`, message: 'Section marker coordinates must be finite' });
    }
  }

  for (const node of dataset.graph.nodes) {
    if (!floorIds.has(node.floorId)) {
      errors.push({ path: `graph.nodes.${node.id}.floorId`, message: `Unknown floor ${node.floorId}` });
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      errors.push({ path: `graph.nodes.${node.id}`, message: 'Node coordinates must be finite' });
    }
    if (node.storeId && !storeIds.has(node.storeId)) {
      errors.push({ path: `graph.nodes.${node.id}.storeId`, message: `Unknown store ${node.storeId}` });
    }
    if (node.sectionId && !sectionIds.has(node.sectionId)) {
      errors.push({ path: `graph.nodes.${node.id}.sectionId`, message: `Unknown section ${node.sectionId}` });
    }
  }

  for (const edge of dataset.graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push({ path: `graph.edges.${edge.id}`, message: 'Edge endpoint references unknown node' });
    }
    if (!Number.isFinite(edge.weight) || edge.weight <= 0) {
      errors.push({ path: `graph.edges.${edge.id}.weight`, message: 'Edge weight must be positive and finite' });
    }
  }

  for (const item of dataset.items) {
    for (const location of item.locations) {
      if (!floorIds.has(location.floorId)) {
        errors.push({
          path: `items.${item.id}.locations.${location.id}.floorId`,
          message: `Unknown floor ${location.floorId}`,
        });
      }
      if (!storeIds.has(location.storeId)) {
        errors.push({
          path: `items.${item.id}.locations.${location.id}.storeId`,
          message: `Unknown store ${location.storeId}`,
        });
      }
      if (!sectionIds.has(location.sectionId)) {
        errors.push({
          path: `items.${item.id}.locations.${location.id}.sectionId`,
          message: `Unknown section ${location.sectionId}`,
        });
      }
      if (!nodeIds.has(location.navigationNodeId)) {
        errors.push({
          path: `items.${item.id}.locations.${location.id}.navigationNodeId`,
          message: `Unknown navigation node ${location.navigationNodeId}`,
        });
      }
      const store = dataset.stores.find((candidate) => candidate.id === location.storeId);
      if (store && location.floorId !== store.floorId) {
        errors.push({
          path: `items.${item.id}.locations.${location.id}`,
          message: `Location floor ${location.floorId} does not match store floor ${store.floorId}`,
        });
      }
    }
  }

  return errors;
};
