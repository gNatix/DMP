import { Paintbrush } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { ColorType } from '../../../types';
import ColorPickerSubmenu from '../submenus/ColorPickerSubmenu';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const colorPickerButtonConfig: ToolButtonConfig = {
  id: 'color-picker',
  enabled: true,
  enabledInGameMode: true,
  category: 'utilities',
  weight: 3, // After lock in utilities category
  
  icon: <Paintbrush size={18} />,
  label: 'Color Picker',
  shortcutKey: 'C',
  
  buttonType: 'submenu',        // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: null,         // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  hasSubmenu: true,
};
// ==========================================

interface ColorPickerButtonPropsExtended extends ToolButtonProps {
  selectedColor: ColorType;
  colorMap: Record<ColorType, string>;
  hasSelection: boolean;
  onColorChange: (color: ColorType) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onCloseSubmenu: (reason?: string) => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
  // Cycling functions
  cycleColor: () => void;
  selectLastUsedColor: () => void;
}

const ColorPickerButton = ({
  selectedColor,
  colorMap,
  hasSelection,
  onColorChange,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onCloseSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
  cycleColor,
  selectLastUsedColor
}: ColorPickerButtonPropsExtended) => {
  const isSubmenuOpen = openSubmenuId === 'color';

  // Scroll handler for cycling through colors on wheel (uses same array as cycleColor)
  const handleColorScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const colors: ColorType[] = [
      'red', 'blue', 'yellow', 'purple', 'orange', 'pink', 
      'brown', 'gray', 'black', 'white', 'cyan', 'magenta', 
      'lime', 'indigo', 'teal', 'green'
    ];
    const currentIndex = colors.indexOf(selectedColor);
    
    let newIndex;
    if (e.deltaY > 0) {
      // Scroll down = go backward in list
      newIndex = (currentIndex - 1 + colors.length) % colors.length;
    } else {
      // Scroll up = go forward in list
      newIndex = (currentIndex + 1) % colors.length;
    }
    
    onColorChange(colors[newIndex]);
    // Apply color to selected element(s) immediately
    if (hasSelection) {
      const event = new CustomEvent('applyColorToSelection', { detail: { color: colors[newIndex] } });
      window.dispatchEvent(event);
    }
  };

  // Color select handler
  const handleColorSelect = (color: ColorType) => {
    onColorChange(color);
    onCloseSubmenu('color-selected');
    // Apply color to selected element(s) immediately
    if (hasSelection) {
      const event = new CustomEvent('applyColorToSelection', { detail: { color } });
      window.dispatchEvent(event);
    }
  };

  // Handle color picker button click
  const handleClick = () => {
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('color', 'click'); // Open (or switch from hover/shortcut to click)
    }
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('c', () => {
    // If submenu is already open via shortcut, cycle to next color
    if (isSubmenuOpen && submenuOpenedBy === 'shortcut') {
      cycleColor();
    } else {
      // Select last-used color before opening submenu
      selectLastUsedColor();
      onOpenSubmenu('color', 'shortcut');
    }
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('color')}
        onMouseLeave={() => onToolboxButtonMouseLeave('color')}
        onWheel={handleColorScroll}
        className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border border-2 border-transparent box-content"
      >
        <Paintbrush
          size={18}
          style={{
            color: colorMap[selectedColor],
            stroke: colorMap[selectedColor],
            fill: 'none'
          }}
        />
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{colorPickerButtonConfig.shortcutKey}</span>

      {/* Color Picker Submenu */}
      {isSubmenuOpen && (
        <div
          data-submenu-id="color"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('color')}
          onMouseLeave={() => onSubmenuMouseLeave('color')}
          onWheel={handleColorScroll}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
        >
          <ColorPickerSubmenu
            selectedColor={selectedColor}
            onSelectColor={handleColorSelect}
          />
        </div>
      )}
    </div>
  );
};

export default ColorPickerButton;
