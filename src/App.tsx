import { useCallback, useMemo, useState } from 'react';
import './index.css';
import { computeMinimumSpanningForest } from './algorithms/kruskal';
import { findShortestRoute } from './algorithms/dijkstra';
import { planTrip, type TripStopInput } from './algorithms/multiStop';
import { MapView, type MapStopMarker, type MapTripLink } from './components/MapView';
import { AccessibleLocationList } from './components/AccessibleLocationList';
import { NavigationPanel } from './components/NavigationPanel';
import { TripPanel, MAX_TRIP_STOPS } from './components/TripPanel';
import { GraphMstPanel } from './components/GraphMstPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { DemoEditor } from './components/DemoEditor';
import { Drawer } from './components/Drawer';
import { SearchBox } from './components/SearchBox';
import { resultKey } from './utils/resultKey';
import { StartPointSelect } from './components/StartPointSelect';
import { GearIcon, Section, Tabs, buttonClass, cardClass, primaryButtonClass } from './components/ui';
import { useMallData } from './hooks/useMallData';
import { useSpeech } from './hooks/useSpeech';
import { useGuidance } from './hooks/useGuidance';
import { useAppSettings } from './hooks/useAppSettings';
import { useStepPlayback } from './hooks/useStepPlayback';
import type { MallDataset, NavigationEdge, NavigationNode, SearchResult } from './models/types';

type TabId = 'find' | 'trip' | 'directions' | 'explore';
type RouteSource = 'single' | 'trip' | null;

const EMPTY_NODES: NavigationNode[] = [];
const EMPTY_EDGES: NavigationEdge[] = [];
const START_NODE_TYPES = ['entrance', 'intersection', 'facility', 'storeEntrance', 'elevator', 'stairs'];

const toTripStop = (result: SearchResult): TripStopInput => ({
  id: resultKey(result),
  nodeId: result.location.navigationNodeId,
  itemName: result.item.name,
  storeName: result.store.name,
  sectionName: result.section.name,
  aisleLabel: result.location.aisleLabel,
});

