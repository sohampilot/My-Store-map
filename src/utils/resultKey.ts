import type { SearchResult } from '../models/types';

/** Stable key for an item at a specific location. */
export const resultKey = (result: SearchResult) => `${result.item.id}:${result.location.id}`;
