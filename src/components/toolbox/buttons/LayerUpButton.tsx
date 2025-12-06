import { ChevronUp } from 'lucide-react';
import { useEffect } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== BUTTON CONFIGURATION ==========
export const layerUpButtonConfig: ToolButtonConfig = {
  id: 'layer-up',
  enabled: true,
  category: 'layers',
  weight: 3, // After delete in layers category
  
  icon: <ChevronUp size={18} />,
  label: 'Move Layer Up',
  shortcutKey: ']',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface LayerUpButtonPropsExtended extends ToolButtonProps {
  onLayerUp: () => void;
  hasSelection: boolean;
}

const LayerUpButton = ({ onLayerUp, hasSelection }: LayerUpButtonPropsExtended) => {
  // Handle keyboard shortcut from config
  useEffect(() => {
    if (!layerUpButtonConfig.shortcutKey) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = layerUpButtonConfig.shortcutKey!;
      if (e.key === key) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          if (hasSelection) {
            e.preventDefault();
            onLayerUp();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onLayerUp, hasSelection]);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.layerup-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.layerup-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onLayerUp}
        disabled={!hasSelection}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
      >
        {layerUpButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{layerUpButtonConfig.shortcutKey}</span>
      <div
        className="layerup-badge"
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
        {layerUpButtonConfig.label} ({layerUpButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default LayerUpButton;
