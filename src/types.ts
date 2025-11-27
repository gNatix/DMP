// Data model types for the DM Planner application

export type ElementType = "annotation" | "token";

export type ToolType = "pointer" | "marker" | "token" | "pan" | "zoom-in" | "zoom-out";

export type IconType = "circle" | "square" | "triangle" | "star" | "diamond" | "heart" | "skull" | "quest" | "clue" | "hidden" | "door" | "landmark" | "footprint" | "info";

export type ColorType = "red" | "blue" | "yellow" | "green" | "purple" | "orange";

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
}

export type MapElement = AnnotationElement | TokenElement;

export interface CollectionAppearance {
  gradient: string; // CSS gradient string
}

export interface Collection {
  id: string;
  name: string;
  appearance?: CollectionAppearance;
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
  category?: 'monsters' | 'npcs' | 'items' | 'objects' | 'other' | 'poi' | 'environment'; // For token categorization
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
