import { Stamp } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { TokenTemplate } from '../../../types';
import TokenPickerSubmenu from '../submenus/TokenPickerSubmenu';

// ========== BUTTON CONFIGURATION ==========
export const tokenButtonConfig: ToolButtonConfig = {
  id: 'token',
  enabled: true,
  category: 'drawing',
  weight: 1, // First in drawing category
  
  icon: <Stamp size={18} />,
  label: 'Token Tool',
  shortcutKey: 'Q',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'token',
  hasSubmenu: true,
};
// ==========================================

interface TokenButtonPropsExtended extends ToolButtonProps {
  tokenTemplates: TokenTemplate[];
  activeTokenTemplate: TokenTemplate | null;
  onSelectToken: (token: TokenTemplate) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
  // Cycling functions
  cycleToken: () => void;
  selectLastUsedToken: () => void;
  // Tab switch callback
  onSwitchToTokensTab?: () => void;
  customKeybind?: string;
}

const TokenButton = ({ 
  activeTool, 
  setActiveTool,
  tokenTemplates,
  activeTokenTemplate,
  onSelectToken,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
  cycleToken,
  selectLastUsedToken,
  onSwitchToTokensTab,
  customKeybind
}: TokenButtonPropsExtended) => {
  const isActive = activeTool === tokenButtonConfig.tool;
  const tokenButtonRef = useRef<HTMLButtonElement>(null);
  const isSubmenuOpen = openSubmenuId === 'token';
  const effectiveKeybind = customKeybind || tokenButtonConfig.shortcutKey || 'Q';

  // Scroll handler for cycling through tokens on wheel
  const handleTokenScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentIndex = activeTokenTemplate 
      ? tokenTemplates.findIndex((t: TokenTemplate) => t.id === activeTokenTemplate.id)
      : -1;
    
    let newIndex;
    if (e.deltaY > 0) {
      // Scroll down = go backward in list
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = tokenTemplates.length - 1;
    } else {
      // Scroll up = go forward in list
      newIndex = currentIndex + 1;
      if (newIndex >= tokenTemplates.length) newIndex = 0;
    }
    
    if (newIndex >= 0 && newIndex < tokenTemplates.length) {
      onSelectToken(tokenTemplates[newIndex]);
      setActiveTool(tokenButtonConfig.tool!);
    }
  };

  // Wrap token selection to also activate the tool
  const handleSelectToken = (token: TokenTemplate) => {
    onSelectToken(token);
    setActiveTool(tokenButtonConfig.tool!);
  };

  // Handle token button click
  const handleClick = () => {
    setActiveTool(tokenButtonConfig.tool!);
    
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('token', 'click'); // Open (or switch from hover/shortcut to click)
    }
    // Always switch to tokens tab
    if (onSwitchToTokensTab) onSwitchToTokensTab();
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('q', () => {
    // If already on token tool and submenu is open via shortcut, cycle to next token
    if (activeTool === 'token' && isSubmenuOpen && submenuOpenedBy === 'shortcut' && tokenTemplates.length > 0) {
      cycleToken();
    } else {
      // Switch to token tool and open submenu
      setActiveTool(tokenButtonConfig.tool!);
      selectLastUsedToken();
      onOpenSubmenu('token', 'shortcut');
    }
    // Always switch to tokens tab (even if tool was already active)
    if (onSwitchToTokensTab) onSwitchToTokensTab();
  });
  
  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={tokenButtonRef}
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('token')}
        onMouseLeave={() => onToolboxButtonMouseLeave('token')}
        onWheel={handleTokenScroll}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={`${tokenButtonConfig.label} (${tokenButtonConfig.shortcutKey})`}
      >
        {tokenButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{effectiveKeybind}</span>

      {/* Token Submenu */}
      {isSubmenuOpen && tokenTemplates.length > 0 && (
        <div
          data-submenu-id="token"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('token')}
          onMouseLeave={() => onSubmenuMouseLeave('token')}
          onWheel={handleTokenScroll}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
        >
          <TokenPickerSubmenu
            tokens={tokenTemplates}
            onSelectToken={handleSelectToken}
            activeTokenId={activeTokenTemplate?.id}
          />
        </div>
      )}
    </div>
  );
};

export default TokenButton;
