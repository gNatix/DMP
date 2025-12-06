import { Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== BUTTON CONFIGURATION ==========
export const deleteButtonConfig: ToolButtonConfig = {
  id: 'delete',
  enabled: true,
  category: 'layers',
  weight: 2, // After duplicate in layers category
  
  icon: <Trash2 size={18} />,
  label: 'Delete',
  shortcutKey: 'Del',
  
  buttonType: 'action',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface DeleteButtonPropsExtended extends ToolButtonProps {
  onDelete: () => void;
  hasSelection: boolean;
}

const DeleteButton = ({ onDelete, hasSelection }: DeleteButtonPropsExtended) => {
  // Handle keyboard shortcut from config
  useEffect(() => {
    if (!deleteButtonConfig.shortcutKey) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = deleteButtonConfig.shortcutKey!;
      // Special handling for Delete key
      if (key === 'Del' && e.key === 'Delete') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          if (hasSelection) {
            e.preventDefault();
            onDelete();
          }
        }
      } else if (e.key.toLowerCase() === key.toLowerCase()) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          if (hasSelection) {
            e.preventDefault();
            onDelete();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onDelete, hasSelection]);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.delete-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.delete-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark disabled:hover:text-red-400"
      >
        {deleteButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{deleteButtonConfig.shortcutKey}</span>
      <div
        className="delete-badge"
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
        {deleteButtonConfig.label} ({deleteButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default DeleteButton;
