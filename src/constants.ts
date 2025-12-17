// Default names for scenes and collections
export const DEFAULT_COLLECTION_NAME = 'My First Collection';
export const DEFAULT_CANVAS_NAME = 'New Canvas';
export const DEFAULT_NAMED_CANVAS_PREFIX = 'Canvas';

// ============================================
// MODULAR ROOMS CONSTANTS
// ============================================

// Tile size in pixels (all modular rooms snap to this grid)
export const MODULAR_TILE_PX = 128;

// Wall geometry
export const MODULAR_WALL_THICKNESS_PX = 32; // Wall thickness, centered on tile boundaries (±16px overlap)
export const MODULAR_WALL_HALF_THICKNESS = MODULAR_WALL_THICKNESS_PX / 2;

// Wall sprite dimensions
export const MODULAR_WALL_SPRITE_2TILE_WIDTH = 256; // wall_256x32.png (2 tiles)
export const MODULAR_WALL_SPRITE_1TILE_WIDTH = 128; // wall_128x32.png (1 tile)
export const MODULAR_WALL_SPRITE_HEIGHT = 32;

// Pillar sprite dimensions
export const MODULAR_PILLAR_SIZE = 64; // pillar_64x64.png

// Door dimensions
export const MODULAR_DOOR_WIDTH_PX = 128; // 1 tile
export const MODULAR_DOOR_WIDTH_TILES = 1;
export const MODULAR_DOOR_SPRITE_WIDTH = 128;
export const MODULAR_DOOR_SPRITE_HEIGHT = 32;

// Asset base URL
export const MODULAR_ASSETS_BASE_URL = 'https://dmp.natixlabs.com';

// Asset paths (relative to base URL)
export const MODULAR_FLOORS_PATH = 'modular-rooms/floors';
export const MODULAR_WALLS_PATH = 'modular-rooms/walls';

// Default styles
export const DEFAULT_FLOOR_STYLE_ID = 'stone-beta';
export const DEFAULT_WALL_STYLE_ID = 'worn-castle';
