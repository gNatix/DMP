import { ToolType } from '../../../types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { Beaker } from 'lucide-react';
import type { ToolButtonConfig } from './types';

// ============================================================
// X-LAB BUTTON CONFIGURATION
// ============================================================
export const xLabButtonConfig: ToolButtonConfig = {
  id: 'xlab',
  label: 'X-Lab',
  icon: Beaker as any,
  tool: 'xlab' as ToolType,
  category: 'utilities',
  weight: 100,
  shortcutKey: 'X',
  enabled: false,
  buttonType: 'tool',
  highlightStyle: 'full',
  hasSubmenu: false
};

interface XLabButtonProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onSwitchToXLab?: () => void;
}

export default function XLabButton({ 
  activeTool, 
  setActiveTool,
  onSwitchToXLab
}: XLabButtonProps) {
  const isActive = activeTool === xLabButtonConfig.tool;

  const handleClick = () => {
    setActiveTool(xLabButtonConfig.tool!);
    if (onSwitchToXLab) onSwitchToXLab();
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('x', () => {
    setActiveTool(xLabButtonConfig.tool!);
    if (onSwitchToXLab) onSwitchToXLab();
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center transition-all
          ${isActive 
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50' 
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }
        `}
        title={`${xLabButtonConfig.label} (${xLabButtonConfig.shortcutKey})`}
        aria-label={xLabButtonConfig.label}
      >
        <Beaker size={20} />
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{xLabButtonConfig.shortcutKey}</span>
    </div>
  );
}
