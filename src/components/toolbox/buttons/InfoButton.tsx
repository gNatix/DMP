import { Info } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const infoButtonConfig: ToolButtonConfig = {
  id: 'info',
  enabled: true,
  enabledInGameMode: true, // Show in game mode
  enabledInPlanningMode: true, // Show in planning mode
  category: 'toggle',
  weight: 5,
  
  icon: <Info size={18} />,
  label: 'Toggle Info Panel',
  shortcutKey: 'I',
  
  buttonType: 'toggle',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'border',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface InfoButtonPropsExtended extends ToolButtonProps {
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
}

const InfoButton = ({
  isLeftPanelOpen,
  onToggleLeftPanel
}: InfoButtonPropsExtended) => {
  // Handle keyboard shortcut
  useKeyboardShortcut('i', () => {
    onToggleLeftPanel();
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={onToggleLeftPanel}
        className={`p-2.5 rounded transition-colors ${
          isLeftPanelOpen
            ? infoButtonConfig.highlightStyle === 'border'
              ? 'bg-dm-dark text-white border-dm-highlight'
              : 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        } border-2 ${isLeftPanelOpen && infoButtonConfig.highlightStyle === 'border' ? 'border-dm-highlight' : 'border-transparent'} box-content`}
      >
        {infoButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{infoButtonConfig.shortcutKey}</span>
    </div>
  );
};

export default InfoButton;
