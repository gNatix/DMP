// ========================================
// MINIMALISTIC PRESET - Essential tools only
// ========================================
// Includes: Pointer, Token, Wall, Terrain, Room, Modular Room, Wall Cutter, Lock
// Hides: Most other tools for a clean interface
// ========================================

// ========== TOGGLE BUTTONS ON/OFF ==========
// Set to TRUE to HIDE the button, FALSE to SHOW it
// ============================================

const HIDE_POINTER = false;           // Main selection tool ✓
const HIDE_TOKEN = false;             // Token placement ✓
const HIDE_TERRAIN = false;           // Terrain brush ✓
const HIDE_ROOM = false;              // Room builder ✓
const HIDE_MODULAR_ROOM = false;      // Modular room tool ✓
const HIDE_WALL = false;              // Wall drawing ✓
const HIDE_WALL_CUTTER = false;       // Wall cutter tool ✓
const HIDE_DOOR = true;               // Door tool

const HIDE_PAN = true;                // Pan tool
const HIDE_ZOOM = true;               // Zoom tool

const HIDE_UNDO = true;               // Undo
const HIDE_REDO = true;               // Redo

const HIDE_DUPLICATE = true;          // Duplicate
const HIDE_DELETE = true;             // Delete
const HIDE_LAYER_UP = true;           // Move layer up
const HIDE_LAYER_DOWN = true;         // Move layer down

const HIDE_GRID = true;               // Grid toggle
const HIDE_FIT_TO_VIEW = true;        // Fit to view
const HIDE_INFO = true;               // Info panel
const HIDE_LOCK = false;              // Lock element ✓

const HIDE_COLOR_PICKER = true;       // Color picker
const HIDE_BADGE_TOGGLE = true;       // Name badges

// ========================================

// Build the hidden buttons array from toggles
export const MINIMALISTIC_HIDDEN_BUTTONS: string[] = [
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

export const MINIMALISTIC_PRESET = {
  id: 'minimalistic',
  name: 'Minimalistic',
  description: 'Clean interface with essential tools only',
  hiddenButtons: MINIMALISTIC_HIDDEN_BUTTONS,
};
