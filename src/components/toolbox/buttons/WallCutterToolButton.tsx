import { Scissors } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const wallCutterToolButtonConfig: ToolButtonConfig = {
  id: 'wallCutterTool',
  enabled: true,
  enabledInPlanningMode: true,
  enabledInGameMode: false,
  category: 'drawing',
  weight: 5,
  
  icon: <Scissors size={18} />,
  label: 'Wall Cutter',
  shortcutKey: 'A',
  
  buttonType: 'tool',
  highlightStyle: 'full',
  
  tool: 'wallCutterTool',
  hasSubmenu: false,
};
// ==========================================

const WallCutterToolButton = ({
  activeTool,
  setActiveTool,
}: ToolButtonProps) => {
  const isActive = activeTool === wallCutterToolButtonConfig.tool;

  // Keyboard shortcut: A
  useKeyboardShortcut('a', () => {
    setActiveTool('wallCutterTool');
  });

  const handleClick = () => {
    setActiveTool('wallCutterTool');
  };

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
      >
        {wallCutterToolButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{wallCutterToolButtonConfig.shortcutKey}</span>
    </div>
  );
};

export default WallCutterToolButton;
