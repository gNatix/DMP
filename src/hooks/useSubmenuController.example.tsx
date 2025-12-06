/**
 * EXAMPLE USAGE OF useSubmenuController
 * 
 * This file demonstrates how to integrate the useSubmenuController hook
 * with a FloatingToolbar component that has multiple tools with submenus.
 */

import { useEffect } from 'react';
import { useSubmenuController, ToolId, SubmenuId } from './useSubmenuController';

// Example: FloatingToolbar component
export function FloatingToolbar() {
  const controller = useSubmenuController();

  // Example submenu items for each tool
  const tokenItems = ['hero-token', 'monster-token', 'npc-token', 'object-token'];
  const terrainItems = ['grass', 'stone', 'water', 'lava', 'ice'];
  const roomItems = ['rectangle', 'circle', 'polygon', 'freehand'];
  const gridItems = ['show', 'hide', 'snap-to-grid'];
  const colorItems = ['red', 'blue', 'green', 'yellow', 'purple'];

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Token tool - press 'T'
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        controller.handleToolShortcut('tokenTool', 'tokenpicker', tokenItems);
      }

      // Terrain tool - press 'B' (for brush)
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        controller.handleToolShortcut('terrainTool', 'terrainpicker', terrainItems);
      }

      // Room tool - press 'R'
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        controller.handleToolShortcut('roomTool', 'roomtool', roomItems);
      }

      // Grid tool - press 'G'
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        controller.handleToolShortcut('gridTool', 'grid', gridItems);
      }

      // Color tool - press 'C'
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        controller.handleToolShortcut('colorTool', 'colorpicker', colorItems);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controller, tokenItems, terrainItems, roomItems, gridItems, colorItems]);

  // ============================================================================
  // RENDER TOOLBAR
  // ============================================================================

  return (
    <div className="floating-toolbar">
      {/* SELECT TOOL (no submenu) */}
      <button
        className={controller.activeTool === 'selectTool' ? 'active' : ''}
        onClick={() => {
          // Select tool just sets active tool, no submenu
          controller.handleToolClick('selectTool', 'tokenpicker', []); // dummy submenu
        }}
      >
        Select
      </button>

      {/* TOKEN TOOL */}
      <ToolButton
        toolId="tokenTool"
        submenuId="tokenpicker"
        items={tokenItems}
        controller={controller}
        label="Token"
      />

      {/* TERRAIN TOOL */}
      <ToolButton
        toolId="terrainTool"
        submenuId="terrainpicker"
        items={terrainItems}
        controller={controller}
        label="Terrain"
      />

      {/* ROOM TOOL */}
      <ToolButton
        toolId="roomTool"
        submenuId="roomtool"
        items={roomItems}
        controller={controller}
        label="Room"
      />

      {/* GRID TOOL */}
      <ToolButton
        toolId="gridTool"
        submenuId="grid"
        items={gridItems}
        controller={controller}
        label="Grid"
      />

      {/* COLOR TOOL */}
      <ToolButton
        toolId="colorTool"
        submenuId="colorpicker"
        items={colorItems}
        controller={controller}
        label="Color"
      />

      {/* SUBMENUS */}
      <SubmenuPanel
        submenuId="tokenpicker"
        items={tokenItems}
        controller={controller}
        title="Select Token"
      />

      <SubmenuPanel
        submenuId="terrainpicker"
        items={terrainItems}
        controller={controller}
        title="Select Terrain"
      />

      <SubmenuPanel
        submenuId="roomtool"
        items={roomItems}
        controller={controller}
        title="Room Shape"
      />

      <SubmenuPanel
        submenuId="grid"
        items={gridItems}
        controller={controller}
        title="Grid Options"
      />

      <SubmenuPanel
        submenuId="colorpicker"
        items={colorItems}
        controller={controller}
        title="Select Color"
      />
    </div>
  );
}

// ============================================================================
// TOOL BUTTON COMPONENT
// ============================================================================

interface ToolButtonProps {
  toolId: ToolId;
  submenuId: SubmenuId;
  items: string[];
  controller: ReturnType<typeof useSubmenuController>;
  label: string;
}

function ToolButton({ toolId, submenuId, items, controller, label }: ToolButtonProps) {
  const isActive = controller.activeTool === toolId;
  const isOpen = controller.isSubmenuOpen(submenuId);
  const selectedItem = controller.getSelectedItemId(submenuId);

  return (
    <button
      className={`tool-button ${isActive ? 'active' : ''} ${isOpen ? 'open' : ''}`}
      onClick={() => controller.handleToolClick(toolId, submenuId, items)}
      onMouseEnter={() => controller.handleTriggerMouseEnter(submenuId)}
      onMouseLeave={() => controller.handleTriggerMouseLeave(submenuId)}
      title={selectedItem ? `${label}: ${selectedItem}` : label}
    >
      {label}
      {selectedItem && <span className="selected-indicator">({selectedItem})</span>}
    </button>
  );
}

// ============================================================================
// SUBMENU PANEL COMPONENT
// ============================================================================

interface SubmenuPanelProps {
  submenuId: SubmenuId;
  items: string[];
  controller: ReturnType<typeof useSubmenuController>;
  title: string;
}

function SubmenuPanel({ submenuId, items, controller, title }: SubmenuPanelProps) {
  const isOpen = controller.isSubmenuOpen(submenuId);
  const selectedItem = controller.getSelectedItemId(submenuId);

  if (!isOpen) return null;

  return (
    <div
      className={`submenu-panel submenu-${submenuId}`}
      onMouseEnter={() => controller.handlePanelMouseEnter(submenuId)}
      onMouseLeave={() => controller.handlePanelMouseLeave(submenuId)}
    >
      <h3>{title}</h3>
      <div className="submenu-items">
        {items.map((itemId) => (
          <button
            key={itemId}
            className={`submenu-item ${selectedItem === itemId ? 'selected' : ''}`}
            onClick={() => controller.selectSubmenuItem(submenuId, itemId)}
          >
            {itemId}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BEHAVIOR SUMMARY
// ============================================================================

/**
 * HOVER BEHAVIOR:
 * - Hover over tool button → opens submenu (openedBy: 'hover')
 * - Does NOT select tool or item
 * - Leaving trigger + panel closes submenu (after 200ms delay)
 * 
 * CLICK BEHAVIOR:
 * - First click → opens submenu (openedBy: 'click')
 *   - Sets activeTool to matching tool
 *   - Selects last-selected item or first item
 * - Second click (same tool) → closes submenu
 *   - Resets activeTool to 'selectTool'
 *   - Remembers lastSelectedItemId for next time
 * - Click different tool → opens that submenu, activates that tool
 * 
 * SHORTCUT BEHAVIOR:
 * - First press (closed) → opens submenu (openedBy: 'shortcut')
 *   - Sets activeTool to matching tool
 *   - Selects last-selected item or first item
 * - Subsequent presses (open + active) → cycles through items
 *   - Tool remains active
 *   - Submenu remains open
 *   - Never closes via shortcut (only click can close)
 * 
 * ITEM SELECTION:
 * - Click item in submenu → selects it
 * - Selection is remembered in submenuSelection state
 * - Next time submenu opens → preselects last-selected item
 */
