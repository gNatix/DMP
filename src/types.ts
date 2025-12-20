// Data model types for the DM Planner application

export type ViewMode = "planning" | "game";

export type ElementType = "annotation" | "token" | "room" | "wall" | "modularRoom";

export type ToolType = "pointer" | "marker" | "token" | "pan" | "zoom-in" | "zoom-out" | "room" | "background" | "wall" | "wall-line" | "xlab" | "doorTool" | "wallCutterTool" | "modularRoom";

export type RoomSubTool = "rectangle" | "pentagon" | "hexagon" | "octagon" | "erase" | "custom" | 
  "subtract-rectangle" | "subtract-pentagon" | "subtract-hexagon" | "subtract-octagon" | "subtract-custom";

export type TerrainShapeMode = 'rectangle' | 'circle' | 'polygon' | null;

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

export interface HoleWallOpening {
  holeIndex: number; // Which hole this opening is on
  segmentIndex: number; // Which edge/segment of that hole (index into hole vertices array)
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
  playlistObject?: boolean; // Display in game mode playlist
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
  playlistObject?: boolean; // Display in game mode playlist
  parentRoomId?: string; // Link to modular room - token moves with room
  parentRoomOffset?: { x: number; y: number }; // Relative offset from room's top-left corner
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
  
  // Wall openings on hole edges
  holeWallOpenings?: HoleWallOpening[];
  
  // Appearance
  floorTextureUrl: string;
  tileSize: number; // Size of the floor texture tiles in pixels (default 50)
  showWalls: boolean; // Whether to show walls or not
  wallTextureUrl: string; // URL to wall texture image
  wallThickness: number; // Thickness of walls in pixels (default 8)
  wallTileSize: number; // Size of the wall texture tiles in pixels (default 50)
  rotation?: number; // Rotation angle in degrees (default 0)
  cornerRadius?: number; // Corner radius in pixels (default 8, 0 = sharp corners)
  
  // Metadata
  name: string;
  notes: string;
  label?: string; // Optional text label to display on the room
  zIndex?: number; // For layering control
  visible?: boolean; // For hiding elements (default true)
  widgets?: Widget[]; // For properties panel customization
  locked?: boolean; // Prevent movement when true
  playlistObject?: boolean; // Display in game mode playlist
}

export interface WallElement {
  id: string;
  type: "wall";
  
  // Array of points forming the wall path (open polyline, not closed)
  // OR array of arrays for multiple disconnected segments
  vertices: Point[];
  segments?: Point[][]; // Optional: multiple disconnected wall segments
  
  // Appearance
  wallTextureUrl: string; // URL to wall texture image
  wallThickness: number; // Thickness of walls in pixels (default 8)
  wallTileSize: number; // Size of the wall texture tiles in pixels (default 50)
  
  // Transparent tiles (for doors/openings)
  transparentTiles?: Set<string>; // Set of "x,y" strings representing transparent tile positions
  
  // Metadata
  name?: string; // Optional name for the wall
  hasCustomName?: boolean; // True if user has manually edited the name
  notes: string;
  zIndex?: number; // For layering control
  visible?: boolean; // For hiding elements (default true)
  widgets?: Widget[]; // For properties panel customization
  locked?: boolean; // Prevent movement when true
  playlistObject?: boolean; // Display in game mode playlist
}

// ============================================
// MODULAR ROOMS - Prefab floor + auto-generated walls system
// ============================================

/**
 * Modular Room Element - A prefab floor image placed on the tile grid.
 * Walls/pillars/doors are auto-generated based on adjacency.
 */
export interface ModularRoomElement {
  id: string;
  type: "modularRoom";
  
  // Position in pixels (free placement, not locked to universal grid)
  x: number;
  y: number;
  
  // Dimensions in tiles
  tilesW: number;
  tilesH: number;
  
  // Floor style (folder name in modular-rooms/floors/)
  floorStyleId: string;
  
  // Optional variant for future use
  floorVariantId?: string;
  
  // Wall group membership (for shared wall style)
  wallGroupId: string;
  
  // Rotation (0, 90, 180, 270 degrees)
  rotation?: number;
  
  // Metadata
  name?: string;
  notes?: string;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  widgets?: Widget[];
  playlistObject?: boolean;
}

/**
 * Wall Group - A connected component of modular rooms sharing the same wall style
 */
export interface WallGroup {
  id: string;
  wallStyleId: string; // Folder name in modular-rooms/walls/
  roomCount: number;   // Number of rooms in this group (for dominance calculation)
}

