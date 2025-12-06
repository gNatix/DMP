import { MousePointer } from 'lucide-react';
import { useEffect } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== BUTTON CONFIGURATION ==========
export const pointerButtonConfig: ToolButtonConfig = {
  id: 'pointer',
  enabled: true,
  category: 'selection',
  weight: 1, // First in selection category
  
  icon: <MousePointer size={18} />,
  label: 'Pointer Tool',
  shortcutKey: 'V',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'pointer',
  hasSubmenu: false,
};
// ==========================================

interface PointerButtonPropsExtended extends ToolButtonProps {
  onCloseSubmenu?: (reason?: string) => void;
}

const PointerButton = ({ activeTool, setActiveTool, onCloseSubmenu }: PointerButtonPropsExtended) => {
  const isActive = activeTool === pointerButtonConfig.tool;
  
  const handleClick = () => {
    setActiveTool(pointerButtonConfig.tool!);
    // Close all submenus when switching to pointer tool
    if (onCloseSubmenu) {
      onCloseSubmenu('select-tool');
    }
  };

  // Handle keyboard shortcut from config
  useEffect(() => {
    if (!pointerButtonConfig.shortcutKey) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = pointerButtonConfig.shortcutKey!.toLowerCase();
      if (e.key.toLowerCase() === key) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          e.preventDefault();
          handleClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTool, setActiveTool, onCloseSubmenu]);
  
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
        title={pointerButtonConfig.shortcutKey}
      >
        {pointerButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{pointerButtonConfig.shortcutKey}</span>
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
        {pointerButtonConfig.label} ({pointerButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default PointerButton;
