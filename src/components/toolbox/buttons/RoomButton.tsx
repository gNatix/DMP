import { Home } from 'lucide-react';
import { useRef } from 'react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { RoomSubTool } from '../../../types';
import RoomSubToolPicker from '../submenus/RoomSubToolPicker';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const roomButtonConfig: ToolButtonConfig = {
  id: 'room',
  enabled: true,
  category: 'drawing',
  weight: 4, // After terrain in drawing category
  
  icon: <Home size={18} />,
  label: 'Room Builder',
  shortcutKey: 'R',
  
  buttonType: 'tool',           // OPTIONS: 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // OPTIONS: 'full' (colored bg) | 'border' (colored border) | null (no highlight)
  
  tool: 'room',
  hasSubmenu: true,
};
// ==========================================

interface RoomButtonPropsExtended extends ToolButtonProps {
  roomSubTool: RoomSubTool;
  setRoomSubTool: (tool: RoomSubTool) => void;
  autoMergeRooms?: boolean;
  setAutoMergeRooms?: (value: boolean) => void;
  // Central submenu system props
  openSubmenuId: string | null;
  submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null;
  onOpenSubmenu: (id: string | null, openedBy: 'click' | 'shortcut' | 'hover') => void;
  onToolboxButtonMouseEnter: (id: string) => void;
  onToolboxButtonMouseLeave: (id: string) => void;
  onSubmenuMouseEnter: (id: string) => void;
  onSubmenuMouseLeave: (id: string) => void;
  // Cycling functions
  cycleRoomSubTool: () => void;
  selectLastUsedRoomSubTool: () => void;
  // Tab switch callback
  onSwitchToDrawTab?: () => void;
}

const RoomButton = ({
  activeTool,
  setActiveTool,
  roomSubTool,
  setRoomSubTool,
  autoMergeRooms = false,
  setAutoMergeRooms,
  openSubmenuId,
  submenuOpenedBy,
  onOpenSubmenu,
  onToolboxButtonMouseEnter,
  onToolboxButtonMouseLeave,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
  cycleRoomSubTool,
  selectLastUsedRoomSubTool,
  onSwitchToDrawTab
}: RoomButtonPropsExtended) => {
  const isActive = activeTool === roomButtonConfig.tool;
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const roomSubToolPickerRef = useRef<HTMLDivElement>(null);
  const isSubmenuOpen = openSubmenuId === 'room';

  // Scroll handler for cycling through room sub-tools on wheel
  const handleRoomScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const tools: RoomSubTool[] = [
      'rectangle', 'pentagon', 'hexagon', 'octagon', 'custom',
      'subtract-rectangle', 'subtract-pentagon', 'subtract-hexagon', 'subtract-octagon', 'subtract-custom'
    ];
    const currentIndex = tools.indexOf(roomSubTool);
    
    let newIndex;
    if (e.deltaY > 0) {
      // Scroll down = go backward in list
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = tools.length - 1;
    } else {
      // Scroll up = go forward in list
      newIndex = currentIndex + 1;
      if (newIndex >= tools.length) newIndex = 0;
    }
    
    setRoomSubTool(tools[newIndex]);
    setActiveTool(roomButtonConfig.tool!);
  };

  // Wrap room selection to also activate the tool
  const handleSelectRoom = (tool: RoomSubTool) => {
    setRoomSubTool(tool);
    setActiveTool(roomButtonConfig.tool!);
  };

  // Handle room button click
  const handleClick = () => {
    setActiveTool(roomButtonConfig.tool!);
    
    // Toggle submenu if already open via click, otherwise open it
    if (isSubmenuOpen && submenuOpenedBy === 'click') {
      onOpenSubmenu(null, 'click'); // Toggle off
    } else {
      onOpenSubmenu('room', 'click'); // Open (or switch from hover/shortcut to click)
    }
    // Always switch to draw tab
    if (onSwitchToDrawTab) onSwitchToDrawTab();
  };

  // Handle keyboard shortcut
  useKeyboardShortcut('r', () => {
    console.log('[ROOM BUTTON] R pressed', { 
      activeTool, 
      isSubmenuOpen, 
      submenuOpenedBy,
      roomSubTool 
    });
    
    // If already on room tool and submenu is open via shortcut, cycle to next sub-tool
    if (activeTool === 'room' && isSubmenuOpen && submenuOpenedBy === 'shortcut') {
      console.log('[ROOM BUTTON] Cycling room sub-tool');
      cycleRoomSubTool();
    } else {
      console.log('[ROOM BUTTON] Selecting last used room sub-tool');
      // Switch to room tool and open submenu
      setActiveTool(roomButtonConfig.tool!);
      selectLastUsedRoomSubTool();
      onOpenSubmenu('room', 'shortcut');
    }
    // Always switch to draw tab
    if (onSwitchToDrawTab) onSwitchToDrawTab();
  });

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={roomButtonRef}
        onClick={handleClick}
        onMouseEnter={() => onToolboxButtonMouseEnter('room')}
        onMouseLeave={() => onToolboxButtonMouseLeave('room')}
        onWheel={handleRoomScroll}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
        title={`${roomButtonConfig.label} (${roomButtonConfig.shortcutKey})`}
      >
        {roomButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{roomButtonConfig.shortcutKey}</span>

      {/* Room Sub-Tool Picker */}
      {isSubmenuOpen && (
        <div
          ref={roomSubToolPickerRef}
          data-submenu-id="room"
          data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
          data-opened-by={submenuOpenedBy}
          data-submenu-container="true"
          onMouseEnter={() => onSubmenuMouseEnter('room')}
          onMouseLeave={() => onSubmenuMouseLeave('room')}
          onWheel={handleRoomScroll}
          className="absolute bottom-full mb-2"
          style={{ left: '-96px' }}
        >
          <RoomSubToolPicker
            roomSubTool={roomSubTool}
            setRoomSubTool={handleSelectRoom}
            setActiveTool={setActiveTool}
            autoMergeRooms={autoMergeRooms}
            setAutoMergeRooms={setAutoMergeRooms}
          />
        </div>
      )}
    </div>
  );
};

export default RoomButton;
