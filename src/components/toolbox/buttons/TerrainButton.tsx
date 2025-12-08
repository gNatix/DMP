import { Mountain } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import TerrainPickerSubmenu from '../submenus/TerrainPickerSubmenu';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const terrainButtonConfig: ToolButtonConfig = {
  id: 'terrain',
  enabled: true,
  category: 'drawing',
  weight: 3, // After token in drawing category
  
  icon: <Mountain size={18} />,
  label: 'Paint Environment',
  shortcutKey: 'E',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'background',
  hasSubmenu: true,
};
// ==========================================

interface TerrainButtonPropsExtended extends ToolButtonProps {
  terrainBrushes: { name: string; download_url: string }[];
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  onSwitchToDrawTab?: () => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
  // Cycling functions
  cycleTerrain: () => void;
  selectLastUsedTerrain: () => void;
}

const TerrainButton = ({
  activeTool,
  setActiveTool,
  terrainBrushes,
  selectedTerrainBrush,
  onSelectTerrainBrush,
  onSwitchToDrawTab,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
  cycleTerrain,
  selectLastUsedTerrain
}: TerrainButtonPropsExtended) => {
  const isActive = activeTool === terrainButtonConfig.tool;
  const terrainButtonRef = useRef<HTMLButtonElement>(null);
  const isSubmenuOpen = openSubmenuId === 'terrain';

  // Scroll handler for cycling through terrain brushes on wheel
  const handleTerrainScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentIndex = selectedTerrainBrush 
      ? terrainBrushes.findIndex(b => b.download_url === selectedTerrainBrush)
      : -1;
    
    let newIndex;
    if (e.deltaY > 0) {
      // Scroll down = go backward in list
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = terrainBrushes.length - 1;
    } else {
      // Scroll up = go forward in list
      newIndex = currentIndex + 1;
      if (newIndex >= terrainBrushes.length) newIndex = 0;
    }
    
    if (newIndex >= 0 && newIndex < terrainBrushes.length) {
      onSelectTerrainBrush(terrainBrushes[newIndex].download_url);
      setActiveTool(terrainButtonConfig.tool!);
    }
  };

  // Wrap terrain selection to also activate the tool
  const handleSelectTerrain = (url: string) => {
    onSelectTerrainBrush(url);
    setActiveTool(terrainButtonConfig.tool!);
  };

  // Handle terrain button click
  const handleClick = () => {
    setActiveTool(terrainButtonConfig.tool!);
    if (onSwitchToDrawTab) onSwitchToDrawTab();
    
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('terrain', 'click'); // Open (or switch from hover/shortcut to click)
    }
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('e', () => {
    // If already on background tool and submenu is open via shortcut, cycle to next brush
    if (activeTool === 'background' && isSubmenuOpen && submenuOpenedBy === 'shortcut' && terrainBrushes.length > 0) {
      cycleTerrain();
    } else {
      // Switch to background tool and open submenu
      setActiveTool(terrainButtonConfig.tool!);
      if (onSwitchToDrawTab) onSwitchToDrawTab();
      selectLastUsedTerrain();
      onOpenSubmenu('terrain', 'shortcut');
    }
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={terrainButtonRef}
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('terrain')}
        onMouseLeave={() => onToolboxButtonMouseLeave('terrain')}
        onWheel={handleTerrainScroll}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-green-600 text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={`${terrainButtonConfig.label} (${terrainButtonConfig.shortcutKey})`}
      >
        {terrainButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{terrainButtonConfig.shortcutKey}</span>

      {/* Terrain Brush Submenu */}
      {isSubmenuOpen && terrainBrushes && terrainBrushes.length > 0 && (
        <div
          data-submenu-id="terrain"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('terrain')}
          onMouseLeave={() => onSubmenuMouseLeave('terrain')}
          onWheel={handleTerrainScroll}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
        >
          <TerrainPickerSubmenu
            brushes={terrainBrushes}
            onSelectBrush={handleSelectTerrain}
            activeBrushUrl={selectedTerrainBrush}
          />
        </div>
      )}
    </div>
  );
};

export default TerrainButton;
