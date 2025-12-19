// ========================================
// ADVANCED PRESET - Focused toolset
// ========================================
// Includes: Drawing tools, pointer, layers, grid, lock, colors
// Hides: Navigation tools, history, some toggles
// ========================================

// ========== TOGGLE BUTTONS ON/OFF ==========
// Set to TRUE to HIDE the button, FALSE to SHOW it
// ============================================

const HIDE_POINTER = false;           // Main selection tool
const HIDE_TOKEN = false;             // Token placement
const HIDE_TERRAIN = false;           // Terrain brush
const HIDE_ROOM = false;              // Room builder
const HIDE_MODULAR_ROOM = false;      // Modular room tool
const HIDE_WALL = false;              // Wall drawing
const HIDE_WALL_CUTTER = false;       // Wall cutter tool
const HIDE_DOOR = false;              // Door tool

const HIDE_PAN = true;                // Pan tool (use middle-click instead)
const HIDE_ZOOM = true;               // Zoom tool (use scroll instead)

const HIDE_UNDO = true;               // Undo (use Ctrl+Z)
const HIDE_REDO = true;               // Redo (use Ctrl+Y)

const HIDE_DUPLICATE = true;          // Duplicate (use Ctrl+D)
const HIDE_DELETE = true;             // Delete (use Del key)
const HIDE_LAYER_UP = false;          // Move layer up
const HIDE_LAYER_DOWN = false;        // Move layer down

const HIDE_GRID = false;              // Grid toggle
const HIDE_FIT_TO_VIEW = true;        // Fit to view
const HIDE_INFO = true;               // Info panel
const HIDE_LOCK = false;              // Lock element

const HIDE_COLOR_PICKER = false;      // Color picker
const HIDE_BADGE_TOGGLE = true;       // Name badges

// ========================================

// Build the hidden buttons array from toggles
export const ADVANCED_HIDDEN_BUTTONS: string[] = [
  ...(HIDE_POINTER ? ['pointer'] : []),
  ...(HIDE_TOKEN ? ['token'] : []),
  ...(HIDE_TERRAIN ? ['terrain'] : []),
  ...(HIDE_ROOM ? ['room'] : []),
  ...(HIDE_MODULAR_ROOM ? ['modularRoom'] : []),
  ...(HIDE_WALL ? ['wall'] : []),
  ...(HIDE_WALL_CUTTER ? ['wallCutterTool'] : []),
  ...(HIDE_DOOR ? ['doorTool'] : []),
  ...(HIDE_PAN ? ['pan'] : []),
  ...(HIDE_ZOOM ? ['zoom'] : []),
  ...(HIDE_UNDO ? ['undo'] : []),
  ...(HIDE_REDO ? ['redo'] : []),
  ...(HIDE_DUPLICATE ? ['duplicate'] : []),
  ...(HIDE_DELETE ? ['delete'] : []),
  ...(HIDE_LAYER_UP ? ['layer-up'] : []),
  ...(HIDE_LAYER_DOWN ? ['layer-down'] : []),
  ...(HIDE_GRID ? ['grid'] : []),
  ...(HIDE_FIT_TO_VIEW ? ['fit-to-view'] : []),
  ...(HIDE_INFO ? ['info'] : []),
  ...(HIDE_LOCK ? ['lock'] : []),
  ...(HIDE_COLOR_PICKER ? ['color-picker'] : []),
  ...(HIDE_BADGE_TOGGLE ? ['badge-toggle'] : []),
];

export const ADVANCED_PRESET = {
  id: 'advanced',
  name: 'Advanced',
  description: 'Focused tools for experienced users',
  hiddenButtons: ADVANCED_HIDDEN_BUTTONS,
};
