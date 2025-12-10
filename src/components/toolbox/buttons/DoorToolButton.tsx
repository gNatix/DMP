import { DoorOpen } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import DoorToolSubmenu from '../submenus/DoorToolSubmenu';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const doorToolButtonConfig: ToolButtonConfig = {
  id: 'doorTool',
  enabled: true,
  enabledInPlanningMode: true,
  enabledInGameMode: false,
  category: 'drawing',
  weight: 4, // After terrain in drawing category
  
  icon: <DoorOpen size={18} />,
  label: 'Door Tool',
  shortcutKey: 'D',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'doorTool',
  hasSubmenu: true,
};
// ==========================================

interface DoorToolButtonPropsExtended extends ToolButtonProps {
  doorToolMode: 'freehand' | 'rectangle';
  setDoorToolMode: (mode: 'freehand' | 'rectangle') => void;
  doorToolBrushSize: number;
  setDoorToolBrushSize: (size: number) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
}

const DoorToolButton = ({
  activeTool,
  setActiveTool,
  doorToolMode,
  setDoorToolMode,
  doorToolBrushSize,
  setDoorToolBrushSize,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
}: DoorToolButtonPropsExtended) => {
  const isActive = activeTool === doorToolButtonConfig.tool;
  const doorToolButtonRef = useRef<HTMLButtonElement>(null);
  const isSubmenuOpen = openSubmenuId === 'doorTool';

  // Keyboard shortcut: D
  useKeyboardShortcut('d', () => {
    setActiveTool('doorTool');
  });

  // Keyboard shortcut: Shift+D to toggle submenu
  useKeyboardShortcut('D', () => {
    if (isSubmenuOpen) {
      onOpenSubmenu(null, 'shortcut');
    } else {
      onOpenSubmenu('doorTool', 'shortcut');
      setActiveTool('doorTool');
    }
  });

  const handleClick = () => {
    if (isSubmenuOpen) {
      onOpenSubmenu(null, 'click');
    } else {
      setActiveTool('doorTool');
      onOpenSubmenu('doorTool', 'click');
    }
  };

  const handleMouseEnter = () => {
    onToolboxButtonMouseEnter('doorTool');
  };

  const handleMouseLeave = () => {
    onToolboxButtonMouseLeave('doorTool');
  };

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={doorToolButtonRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
      >
        {doorToolButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{doorToolButtonConfig.shortcutKey}</span>

      {/* Submenu */}
      {isSubmenuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            zIndex: 100
          }}
          onMouseEnter={() => onSubmenuMouseEnter('doorTool')}
          onMouseLeave={() => onSubmenuMouseLeave('doorTool')}
        >
          <DoorToolSubmenu
            doorToolMode={doorToolMode}
            setDoorToolMode={setDoorToolMode}
            doorToolBrushSize={doorToolBrushSize}
            setDoorToolBrushSize={setDoorToolBrushSize}
            setActiveTool={setActiveTool}
            onMouseLeave={() => {
              if (submenuOpenedBy === 'hover') {
                onOpenSubmenu(null, 'hover');
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DoorToolButton;
