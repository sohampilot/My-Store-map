import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Facility, Floor, NavigationEdge, NavigationNode, Section, Store } from '../models/types';
import { formatDistance } from '../algorithms/directions';
import { Legend } from './Legend';

export interface MapStopMarker {
  nodeId: string;
  /** Text inside the marker, e.g. "1" or "S". */
  badge: string;
  title: string;
  isStart?: boolean;
}

export interface MapTripLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distance: number;
  state: 'tree' | 'accepted' | 'rejected';
}

interface MapViewProps {
  floorId: string;
  floors: Floor[];
  stores: Store[];
  sections: Section[];
  facilities: Facility[];
  nodes: NavigationNode[];
  edges: NavigationEdge[];
  mstEdges: NavigationEdge[];
  /** Edge currently being considered during MST step playback. */
  mstCandidate?: { edge: NavigationEdge; accepted: boolean } | null;
  routeNodeIds: string[];
  selectedNodeId?: string;
  /** Node of the active turn-by-turn step. */
  activeStepNodeId?: string;
  /** Live "you are here" position during guidance. */
  walker?: { floorId: string; x: number; y: number } | null;
  showWalkways?: boolean;
  /** Numbered trip stops (and the start) shown as badges. */
  stopMarkers?: MapStopMarker[];
  /** Links of the trip MST between stops (straight lines labelled with walking distance). */
  tripLinks?: MapTripLink[];
  /** Tailwind height class for the map canvas. */
  heightClass?: string;
  onSelectNode: (nodeId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onSelectStore: (storeId: string) => void;
  onChangeFloor: (floorId: string) => void;
}

const WIDTH = 820;
const HEIGHT = 420;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;

interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

const DEFAULT_VIEW: ViewState = { x: 0, y: 0, zoom: 1 };

const zoomAround = (view: ViewState, nextZoom: number, focusX = 0.5, focusY = 0.5): ViewState => {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const oldW = WIDTH / view.zoom;
  const oldH = HEIGHT / view.zoom;
  const newW = WIDTH / zoom;
  const newH = HEIGHT / zoom;
  return { zoom, x: view.x + (oldW - newW) * focusX, y: view.y + (oldH - newH) * focusY };
};

/** Split long labels onto two lines so neighbouring section labels do not overlap. */
const splitLabel = (label: string): string[] => {
  if (label.length <= 9) return [label];
  const words = label.split(' ');
  if (words.length < 2) return [label];
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
};

export function MapView({
  floorId,
  floors,
  stores,
  sections,
  facilities,
  nodes,
  edges,
  mstEdges,
  mstCandidate,
  routeNodeIds,
  selectedNodeId,
  activeStepNodeId,
  walker,
  showWalkways = true,
  stopMarkers = [],
  tripLinks = [],
  heightClass = 'h-[420px]',
  onSelectNode,
  onSelectSection,
  onSelectStore,
  onChangeFloor,
}: MapViewProps) {
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [legendOpen, setLegendOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; view: ViewState; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const floorNodes = useMemo(() => nodes.filter((node) => node.floorId === floorId), [floorId, nodes]);

  const edgeLine = (edge: NavigationEdge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to || from.floorId !== floorId || to.floorId !== floorId) return null;
    return { from, to };
  };

  const routePoints = useMemo(() => {
    // Polylines per contiguous same-floor run of the route.
    const runs: NavigationNode[][] = [];
    let current: NavigationNode[] = [];
    for (const nodeId of routeNodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      if (node.floorId === floorId) {
        current.push(node);
      } else if (current.length > 0) {
        runs.push(current);
        current = [];
      }
    }
    if (current.length > 0) runs.push(current);
    return runs.filter((run) => run.length > 1);
  }, [floorId, nodeMap, routeNodeIds]);

  const routeFloors = useMemo(() => {
    const ids: string[] = [];
    for (const nodeId of routeNodeIds) {
      const floor = nodeMap.get(nodeId)?.floorId;
      if (floor && ids[ids.length - 1] !== floor) ids.push(floor);
    }
    return ids;
  }, [nodeMap, routeNodeIds]);
  const otherRouteFloors = [...new Set(routeFloors.filter((id) => id !== floorId))];

  const startNode = routeNodeIds.length > 0 ? nodeMap.get(routeNodeIds[0]) : undefined;
  const endNode = routeNodeIds.length > 0 ? nodeMap.get(routeNodeIds[routeNodeIds.length - 1]) : undefined;
  const activeNode = activeStepNodeId ? nodeMap.get(activeStepNodeId) : undefined;

  // Wheel zoom needs a non-passive listener so the page does not scroll at the same time.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const focusX = (event.clientX - rect.left) / rect.width;
      const focusY = (event.clientY - rect.top) / rect.height;
      setView((current) => zoomAround(current, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), focusX, focusY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, view, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      svg.setPointerCapture(event.pointerId);
    }
    const rect = svg.getBoundingClientRect();
    // viewBox is letterboxed with "meet": use the larger scale factor.
    const scale = Math.max(WIDTH / drag.view.zoom / rect.width, HEIGHT / drag.view.zoom / rect.height);
    setView({ ...drag.view, x: drag.view.x - dx * scale, y: drag.view.y - dy * scale });
  };
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.moved) {
      suppressClickRef.current = true;
      svgRef.current?.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const floorLabel = (id: string) => floors.find((floor) => floor.id === id)?.label ?? id;
  const walkerVisible = walker && walker.floorId === floorId;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-300 bg-white/70 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="relative mb-2 flex flex-wrap items-center gap-2 text-sm">
        <label className="sr-only" htmlFor="floor-select">
          Floor
        </label>
        <select id="floor-select" className="rounded border px-2 py-1 font-medium" value={floorId} onChange={(event) => onChangeFloor(event.target.value)}>
          {floors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.label}
            </option>
          ))}
        </select>
        <button className="rounded border px-2 py-1" onClick={() => setView((current) => zoomAround(current, current.zoom + 0.25))} aria-label="Zoom in">
          +
        </button>
        <button className="rounded border px-2 py-1" onClick={() => setView((current) => zoomAround(current, current.zoom - 0.25))} aria-label="Zoom out">
          −
        </button>
        <button className="rounded border px-2 py-1" onClick={() => setView(DEFAULT_VIEW)}>
          Reset
        </button>
        <button className="rounded border px-2 py-1" onClick={() => setLegendOpen((value) => !value)} aria-expanded={legendOpen}>
          Legend
        </button>
        <span className="hidden text-xs text-slate-500 xl:inline dark:text-slate-400">Drag to pan · scroll to zoom</span>
        {legendOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-72 bg-white shadow-lg dark:bg-slate-900">
            <Legend />
          </div>
        )}
        {otherRouteFloors.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-1 text-xs">
            <span className="text-sky-700 dark:text-sky-300">Route continues on</span>
            {otherRouteFloors.map((id) => (
              <button key={id} className="rounded border border-sky-500 px-2 py-0.5 text-sky-700 dark:text-sky-300" onClick={() => onChangeFloor(id)}>
                {floorLabel(id)}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${WIDTH / view.zoom} ${HEIGHT / view.zoom}`}
          className={`${heightClass} w-full cursor-grab touch-none select-none active:cursor-grabbing rounded-lg bg-slate-100 dark:bg-slate-950`}
          role="img"
          aria-label={`Mall map, ${floorLabel(floorId)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={(event) => {
            if (suppressClickRef.current) {
              event.stopPropagation();
              suppressClickRef.current = false;
            }
          }}
        >
          <defs>
            <marker id="route-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#0284c7" />
            </marker>
          </defs>
          <rect x={0} y={220} width={WIDTH} height={60} fill="#dbeafe" opacity={0.5} className="corridor" />

          {stores.map((store) => (
            <g key={store.id}>
              <rect
                x={store.bounds.x}
                y={store.bounds.y}
                width={store.bounds.width}
                height={store.bounds.height}
                rx={8}
                fill="#dcfce7"
                stroke="#166534"
                className="cursor-pointer"
                onClick={() => onSelectStore(store.id)}
              />
              <text x={store.bounds.x + 8} y={store.bounds.y + 18} fontSize={12} fontWeight={600} fill="#14532d" pointerEvents="none" className="keep-fill">
                {store.name}
              </text>
            </g>
          ))}

          {showWalkways &&
            edges.map((edge) => {
              const line = edgeLine(edge);
              if (!line) return null;
              return (
                <line
                  key={`walk-${edge.id}`}
                  x1={line.from.x}
                  y1={line.from.y}
                  x2={line.to.x}
                  y2={line.to.y}
                  stroke="#94a3b8"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  strokeDasharray={edge.accessible ? undefined : '2 3'}
                />
              );
            })}

          {sections.map((section) => {
            const lines = splitLabel(section.name);
            return (
              <g key={section.id} className="cursor-pointer" onClick={() => onSelectSection(section.id)}>
                <circle cx={section.marker.x} cy={section.marker.y} r={6} fill="#f59e0b" />
                <text x={section.marker.x} y={section.marker.y + 17} fontSize={9} textAnchor="middle" fill="#334155" className="keep-fill">
                  {lines.map((line, index) => (
                    <tspan key={line} x={section.marker.x} dy={index === 0 ? 0 : 10}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {mstEdges.map((edge) => {
            const line = edgeLine(edge);
            if (!line) return null;
            return <line key={edge.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 4" />;
          })}
          {mstCandidate &&
            (() => {
              const line = edgeLine(mstCandidate.edge);
              if (!line) return null;
              return (
                <line
                  x1={line.from.x}
                  y1={line.from.y}
                  x2={line.to.x}
                  y2={line.to.y}
                  stroke={mstCandidate.accepted ? '#16a34a' : '#dc2626'}
                  strokeWidth={6}
                  strokeOpacity={0.8}
                  strokeLinecap="round"
                />
              );
            })()}

          {routePoints.map((run) => (
            <polyline
              key={run.map((node) => node.id).join('>')}
              points={run.map((node) => `${node.x},${node.y}`).join(' ')}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={4.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerMid="url(#route-arrow)"
              markerEnd="url(#route-arrow)"
            />
          ))}

          {facilities.map((facility) => (
            <g key={facility.id} className="cursor-pointer" onClick={() => onSelectNode(facility.navigationNodeId)}>
              <rect x={facility.x - 7} y={facility.y - 7} width={14} height={14} rx={2} fill="#f97316" />
              <text
                x={facility.x > WIDTH - 110 ? facility.x + 8 : facility.x + 10}
                y={facility.x > WIDTH - 110 ? facility.y + 20 : facility.y + 4}
                textAnchor={facility.x > WIDTH - 110 ? 'end' : 'start'}
                fontSize={10}
                fill="#334155"
              >
                {facility.label}
              </text>
            </g>
          ))}

          {floorNodes.map((node) => (
            <g key={node.id} className="cursor-pointer" onClick={() => onSelectNode(node.id)}>
              <title>{node.label}</title>
              <circle cx={node.x} cy={node.y} r={10} fill="transparent" />
              <circle cx={node.x} cy={node.y} r={selectedNodeId === node.id ? 7 : 3.5} fill={selectedNodeId === node.id ? '#ef4444' : '#334155'} />
            </g>
          ))}

          {activeNode && activeNode.floorId === floorId && (
            <circle cx={activeNode.x} cy={activeNode.y} r={11} fill="none" stroke="#0284c7" strokeWidth={2.5} strokeDasharray="3 3" />
          )}

          {startNode && startNode.floorId === floorId && routeNodeIds.length > 1 && (
            <g pointerEvents="none">
              <circle cx={startNode.x} cy={startNode.y} r={8} fill="#16a34a" stroke="white" strokeWidth={2} />
              <text x={startNode.x} y={startNode.y - 12} fontSize={10} fontWeight={700} textAnchor="middle" fill="#15803d" className="keep-fill">
                Start
              </text>
            </g>
          )}
          {endNode && endNode.floorId === floorId && (
            <g pointerEvents="none" transform={`translate(${endNode.x} ${endNode.y})`}>
              <path d="M0 0c-6-8-9-11-9-15a9 9 0 0 1 18 0c0 4-3 7-9 15z" fill="#dc2626" stroke="white" strokeWidth={1.5} />
              <circle cx={0} cy={-15} r={3} fill="white" />
            </g>
          )}

          {tripLinks.map((link) => {
            const from = nodeMap.get(link.fromNodeId);
            const to = nodeMap.get(link.toNodeId);
            if (!from || !to) return null;
            const color = link.state === 'rejected' ? '#dc2626' : link.state === 'accepted' ? '#16a34a' : '#6366f1';
            const width = link.state === 'tree' ? 3 : 5;
            if (from.floorId === floorId && to.floorId === floorId) {
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const label = formatDistance(link.distance) || '0 m';
              return (
                <g key={`trip-${link.id}`} pointerEvents="none">
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeDasharray={link.state === 'rejected' ? '6 4' : undefined} strokeLinecap="round" opacity={0.85} />
                  <rect x={midX - 18} y={midY - 8} width={36} height={15} rx={4} fill="white" stroke={color} strokeWidth={1} />
                  <text x={midX} y={midY + 3} fontSize={9} fontWeight={700} textAnchor="middle" fill={color} className="keep-fill">
                    {label}
                  </text>
                </g>
              );
            }
            // Link to another floor: show a badge next to the stop on this floor.
            const here = from.floorId === floorId ? from : to.floorId === floorId ? to : null;
            const other = here === from ? to : from;
            if (!here) return null;
            return (
              <g key={`trip-${link.id}`} pointerEvents="none">
                <line x1={here.x} y1={here.y} x2={here.x + 26} y2={here.y + 30} stroke={color} strokeWidth={width} strokeDasharray="4 3" />
                <rect x={here.x + 14} y={here.y + 30} width={78} height={15} rx={4} fill="white" stroke={color} />
                <text x={here.x + 53} y={here.y + 41} fontSize={9} fontWeight={700} textAnchor="middle" fill={color} className="keep-fill">
                  ↕ {floorLabel(other.floorId)} · {formatDistance(link.distance)}
                </text>
              </g>
            );
          })}

          {stopMarkers.map((marker) => {
            const node = nodeMap.get(marker.nodeId);
            if (!node || node.floorId !== floorId) return null;
            return (
              <g key={`stop-${marker.nodeId}`} className="cursor-pointer" onClick={() => onSelectNode(marker.nodeId)}>
                <title>{marker.title}</title>
                <circle cx={node.x} cy={node.y} r={10} fill={marker.isStart ? '#16a34a' : '#4f46e5'} stroke="white" strokeWidth={2} />
                <text x={node.x} y={node.y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill="white" className="keep-fill">
                  {marker.badge}
                </text>
              </g>
            );
          })}

          {walkerVisible && walker && (
            <g pointerEvents="none" aria-label="You are here">
              <circle cx={walker.x} cy={walker.y} r={14} fill="#2563eb" opacity={0.25}>
                <animate attributeName="r" values="9;16;9" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx={walker.x} cy={walker.y} r={7} fill="#2563eb" stroke="white" strokeWidth={2.5} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
