import { Group, Ungroup } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const groupButtonConfig: ToolButtonConfig = {
  id: 'group',
  enabled: true,
  category: 'toggle',
  weight: 2,  // After lock button
  
  icon: <Group size={18} />,
  label: 'Group/Ungroup',
  shortcutKey: 'Ctrl+G',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface GroupButtonPropsExtended extends ToolButtonProps {
  onToggleGroup: () => void;
  hasMultipleSelection: boolean;
  isGrouped: boolean;  // True if selected elements are all in the same group
}

const GroupButton = ({ onToggleGroup, hasMultipleSelection, isGrouped }: GroupButtonPropsExtended) => {
  // Handle keyboard shortcuts (Ctrl+G) - handled in Canvas.tsx
  // But we still register it here for the tooltip
  useKeyboardShortcut('g', () => {
    onToggleGroup();
  }, { ctrl: true });

  const canInteract = hasMultipleSelection || isGrouped;

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.group-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.group-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onToggleGroup}
        disabled={!canInteract}
        className={`p-2.5 rounded transition-colors ${
          isGrouped 
            ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400' 
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        } disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark`}
        title={isGrouped ? "Ungroup selected elements (Ctrl+G)" : "Group selected elements (Ctrl+G)"}
      >
        {isGrouped ? <Ungroup size={18} /> : <Group size={18} />}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{groupButtonConfig.shortcutKey}</span>
      {/* Tooltip badge */}
      <div
        className="group-badge"
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
        {isGrouped ? 'Ungroup' : 'Group'} ({groupButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default GroupButton;
