// Data model types for the DM Planner application

export type ElementType = "annotation" | "token" | "room";

export type ToolType = "pointer" | "marker" | "token" | "pan" | "zoom-in" | "zoom-out" | "room";

export type RoomSubTool = "rectangle" | "pentagon" | "hexagon" | "octagon" | "erase" | "custom" | 
  "subtract-rectangle" | "subtract-pentagon" | "subtract-hexagon" | "subtract-octagon" | "subtract-custom";

export type IconType = "circle" | "square" | "triangle" | "star" | "diamond" | "heart" | "skull" | "quest" | "clue" | "hidden" | "door" | "landmark" | "footprint" | "info";

export type ColorType = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'orange' | 'pink' | 'brown' | 'gray' | 'black' | 'white' | 'cyan' | 'magenta' | 'lime' | 'indigo' | 'teal';

// Point in 2D space
export interface Point {
  x: number;
  y: number;
}

// Wall segment opening (door/entrance) for polygon-based rooms
export interface WallOpening {
  segmentIndex: number; // Which edge/segment this opening is on (index into vertices array)
  startRatio: number; // Position along the segment where opening starts (0.0 to 1.0)
  endRatio: number; // Position along the segment where opening ends (0.0 to 1.0)
}

export interface AnnotationElement {
  id: string;
  type: "annotation";
  x: number;
  y: number;
  size: number;
  color: ColorType;
  icon: IconType;
  notes: string;
  label?: string; // Optional number or text label
  zIndex?: number; // For layering control
  visible?: boolean; // For hiding elements (default true)
  widgets?: Widget[]; // For properties panel customization
  locked?: boolean; // Prevent movement when true
}

export interface TokenElement {
  id: string;
  type: "token";
  x: number;
  y: number;
  size: number;
  name: string;
  imageUrl?: string; // Optional for shape tokens
  notes: string;
  isShape?: boolean; // True if it's a shape token
  isPOI?: boolean; // True for POI icons (no background circle)
  icon?: IconType; // For shape tokens
  color?: ColorType; // For shape tokens or image border
  zIndex?: number; // For layering control
  visible?: boolean; // For hiding elements (default true)
  widgets?: Widget[]; // For properties panel customization
  showBadge?: boolean; // For displaying name badge above token
  locked?: boolean; // Prevent movement when true
}

// Legacy WallGap (deprecated - keeping for reference during migration)
export interface WallGap {
  wall: 'top' | 'right' | 'bottom' | 'left';
  start: number;
  end: number;
}

export interface RoomElement {
  id: string;
  type: "room";
  
  // Polygon shape - ordered vertices forming the room
  vertices: Point[];
  
  // Holes inside the room (each hole is a polygon defined by vertices)
  holes?: Point[][]; // Array of polygons, each representing a hole
  
  // Wall openings (doors/entrances) on polygon edges
  wallOpenings: WallOpening[];
  
  // Appearance
  floorTextureUrl: string;
  tileSize: number; // Size of the floor texture tiles in pixels (default 50)
  showWalls: boolean; // Whether to show walls or not
  wallTextureUrl: string; // URL to wall texture image
  wallThickness: number; // Thickness of walls in pixels (default 8)
  wallTileSize: number; // Size of the wall texture tiles in pixels (default 50)
  rotation?: number; // Rotation angle in degrees (default 0)
  
  // Metadata
  name: string;
  notes: string;
  label?: string; // Optional text label to display on the room
  zIndex?: number; // For layering control
  visible?: boolean; // For hiding elements (default true)
  widgets?: Widget[]; // For properties panel customization
  locked?: boolean; // Prevent movement when true
}

export type MapElement = AnnotationElement | TokenElement | RoomElement;

export interface CollectionAppearance {
  gradient: string; // CSS gradient string
}

export interface Collection {
  id: string;
  name: string;
  appearance?: CollectionAppearance;
  isAutoCreated?: boolean; // True if auto-created with default canvas
}

export interface Scene {
  id: string;
  name: string;
  backgroundMapUrl: string;
  backgroundMapName: string;
  elements: MapElement[];
  width: number;
  height: number;
  collectionId?: string; // Optional reference to a collection
  isAutoCreated?: boolean; // True if auto-created when user started drawing
}

export interface DungeonMap {
  id: string;
  name: string;
  imageUrl: string;
  description?: string;
  elements: MapElement[];
}

export interface TokenTemplate {
  id: string;
  name: string;
  imageUrl?: string; // Optional for shape tokens
  category?: 'monsters' | 'npcs' | 'items' | 'objects' | 'other' | 'shapes' | 'poi' | 'environment'; // For token categorization
  isShape?: boolean; // True if it's a shape token (no image)
  isPOI?: boolean; // True for POI icons (no background circle)
  icon?: IconType; // For shape tokens
  color?: ColorType; // For shape tokens
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// Widget types for properties panel
export type WidgetType = "text" | "statblock";

export interface BaseWidget {
  id: string;
  type: WidgetType;
  order: number; // For drag-and-drop ordering
}

export interface TextWidget extends BaseWidget {
  type: "text";
  content: string; // HTML content from rich text editor
}

export interface StatBlockWidget extends BaseWidget {
  type: "statblock";
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
}

export type Widget = TextWidget | StatBlockWidget;
