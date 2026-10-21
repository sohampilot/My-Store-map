import { useEffect, useMemo, useState } from 'react';
import './index.css';
import { computeMinimumSpanningForest } from './algorithms/kruskal';
import { findShortestRoute } from './algorithms/dijkstra';
import { MapView } from './components/MapView';
import { Legend } from './components/Legend';
import { AccessibleLocationList } from './components/AccessibleLocationList';
import { NavigationPanel } from './components/NavigationPanel';
import { useMallData } from './hooks/useMallData';
import { useSpeech } from './hooks/useSpeech';
import { useGuidance } from './hooks/useGuidance';
import type { Item, ItemLocation, MallDataset, NavigationNode, SearchResult } from './models/types';

const THEME_KEY = 'mallmap-theme';
const EMPTY_NODES: NavigationNode[] = [];

const initialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const { dataset, loading, error, validationErrors, searchItems, save, exportData, importData, resetData } = useMallData();
  const [floorId, setFloorId] = useState('f1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [routeRequested, setRouteRequested] = useState(false);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [startNodeId, setStartNodeId] = useState('n-ent-east');
  const [accessibleOnly, setAccessibleOnly] = useState(true);
  const [showMst, setShowMst] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const floorLabel = (id: string) => dataset?.floors.find((floor) => floor.id === id)?.label ?? id;

  // Shortest route is derived from the current selection, so it never goes stale
  // when the item, start point, or accessibility option changes.
  const routeOutcome = useMemo(() => {
    if (!routeRequested || !dataset || !selectedResult) {
      return { route: null, error: null };
    }
    const computed = findShortestRoute(
      dataset.graph.nodes,
      dataset.graph.edges,
      startNodeId,
      selectedResult.location.navigationNodeId,
      accessibleOnly,
      {
        floors: dataset.floors,
        destination: {
          itemName: selectedResult.item.name,
          storeName: selectedResult.store.name,
          sectionName: selectedResult.section.name,
          aisleLabel: selectedResult.location.aisleLabel,
        },
      },
    );
    return computed
      ? { route: computed, error: null }
      : {
          route: null,
          error: accessibleOnly
            ? 'No step-free route is available. Try turning off "Accessible route only".'
            : 'No route available for the selected options.',
        };
  }, [accessibleOnly, dataset, routeRequested, selectedResult, startNodeId]);
  const route = routeOutcome.route;
  const routeError = routeHint ?? routeOutcome.error;

  const speech = useSpeech();
  const guidance = useGuidance({
    route,
    nodes: dataset?.graph.nodes ?? EMPTY_NODES,
    speech,
    destinationName: selectedResult?.item.name,
  });

  // Show the floor where the route starts whenever a new route is created
  // (state is adjusted during render, as recommended by React, instead of in an effect).
  const [previousRoute, setPreviousRoute] = useState(route);
  if (route !== previousRoute) {
    setPreviousRoute(route);
    const startFloor = route && dataset?.graph.nodes.find((node) => node.id === route.nodeIds[0])?.floorId;
    if (startFloor) setFloorId(startFloor);
  }

  // Follow the "you are here" marker across floors during guidance.
  const walkerFloorId = guidance.position?.floorId;
  const [previousWalkerFloorId, setPreviousWalkerFloorId] = useState(walkerFloorId);
  if (walkerFloorId !== previousWalkerFloorId) {
    setPreviousWalkerFloorId(walkerFloorId);
    if (walkerFloorId) setFloorId(walkerFloorId);
  }

  const results = useMemo(() => searchItems(searchQuery), [searchItems, searchQuery]);

  const mstResult = useMemo(() => {
    if (!dataset) {
      return null;
    }
    return computeMinimumSpanningForest(dataset.graph.nodes, dataset.graph.edges, { accessibleOnly: false });
  }, [dataset]);

  useEffect(() => {
    if (!isPlaying || !mstResult) {
      return;
    }
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= mstResult.steps.length) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [isPlaying, mstResult]);

  if (loading) {
    return <div className="p-8 text-center">Loading MallMap Navigator…</div>;
  }

  if (error || !dataset) {
    return <div className="p-8 text-red-600">Error loading data: {error ?? 'Unknown error'}</div>;
  }

  const floors = dataset.floors;
  const storesOnFloor = dataset.stores.filter((store) => store.floorId === floorId);
  const sectionsOnFloor = dataset.sections.filter((section) => section.floorId === floorId);
  const facilitiesOnFloor = dataset.facilities.filter((facility) => facility.floorId === floorId);
  const nodes = dataset.graph.nodes;
  const candidateStartNodes = nodes.filter((node) => ['entrance', 'intersection', 'facility', 'storeEntrance', 'elevator', 'stairs'].includes(node.type));

  const stepSlice = mstResult ? mstResult.steps.slice(0, stepIndex) : [];
  const stepAccepted = stepSlice.filter((step) => step.accepted);
  const stepRejected = stepSlice.filter((step) => !step.accepted);
  const currentStep = mstResult && stepIndex > 0 ? mstResult.steps[Math.min(stepIndex - 1, mstResult.steps.length - 1)] : null;
  // During step playback the map shows only the edges accepted so far.
  const visibleMstEdges = !showMst || !mstResult ? [] : stepIndex > 0 ? stepAccepted.map((step) => step.edge) : mstResult.edges;

  const connectedComponents = mstResult?.components ?? 0;

  const selectResult = (result: SearchResult) => {
    setSelectedResult(result);
    setFloorId(result.location.floorId);
    setSelectedStoreId(result.store.id);
    setSelectedSectionId(result.section.id);
    setSelectedNodeId(result.location.navigationNodeId);
    setRouteHint(null);
  };

  const runRoute = () => {
    if (!selectedResult) {
      setRouteHint('Search for an item and select it first.');
      return;
    }
    setRouteHint(null);
    setRouteRequested(true);
  };

  const selectedIsStartCandidate = !!selectedNodeId && candidateStartNodes.some((node) => node.id === selectedNodeId);

  const updateDataset = async (updater: (current: MallDataset) => MallDataset) => {
    try {
      const next = updater(dataset);
      await save(next);
      setEditMessage('Saved successfully.');
    } catch (saveError) {
      setEditMessage(saveError instanceof Error ? saveError.message : 'Save failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mb-4 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">MallMap Navigator</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Interactive fictional mall map with searchable product locations, route guidance, and MST graph visualization.
            </p>
          </div>
          <button
            className="rounded border px-3 py-2"
            onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'light' ? 'Dark Theme' : 'Light Theme'}
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <label className="mb-1 block text-sm font-medium">Search items, categories, keywords, or store</label>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results.length > 0) selectResult(results[0]);
              }}
              type="search"
              aria-label="Search items"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Try: laptop, groceries, sports, Urban Fashion"
            />
            {searchQuery.trim().length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Start typing to search 40+ sample items.</p>
            ) : results.length === 0 ? (
              <p className="mt-2 text-xs text-amber-600">No results found. Try broader keywords.</p>
            ) : (
              <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-sm">
                {results.map((result) => (
                  <li key={`${result.item.id}-${result.location.id}`}>
                    <button
                      className={`w-full rounded border p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        selectedResult?.location.id === result.location.id && selectedResult.item.id === result.item.id
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30'
                          : ''
                      }`}
                      onClick={() => selectResult(result)}
                    >
                      <div className="font-medium">{result.item.name}</div>
                      <div className="text-xs">
                        {result.floor.label} → {result.store.name} → {result.section.name} → {result.location.aisleLabel}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold">Route controls</h2>
            {selectedResult ? (
              <p className="mb-2 text-xs">
                To: <strong>{selectedResult.item.name}</strong> ({selectedResult.store.name}, {selectedResult.location.aisleLabel})
              </p>
            ) : (
              <p className="mb-2 text-xs text-slate-500">Pick an item from the search results to set a destination.</p>
            )}
            <label className="mb-1 block text-xs font-medium" htmlFor="start-node">
              Starting point
            </label>
            <select id="start-node" className="mb-2 w-full rounded border px-2 py-2 text-sm" value={startNodeId} onChange={(event) => setStartNodeId(event.target.value)}>
              {candidateStartNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label} ({floorLabel(node.floorId)})
                </option>
              ))}
            </select>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={accessibleOnly} onChange={(event) => setAccessibleOnly(event.target.checked)} />
              Accessible route only (exclude stairs)
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded border border-sky-600 px-3 py-1 font-medium text-sky-700 dark:text-sky-300" onClick={runRoute}>
                Get directions
              </button>
              {routeRequested && (
                <button className="rounded border px-3 py-1" onClick={() => setRouteRequested(false)}>
                  Clear route
                </button>
              )}
            </div>
            {routeError && <p className="mt-2 text-xs text-red-600">{routeError}</p>}
          </div>

          {route && (
            <NavigationPanel
              route={route}
              guidance={guidance}
              speech={speech}
              destinationName={selectedResult?.item.name}
              floorLabel={floorLabel}
            />
          )}

          <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold">MST controls</h2>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showMst} onChange={(event) => setShowMst(event.target.checked)} />
              Show Minimum Spanning Tree
            </label>
            <p className="mb-2 text-xs text-slate-500">
              MST is a graph visualization that connects all navigation nodes. It is not the shortest route for visitors.
            </p>
            <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
              <div>Total nodes: {dataset.graph.nodes.length}</div>
              <div>Candidate edges: {dataset.graph.edges.length}</div>
              <div>Selected edges: {mstResult?.edges.length ?? 0}</div>
              <div>Total tree weight: {(mstResult?.totalWeight ?? 0).toFixed(1)}</div>
              <div>Components: {connectedComponents}</div>
            </div>
            {connectedComponents > 1 && (
              <p className="mb-2 text-xs text-amber-600">Graph is disconnected; showing a minimum spanning forest.</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                className="rounded border px-2 py-1"
                onClick={() => {
                  setShowMst(true);
                  if (mstResult && stepIndex >= mstResult.steps.length) setStepIndex(0);
                  setIsPlaying((value) => !value);
                }}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                className="rounded border px-2 py-1"
                onClick={() => {
                  setShowMst(true);
                  setStepIndex((value) => Math.min(mstResult?.steps.length ?? 0, value + 1));
                }}
              >
                Next Step
              </button>
              <button
                className="rounded border px-2 py-1"
                onClick={() => {
                  setStepIndex(0);
                  setIsPlaying(false);
                }}
              >
                Reset
              </button>
            </div>
            {currentStep && (
              <div className="mt-2 text-xs">
                <p>
                  Step {stepIndex} of {mstResult?.steps.length}: {currentStep.edge.id} ({currentStep.edge.weight}m) →{' '}
                  {currentStep.accepted ? 'accepted' : 'rejected (cycle)'}
                </p>
                <p>Accepted edges so far: {stepAccepted.length}</p>
                <p>Rejected edges so far: {stepRejected.length}</p>
              </div>
            )}
          </div>

          <Legend />
          <AccessibleLocationList
            stores={storesOnFloor}
            sections={sectionsOnFloor}
            onSelectStore={(store) => setSelectedStoreId(store)}
            onSelectSection={(section) => setSelectedSectionId(section)}
          />
        </aside>

        <main className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium">Floor:</label>
            <select className="rounded border px-2 py-1" value={floorId} onChange={(event) => setFloorId(event.target.value)}>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.label}
                </option>
              ))}
            </select>
            <button className="rounded border px-2 py-1" onClick={() => setEditMode((value) => !value)}>
              {editMode ? 'Close Demo Edit Mode' : 'Open Demo Edit Mode'}
            </button>
          </div>

          <MapView
            floorId={floorId}
            floors={floors}
            stores={storesOnFloor}
            sections={sectionsOnFloor}
            facilities={facilitiesOnFloor}
            nodes={dataset.graph.nodes}
            edges={dataset.graph.edges}
            mstEdges={visibleMstEdges}
            mstCandidate={showMst && currentStep && stepIndex < (mstResult?.steps.length ?? 0) ? { edge: currentStep.edge, accepted: currentStep.accepted } : null}
            routeNodeIds={route?.nodeIds ?? []}
            selectedNodeId={selectedNodeId}
            activeStepNodeId={guidance.status !== 'idle' ? guidance.currentStep?.nodeId : undefined}
            walker={guidance.position}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            onSelectSection={(sectionId) => setSelectedSectionId(sectionId)}
            onSelectStore={(storeId) => setSelectedStoreId(storeId)}
            onChangeFloor={setFloorId}
          />

          <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold">Selection details</h2>
            {selectedResult && (
              <p>
                Item: <strong>{selectedResult.item.name}</strong> at {selectedResult.floor.label} → {selectedResult.store.name} →{' '}
                {selectedResult.section.name} → {selectedResult.location.aisleLabel}
              </p>
            )}
            {selectedStoreId && <p>Store: {dataset.stores.find((store) => store.id === selectedStoreId)?.name}</p>}
            {selectedSectionId && <p>Section: {dataset.sections.find((section) => section.id === selectedSectionId)?.name}</p>}
            {selectedNodeId && (
              <p className="flex flex-wrap items-center gap-2">
                Node: {dataset.graph.nodes.find((node) => node.id === selectedNodeId)?.label}
                {selectedIsStartCandidate && selectedNodeId !== startNodeId && (
                  <button className="rounded border px-2 py-0.5 text-xs" onClick={() => setStartNodeId(selectedNodeId)}>
                    Start from here
                  </button>
                )}
              </p>
            )}
            {!selectedResult && !selectedStoreId && !selectedSectionId && !selectedNodeId && <p>No location selected.</p>}
          </div>

          {editMode && (
            <details className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
              <summary className="cursor-pointer font-semibold">Local Demo Edit Mode</summary>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                This local-only mode edits data in localStorage. It is not a production admin system.
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
              </div>
            </details>
          )}

          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100">
              <h3 className="font-semibold">Validation issues</h3>
              <ul className="ml-4 list-disc">
                {validationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
