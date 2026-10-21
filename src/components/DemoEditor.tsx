import { useState } from 'react';
import type { Item, ItemLocation, MallDataset, Section, Store } from '../models/types';

interface DemoEditorProps {
  dataset: MallDataset;
  floorId: string;
  storesOnFloor: Store[];
  sectionsOnFloor: Section[];
  validationErrors: string[];
  updateDataset: (updater: (current: MallDataset) => MallDataset) => Promise<void>;
  exportData: () => string;
  importData: (raw: string) => Promise<void>;
  resetData: () => Promise<void>;
  editMessage: string | null;
  setEditMessage: (message: string | null) => void;
}

/** Local-only demo editor (moved out of the main page into a dialog). */
export function DemoEditor({
  dataset,
  floorId,
  storesOnFloor,
  sectionsOnFloor,
  validationErrors,
  updateDataset,
  exportData,
  importData,
  resetData,
  editMessage,
  setEditMessage,
}: DemoEditorProps) {
  const [importText, setImportText] = useState('');

  return (
    <div className="text-sm">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        This local-only mode edits data in localStorage. It is not a production admin system. New items and stores are added to the floor
        currently shown on the map.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = `item-${Date.now()}`;
            const location: ItemLocation = {
              id: `loc-${Date.now()}`,
              floorId,
              storeId: storesOnFloor[0]?.id ?? dataset.stores[0].id,
              sectionId: sectionsOnFloor[0]?.id ?? dataset.sections[0].id,
              aisleLabel: 'Aisle X',
              navigationNodeId: `n-${sectionsOnFloor[0]?.id ?? dataset.sections[0].id}`,
            };
            const item: Item = {
              id,
              name: 'New Demo Item',
              category: 'misc',
              keywords: ['demo'],
              locations: [location],
            };
            void updateDataset((current) => ({ ...current, items: [...current.items, item] }));
          }}
        >
          Add demo item
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('Item id to delete');
            if (!id) return;
            if (!confirm(`Delete item ${id}?`)) return;
            void updateDataset((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
          }}
        >
          Delete item by id
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('New store id');
            const name = prompt('Store name');
            if (!id || !name) return;
            void updateDataset((current) => ({
              ...current,
              stores: [
                ...current.stores,
                { id, name, floorId, bounds: { x: 40, y: 350, width: 120, height: 50 } },
              ],
            }));
          }}
        >
          Add store
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('Store id to rename');
            const name = prompt('New store name');
            if (!id || !name) return;
            void updateDataset((current) => ({
              ...current,
              stores: current.stores.map((store) => (store.id === id ? { ...store, name } : store)),
            }));
          }}
        >
          Edit store name
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const storeId = prompt('Store id for new section');
            const sectionName = prompt('Section name');
            if (!storeId || !sectionName) return;
            const sectionId = `${storeId}-sec-${Date.now()}`;
            void updateDataset((current) => ({
              ...current,
              sections: [...current.sections, { id: sectionId, storeId, floorId, name: sectionName, marker: { x: 100, y: 100 } }],
            }));
          }}
        >
          Add section
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('Section id to rename');
            const name = prompt('New section name');
            if (!id || !name) return;
            void updateDataset((current) => ({
              ...current,
              sections: current.sections.map((section) => (section.id === id ? { ...section, name } : section)),
            }));
          }}
        >
          Edit section name
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('Node id to rename');
            const label = prompt('New node label');
            if (!id || !label) return;
            void updateDataset((current) => ({
              ...current,
              graph: {
                ...current.graph,
                nodes: current.graph.nodes.map((node) => (node.id === id ? { ...node, label } : node)),
              },
            }));
          }}
        >
          Edit graph node label
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('Edge id to edit weight');
            const weight = prompt('New edge weight in meters');
            if (!id || !weight) return;
            const parsed = Number(weight);
            void updateDataset((current) => ({
              ...current,
              graph: {
                ...current.graph,
                edges: current.graph.edges.map((edge) => (edge.id === id ? { ...edge, weight: parsed } : edge)),
              },
            }));
          }}
        >
          Change edge weight
        </button>
        <button
          className="rounded border px-2 py-1 text-left"
          onClick={() => {
            const id = prompt('New edge id');
            const from = prompt('from node id');
            const to = prompt('to node id');
            if (!id || !from || !to) return;
            void updateDataset((current) => ({
              ...current,
              graph: {
                ...current.graph,
                edges: [
                  ...current.graph.edges,
                  { id, from, to, weight: 10, accessible: true, connectionType: 'corridor' as const },
                ],
              },
            }));
          }}
        >
          Add graph edge
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          className="rounded border px-3 py-1"
          onClick={() => {
            const json = exportData();
            navigator.clipboard.writeText(json).catch(() => undefined);
            setImportText(json);
            setEditMessage('Dataset exported to text area and copied when allowed.');
          }}
        >
          Export JSON
        </button>
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder="Paste dataset JSON here to import"
          className="h-36 rounded border p-2 font-mono text-xs"
        />
        <button
          className="rounded border px-3 py-1"
          onClick={() => {
            void importData(importText)
              .then(() => setEditMessage('Import successful.'))
              .catch((importError: Error) => setEditMessage(importError.message));
          }}
        >
          Import JSON (validated)
        </button>
        <button
          className="rounded border px-3 py-1"
          onClick={() => {
            if (!confirm('Reset all local edits and restore sample data?')) {
              return;
            }
            void resetData().then(() => setEditMessage('Sample data restored.'));
          }}
        >
          Reset sample data
        </button>
        {editMessage && <p className="text-xs text-sky-700 dark:text-sky-300">{editMessage}</p>}
        {validationErrors.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100">
            <h3 className="font-semibold">Validation issues</h3>
            <ul className="ml-4 list-disc">
              {validationErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
