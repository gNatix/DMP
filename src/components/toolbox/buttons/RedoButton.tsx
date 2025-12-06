import { Redo } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const redoButtonConfig: ToolButtonConfig = {
  id: 'redo',
  enabled: true,
  category: 'history',
  weight: 2, // After undo in history category
  
  icon: <Redo size={18} />,
  label: 'Redo',
  shortcutKey: 'Ctrl+Y',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface RedoButtonPropsExtended extends ToolButtonProps {
  onRedo: () => void;
  canRedo: boolean;
}

const RedoButton = ({ onRedo, canRedo }: RedoButtonPropsExtended) => {
  // Handle keyboard shortcut (Ctrl+Y)
  useKeyboardShortcut('y', () => {
    if (canRedo) {
      onRedo();
    }
  }, { ctrl: true });

  return (
    <div 
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.redo-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.redo-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
      >
        {redoButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{redoButtonConfig.shortcutKey}</span>
      <div 
        className="redo-badge"
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
        {redoButtonConfig.label} ({redoButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default RedoButton;
