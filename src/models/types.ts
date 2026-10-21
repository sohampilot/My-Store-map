export type NodeType =
  | 'entrance'
  | 'intersection'
  | 'storeEntrance'
  | 'sectionAccess'
  | 'elevator'
  | 'stairs'
  | 'facility';

export type ConnectionType = 'corridor' | 'doorway' | 'stairs' | 'elevator';

export interface Floor {
  id: string;
  label: string;
}

export interface Store {
  id: string;
  name: string;
  floorId: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface Section {
  id: string;
  storeId: string;
  floorId: string;
  name: string;
  marker: { x: number; y: number };
}

export interface Facility {
  id: string;
  label: string;
  floorId: string;
  type: 'restroom' | 'infoDesk' | 'stairs' | 'elevator' | 'entrance';
  x: number;
  y: number;
  navigationNodeId: string;
}

export interface ItemLocation {
  id: string;
  floorId: string;
  storeId: string;
  sectionId: string;
  aisleLabel: string;
  navigationNodeId: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  locations: ItemLocation[];
}

export interface NavigationNode {
  id: string;
  label: string;
  type: NodeType;
  floorId: string;
  x: number;
  y: number;
  storeId?: string;
  sectionId?: string;
}

export interface NavigationEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  accessible: boolean;
  connectionType: ConnectionType;
}

export interface MallDataset {
  floors: Floor[];
  stores: Store[];
  sections: Section[];
  facilities: Facility[];
  items: Item[];
  graph: {
    nodes: NavigationNode[];
    edges: NavigationEdge[];
  };
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface SearchResult {
  item: Item;
  location: ItemLocation;
  store: Store;
  section: Section;
  floor: Floor;
}

export interface RouteResult {
  nodeIds: string[];
  totalWeight: number;
  instructions: string[];
}
