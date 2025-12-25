import { ZoomIn, ZoomOut } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const zoomButtonConfig: ToolButtonConfig = {
  id: 'zoom',
  enabled: true,
  enabledInGameMode: true,
  category: 'navigation',
  weight: 2, // After pan in navigation category
  
  icon: <ZoomIn size={18} />,
  label: 'Zoom Tool',
  shortcutKey: 'Z',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'zoom-in',
  hasSubmenu: false,
};
// ==========================================

interface ZoomButtonPropsExtended extends ToolButtonProps {
  isAltPressed: boolean;
  customKeybind?: string;
}

const ZoomButton = ({ activeTool, setActiveTool, isAltPressed, customKeybind }: ZoomButtonPropsExtended) => {
  const isActive = activeTool === 'zoom-in' || activeTool === 'zoom-out';
  const effectiveKeybind = customKeybind || zoomButtonConfig.shortcutKey || 'Z';

  const handleClick = () => setActiveTool(zoomButtonConfig.tool!);
  
  // Handle keyboard shortcut
  useKeyboardShortcut(effectiveKeybind.toLowerCase(), handleClick);

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={() => setActiveTool('zoom-in')}
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
        title={effectiveKeybind}
      >
        {isAltPressed && isActive ? (
          <ZoomOut size={18} />
        ) : (
          <ZoomIn size={18} />
        )}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{effectiveKeybind}</span>
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
        {zoomButtonConfig.label} ({zoomButtonConfig.shortcutKey}) - Alt+Click to Zoom Out
      </div>
    </div>
  );
};

export default ZoomButton;
