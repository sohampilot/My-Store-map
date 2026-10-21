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

export type Maneuver =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'slight-right'
  | 'left'
  | 'right'
  | 'u-turn'
  | 'enter-store'
  | 'exit-store'
  | 'elevator-up'
  | 'elevator-down'
  | 'stairs-up'
  | 'stairs-down'
  | 'exit-elevator'
  | 'exit-stairs'
  | 'arrive';

/** One turn-by-turn instruction, similar to a single step in a GPS navigation app. */
export interface DirectionStep {
  index: number;
  maneuver: Maneuver;
  /** Navigation node where this maneuver happens. */
  nodeId: string;
  floorId: string;
  /** Short instruction shown on screen, e.g. "Turn left toward Tech Haven Entrance". */
  instruction: string;
  /** Full sentence read aloud by the voice guide. */
  spoken: string;
  /** Short phrase used for advance warnings, e.g. "turn left toward Tech Haven Entrance". */
  preview: string;
  /** Walking distance in meters until the next step (0 for the final step). */
  distance: number;
  /** Cumulative route cost in meters at which this step begins. */
  startDistance: number;
}

/** A single traversed edge of a computed route. */
export interface RouteSegment {
  fromId: string;
  toId: string;
  edgeId: string;
  weight: number;
  connectionType: ConnectionType;
  /** Elevator or stairs connection between floors. */
  vertical: boolean;
  startDistance: number;
}

export interface RouteDestination {
  itemName?: string;
  storeName?: string;
  sectionName?: string;
  aisleLabel?: string;
}

export interface RouteResult {
  nodeIds: string[];
  totalWeight: number;
  /** Total walking distance excluding elevator/stairs traversal cost. */
  walkingDistance: number;
  instructions: string[];
  steps: DirectionStep[];
  segments: RouteSegment[];
}
