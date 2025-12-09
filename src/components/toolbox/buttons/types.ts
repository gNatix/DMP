import { ReactNode } from 'react';
import { ToolType } from '../../../types';

// ============================================================
// BUTTON CONFIGURATION GUIDE
// ============================================================
// This file defines the types and options for toolbar buttons.
// Use this guide when adding or modifying buttons.
// ============================================================

/**
 * CATEGORY - Where the button appears in the toolbar
 * ============================================================
 * Buttons are grouped by category and separated by dividers.
 * 
 * Categories are now dynamically discovered from enabled buttons.
 * You can use any string as a category name - just add it to a button config.
 * Control category order using categoryOrderWeights in Toolbox.tsx
 * 
 * Common categories:
 * - 'selection'   → Selection tools (e.g., pointer)
 * - 'drawing'     → Drawing tools (e.g., token, terrain, room)
 * - 'navigation'  → View navigation (e.g., pan, zoom)
 * - 'history'     → Undo/redo operations
 * - 'layers'      → Layer management (e.g., duplicate, delete, move)
 * - 'view'        → View options (e.g., grid, fit to view)
 * - 'utilities'   → Utility functions (e.g., badges, lock, color)
 */
export type ToolButtonCategory = string;

/**
 * HIGHLIGHT STYLE - How the button looks when active
 * ============================================================
 * Controls the visual feedback when a button is active/selected.
 * 
 * Available styles:
 * - 'full'   → Full colored background (e.g., green for pointer, blue for token)
 *              Use for: Tool buttons, toggle buttons with strong state
 *              Example: Pointer (green), Token (blue), Grid (when on)
 * 
 * - 'border' → Colored border around button (e.g., yellow border)
 *              Use for: Subtle state indicators, badges
 *              Example: Badge toggle (yellow border when token has badge)
 * 
 * - null     → No visual highlight
 *              Use for: One-shot actions, submenu openers without state
 *              Example: Undo, Redo, Delete, Color Picker
 */
export type HighlightStyle = 'full' | 'border' | null;

/**
 * BUTTON TYPE - How the button behaves when clicked
 * ============================================================
 * Defines the fundamental behavior of the button.
 * 
 * Available types:
 * - 'tool'    → Tool selection button
 *               • Stays active until another tool is selected
 *               • Only one tool can be active at a time
 *               • Changes cursor/interaction mode
 *               • Example: Pointer, Token, Terrain, Room, Pan, Zoom
 * 
 * - 'toggle'  → On/Off state button
 *               • Toggles between on and off state
 *               • State persists until toggled again
 *               • Can work independently of selected tool
 *               • Example: Grid (on/off), Lock (locked/unlocked), Badges (show/hide)
 * 
 * - 'action'  → One-shot action button
 *               • Executes action immediately when clicked
 *               • Does not maintain active state
 *               • Performs single operation then returns to normal
 *               • Example: Undo, Redo, Duplicate, Delete, Layer Up/Down, Fit to View
 * 
 * - 'submenu' → Submenu/picker opener
 *               • Opens a submenu or picker panel
 *               • Does not change tool or maintain state
 *               • Just provides access to additional options
 *               • Example: Color Picker
 */
export type ButtonType = 'tool' | 'toggle' | 'action' | 'submenu';

/**
 * BUTTON CONFIGURATION INTERFACE
 * ============================================================
 * All required and optional properties for a button.
 */
export interface ToolButtonConfig {
  // ========== BASIC SETTINGS ==========
  
  /**
   * id - Unique identifier for the button
   * Must be unique across all buttons
   * Example: 'pointer', 'token', 'undo', 'grid'
   */
  id: string;
  
  /**
   * enabled - Whether the button is currently enabled
   * true  = Button is visible and clickable
   * false = Button is hidden or disabled
   */
  enabled: boolean;
  
  /**
   * enabledInPlanningMode - Whether button is enabled in planning mode (optional)
   * If not specified, uses 'enabled' value
   * true  = Button is visible in planning mode
   * false = Button is hidden in planning mode
   */
  enabledInPlanningMode?: boolean;
  
  /**
   * enabledInGameMode - Whether button is enabled in game mode (optional)
   * If not specified, defaults to false (hidden in game mode)
   * true  = Button is visible in game mode
   * false = Button is hidden in game mode
   */
  enabledInGameMode?: boolean;
  
  /**
   * category - Which group this button belongs to
   * See CATEGORY section above for options
   * Example: 'selection', 'drawing', 'utilities'
   */
  category: ToolButtonCategory;
  
  /**
   * weight - Position within category (higher = further right)
   * Used to order buttons within the same category
   * Example: In 'drawing' category:
   *   - Token (weight: 1) appears first
   *   - Terrain (weight: 2) appears second
   *   - Room (weight: 3) appears third
   */
  weight: number;
  
  // ========== VISUAL SETTINGS ==========
  
  /**
   * icon - React icon component to display
   * Import from 'lucide-react' library
   * Example: <MousePointer size={18} />, <Stamp size={18} />
   */
  icon: ReactNode;
  
  /**
   * label - Tooltip text shown on hover
   * Example: 'Pointer Tool', 'Token Tool', 'Toggle Grid'
   */
  label: string;
  
  /**
   * shortcutKey - Keyboard shortcut (optional)
   * Display string shown below button
   * Example: 'V', 'B', 'T', 'Ctrl+Z', 'Del'
   */
  shortcutKey?: string;
  
  // ========== BEHAVIOR SETTINGS ==========
  
  /**
   * buttonType - How the button behaves
   * See BUTTON TYPE section above for options
   * Example: 'tool', 'toggle', 'action', 'submenu'
   */
  buttonType: ButtonType;
  
  /**
   * highlightStyle - Visual feedback when active
   * See HIGHLIGHT STYLE section above for options
   * Example: 'full', 'border', null
   */
  highlightStyle: HighlightStyle;
  
  // ========== FUNCTIONALITY ==========
  
  /**
   * tool - Which tool this button activates (optional)
   * Only needed for buttonType: 'tool'
   * Must match ToolType from types.ts
   * Example: 'pointer', 'token', 'background', 'room', 'pan', 'zoom-in'
   */
  tool?: ToolType;
  
  /**
   * hasSubmenu - Whether this button opens a submenu
   * true  = Button has associated submenu (e.g., token picker, grid controls)
   * false = Button has no submenu
   */
  hasSubmenu: boolean;
  
  // ========== ADVANCED SETTINGS ==========
  
  /**
   * showWhen - Conditional visibility function (optional)
   * Return true to show button, false to hide it
   * Example: () => hasSelection (only show when something is selected)
   */
  showWhen?: () => boolean;
}

/**
 * BUTTON PROPS INTERFACE
 * ============================================================
 * Props passed to button components from FloatingToolbar
 */

export interface ToolButtonProps {
  // Props passed from FloatingToolbar
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeSubmenu: string | null;
  setActiveSubmenu: (submenu: string | null) => void;
  onAction?: () => void;
  disabled?: boolean;
  
  // Additional props specific to button type
  [key: string]: any;
}
