// ============================================================
// TOOLBOX CONFIGURATION
// ============================================================
// Configure toolbox appearance and button organization
// Buttons are automatically loaded from tool-buttons/ directory
// ============================================================

// ========== GENERAL SETTINGS ==========
const TOOLBOX_CONFIG = {
  // Show keyboard shortcut labels below buttons
  showKeyboardShortcuts: true,  // OPTIONS: true (show shortcuts) | false (hide shortcuts)
  
  // Category order weights - lower numbers appear first
  // Categories are automatically discovered from enabled buttons
  // To change category order, adjust these weight values
  // To hide a category, set weight to 999 or disable all its buttons
  categoryOrderWeights: {
    'selection': 10,   // Selection tools (e.g., pointer)
    'drawing': 20,     // Drawing tools (e.g., token, terrain, room)
    'navigation': 30,  // Navigation (e.g., pan, zoom)
    'history': 40,     // Undo/redo
    'layers': 50,      // Layer management (e.g., duplicate, delete, layer up/down)
    'toggle': 55,      // Toggle panels (e.g., info)
    'view': 60,        // View options (e.g., grid, fit to view)
    'utilities': 70,   // Utilities (e.g., lock, badges, color picker)
  } as Record<string, number>,
  
  // Show vertical dividers between categories
  showCategoryDividers: true,   // OPTIONS: true | false
};

// ========== SUBMENU DEBUG MODE ==========
const MENU_DEBUG_MODE = false; // Set to false to disable debug logging
// ======================================

import { ToolType, TokenTemplate, ColorType, RoomSubTool } from '../../types';
import { useState, useRef, useEffect } from 'react';

// Import ALL button components
import PointerButton, { pointerButtonConfig } from './buttons/PointerButton';
import TokenButton, { tokenButtonConfig } from './buttons/TokenButton';
import TerrainButton, { terrainButtonConfig } from './buttons/TerrainButton';
// LEGACY TOOLS - Archived (see src/legacy/)
// import RoomButton, { roomButtonConfig } from './buttons/RoomButton';
import ModularRoomButton, { modularRoomButtonConfig } from './buttons/ModularRoomButton';
// import WallButton, { wallButtonConfig } from './buttons/WallButton';
// import WallCutterToolButton, { wallCutterToolButtonConfig } from './buttons/WallCutterToolButton';
import DoorToolButton, { doorToolButtonConfig } from './buttons/DoorToolButton';
import PanButton, { panButtonConfig } from './buttons/PanButton';
import ZoomButton, { zoomButtonConfig } from './buttons/ZoomButton';
import UndoButton, { undoButtonConfig } from './buttons/UndoButton';
import RedoButton, { redoButtonConfig } from './buttons/RedoButton';
import DuplicateButton, { duplicateButtonConfig } from './buttons/DuplicateButton';
import DeleteButton, { deleteButtonConfig } from './buttons/DeleteButton';
import LayerUpButton, { layerUpButtonConfig } from './buttons/LayerUpButton';
import LayerDownButton, { layerDownButtonConfig } from './buttons/LayerDownButton';
import BadgeToggleButton, { badgeToggleButtonConfig } from './buttons/BadgeToggleButton';
import LockButton, { lockButtonConfig } from './buttons/LockButton';
import GameModeLockButton, { gameModeLockButtonConfig } from './buttons/GameModeLockButton';
import GridButton, { gridButtonConfig } from './buttons/GridButton';
import ColorPickerButton, { colorPickerButtonConfig } from './buttons/ColorPickerButton';
import FitToViewButton, { fitToViewButtonConfig } from './buttons/FitToViewButton';
import XLabButton, { xLabButtonConfig } from './buttons/XLabButton';
import InfoButton, { infoButtonConfig } from './buttons/InfoButton';

// Import submenu components (for buttons that need them)
// Submenus are rendered by individual button components
// import TokenPickerSubmenu from './submenus/TokenPickerSubmenu';
// import TerrainPickerSubmenu from './submenus/TerrainPickerSubmenu';
// import ColorPickerSubmenu from './submenus/ColorPickerSubmenu';
// import RoomSubToolPicker from './submenus/RoomSubToolPicker';
// import GridControlsSubmenu from './submenus/GridControlsSubmenu';

