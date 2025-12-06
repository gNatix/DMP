import { useState, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ToolId =
  | 'selectTool'
  | 'tokenTool'
  | 'terrainTool'
  | 'roomTool'
  | 'colorTool'
  | 'gridTool';

export type SubmenuId =
  | 'tokenpicker'
  | 'terrainpicker'
  | 'roomtool'
  | 'colorpicker'
  | 'grid';

export type OpenReason = 'hover' | 'click' | 'shortcut';

export type SubmenuItemId = string;

export interface ActiveSubmenu {
  id: SubmenuId;
  openedBy: OpenReason;
}

export interface UseSubmenuControllerResult {
  activeTool: ToolId;
  activeSubmenu: ActiveSubmenu | null;

  isSubmenuOpen: (id: SubmenuId) => boolean;
  getSelectedItemId: (id: SubmenuId) => SubmenuItemId | undefined;

  // hover logic
  handleTriggerMouseEnter: (id: SubmenuId) => void;
  handleTriggerMouseLeave: (id: SubmenuId) => void;
  handlePanelMouseEnter: (id: SubmenuId) => void;
  handlePanelMouseLeave: (id: SubmenuId) => void;

  // clicking a toolbar button
  handleToolClick: (
    toolId: ToolId,
    submenuId: SubmenuId,
    items: SubmenuItemId[]
  ) => void;

  // keyboard shortcut for tool
  handleToolShortcut: (
    toolId: ToolId,
    submenuId: SubmenuId,
    items: SubmenuItemId[]
  ) => void;

  // selecting an item within a submenu
  selectSubmenuItem: (submenuId: SubmenuId, itemId: SubmenuItemId) => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSubmenuController(): UseSubmenuControllerResult {
  // Active tool (which tool is selected)
  const [activeTool, setActiveTool] = useState<ToolId>('selectTool');

  // Active submenu (which submenu is open and how it was opened)
  const [activeSubmenu, setActiveSubmenu] = useState<ActiveSubmenu | null>(null);

  // Remember last selected item for each submenu
  const [submenuSelection, setSubmenuSelection] = useState<
    Record<SubmenuId, { lastSelectedItemId?: SubmenuItemId }>
  >({
    tokenpicker: {},
    terrainpicker: {},
    roomtool: {},
    colorpicker: {},
    grid: {},
  });

  // Hover timeout refs for each submenu
  const hoverTimeoutRef = useRef<Record<SubmenuId, number | null>>({
    tokenpicker: null,
    terrainpicker: null,
    roomtool: null,
    colorpicker: null,
    grid: null,
  });

  // Track if mouse is over trigger or panel for each submenu
  const isOverTriggerRef = useRef<Record<SubmenuId, boolean>>({
    tokenpicker: false,
    terrainpicker: false,
    roomtool: false,
    colorpicker: false,
    grid: false,
  });

  const isOverPanelRef = useRef<Record<SubmenuId, boolean>>({
    tokenpicker: false,
    terrainpicker: false,
    roomtool: false,
    colorpicker: false,
    grid: false,
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const clearHoverTimeout = useCallback((id: SubmenuId) => {
    if (hoverTimeoutRef.current[id]) {
      clearTimeout(hoverTimeoutRef.current[id]!);
      hoverTimeoutRef.current[id] = null;
    }
  }, []);

  const isSubmenuOpen = useCallback(
    (id: SubmenuId): boolean => {
      return activeSubmenu?.id === id;
    },
    [activeSubmenu]
  );

  const getSelectedItemId = useCallback(
    (id: SubmenuId): SubmenuItemId | undefined => {
      return submenuSelection[id].lastSelectedItemId;
    },
    [submenuSelection]
  );

  // Select an item within a submenu and remember it
  const selectSubmenuItem = useCallback(
    (submenuId: SubmenuId, itemId: SubmenuItemId) => {
      setSubmenuSelection((prev) => ({
        ...prev,
        [submenuId]: { lastSelectedItemId: itemId },
      }));
    },
    []
  );

  // Get the item to preselect when opening a submenu
  const getItemToPreselect = useCallback(
    (submenuId: SubmenuId, items: SubmenuItemId[]): SubmenuItemId | undefined => {
      const lastSelected = submenuSelection[submenuId].lastSelectedItemId;
      
      // If we have a last selected item and it still exists in the items list, use it
      if (lastSelected && items.includes(lastSelected)) {
        return lastSelected;
      }
      
      // Otherwise, select first item if available
      return items.length > 0 ? items[0] : undefined;
    },
    [submenuSelection]
  );

  // ============================================================================
  // HOVER LOGIC
  // ============================================================================

  const handleTriggerMouseEnter = useCallback(
    (id: SubmenuId) => {
      isOverTriggerRef.current[id] = true;
      clearHoverTimeout(id);

      // Only open on hover if no submenu is currently open, or if it's hover-opened
      if (!activeSubmenu || activeSubmenu.openedBy === 'hover') {
        setActiveSubmenu({ id, openedBy: 'hover' });
      }
    },
    [activeSubmenu, clearHoverTimeout]
  );

  const handleTriggerMouseLeave = useCallback(
    (id: SubmenuId) => {
      isOverTriggerRef.current[id] = false;
      clearHoverTimeout(id);

      // Only auto-close if opened by hover
      if (activeSubmenu?.id === id && activeSubmenu.openedBy === 'hover') {
        hoverTimeoutRef.current[id] = setTimeout(() => {
          // Close only if mouse isn't over trigger or panel
          if (!isOverTriggerRef.current[id] && !isOverPanelRef.current[id]) {
            setActiveSubmenu(null);
          }
        }, 200); // Small delay to allow moving to panel
      }
    },
    [activeSubmenu, clearHoverTimeout]
  );

  const handlePanelMouseEnter = useCallback(
    (id: SubmenuId) => {
      isOverPanelRef.current[id] = true;
      clearHoverTimeout(id);
    },
    [clearHoverTimeout]
  );

  const handlePanelMouseLeave = useCallback(
    (id: SubmenuId) => {
      isOverPanelRef.current[id] = false;
      clearHoverTimeout(id);

      // Only auto-close if opened by hover
      if (activeSubmenu?.id === id && activeSubmenu.openedBy === 'hover') {
        hoverTimeoutRef.current[id] = setTimeout(() => {
          // Close only if mouse isn't over trigger or panel
          if (!isOverTriggerRef.current[id] && !isOverPanelRef.current[id]) {
            setActiveSubmenu(null);
          }
        }, 200);
      }
    },
    [activeSubmenu, clearHoverTimeout]
  );

  // ============================================================================
  // CLICK LOGIC
  // ============================================================================

  const handleToolClick = useCallback(
    (toolId: ToolId, submenuId: SubmenuId, items: SubmenuItemId[]) => {
      // Clear any hover timeouts
      clearHoverTimeout(submenuId);

      const isCurrentlyOpen = activeSubmenu?.id === submenuId;
      const isCurrentlyActive = activeTool === toolId;

      if (isCurrentlyOpen && isCurrentlyActive) {
        // Second click on same tool - toggle off
        setActiveSubmenu(null);
        setActiveTool('selectTool');
        // Keep lastSelectedItemId for next time
      } else {
        // First click or different tool - open submenu
        setActiveSubmenu({ id: submenuId, openedBy: 'click' });
        setActiveTool(toolId);

        // Preselect last-or-first item
        const itemToSelect = getItemToPreselect(submenuId, items);
        if (itemToSelect) {
          selectSubmenuItem(submenuId, itemToSelect);
        }
      }
    },
    [activeSubmenu, activeTool, clearHoverTimeout, getItemToPreselect, selectSubmenuItem]
  );

  // ============================================================================
  // SHORTCUT LOGIC
  // ============================================================================

  const handleToolShortcut = useCallback(
    (toolId: ToolId, submenuId: SubmenuId, items: SubmenuItemId[]) => {
      const isCurrentlyOpen = activeSubmenu?.id === submenuId;
      const isCurrentlyActive = activeTool === toolId;

      if (isCurrentlyOpen && isCurrentlyActive) {
        // Submenu already open with this tool active - cycle through items
        const currentItemId = submenuSelection[submenuId].lastSelectedItemId;
        const currentIndex = currentItemId ? items.indexOf(currentItemId) : -1;
        const nextIndex = (currentIndex + 1) % items.length;
        const nextItemId = items[nextIndex];

        if (nextItemId) {
          selectSubmenuItem(submenuId, nextItemId);
        }
        // Tool and submenu remain active/open
      } else {
        // Submenu closed or different submenu open - open this one
        setActiveSubmenu({ id: submenuId, openedBy: 'shortcut' });
        setActiveTool(toolId);

        // Preselect last-or-first item
        const itemToSelect = getItemToPreselect(submenuId, items);
        if (itemToSelect) {
          selectSubmenuItem(submenuId, itemToSelect);
        }
      }
    },
    [activeSubmenu, activeTool, submenuSelection, getItemToPreselect, selectSubmenuItem]
  );

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    activeTool,
    activeSubmenu,
    isSubmenuOpen,
    getSelectedItemId,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
    handlePanelMouseEnter,
    handlePanelMouseLeave,
    handleToolClick,
    handleToolShortcut,
    selectSubmenuItem,
  };
}
