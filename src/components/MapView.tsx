import { useMemo, useState } from 'react';
import type { Facility, NavigationEdge, NavigationNode, Section, Store } from '../models/types';

interface MapViewProps {
  floorId: string;
  stores: Store[];
  sections: Section[];
  facilities: Facility[];
  nodes: NavigationNode[];
  mstEdges: NavigationEdge[];
  routeNodeIds: string[];
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onSelectStore: (storeId: string) => void;
}

const WIDTH = 820;
const HEIGHT = 420;

export function MapView({
  floorId,
  stores,
  sections,
  facilities,
  nodes,
  mstEdges,
  routeNodeIds,
  selectedNodeId,
  onSelectNode,
  onSelectSection,
  onSelectStore,
}: MapViewProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const routeSegments = useMemo(() => {
    const segments: Array<[NavigationNode, NavigationNode]> = [];
    for (let index = 0; index < routeNodeIds.length - 1; index += 1) {
      const from = nodeMap.get(routeNodeIds[index]);
      const to = nodeMap.get(routeNodeIds[index + 1]);
      if (from && to && from.floorId === floorId && to.floorId === floorId) {
        segments.push([from, to]);
      }
    }
    return segments;
  }, [floorId, nodeMap, routeNodeIds]);

  return (
    <div className="rounded-xl border border-slate-300 bg-white/70 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <button className="rounded border px-2 py-1" onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}>
          Zoom +
        </button>
        <button className="rounded border px-2 py-1" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>
          Zoom -
        </button>
        <button
          className="rounded border px-2 py-1"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          Reset View
        </button>
      </div>
      <div className="overflow-auto" onWheel={(event) => setOffset((prev) => ({ x: prev.x - event.deltaX * 0.15, y: prev.y - event.deltaY * 0.15 }))}>
        <svg
          viewBox={`${-offset.x} ${-offset.y} ${WIDTH / zoom} ${HEIGHT / zoom}`}
          className="h-[420px] w-full rounded-lg bg-slate-100 dark:bg-slate-950"
          role="img"
          aria-label={`Mall floor map ${floorId}`}
        >
          <rect x={0} y={220} width={WIDTH} height={60} fill="#dbeafe" opacity={0.5} />
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
              <text x={store.bounds.x + 8} y={store.bounds.y + 20} fontSize={12} fill="#14532d">
                {store.name}
              </text>
            </g>
          ))}

          {sections.map((section) => (
            <g key={section.id} className="cursor-pointer" onClick={() => onSelectSection(section.id)}>
              <circle cx={section.marker.x} cy={section.marker.y} r={6} fill="#f59e0b" />
              <text x={section.marker.x + 8} y={section.marker.y - 8} fontSize={10}>
                {section.name}
              </text>
            </g>
          ))}

          {mstEdges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to || from.floorId !== floorId || to.floorId !== floorId) {
              return null;
            }
            return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 4" />;
          })}

          {routeSegments.map(([from, to]) => (
            <line key={`${from.id}-${to.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#0ea5e9" strokeWidth={4} />
          ))}

          {facilities.map((facility) => (
            <g key={facility.id} className="cursor-pointer" onClick={() => onSelectNode(facility.navigationNodeId)}>
              <rect x={facility.x - 7} y={facility.y - 7} width={14} height={14} fill="#f97316" />
              <text x={facility.x + 10} y={facility.y} fontSize={10}>
                {facility.label}
              </text>
            </g>
          ))}

          {nodes
            .filter((node) => node.floorId === floorId)
            .map((node) => (
              <g key={node.id} className="cursor-pointer" onClick={() => onSelectNode(node.id)}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={selectedNodeId === node.id ? 8 : 4}
                  fill={selectedNodeId === node.id ? '#ef4444' : '#334155'}
                />
              </g>
            ))}
        </svg>
      </div>
    </div>
  );
}