interface ToolboxProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLayerUp: () => void;
  onLayerDown: () => void;
  onFitToView: () => void;
  fitToViewLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  showTokenBadges: boolean;
  selectedTokenHasBadge: boolean;
  onToggleBadges: () => void;
  recentTokens: TokenTemplate[];
  tokenTemplates: TokenTemplate[];
  activeTokenTemplate: TokenTemplate | null;
  onSelectToken: (token: TokenTemplate) => void;
  selectedColor: ColorType;
  onColorChange: (color: ColorType) => void;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  autoMergeRooms?: boolean;
  setAutoMergeRooms?: (value: boolean) => void;
  selectedElementLocked: boolean;
  onToggleLock: () => void;
  showGrid: boolean;
  gridSize: number;
  onToggleGrid: () => void;
  onGridSizeChange: (size: number) => void;
  forceShowTokenSubmenu?: boolean;
  onHideTokenPreview?: () => void;
  terrainBrushes: { name: string; download_url: string }[];
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  wallTextures?: { name: string; download_url: string }[];
  selectedWallTexture?: string | null;
  onSelectWallTexture?: (url: string) => void;
  wallCutterToolBrushSize: number;
  setWallCutterToolBrushSize: (size: number) => void;
  onSwitchToDrawTab?: () => void;
  onSwitchToTokensTab?: () => void;
  onSwitchToModulesTab?: () => void;
  forceShowTerrainSubmenu?: boolean;
  forceShowGridSubmenu?: boolean;
  onSwitchToXLab?: () => void;
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  viewMode?: 'planning' | 'game'; // Add viewMode prop
  activeSceneId?: string | null; // Used to reset submenus when scene changes
  hiddenToolbarButtons?: Set<string>; // Button IDs hidden by user in settings
  customKeybinds?: Record<string, string>; // Custom keybinds (buttonId -> key)
}

// Registry of all available buttons with their configs
const BUTTON_REGISTRY = [
  { component: PointerButton, config: pointerButtonConfig },
  { component: TokenButton, config: tokenButtonConfig },
  { component: TerrainButton, config: terrainButtonConfig },
  // LEGACY TOOLS - Archived (replaced by Modular Rooms)
  // { component: RoomButton, config: roomButtonConfig },
  { component: ModularRoomButton, config: modularRoomButtonConfig },
  // { component: WallButton, config: wallButtonConfig },
  // { component: WallCutterToolButton, config: wallCutterToolButtonConfig },
  { component: DoorToolButton, config: doorToolButtonConfig },
  { component: PanButton, config: panButtonConfig },
  { component: ZoomButton, config: zoomButtonConfig },
  { component: UndoButton, config: undoButtonConfig },
  { component: RedoButton, config: redoButtonConfig },
  { component: DuplicateButton, config: duplicateButtonConfig },
  { component: DeleteButton, config: deleteButtonConfig },
  { component: LayerUpButton, config: layerUpButtonConfig },
  { component: LayerDownButton, config: layerDownButtonConfig },
  { component: BadgeToggleButton, config: badgeToggleButtonConfig },
  { component: LockButton, config: lockButtonConfig },
  { component: GameModeLockButton, config: gameModeLockButtonConfig },
  { component: GridButton, config: gridButtonConfig },
  { component: ColorPickerButton, config: colorPickerButtonConfig },
  { component: FitToViewButton, config: fitToViewButtonConfig },
  { component: XLabButton, config: xLabButtonConfig },
  { component: InfoButton, config: infoButtonConfig },
];

