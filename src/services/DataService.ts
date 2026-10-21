import type { MallDataset, SearchResult } from '../models/types';

export interface DataService {
  loadDataset(): Promise<MallDataset>;
  searchItems(dataset: MallDataset, query: string): SearchResult[];
  saveLocalEdits(dataset: MallDataset): Promise<void>;
  exportData(dataset: MallDataset): string;
  importData(raw: string): Promise<MallDataset>;
  resetSampleData(): Promise<MallDataset>;
}
