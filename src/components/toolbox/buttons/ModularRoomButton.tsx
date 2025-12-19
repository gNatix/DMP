import { Boxes } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const modularRoomButtonConfig: ToolButtonConfig = {
  id: 'modularRoom',
  enabled: true,
  category: 'drawing',
  weight: 5, // After room in drawing category
  
  icon: <Boxes size={18} />,
  label: 'Modular Rooms',
  shortcutKey: 'M',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'modularRoom',
  hasSubmenu: false, // No submenu needed - we use the Modules tab in RightPanel
};
// ==========================================

interface ModularRoomButtonProps extends ToolButtonProps {
  onSwitchToModulesTab?: () => void;
}

const ModularRoomButton = ({
  activeTool,
  setActiveTool,
  onSwitchToModulesTab,
}: ModularRoomButtonProps) => {
  const isActive = activeTool === modularRoomButtonConfig.tool;

  // Register keyboard shortcut
  useKeyboardShortcut(
    modularRoomButtonConfig.shortcutKey!,
    () => {
      setActiveTool(modularRoomButtonConfig.tool!);
      if (onSwitchToModulesTab) onSwitchToModulesTab();
    },
    { 
      preventDefault: true
    }
  );

  const handleClick = () => {
    setActiveTool(modularRoomButtonConfig.tool!);
    if (onSwitchToModulesTab) onSwitchToModulesTab();
  };

  return (
    <div className="relative group flex flex-col items-center">
      <button
        onClick={handleClick}
        className={`p-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-gradient-to-b from-purple-400 to-purple-600 text-white shadow-md shadow-purple-500/30'
            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
        }`}
        title={`${modularRoomButtonConfig.label} (${modularRoomButtonConfig.shortcutKey})`}
      >
        {modularRoomButtonConfig.icon}
      </button>
      
      {/* Keyboard shortcut label */}
      <span className="text-[9px] text-gray-500 mt-0.5 font-mono">
        {modularRoomButtonConfig.shortcutKey}
      </span>
    </div>
  );
};

export default ModularRoomButton;