function App() {
  const { dataset, loading, error, validationErrors, searchItems, save, exportData, importData, resetData } = useMallData();
  const { settings, update: updateSettings } = useAppSettings();

  const [tab, setTab] = useState<TabId>('find');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [floorId, setFloorId] = useState('f1');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [startNodeId, setStartNodeId] = useState('n-ent-east');
  const [singleRequested, setSingleRequested] = useState(false);
  const [tripStops, setTripStops] = useState<SearchResult[]>([]);
  const [tripRequested, setTripRequested] = useState(false);
  const [routeSource, setRouteSource] = useState<RouteSource>(null);
  const [showGraphMst, setShowGraphMst] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const nodes = dataset?.graph.nodes ?? EMPTY_NODES;
  const edges = dataset?.graph.edges ?? EMPTY_EDGES;
  const floorLabel = useCallback((id: string) => dataset?.floors.find((floor) => floor.id === id)?.label ?? id, [dataset]);
  const nodeFloor = useCallback((nodeId: string) => nodes.find((node) => node.id === nodeId)?.floorId ?? '', [nodes]);
  const { accessibleOnly, returnToStart } = settings;

  // Single destination route, derived from the selection so it never goes stale.
  const single = useMemo(() => {
    if (!singleRequested || !dataset || !selectedResult) return { route: null, error: null };
    const route = findShortestRoute(nodes, edges, startNodeId, selectedResult.location.navigationNodeId, accessibleOnly, {
      floors: dataset.floors,
      destination: {
        itemName: selectedResult.item.name,
        storeName: selectedResult.store.name,
        sectionName: selectedResult.section.name,
        aisleLabel: selectedResult.location.aisleLabel,
      },
    });
    return route
      ? { route, error: null }
      : {
          route: null,
          error: accessibleOnly
            ? 'No step-free route is available. Allow stairs in Settings and try again.'
            : 'No route available for the selected options.',
        };
  }, [accessibleOnly, dataset, edges, nodes, selectedResult, singleRequested, startNodeId]);

  // Multi-stop trip: all-pairs walking distances -> MST -> visiting order -> stitched route.
  const tripPlan = useMemo(() => {
    if (!tripRequested || !dataset || tripStops.length === 0) return null;
    return planTrip(nodes, edges, startNodeId, tripStops.map(toTripStop), {
      accessibleOnly,
      returnToStart,
      improveOrder: settings.improveTripOrder,
      floors: dataset.floors,
    });
  }, [accessibleOnly, dataset, edges, nodes, returnToStart, settings.improveTripOrder, startNodeId, tripRequested, tripStops]);
  const tripPlayback = useStepPlayback(tripPlan?.mstSteps.length ?? 0, settings.playbackMs, tripPlan, true);

  const graphMst = useMemo(() => computeMinimumSpanningForest(nodes, edges, { accessibleOnly: false }), [edges, nodes]);
  const graphPlayback = useStepPlayback(graphMst.steps.length, Math.max(250, settings.playbackMs - 300), graphMst);

  const route = routeSource === 'single' ? single.route : routeSource === 'trip' ? (tripPlan?.route ?? null) : null;
  const tripStopCount = tripPlan?.order.length ?? 0;
  const routeTitle =
    routeSource === 'trip'
      ? `Trip · ${tripStopCount} ${tripStopCount === 1 ? 'stop' : 'stops'}`
      : selectedResult
        ? `To ${selectedResult.item.name}`
        : 'Directions';

  const speech = useSpeech();
  const guidance = useGuidance({
    route,
    nodes,
    speech,
    destinationName: routeSource === 'trip' ? `your ${tripStopCount} stops` : selectedResult?.item.name,
    simulateWalk: settings.simulateWalk,
    speedMultiplier: settings.speedMultiplier,
  });

  // Jump to the start floor when a new route appears, and follow the walker between floors.
  const [previousRoute, setPreviousRoute] = useState(route);
  if (route !== previousRoute) {
    setPreviousRoute(route);
    const startFloor = route && nodes.find((node) => node.id === route.nodeIds[0])?.floorId;
    if (startFloor) setFloorId(startFloor);
  }
  const walkerFloorId = guidance.position?.floorId;
  const [previousWalkerFloorId, setPreviousWalkerFloorId] = useState(walkerFloorId);
  if (walkerFloorId !== previousWalkerFloorId) {
    setPreviousWalkerFloorId(walkerFloorId);
    if (walkerFloorId) setFloorId(walkerFloorId);
  }

  if (loading) {
    return <div className="p-8 text-center">Loading MallMap Navigator…</div>;
  }
  if (error || !dataset) {
    return <div className="p-8 text-red-600">Error loading data: {error ?? 'Unknown error'}</div>;
  }

  const storesOnFloor = dataset.stores.filter((store) => store.floorId === floorId);
  const sectionsOnFloor = dataset.sections.filter((section) => section.floorId === floorId);
  const facilitiesOnFloor = dataset.facilities.filter((facility) => facility.floorId === floorId);
  const startCandidates = nodes.filter((node) => START_NODE_TYPES.includes(node.type));
  const selectedIsStartCandidate = !!selectedNodeId && startCandidates.some((node) => node.id === selectedNodeId);
  const stopKeys = new Set(tripStops.map(resultKey));

  // ---- actions -------------------------------------------------------------
  const focusResult = (result: SearchResult) => {
    setSelectedResult(result);
    setFloorId(result.location.floorId);
    setSelectedStoreId(result.store.id);
    setSelectedSectionId(result.section.id);
    setSelectedNodeId(result.location.navigationNodeId);
  };

  const getDirections = (result: SearchResult | null = selectedResult) => {
    if (!result) return;
    focusResult(result);
    setSingleRequested(true);
    setRouteSource('single');
    setTab('directions');
  };

  const addStop = (result: SearchResult) => {
    setTripStops((current) =>
      current.length >= MAX_TRIP_STOPS || current.some((stop) => resultKey(stop) === resultKey(result)) ? current : [...current, result],
    );
  };
  const removeStop = (key: string) => setTripStops((current) => current.filter((stop) => resultKey(stop) !== key));
  const clearTrip = () => {
    setTripRequested(false);
    if (routeSource === 'trip') setRouteSource(null);
  };

  const updateDataset = async (updater: (current: MallDataset) => MallDataset) => {
    try {
      await save(updater(dataset));
      setEditMessage('Saved successfully.');
    } catch (saveError) {
      setEditMessage(saveError instanceof Error ? saveError.message : 'Save failed.');
    }
  };

  // ---- map overlays --------------------------------------------------------
  const tripVisible = tab === 'trip' || routeSource === 'trip';
  const stopMarkers: MapStopMarker[] = [];
  if (tripVisible && tripStops.length > 0) {
    stopMarkers.push({ nodeId: startNodeId, badge: 'S', title: 'Trip start', isStart: true });
    const numbered = tripPlan && tripPlayback.finished ? tripPlan.order.map((terminal) => terminal.nodeId) : [...new Set(tripStops.map((stop) => stop.location.navigationNodeId))];
    numbered.forEach((nodeId, index) => {
      if (nodeId === startNodeId) return;
      const items = tripStops.filter((stop) => stop.location.navigationNodeId === nodeId).map((stop) => stop.item.name);
      stopMarkers.push({ nodeId, badge: tripPlan && tripPlayback.finished ? String(index + 1) : '•', title: items.join(', ') });
    });
  }

  const tripLinks: MapTripLink[] = [];
  if (tripPlan && tab === 'trip') {
    const terminalNode = new Map(tripPlan.terminals.map((terminal) => [terminal.id, terminal.nodeId]));
    tripPlan.mstSteps.slice(0, tripPlayback.index).forEach((step, index) => {
      const isCurrent = index === tripPlayback.index - 1 && !tripPlayback.finished;
      if (!step.accepted && !isCurrent) return;
      tripLinks.push({
        id: step.pair.id,
        fromNodeId: terminalNode.get(step.pair.from)!,
        toNodeId: terminalNode.get(step.pair.to)!,
        distance: step.pair.distance,
        state: isCurrent ? (step.accepted ? 'accepted' : 'rejected') : 'tree',
      });
    });
  }

  const graphMstVisible = tab === 'explore' && showGraphMst;
  const graphRevealed = graphMst.steps.slice(0, graphPlayback.index);
  const graphMstEdges = !graphMstVisible ? [] : graphPlayback.index > 0 ? graphRevealed.filter((step) => step.accepted).map((step) => step.edge) : graphMst.edges;
  const graphCandidate =
    graphMstVisible && graphPlayback.index > 0 && !graphPlayback.finished
      ? { edge: graphRevealed[graphRevealed.length - 1].edge, accepted: graphRevealed[graphRevealed.length - 1].accepted }
      : null;

  // While the trip tree is animating, hide the walking route so the tree is easy to follow.
  const showRouteLine = !!route && !(routeSource === 'trip' && tab === 'trip' && !tripPlayback.finished);

  // ---- render --------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 lg:h-screen dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">MallMap Navigator</h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
            Find items, plan multi-stop trips with a minimum spanning tree, and follow spoken directions.
          </p>
        </div>
        <button
          className="hidden rounded-full border px-2 py-0.5 text-xs sm:inline-block"
          onClick={() => setSettingsOpen(true)}
          title="Change in Settings"
        >
          {accessibleOnly ? 'Step-free routes' : 'Stairs allowed'}
        </button>
        <button
          className="rounded border px-2 py-1.5"
          onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
          aria-label={settings.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title="Toggle theme"
        >
          {settings.theme === 'light' ? '☾' : '☀'}
        </button>
        <button className="flex items-center gap-1 rounded border px-2 py-1.5 text-sm" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog">
          <GearIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3 lg:grid lg:min-h-0 lg:grid-cols-[380px_1fr]">
        {/* Side panel: tabs keep everything within one screen. */}
        <aside className={`${cardClass} order-2 flex min-h-0 flex-col lg:order-1`}>
          <div className="flex-none border-b border-slate-200 p-2 dark:border-slate-800">
            <Tabs<TabId>
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'find', label: 'Find' },
                { id: 'trip', label: 'Trip', badge: tripStops.length || undefined },
                { id: 'directions', label: 'Directions', badge: route ? route.steps.length : undefined },
                { id: 'explore', label: 'Explore' },
              ]}
            />
          </div>

          <div key={tab} className="min-h-0 flex-1 overflow-auto p-3" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'find' && (
              <div className="space-y-4">
                <Section title="Find an item">
                  <SearchBox
                    search={searchItems}
                    placeholder="Try: laptop, groceries, sports, Urban Fashion"
                    onSubmit={focusResult}
                    onResultClick={focusResult}
                    isActive={(result) => !!selectedResult && resultKey(result) === resultKey(selectedResult)}
                    renderActions={(result) => (
                      <>
                        <button className={`${buttonClass} border-sky-600 text-sky-700 dark:text-sky-300`} onClick={() => getDirections(result)}>
                          Go
                        </button>
                        <button
                          className={buttonClass}
                          onClick={() => addStop(result)}
                          disabled={stopKeys.has(resultKey(result)) || tripStops.length >= MAX_TRIP_STOPS}
                          title="Add to multi-stop trip"
                        >
                          {stopKeys.has(resultKey(result)) ? 'In trip' : '+ Trip'}
                        </button>
                      </>
                    )}
                  />
                </Section>
                <Section title="Destination">
                  {selectedResult ? (
                    <p className="text-sm">
                      <strong>{selectedResult.item.name}</strong>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {selectedResult.floor.label} · {selectedResult.store.name} · {selectedResult.section.name} · {selectedResult.location.aisleLabel}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Search for an item, then press Go.</p>
                  )}
                  <StartPointSelect id="single-start" value={startNodeId} nodes={startCandidates} floorLabel={floorLabel} onChange={setStartNodeId} />
                  <button className={primaryButtonClass} onClick={() => getDirections()} disabled={!selectedResult}>
                    Get directions
                  </button>
                </Section>
                {tripStops.length > 0 && (
                  <p className="rounded bg-indigo-50 p-2 text-xs text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100">
                    {tripStops.length} item{tripStops.length === 1 ? '' : 's'} in your trip.{' '}
                    <button className="font-medium underline" onClick={() => setTab('trip')}>
                      Plan the trip
                    </button>
                  </p>
                )}
              </div>
            )}

            {tab === 'trip' && (
              <TripPanel
                stops={tripStops}
                search={searchItems}
                onAddStop={addStop}
                onRemoveStop={removeStop}
                onClearStops={() => {
                  setTripStops([]);
                  clearTrip();
                }}
                onFocusStop={focusResult}
                startNodeId={startNodeId}
                startCandidates={startCandidates}
                onStartChange={setStartNodeId}
                returnToStart={returnToStart}
                onReturnToStartChange={(value) => updateSettings({ returnToStart: value })}
                accessibleOnly={accessibleOnly}
                improveOrder={settings.improveTripOrder}
                onImproveOrderChange={(value) => updateSettings({ improveTripOrder: value })}
                plan={tripPlan}
                onPlan={() => {
                  setTripRequested(true);
                  setRouteSource('trip');
                }}
                onClearPlan={clearTrip}
                onStartNavigation={() => {
                  setRouteSource('trip');
                  setTab('directions');
                }}
                playback={tripPlayback}
                floorLabel={floorLabel}
                nodeFloor={nodeFloor}
              />
            )}

            {tab === 'directions' &&
              (route ? (
                <NavigationPanel
                  route={route}
                  guidance={guidance}
                  speech={speech}
                  destinationName={routeSource === 'trip' ? `your ${tripStopCount} stops` : selectedResult?.item.name}
                  floorLabel={floorLabel}
                  onOpenSettings={() => setSettingsOpen(true)}
                  title={routeTitle}
                />
              ) : (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {routeSource === 'single' && single.error ? (
                    <p className="text-red-600">{single.error}</p>
                  ) : (
                    <p>No route yet.</p>
                  )}
                  <p className="text-xs">
                    Use <button className="underline" onClick={() => setTab('find')}>Find</button> for one item or{' '}
                    <button className="underline" onClick={() => setTab('trip')}>Trip</button> for several stops.
                  </p>
                </div>
              ))}

            {tab === 'explore' && (
              <div className="space-y-4">
                <Section title="Walkway minimum spanning tree">
                  <GraphMstPanel
                    show={showGraphMst}
                    onShowChange={setShowGraphMst}
                    mst={graphMst}
                    playback={graphPlayback}
                    nodeCount={nodes.length}
                    edgeCount={edges.length}
                  />
                </Section>
                <Section title={`Places on ${floorLabel(floorId)}`}>
                  <AccessibleLocationList
                    stores={storesOnFloor}
                    sections={sectionsOnFloor}
                    onSelectStore={(store) => setSelectedStoreId(store)}
                    onSelectSection={(section) => setSelectedSectionId(section)}
                  />
                </Section>
              </div>
            )}
          </div>
        </aside>

        <main className="order-1 flex min-h-0 flex-col gap-2 lg:order-2">
          <div className="h-[340px] sm:h-[460px] lg:h-auto lg:min-h-0 lg:flex-1">
            <MapView
              floorId={floorId}
              floors={dataset.floors}
              stores={storesOnFloor}
              sections={sectionsOnFloor}
              facilities={facilitiesOnFloor}
              nodes={nodes}
              edges={edges}
              mstEdges={graphMstEdges}
              mstCandidate={graphCandidate}
              routeNodeIds={showRouteLine && route ? route.nodeIds : []}
              selectedNodeId={selectedNodeId}
              activeStepNodeId={guidance.status !== 'idle' ? guidance.currentStep?.nodeId : undefined}
              walker={guidance.position}
              showWalkways={settings.showWalkways}
              stopMarkers={stopMarkers}
              tripLinks={tripLinks}
              heightClass="h-full"
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              onSelectSection={(sectionId) => setSelectedSectionId(sectionId)}
              onSelectStore={(storeId) => setSelectedStoreId(storeId)}
              onChangeFloor={setFloorId}
            />
          </div>

          <div className={`${cardClass} flex flex-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs`} aria-live="polite">
            {selectedResult ? (
              <span>
                <strong>{selectedResult.item.name}</strong> · {selectedResult.floor.label} → {selectedResult.store.name} → {selectedResult.section.name} →{' '}
                {selectedResult.location.aisleLabel}
              </span>
            ) : selectedStoreId || selectedSectionId || selectedNodeId ? (
              <span>
                {[
                  selectedStoreId && dataset.stores.find((store) => store.id === selectedStoreId)?.name,
                  selectedSectionId && dataset.sections.find((section) => section.id === selectedSectionId)?.name,
                  selectedNodeId && nodes.find((node) => node.id === selectedNodeId)?.label,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            ) : (
              <span className="text-slate-500">Click the map or search to select a place.</span>
            )}
            <span className="ml-auto flex flex-wrap gap-1">
              {selectedResult && (
                <>
                  <button className={buttonClass} onClick={() => getDirections()}>
                    Directions
                  </button>
                  <button className={buttonClass} onClick={() => addStop(selectedResult)} disabled={stopKeys.has(resultKey(selectedResult))}>
                    {stopKeys.has(resultKey(selectedResult)) ? 'In trip' : '+ Trip'}
                  </button>
                </>
              )}
              {selectedIsStartCandidate && selectedNodeId !== startNodeId && (
                <button className={buttonClass} onClick={() => setStartNodeId(selectedNodeId!)}>
                  Start from here
                </button>
              )}
              {validationErrors.length > 0 && (
                <button className={`${buttonClass} border-red-400 text-red-700 dark:text-red-300`} onClick={() => setEditorOpen(true)}>
                  {validationErrors.length} data issue{validationErrors.length === 1 ? '' : 's'}
                </button>
              )}
            </span>
          </div>
        </main>
      </div>

      <Drawer open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          speech={speech}
          onOpenEditor={() => {
            setSettingsOpen(false);
            setEditorOpen(true);
          }}
        />
      </Drawer>

      <Drawer open={editorOpen} title="Demo data editor" onClose={() => setEditorOpen(false)} side="center" widthClass="w-full max-w-2xl">
        <DemoEditor
          dataset={dataset}
          floorId={floorId}
          storesOnFloor={storesOnFloor}
          sectionsOnFloor={sectionsOnFloor}
          validationErrors={validationErrors}
          updateDataset={updateDataset}
          exportData={exportData}
          importData={importData}
          resetData={resetData}
          editMessage={editMessage}
          setEditMessage={setEditMessage}
        />
      </Drawer>
    </div>
  );
}

export default App;
