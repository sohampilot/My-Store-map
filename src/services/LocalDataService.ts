import sampleMallData from '../data/sampleMallData.json';
import type { DataService } from './DataService';
import type { MallDataset, SearchResult } from '../models/types';
import { validateDataset } from '../utils/validation';

const STORAGE_KEY = 'mallmap-dataset-v1';

const asDataset = (input: unknown): MallDataset => input as MallDataset;

export class LocalDataService implements DataService {
  private readonly fallbackData = asDataset(sampleMallData);

  async loadDataset(): Promise<MallDataset> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(this.fallbackData);
    }

    try {
      const parsed = JSON.parse(raw) as MallDataset;
      const errors = validateDataset(parsed);
      if (errors.length > 0) {
        localStorage.removeItem(STORAGE_KEY);
        return structuredClone(this.fallbackData);
      }
      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return structuredClone(this.fallbackData);
    }
  }

  searchItems(dataset: MallDataset, query: string): SearchResult[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const storeById = new Map(dataset.stores.map((store) => [store.id, store]));
    const sectionById = new Map(dataset.sections.map((section) => [section.id, section]));
    const floorById = new Map(dataset.floors.map((floor) => [floor.id, floor]));

    const matches: SearchResult[] = [];
    for (const item of dataset.items) {
      const searchable = [item.name, item.category, ...item.keywords].join(' ').toLowerCase();
      const itemMatches = searchable.includes(normalized);
      for (const location of item.locations) {
        const store = storeById.get(location.storeId);
        const section = sectionById.get(location.sectionId);
        const floor = floorById.get(location.floorId);
        const storeMatches = (store?.name ?? '').toLowerCase().includes(normalized);
        if ((itemMatches || storeMatches) && store && section && floor) {
          matches.push({ item, location, store, section, floor });
        }
      }
    }

    return matches;
  }

  async saveLocalEdits(dataset: MallDataset): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  }

  exportData(dataset: MallDataset): string {
    return JSON.stringify(dataset, null, 2);
  }

  async importData(raw: string): Promise<MallDataset> {
    const parsed = JSON.parse(raw) as MallDataset;
    const errors = validateDataset(parsed);
    if (errors.length > 0) {
      throw new Error(errors.map((error) => `${error.path}: ${error.message}`).join('\n'));
    }
    await this.saveLocalEdits(parsed);
    return parsed;
  }

  async resetSampleData(): Promise<MallDataset> {
    localStorage.removeItem(STORAGE_KEY);
    const cloned = structuredClone(this.fallbackData);
    await this.saveLocalEdits(cloned);
    return cloned;
  }
}
