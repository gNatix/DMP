import { Maximize2, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== BUTTON CONFIGURATION ==========
export const fitToViewButtonConfig: ToolButtonConfig = {
  id: 'fit-to-view',
  enabled: true,
  category: 'view',
  weight: 4, // After color picker in view category
  
  icon: <Maximize2 size={18} />,
  label: 'Fit to View',
  shortcutKey: 'F',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface FitToViewButtonPropsExtended extends ToolButtonProps {
  onFitToView: () => void;
  fitToViewLocked: boolean;
}

const FitToViewButton = ({ onFitToView, fitToViewLocked }: FitToViewButtonPropsExtended) => {
  // Handle keyboard shortcut from config
  useEffect(() => {
    if (!fitToViewButtonConfig.shortcutKey) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = fitToViewButtonConfig.shortcutKey!.toLowerCase();
      if (e.key.toLowerCase() === key) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          e.preventDefault();
          onFitToView();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onFitToView]);

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={onFitToView}
        onMouseEnter={(e) => {
          const badge = e.currentTarget.parentElement?.querySelector('.fit-to-view-badge') as HTMLElement;
          if (badge) badge.style.display = 'block';
        }}
        onMouseLeave={(e) => {
          const badge = e.currentTarget.parentElement?.querySelector('.fit-to-view-badge') as HTMLElement;
          if (badge) badge.style.display = 'none';
        }}
        className={`p-2.5 rounded transition-colors relative ${
          fitToViewLocked
            ? 'bg-dm-dark border-2 border-red-500 text-gray-300 hover:text-white box-content'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white border-2 border-transparent box-content'
        }`}
      >
        {fitToViewButtonConfig.icon}
        {fitToViewLocked && (
          <Lock size={10} className="absolute top-0.5 right-0.5 text-white opacity-60" />
        )}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{fitToViewButtonConfig.shortcutKey}</span>
      <div
        className="fit-to-view-badge"
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
        {fitToViewButtonConfig.label} ({fitToViewButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default FitToViewButton;
