import { Tag } from 'lucide-react';
import { useEffect } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== BUTTON CONFIGURATION ==========
export const badgeToggleButtonConfig: ToolButtonConfig = {
  id: 'badge-toggle',
  enabled: true,
  category: 'utilities',
  weight: 2, // First in utilities category
  
  icon: <Tag size={18} />,
  label: 'Toggle Badges',
  shortcutKey: 'N',
  
  buttonType: 'toggle',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'border',     // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface BadgeToggleButtonPropsExtended extends ToolButtonProps {
  onToggleBadges: () => void;
  showTokenBadges: boolean;
  selectedTokenHasBadge: boolean;
  hasSelection: boolean;
}

const BadgeToggleButton = ({
  onToggleBadges,
  showTokenBadges,
  selectedTokenHasBadge,
  hasSelection
}: BadgeToggleButtonPropsExtended) => {
  // Handle keyboard shortcut from config
  useEffect(() => {
    if (!badgeToggleButtonConfig.shortcutKey) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = badgeToggleButtonConfig.shortcutKey!.toLowerCase();
      if (e.key.toLowerCase() === key) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          
          e.preventDefault();
          onToggleBadges();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onToggleBadges]);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.badge-toggle-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.badge-toggle-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={onToggleBadges}
        className={`p-2.5 rounded transition-colors ${
          showTokenBadges
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        } ${
          selectedTokenHasBadge && hasSelection
            ? 'border-2 border-yellow-500 box-content'
            : 'border-2 border-transparent box-content'
        }`}
      >
        {badgeToggleButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{badgeToggleButtonConfig.shortcutKey}</span>
      <div
        className="badge-toggle-badge"
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
        {badgeToggleButtonConfig.label} ({badgeToggleButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default BadgeToggleButton;
