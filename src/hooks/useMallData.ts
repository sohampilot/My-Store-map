import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocalDataService } from '../services/LocalDataService';
import type { MallDataset } from '../models/types';
import { validateDataset } from '../utils/validation';

const dataService = new LocalDataService();

export const useMallData = () => {
  const [dataset, setDataset] = useState<MallDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    dataService
      .loadDataset()
      .then((loaded) => {
        setDataset(loaded);
        setValidationErrors(validateDataset(loaded).map((entry) => `${entry.path}: ${entry.message}`));
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (next: MallDataset) => {
    const errors = validateDataset(next).map((entry) => `${entry.path}: ${entry.message}`);
    setValidationErrors(errors);
    if (errors.length > 0) {
      throw new Error('Validation failed. Fix data before saving.');
    }
    setDataset(next);
    await dataService.saveLocalEdits(next);
  }, []);

  const actions = useMemo(
    () => ({
      searchItems: (query: string) => (dataset ? dataService.searchItems(dataset, query) : []),
      save,
      exportData: () => (dataset ? dataService.exportData(dataset) : ''),
      importData: async (raw: string) => {
        const imported = await dataService.importData(raw);
        setDataset(imported);
        setValidationErrors([]);
      },
      resetData: async () => {
        const reset = await dataService.resetSampleData();
        setDataset(reset);
        setValidationErrors([]);
      },
    }),
    [dataset, save],
  );

  return { dataset, loading, error, validationErrors, ...actions };
};
