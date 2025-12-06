import { Minus } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import WallPickerSubmenu from '../submenus/WallPickerSubmenu';

// ========== BUTTON CONFIGURATION ==========
export const wallButtonConfig: ToolButtonConfig = {
  id: 'wall',
  enabled: true,
  category: 'drawing',
  weight: 2, // After room in drawing category
  
  icon: <Minus size={18} />,
  label: 'Draw Walls',
  shortcutKey: 'W',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'wall',
  hasSubmenu: true,
};
// ==========================================

interface WallButtonPropsExtended extends ToolButtonProps {
  wallTextures: { name: string; download_url: string }[];
  selectedWallTexture: string | null;
  onSelectWallTexture: (url: string) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
  // Cycling functions
  cycleWall: () => void;
  selectLastUsedWall: () => void;
}

const WallButton = ({
  activeTool,
  setActiveTool,
  wallTextures,
  selectedWallTexture,
  onSelectWallTexture,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
  cycleWall,
  selectLastUsedWall
}: WallButtonPropsExtended) => {
  const isActive = activeTool === wallButtonConfig.tool;
  const wallButtonRef = useRef<HTMLButtonElement>(null);
  const isSubmenuOpen = openSubmenuId === 'wall';

  // Scroll handler for cycling through wall textures on wheel
  const handleWallScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentIndex = selectedWallTexture 
      ? wallTextures.findIndex(b => b.download_url === selectedWallTexture)
      : -1;
    
    let newIndex;
    if (e.deltaY > 0) {
      // Scroll down = go backward in list
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = wallTextures.length - 1;
    } else {
      // Scroll up = go forward in list
      newIndex = currentIndex + 1;
      if (newIndex >= wallTextures.length) newIndex = 0;
    }
    
    if (newIndex >= 0 && newIndex < wallTextures.length) {
      onSelectWallTexture(wallTextures[newIndex].download_url);
      setActiveTool(wallButtonConfig.tool!);
    }
  };

  // Wrap wall selection to also activate the tool
  const handleSelectWall = (url: string) => {
    onSelectWallTexture(url);
    setActiveTool(wallButtonConfig.tool!);
  };

  // Handle wall button click
  const handleClick = () => {
    setActiveTool(wallButtonConfig.tool!);
    
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('wall', 'click'); // Open (or switch from hover/shortcut to click)
    }
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('w', () => {
    // If already on wall tool and submenu is open via shortcut, cycle to next texture
    if (activeTool === 'wall' && isSubmenuOpen && submenuOpenedBy === 'shortcut' && wallTextures.length > 0) {
      cycleWall();
    } else {
      // Switch to wall tool and open submenu
      setActiveTool(wallButtonConfig.tool!);
      selectLastUsedWall();
      onOpenSubmenu('wall', 'shortcut');
    }
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={wallButtonRef}
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('wall')}
        onMouseLeave={() => onToolboxButtonMouseLeave('wall')}
        onWheel={handleWallScroll}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-orange-500 text-white'
            : 'bg-dm-dark text-gray-400 hover:bg-dm-border hover:text-white'
        }`}
        title={`${wallButtonConfig.label} (${wallButtonConfig.shortcutKey})`}
      >
        {wallButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{wallButtonConfig.shortcutKey}</span>

      {/* Wall Texture Submenu */}
      {isSubmenuOpen && wallTextures && wallTextures.length > 0 && (
        <div
          data-submenu-id="wall"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('wall')}
          onMouseLeave={() => onSubmenuMouseLeave('wall')}
          onWheel={handleWallScroll}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
        >
          <WallPickerSubmenu
            textures={wallTextures}
            onSelectTexture={handleSelectWall}
            activeTextureUrl={selectedWallTexture}
          />
        </div>
      )}
    </div>
  );
};

export default WallButton;
