import { Grid3x3 } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import GridControlsSubmenu from '../submenus/GridControlsSubmenu';

// ========== BUTTON CONFIGURATION ==========
export const gridButtonConfig: ToolButtonConfig = {
  id: 'grid',
  enabled: true,
  enabledInGameMode: true, // Show in game mode
  enabledInPlanningMode: true, // Show in planning mode
  category: 'toggle',
  weight: 3, // First in view category
  
  icon: <Grid3x3 size={18} />,
  label: 'Toggle Grid',
  shortcutKey: 'G',
  
  buttonType: 'toggle',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'border',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: true,
};
// ==========================================

interface GridButtonPropsExtended extends ToolButtonProps {
  showGrid: boolean;
  gridSize: number;
  onToggleGrid: () => void;
  onGridSizeChange: (size: number) => void;
  handleGridScroll: (e: React.WheelEvent) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onCloseSubmenu: (reason?: string) => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
}

const GridButton = ({
  showGrid,
  gridSize,
  onToggleGrid,
  onGridSizeChange,
  handleGridScroll,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave
}: GridButtonPropsExtended) => {
  const gridButtonRef = useRef<HTMLButtonElement>(null);

  const isSubmenuOpen = openSubmenuId === 'grid';

  // Handle grid button click
  const handleClick = () => {
    onToggleGrid(); // Toggle grid visibility
    
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('grid', 'click'); // Open (or switch from hover/shortcut to click)
    }
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('g', handleClick);

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={gridButtonRef}
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('grid')}
        onMouseLeave={() => onToolboxButtonMouseLeave('grid')}
        onWheel={handleGridScroll}
        className={`p-2.5 rounded transition-colors ${
          showGrid
            ? gridButtonConfig.highlightStyle === 'border'
              ? 'bg-dm-dark text-white border-dm-highlight'
              : 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        } border-2 ${showGrid && gridButtonConfig.highlightStyle === 'border' ? 'border-dm-highlight' : 'border-transparent'} box-content`}
        title={gridButtonConfig.label}
      >
        {gridButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{gridButtonConfig.shortcutKey}</span>

      {/* Grid Controls Submenu */}
      {isSubmenuOpen && (
        <div
          data-submenu-id="grid"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy || 'null'}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('grid')}
          onMouseLeave={() => onSubmenuMouseLeave('grid')}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
        >
          <GridControlsSubmenu
            gridSize={gridSize}
            onGridSizeChange={onGridSizeChange}
            onWheel={handleGridScroll}
          />
        </div>
      )}
    </div>
  );
};

export default GridButton;