const Toolbox = (props: ToolboxProps) => {
  const {
    activeTool,
    setActiveTool,
    onUndo,
    onRedo,
    onDuplicate,
    onDelete,
    onLayerUp,
    onLayerDown,
    onFitToView,
    fitToViewLocked,
    canUndo,
    canRedo,
    hasSelection,
    showTokenBadges,
    selectedTokenHasBadge,
    onToggleBadges,
    tokenTemplates,
    activeTokenTemplate,
    onSelectToken,
    selectedColor,
    onColorChange,
    roomSubTool,
    setRoomSubTool,
    autoMergeRooms = false,
    setAutoMergeRooms,
    selectedElementLocked,
    onToggleLock,
    showGrid,
    gridSize,
    onToggleGrid,
    onGridSizeChange,
    terrainBrushes,
    selectedTerrainBrush,
    onSelectTerrainBrush,
    wallTextures = [],
    selectedWallTexture = null,
    onSelectWallTexture = () => {},
    wallCutterToolBrushSize,
    setWallCutterToolBrushSize,
    onSwitchToDrawTab,
    onSwitchToTokensTab,
    onSwitchToModulesTab,
    onSwitchToXLab,
    isLeftPanelOpen,
    onToggleLeftPanel,
    viewMode = 'planning', // Default to planning mode
    activeSceneId,
    hiddenToolbarButtons = new Set(),
    customKeybinds = {},
  } = props;

  // ========== CENTRAL SUBMENU STATE (SINGLE SOURCE OF TRUTH) ==========
  type SubmenuId = 'token' | 'terrain' | 'room' | 'wall' | 'grid' | 'color' | null;
  type OpenedBy = 'click' | 'shortcut' | 'hover' | null;

  const [openSubmenuId, setOpenSubmenuId] = useState<SubmenuId>(null);
  const [submenuOpenedBy, setSubmenuOpenedBy] = useState<OpenedBy>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const shortcutInactivityTimerRef = useRef<number | null>(null);

  // Reset submenus when scene changes
  useEffect(() => {
    setOpenSubmenuId(null);
    setSubmenuOpenedBy(null);
  }, [activeSceneId]);

  // ========== LAST-USED STATE FOR LIST-TOOLS ==========
  const [lastUsedTokenIndex, setLastUsedTokenIndex] = useState<number>(0);
  const [lastUsedTerrainIndex, setLastUsedTerrainIndex] = useState<number>(0);
  const [lastUsedWallIndex, setLastUsedWallIndex] = useState<number>(0);
  const [lastUsedRoomSubTool, setLastUsedRoomSubTool] = useState<RoomSubTool>('rectangle');
  const [lastUsedColorIndex, setLastUsedColorIndex] = useState<number>(0);

  // ========== KEYBIND MAPPING (FROM BUTTON CONFIGS + CUSTOM KEYBINDS) ==========
  // Maps shortcut keys to their submenu IDs
  // Checks customKeybinds first, then falls back to default shortcutKey from button configs
  const keybindToSubmenuMap: Record<string, SubmenuId> = {};
  
  // Helper to get effective keybind (custom or default)
  const getEffectiveKeybind = (buttonId: string, defaultKey?: string): string | undefined => {
    const custom = customKeybinds[buttonId];
    return custom ? custom : defaultKey;
  };
  
  // Build mapping from button configs (only if shortcutKey is defined)
  const tokenKey = getEffectiveKeybind('token', tokenButtonConfig.shortcutKey);
  if (tokenKey) {
    keybindToSubmenuMap[tokenKey.toLowerCase()] = 'token';
  }
  
  const terrainKey = getEffectiveKeybind('terrain', terrainButtonConfig.shortcutKey);
  if (terrainKey) {
    keybindToSubmenuMap[terrainKey.toLowerCase()] = 'terrain';
  }
  
  // LEGACY - Room and Wall tools archived
  // const roomKey = getEffectiveKeybind('modular-room', roomButtonConfig.shortcutKey);
  // if (roomKey) {
  //   keybindToSubmenuMap[roomKey.toLowerCase()] = 'room';
  // }
  // const wallKey = getEffectiveKeybind('wall', wallButtonConfig.shortcutKey);
  // if (wallKey) {
  //   keybindToSubmenuMap[wallKey.toLowerCase()] = 'wall';
  // }
  
  const colorKey = getEffectiveKeybind('color', colorPickerButtonConfig.shortcutKey);
  if (colorKey) {
    keybindToSubmenuMap[colorKey.toLowerCase()] = 'color';
  }

  // ========== CENTRAL SUBMENU CONTROL FUNCTIONS ==========

  // Reset shortcut inactivity timer (4000ms auto-close for list-tools)
  const resetShortcutInactivityTimer = () => {
    // Clear existing timer
    if (shortcutInactivityTimerRef.current) {
      clearTimeout(shortcutInactivityTimerRef.current);
      shortcutInactivityTimerRef.current = null;
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] cleared shortcut inactivity timer');
      }
    }

    // Only start timer for list-tools opened via shortcut (not grid)
    if (openSubmenuId && openSubmenuId !== 'grid' && submenuOpenedBy === 'shortcut') {
      shortcutInactivityTimerRef.current = window.setTimeout(() => {
        // Only close if still opened by shortcut (not upgraded to click)
        if (submenuOpenedBy === 'shortcut') {
          if (MENU_DEBUG_MODE) {
            console.log('[SUBMENU] shortcut inactivity timeout - auto-closing');
          }
          closeSubmenu('shortcut-inactivity');
        }
      }, 4000);
      
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] started shortcut inactivity timer (4000ms)');
      }
    }
  };

  const closeSubmenu = (reason?: string) => {
    if (MENU_DEBUG_MODE) {
      console.log('[closeSubmenu]', {
        prevId: openSubmenuId,
        prevOpenedBy: submenuOpenedBy,
        reason: reason || 'unspecified'
      });
    }

    // Clear any hover timer
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] clear hoverCloseTimer');
      }
    }

    // Clear any shortcut inactivity timer
    if (shortcutInactivityTimerRef.current) {
      clearTimeout(shortcutInactivityTimerRef.current);
      shortcutInactivityTimerRef.current = null;
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] clear shortcutInactivityTimer');
      }
    }

    setOpenSubmenuId(null);
    setSubmenuOpenedBy(null);
  };

  const openSubmenu = (id: SubmenuId, openedBy: OpenedBy) => {
    if (MENU_DEBUG_MODE) {
      console.log('[openSubmenu]', {
        id,
        openedBy,
        prevId: openSubmenuId,
        prevOpenedBy: submenuOpenedBy
      });
    }

    // If id is null, just close
    if (id === null) {
      closeSubmenu('explicit-null');
      return;
    }

    // If same submenu is already open
    if (openSubmenuId === id) {
      // Click always toggles
      if (openedBy === 'click' && submenuOpenedBy === 'click') {
        closeSubmenu('toggle-off');
        return;
      }
      
      // Shortcut ONLY toggles for grid - list-tools (token, terrain, room, color) stay open
      if (openedBy === 'shortcut' && submenuOpenedBy === 'shortcut') {
        if (id === 'grid') {
          // Grid can toggle via shortcut
          closeSubmenu('toggle-off');
          return;
        } else {
          // List-tools: shortcut cycles items, doesn't close submenu
          // Return early - shortcut handler will handle cycling
          return;
        }
      }
      
      // For hover, keep it open without changing openedBy
      if (openedBy === 'hover') {
        return;
      }
      
      // If opening same submenu with different method (e.g., hover → click),
      // update the openedBy state
      setSubmenuOpenedBy(openedBy);
      
      // Clear shortcut timer if upgrading from shortcut to click
      if (openedBy === 'click' && submenuOpenedBy === 'shortcut') {
        if (shortcutInactivityTimerRef.current) {
          clearTimeout(shortcutInactivityTimerRef.current);
          shortcutInactivityTimerRef.current = null;
          if (MENU_DEBUG_MODE) {
            console.log('[SUBMENU] cleared shortcut timer (upgraded to click)');
          }
        }
      }
      
      return;
    }

    // Different submenu - close current first
    if (openSubmenuId !== null) {
      closeSubmenu('opening-another');
    }

    // Open new submenu
    setOpenSubmenuId(id);
    setSubmenuOpenedBy(openedBy);
    
    // Start shortcut inactivity timer for list-tools opened via shortcut
    if (openedBy === 'shortcut' && id !== 'grid') {
      // Use setTimeout to ensure state is updated first
      setTimeout(() => {
        resetShortcutInactivityTimer();
      }, 0);
    }
  };

  // ========== HOVER HANDLERS (CENTRAL) ==========

  const onToolboxButtonMouseEnter = (id: SubmenuId) => {
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] button mouseEnter', { id, current: openSubmenuId });
    }

    // Clear any pending hover close timer
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] clear hoverCloseTimer (re-enter)');
      }
    }

    // Reset shortcut inactivity timer on button hover (user interaction)
    resetShortcutInactivityTimer();

    // Always allow hover to open/switch submenu (with 100ms delay)
    // Delay before opening to prevent accidental triggers
    hoverCloseTimerRef.current = window.setTimeout(() => {
      openSubmenu(id, 'hover');
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] hover open delay complete');
      }
    }, 100);
    
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] set hoverOpenTimer', { submenuId: id, delayMs: 100 });
    }
  };

  const onToolboxButtonMouseLeave = (id: SubmenuId) => {
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] button mouseLeave', { id, current: openSubmenuId, openedBy: submenuOpenedBy });
    }

    // Only process hover-close logic if this submenu is open AND was opened by hover
    if (openSubmenuId !== id || submenuOpenedBy !== 'hover') {
      return;
    }

    // Start close timer
    hoverCloseTimerRef.current = window.setTimeout(() => {
      closeSubmenu('hover-timeout');
    }, 200);
    
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] set hoverCloseTimer', { submenuId: id, delayMs: 200 });
    }
  };

  const onSubmenuMouseEnter = (id: SubmenuId) => {
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] submenu mouseEnter', { id, current: openSubmenuId });
    }

    // Cancel close timer when entering submenu
    if (openSubmenuId === id && hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
      if (MENU_DEBUG_MODE) {
        console.log('[SUBMENU] clear hoverCloseTimer (enter submenu)');
      }
    }
    
    // Reset shortcut inactivity timer (user is interacting with submenu)
    resetShortcutInactivityTimer();
  };

  const onSubmenuMouseLeave = (id: SubmenuId) => {
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] submenu mouseLeave', { id, current: openSubmenuId, openedBy: submenuOpenedBy });
    }

    // Only set close timer if opened by hover
    if (openSubmenuId !== id || submenuOpenedBy !== 'hover') {
      return;
    }

    hoverCloseTimerRef.current = window.setTimeout(() => {
      closeSubmenu('hover-timeout');
    }, 200);
    
    if (MENU_DEBUG_MODE) {
      console.log('[SUBMENU] set hoverCloseTimer', { submenuId: id, delayMs: 200 });
    }
    
    // Restart shortcut inactivity timer when leaving submenu
    resetShortcutInactivityTimer();
  };

  // ========== LIST-TOOL CYCLING FUNCTIONS ==========

  const cycleToken = () => {
    if (!tokenTemplates || tokenTemplates.length === 0) return;
    const newIndex = (lastUsedTokenIndex + 1) % tokenTemplates.length;
    setLastUsedTokenIndex(newIndex);
    onSelectToken(tokenTemplates[newIndex]);
    resetShortcutInactivityTimer();
  };

  const cycleTerrain = () => {
    if (!terrainBrushes || terrainBrushes.length === 0) return;
    const newIndex = (lastUsedTerrainIndex + 1) % terrainBrushes.length;
    setLastUsedTerrainIndex(newIndex);
    onSelectTerrainBrush(terrainBrushes[newIndex].download_url);
    resetShortcutInactivityTimer();
  };

  const cycleWall = () => {
    if (!wallTextures || wallTextures.length === 0) return;
    const newIndex = (lastUsedWallIndex + 1) % wallTextures.length;
    setLastUsedWallIndex(newIndex);
    onSelectWallTexture(wallTextures[newIndex].download_url);
    resetShortcutInactivityTimer();
  };

  const cycleRoomSubTool = () => {
    const tools: RoomSubTool[] = [
      'rectangle', 'pentagon', 'hexagon', 'octagon', 'custom',
      'subtract-rectangle', 'subtract-pentagon', 'subtract-hexagon', 'subtract-octagon', 'subtract-custom'
    ];
    // Use current roomSubTool instead of lastUsedRoomSubTool to avoid double-increment
    const currentIndex = tools.indexOf(roomSubTool);
    const newIndex = (currentIndex + 1) % tools.length;
    const newTool = tools[newIndex];
    
    console.log('[ROOM CYCLE]', {
      current: roomSubTool,
      currentIndex,
      newIndex,
      newTool,
      totalTools: tools.length
    });
    
    setLastUsedRoomSubTool(newTool);
    setRoomSubTool(newTool);
    resetShortcutInactivityTimer();
  };

  const cycleColor = () => {
    const colors: ColorType[] = [
      'red', 'blue', 'yellow', 'purple', 'orange', 'pink', 
      'brown', 'gray', 'black', 'white', 'cyan', 'magenta', 
      'lime', 'indigo', 'teal', 'green'
    ];
    const newIndex = (lastUsedColorIndex + 1) % colors.length;
    const newColor = colors[newIndex];
    setLastUsedColorIndex(newIndex);
    onColorChange(newColor);
    resetShortcutInactivityTimer();
    // Apply color to selected element(s) immediately
    if (hasSelection) {
      const event = new CustomEvent('applyColorToSelection', { detail: { color: newColor } });
      window.dispatchEvent(event);
    }
  };

  const selectLastUsedToken = () => {
    if (!tokenTemplates || tokenTemplates.length === 0) return;
    const index = Math.min(lastUsedTokenIndex, tokenTemplates.length - 1);
    onSelectToken(tokenTemplates[index]);
  };

  const selectLastUsedTerrain = () => {
    if (!terrainBrushes || terrainBrushes.length === 0) return;
    const index = Math.min(lastUsedTerrainIndex, terrainBrushes.length - 1);
    onSelectTerrainBrush(terrainBrushes[index].download_url);
  };

  const selectLastUsedWall = () => {
    if (!wallTextures || wallTextures.length === 0) return;
    const index = Math.min(lastUsedWallIndex, wallTextures.length - 1);
    onSelectWallTexture(wallTextures[index].download_url);
  };

  const selectLastUsedRoomSubTool = () => {
    setRoomSubTool(lastUsedRoomSubTool);
  };

  const selectLastUsedColor = () => {
    const colors: ColorType[] = [
      'red', 'blue', 'yellow', 'purple', 'orange', 'pink', 
      'brown', 'gray', 'black', 'white', 'cyan', 'magenta', 
      'lime', 'indigo', 'teal', 'green'
    ];
    onColorChange(colors[lastUsedColorIndex]);
  };

  // ========== KEYBOARD & CLICK HANDLERS ==========

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea/contenteditable
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.getAttribute('contenteditable') === 'true' ||
          activeEl.getAttribute('role') === 'textbox' ||
          activeEl.classList.contains('ProseMirror')
        ) {
          return;
        }
      }

      // ESC closes any open submenu
      if (e.key === 'Escape' && openSubmenuId !== null) {
        closeSubmenu('escape');
        return;
      }

      // Dynamic keybind handler - checks all list-tool shortcuts from button configs
      const pressedKey = e.key.toLowerCase();
      const submenuId = keybindToSubmenuMap[pressedKey];
      
      if (submenuId) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          
          // NOTE: All keyboard shortcuts are now handled by individual button components
          // (TokenButton, TerrainButton, WallButton, RoomButton, ColorPickerButton)
          // Each button has its own useKeyboardShortcut hook that handles:
          // - Opening the submenu on first press
          // - Cycling through options on subsequent presses
          // This prevents duplicate keyboard event handling
          
          // Toolbox no longer needs to handle any cycling or selection
          // Just track that the key was pressed for the keybind mapping
        }
        return;
      }
    };

    const handleDocumentClick = (e: MouseEvent) => {
      // Only close if submenu was opened by click/shortcut (not hover)
      if (openSubmenuId !== null && submenuOpenedBy !== 'hover') {
        const target = e.target as HTMLElement;
        
        // Check if click is outside toolbox and submenu areas
        const isToolboxClick = target.closest('[data-toolbox-container]');
        const isSubmenuClick = target.closest('[data-submenu-container]');
        
        if (!isToolboxClick && !isSubmenuClick) {
          closeSubmenu('outside-click');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleDocumentClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [openSubmenuId, submenuOpenedBy, keybindToSubmenuMap, cycleToken, cycleTerrain, cycleWall, cycleRoomSubTool, cycleColor, selectLastUsedToken, selectLastUsedTerrain, selectLastUsedWall, selectLastUsedRoomSubTool, selectLastUsedColor]);

  // ========== COLOR MAP ==========
  const colorMap: Record<ColorType, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    black: '#000000',
    white: '#ffffff',
    gray: '#6b7280',
    brown: '#92400e',
    cyan: '#06b6d4',
    magenta: '#d946ef',
    lime: '#84cc16',
    indigo: '#6366f1',
    teal: '#14b8a6'
  };

  // ========== GRID SCROLL HANDLER ==========
  // Grid is special - it doesn't have a cycling list, just adjusts size
  // Snap to 128 when within range
  const SNAP_TARGET = 128;
  const SNAP_RANGE = 12;

  const handleGridScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -4 : 4;
    let newSize = Math.max(4, Math.min(512, gridSize + delta));
    // Snap to 128 if within range
    if (Math.abs(newSize - SNAP_TARGET) <= SNAP_RANGE) {
      newSize = SNAP_TARGET;
    }
    onGridSizeChange(newSize);
  };

  // ========== AUTO-OPEN SUBMENUS FOR TOOLS ==========
  // TEMPORARILY DISABLED - causing state flapping
  // Will be re-enabled after core submenu system is stable

  // Auto-open token submenu when token tool is active
  /* useEffect(() => {
    if (activeTool === 'token') {
      if (openSubmenuId === null || openSubmenuId === 'token') {
        openSubmenu('token', 'click');
      }
    } else if (openSubmenuId === 'token') {
      closeSubmenu('tool-change');
    }
  }, [activeTool, openSubmenuId]); */

  // Auto-open terrain submenu when terrain tool is active
  /* useEffect(() => {
    if (activeTool === 'background') {
      if (openSubmenuId === null || openSubmenuId === 'terrain') {
        openSubmenu('terrain', 'click');
      }
    } else if (openSubmenuId === 'terrain') {
      closeSubmenu('tool-change');
    }
  }, [activeTool, openSubmenuId]); */

  // Auto-open room sub-tool picker when room tool is active
  /* useEffect(() => {
    if (activeTool === 'room') {
      if (openSubmenuId === null || openSubmenuId === 'room') {
        openSubmenu('room', 'click');
      }
      if (roomSubTool === 'erase') {
        setRoomSubTool('rectangle');
      }
    } else if (openSubmenuId === 'room') {
      closeSubmenu('tool-change');
    }
    
    // Close all submenus when switching to tools without submenus
    if (activeTool === 'pointer' || activeTool === 'pan' || activeTool === 'zoom-in' || activeTool === 'zoom-out' || activeTool === 'marker') {
      closeSubmenu('tool-change');
    }
  }, [activeTool, setRoomSubTool, openSubmenuId, roomSubTool]); */

  // ========== GROUP BUTTONS BY CATEGORY (DYNAMIC) ==========

  const getButtonsByCategory = () => {
    const grouped: Record<string, typeof BUTTON_REGISTRY> = {};

    // Dynamically build categories from enabled buttons
    BUTTON_REGISTRY.forEach((button) => {
      // Check if button is enabled for current view mode
      const isEnabledInCurrentMode = viewMode === 'game'
        ? button.config.enabledInGameMode ?? false
        : button.config.enabledInPlanningMode ?? button.config.enabled;
      
      // NOTE: We now include buttons even if hidden by user settings
      // This ensures their keyboard shortcuts still work (via useKeyboardShortcut hook)
      // They will be visually hidden with CSS instead
      
      if (isEnabledInCurrentMode) {
        const category = button.config.category;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(button);
      }
    });

    // Sort buttons within each category by weight
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort(
        (a, b) => a.config.weight - b.config.weight
      );
    });

    return grouped;
  };

  const buttonsByCategory = getButtonsByCategory();

  // ========== RENDER TOOLBOX ==========

  return (
    <>
      {/* Debug Overlay */}
      {MENU_DEBUG_MODE && (
        <div className="fixed bottom-20 right-4 bg-black/90 text-green-400 p-3 rounded-lg shadow-xl z-[60] font-mono text-xs border border-green-500/30">
          <div className="font-bold mb-2 text-green-300">SUBMENU DEBUG</div>
          <div>openSubmenuId: <span className="text-yellow-400">{openSubmenuId || 'null'}</span></div>
          <div>submenuOpenedBy: <span className="text-yellow-400">{submenuOpenedBy || 'null'}</span></div>
          <div>hoverTimerActive: <span className="text-yellow-400">{hoverCloseTimerRef.current !== null ? 'true' : 'false'}</span></div>
        </div>
      )}

      {/* Toolbox */}
      <div
        data-toolbox-container="true"
        onMouseEnter={() => {
          if (props.onHideTokenPreview) props.onHideTokenPreview();
        }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 flex items-center gap-1 z-50"
      >
      {Object.keys(buttonsByCategory)
        .sort((a, b) => {
          const weightA = TOOLBOX_CONFIG.categoryOrderWeights[a] ?? 999;
          const weightB = TOOLBOX_CONFIG.categoryOrderWeights[b] ?? 999;
          return weightA - weightB;
        })
        .map((category, categoryIndex) => {
        const buttons = buttonsByCategory[category];
        
        if (!buttons || buttons.length === 0) return null;

        return (
          <div key={category} className="flex items-center gap-1">
            {/* Render category divider */}
            {TOOLBOX_CONFIG.showCategoryDividers && categoryIndex > 0 && (
              <div className="w-px h-6 bg-dm-border mx-1"></div>
            )}

            {/* Render buttons in this category */}
            {buttons.map(({ component: ButtonComponent, config }) => {
              // Determine which props to pass based on button ID
              const baseProps = {
                activeTool,
                setActiveTool,
                openSubmenuId,
                submenuOpenedBy,
                onOpenSubmenu: openSubmenu,
                onCloseSubmenu: closeSubmenu,
                onToolboxButtonMouseEnter,
                onToolboxButtonMouseLeave,
                onSubmenuMouseEnter,
                onSubmenuMouseLeave,
                customKeybind: customKeybinds[config.id], // Pass custom keybind if available
              };

              // Add specific props for specific buttons
              let specificProps: any = {};

              switch (config.id) {
                case 'pointer':
                  specificProps = {
                    onCloseSubmenu: closeSubmenu,
                  };
                  break;

                case 'token':
                  specificProps = {
                    tokenTemplates,
                    activeTokenTemplate,
                    onSelectToken,
                    cycleToken,
                    selectLastUsedToken,
                    onSwitchToTokensTab,
                  };
                  break;

                case 'terrain':
                  specificProps = {
                    terrainBrushes,
                    selectedTerrainBrush,
                    onSelectTerrainBrush,
                    onSwitchToDrawTab,
                    cycleTerrain,
                    selectLastUsedTerrain,
                  };
                  break;

                case 'wall':
                  specificProps = {
                    wallTextures,
                    selectedWallTexture,
                    onSelectWallTexture,
                    cycleWall,
                    selectLastUsedWall,
                    onSwitchToDrawTab,
                  };
                  break;

                case 'wallCutterTool':
                  specificProps = {
                    wallCutterToolBrushSize,
                    setWallCutterToolBrushSize,
                  };
                  break;

                case 'room':
                  specificProps = {
                    roomSubTool,
                    setRoomSubTool,
                    autoMergeRooms,
                    setAutoMergeRooms,
                    cycleRoomSubTool,
                    selectLastUsedRoomSubTool,
                    onSwitchToDrawTab,
                  };
                  break;

                case 'pan':
                case 'zoom':
                  // No special props
                  break;

                case 'undo':
                  specificProps = { onUndo, canUndo };
                  break;

                case 'redo':
                  specificProps = { onRedo, canRedo };
                  break;

                case 'duplicate':
                  specificProps = { onDuplicate, hasSelection };
                  break;

                case 'delete':
                  specificProps = { onDelete, hasSelection };
                  break;

                case 'layer-up':
                  specificProps = { onLayerUp, hasSelection };
                  break;

                case 'layer-down':
                  specificProps = { onLayerDown, hasSelection };
                  break;

                case 'badge-toggle':
                  specificProps = { onToggleBadges, showTokenBadges, selectedTokenHasBadge, hasSelection };
                  break;

                case 'lock':
                  specificProps = { onToggleLock, selectedElementLocked, hasSelection };
                  break;

                case 'gamemode-lock':
                  specificProps = { onToggleLock, selectedElementLocked, hasSelection };
                  break;

                case 'grid':
                  specificProps = {
                    showGrid,
                    gridSize,
                    onToggleGrid,
                    onGridSizeChange,
                    handleGridScroll,
                  };
                  break;

                case 'color-picker':
                  specificProps = {
                    selectedColor,
                    colorMap,
                    hasSelection,
                    onColorChange,
                    // Central submenu system props
                    openSubmenuId,
                    submenuOpenedBy,
                    onOpenSubmenu: openSubmenu,
                    onCloseSubmenu: closeSubmenu,
                    onToolboxButtonMouseEnter,
                    onToolboxButtonMouseLeave,
                    onSubmenuMouseEnter,
                    onSubmenuMouseLeave,
                    // Cycling functions
                    cycleColor,
                    selectLastUsedColor,
                  };
                  break;

                case 'xlab':
                  specificProps = {
                    onSwitchToXLab,
                  };
                  break;

                case 'info':
                  specificProps = {
                    isLeftPanelOpen,
                    onToggleLeftPanel,
                  };
                  break;

                case 'modularRoom':
                  specificProps = {
                    onSwitchToModulesTab,
                  };
                  break;

                case 'fit-to-view':
                  specificProps = { onFitToView, fitToViewLocked };
                  break;
              }

              // Check if button is hidden by user settings
              const isHiddenByUser = hiddenToolbarButtons.has(config.id);

              return (
                <div
                  key={config.id}
                  style={{
                    display: isHiddenByUser ? 'none' : 'block',
                  }}
                >
                  <ButtonComponent
                    {...baseProps}
                    {...specificProps}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </>
  );
};

export default Toolbox;
