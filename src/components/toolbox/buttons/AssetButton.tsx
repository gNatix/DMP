import { Package } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const assetButtonConfig: ToolButtonConfig = {
  id: 'asset',
  enabled: true,
  category: 'drawing',
  weight: 2, // After token in drawing category
  
  icon: <Package size={18} />,
  label: 'Asset Tool',
  shortcutKey: 'A',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'asset',
  hasSubmenu: false, // Assets are selected from right panel, not submenu
  required: true,               // Drawing tools are essential
};
// ==========================================

interface AssetButtonPropsExtended extends ToolButtonProps {
  // Tab switch callback
  onSwitchToAssetsTab?: () => void;
  customKeybind?: string;
}

const AssetButton = ({ 
  activeTool, 
  setActiveTool,
  onSwitchToAssetsTab,
  customKeybind
}: AssetButtonPropsExtended) => {
  const isActive = activeTool === assetButtonConfig.tool;
  const assetButtonRef = useRef<HTMLButtonElement>(null);
  const effectiveKeybind = customKeybind || assetButtonConfig.shortcutKey || 'A';

  // Handle asset button click
  const handleClick = () => {
    setActiveTool(assetButtonConfig.tool!);
    // Always switch to assets tab
    if (onSwitchToAssetsTab) onSwitchToAssetsTab();
  };

  // Handle keyboard shortcut
  useKeyboardShortcut(effectiveKeybind.toLowerCase(), () => {
    setActiveTool(assetButtonConfig.tool!);
    // Always switch to assets tab
    if (onSwitchToAssetsTab) onSwitchToAssetsTab();
  });
  
  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={assetButtonRef}
        onClick={handleClick}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={`${assetButtonConfig.label} (${effectiveKeybind})`}
      >
        {assetButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{effectiveKeybind}</span>
    </div>
  );
};

export default AssetButton;
