import { Tag } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const badgeToggleButtonConfig: ToolButtonConfig = {
  id: 'badge-toggle',
  enabled: true,
  enabledInGameMode: true, // Show in game mode
  enabledInPlanningMode: true, // Show in planning mode
  category: 'toggle',
  weight: 2, // In toggle category
  
  icon: <Tag size={18} />,
  label: 'Name Badges',
  shortcutKey: 'N',
  
  buttonType: 'toggle',         // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: false,
};
// ==========================================

interface BadgeToggleButtonPropsExtended extends ToolButtonProps {
  onToggleBadges: () => void;
  showTokenBadges: boolean;
  selectedTokenHasBadge?: boolean;
  hasSelection?: boolean;
}

const BadgeToggleButton = ({
  onToggleBadges,
  showTokenBadges,
}: BadgeToggleButtonPropsExtended) => {
  // Handle keyboard shortcut - always works (global toggle)
  useKeyboardShortcut('n', () => {
    onToggleBadges();
  });

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
        className={`p-2.5 rounded transition-colors border-2 border-transparent box-content ${
          showTokenBadges
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={showTokenBadges ? 'Hide all name badges (N)' : 'Show all name badges (N)'}
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
        {showTokenBadges ? 'Hide' : 'Show'} Name Badges ({badgeToggleButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default BadgeToggleButton;
