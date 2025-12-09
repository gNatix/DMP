import { Hand } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const panButtonConfig: ToolButtonConfig = {
  id: 'pan',
  enabled: true,
  enabledInGameMode: true,
  category: 'navigation',
  weight: 1, // First in navigation category
  
  icon: <Hand size={18} />,
  label: 'Pan Tool',
  shortcutKey: 'H',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'pan',
  hasSubmenu: false,
};
// ==========================================

const PanButton = ({ activeTool, setActiveTool }: ToolButtonProps) => {
  const isActive = activeTool === panButtonConfig.tool;

  const handleClick = () => setActiveTool(panButtonConfig.tool!);
  
  // Handle keyboard shortcut
  useKeyboardShortcut('h', handleClick);

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        onMouseEnter={(e) => {
          const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
          if (badge) badge.style.display = 'block';
        }}
        onMouseLeave={(e) => {
          const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
          if (badge) badge.style.display = 'none';
        }}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={panButtonConfig.shortcutKey}
      >
        {panButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{panButtonConfig.shortcutKey}</span>
      <div
        className="badge-tooltip"
        style={{
          display: 'none',
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '20px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '12px',
          color: '#9ca3af',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}
      >
        {panButtonConfig.label} ({panButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default PanButton;