/**
 * Modular Door - A door opening in the wall between two adjacent modular rooms
 */
export interface ModularDoor {
  id: string;
  
  // Room references (sorted alphabetically for stable key)
  roomAId: string;
  roomBId: string;
  
  // Edge identification
  edgeOrientation: 'horizontal' | 'vertical';
  edgePosition: number; // The fixed coordinate (x for vertical, y for horizontal)
  edgeRangeStart: number; // Start of shared edge range
  edgeRangeEnd: number; // End of shared edge range
  
  // Door position along the shared edge (in tiles from edgeRangeStart)
  offsetTiles: number;
  
  // Door width in tiles (default 1)
  widthTiles: number;
}

/**
 * Scene-level modular rooms state
 */
export interface ModularRoomsState {
  wallGroups: WallGroup[];
  doors: ModularDoor[];
}

/**
 * Simulation result for drop preview
 */
export interface ModularDropSimulation {
  newPosition: { x: number; y: number };  // Position in pixels
  willMerge: boolean;
  targetGroupId: string | null;
  targetWallStyleId: string | null;
  newDoors: ModularDoor[];
  removedDoorIds: string[];
  affectedRoomIds: string[];
}

export type MapElement = AnnotationElement | TokenElement | RoomElement | WallElement | ModularRoomElement;

export interface CollectionAppearance {
  gradient: string; // CSS gradient string
}

export interface Collection {
  id: string;
  name: string;
  appearance?: CollectionAppearance;
  isAutoCreated?: boolean; // True if auto-created with default canvas
}

export type TerrainType = 'grass' | 'sand' | 'rock' | 'dirt' | 'stone' | 'water' | null;

export interface TerrainStamp {
  x: number;
  y: number;
  size: number;
  textureUrl: string;
}

export interface TerrainTile {
  x: number;  // Tile origin X in world coordinates (e.g., 0, 2000, 4000...)
  y: number;  // Tile origin Y in world coordinates
  stamps: TerrainStamp[];  // All brush stamps on this tile
}

export interface TerrainGridCell {
  terrainType: TerrainType;
}

export interface BackgroundTile {
  id: string;
  x: number; // Grid X coordinate
  y: number; // Grid Y coordinate
  terrainType: TerrainType;
}

export interface Scene {
  id: string;
  name: string;
  backgroundMapUrl: string;
  backgroundMapName: string;
  elements: MapElement[];
  backgroundTiles?: BackgroundTile[]; // Painted background tiles
  terrainStamps?: Array<{ x: number; y: number; size: number; textureUrl: string }>; // Terrain brush stamps (deprecated - use terrainTiles)
  terrainTiles?: { [key: string]: TerrainTile }; // New tile-based terrain system
  modularRoomsState?: ModularRoomsState; // Modular rooms wall groups and doors
  viewport?: { x: number; y: number; zoom: number }; // Saved viewport position per scene
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
export type WidgetType = "text" | "statblock" | "encountertable" | "monstercard" | "dialogue";

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

export interface EventRollTableWidget extends BaseWidget {
  type: "encountertable";
  diceType: "d4" | "d6" | "d8" | "d10" | "d12";
  title?: string;
  events: string[];
}

export interface MonsterCardWidget extends BaseWidget {
  type: "monstercard";
  name: string;
  size?: string; // e.g., "Medium", "Large"
  monsterType?: string; // e.g., "Beast", "Dragon"
  alignment?: string; // e.g., "Neutral", "Lawful Good"
  image?: string; // Optional monster image URL
  ac: number; // Armor Class
  hp: number; // Hit Points
  speed: number; // Speed in ft
  initiative?: string; // Initiative bonus, e.g., "+2"
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills: string; // e.g., "Perception +4, Deception +5"
  languages: string; // e.g., "Common, Draconic"
  challenge: string; // e.g., "1/4" or "5"
  special: string; // Special abilities text
}

export interface DialogueEntry {
  id: string;
  speaker: string;
  text: string;
  isCollapsed: boolean;
}

export interface DialogueTab {
  id: string;
  name: string;
  entries: DialogueEntry[];
}

export interface DialogueWidget extends BaseWidget {
  type: "dialogue";
  title?: string;
  entries?: DialogueEntry[]; // Legacy support - will be migrated to tabs
  tabs?: DialogueTab[];
  activeTabId?: string;
}

export type Widget = TextWidget | StatBlockWidget | EventRollTableWidget | MonsterCardWidget | DialogueWidget;
