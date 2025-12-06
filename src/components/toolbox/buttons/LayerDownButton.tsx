import { ChevronsDown } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const layerDownButtonConfig: ToolButtonConfig = {
  id: 'layer-down',
  enabled: true,
  category: 'layers',
  weight: 4, // After layer-up in layers category
  
  icon: <ChevronsDown size={18} />,
  label: 'Move Layer Down',
  shortcutKey: '[',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface LayerDownButtonPropsExtended extends ToolButtonProps {
  onLayerDown: () => void;
  hasSelection: boolean;
}

const LayerDownButton = ({ onLayerDown, hasSelection }: LayerDownButtonPropsExtended) => {
  // Handle keyboard shortcut
  useKeyboardShortcut('[', () => {
    if (hasSelection) {
      onLayerDown();
    }
  });

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.layerdown-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.layerdown-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onLayerDown}
        disabled={!hasSelection}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
      >
        {layerDownButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{layerDownButtonConfig.shortcutKey}</span>
      <div
        className="layerdown-badge"
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
        {layerDownButtonConfig.label} ({layerDownButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default LayerDownButton;
