import { Copy } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const duplicateButtonConfig: ToolButtonConfig = {
  id: 'duplicate',
  enabled: true,
  category: 'layers',
  weight: 1, // First in layers category
  
  icon: <Copy size={18} />,
  label: 'Duplicate',
  shortcutKey: 'Ctrl+D',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface DuplicateButtonPropsExtended extends ToolButtonProps {
  onDuplicate: () => void;
  hasSelection: boolean;
}

const DuplicateButton = ({ onDuplicate, hasSelection }: DuplicateButtonPropsExtended) => {
  // Handle keyboard shortcuts (Ctrl+D and Shift+D)
  useKeyboardShortcut('d', () => {
    if (hasSelection) {
      onDuplicate();
    }
  }, { ctrl: true });
  
  useKeyboardShortcut('D', () => {
    if (hasSelection) {
      onDuplicate();
    }
  });

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.duplicate-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.duplicate-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onDuplicate}
        disabled={!hasSelection}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
      >
        {duplicateButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{duplicateButtonConfig.shortcutKey}</span>
      <div
        className="duplicate-badge"
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
        {duplicateButtonConfig.label} ({duplicateButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default DuplicateButton;
