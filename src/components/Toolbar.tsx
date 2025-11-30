import { MousePointer2, MapPin, Users } from 'lucide-react';
import { ToolType, ColorType, IconType, RoomSubTool } from '../types';
import { useState } from 'react';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeColor: ColorType;
  setActiveColor: (color: ColorType) => void;
  activeIcon: IconType;
  setActiveIcon: (icon: IconType) => void;
  roomSubTool?: RoomSubTool;
  setRoomSubTool?: (subTool: RoomSubTool) => void;
}

const COLORS: { name: ColorType; hex: string }[] = [
  { name: 'red', hex: '#ef4444' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'green', hex: '#22c55e' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'orange', hex: '#f97316' },
];

const ICONS: IconType[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart', 'skull'];

const Toolbar = ({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  activeIcon,
  setActiveIcon,
  roomSubTool,
  setRoomSubTool
}: ToolbarProps) => {
  const [showRoomSubmenu, setShowRoomSubmenu] = useState(false);
  
  const isSubtractMode = roomSubTool?.startsWith('subtract-') || false;
  const baseShape = roomSubTool?.replace('subtract-', '') as 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'custom' | undefined;
  
  return (
    <div className="w-20 bg-dm-panel border-r border-dm-border flex flex-col items-center py-4 gap-6 relative">
      {/* Tools Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs text-gray-400 text-center mb-1">Tools</h3>
        
        <button
          onClick={() => setActiveTool('pointer')}
          className={`p-3 rounded-lg transition-colors ${
            activeTool === 'pointer'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-400'
          }`}
          title="Pointer Tool (Click: select, Drag: multi-select)"
        >
          <MousePointer2 size={20} />
        </button>

        <button
          onClick={() => setActiveTool('marker')}
          className={`p-3 rounded-lg transition-colors ${
            activeTool === 'marker'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-400'
          }`}
          title="Marker Tool"
        >
          <MapPin size={20} />
        </button>

        <button
          onClick={() => setActiveTool('token')}
          className={`p-3 rounded-lg transition-colors ${
            activeTool === 'token'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-400'
          }`}
          title="Token Tool"
        >
          <Users size={20} />
        </button>

        <button
          onClick={() => {
            setActiveTool('room');
            setShowRoomSubmenu(!showRoomSubmenu);
          }}
          onMouseEnter={() => setShowRoomSubmenu(true)}
          className={`p-3 rounded-lg transition-colors relative ${
            activeTool === 'room'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-400'
          }`}
          title="Room Tool (R)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="6" width="16" height="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Room Submenu */}
      {showRoomSubmenu && setRoomSubTool && (
        <div 
          className="absolute left-full top-0 ml-2 bg-dm-panel border border-dm-border rounded-lg p-3 shadow-xl z-50"
          onMouseLeave={() => setShowRoomSubmenu(false)}
        >
          <h3 className="text-xs text-gray-400 mb-2">Room Shapes</h3>
          
          <div className="grid grid-cols-5 gap-2 mb-2">
            {/* Rectangle */}
            <button
              onClick={() => {
                setRoomSubTool(isSubtractMode ? 'subtract-rectangle' : 'rectangle');
                setActiveTool('room');
              }}
              className={`aspect-square rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                baseShape === 'rectangle'
                  ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                  : 'border-dm-border hover:border-dm-highlight'
              }`}
              title="Rectangle"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="6" width="16" height="12" strokeWidth="2"/>
              </svg>
            </button>

            {/* Pentagon */}
            <button
              onClick={() => {
                setRoomSubTool(isSubtractMode ? 'subtract-pentagon' : 'pentagon');
                setActiveTool('room');
              }}
              className={`aspect-square rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                baseShape === 'pentagon'
                  ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                  : 'border-dm-border hover:border-dm-highlight'
              }`}
              title="Pentagon"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 3 L21 9 L18 19 L6 19 L3 9 Z" strokeWidth="2"/>
              </svg>
            </button>

            {/* Hexagon */}
            <button
              onClick={() => {
                setRoomSubTool(isSubtractMode ? 'subtract-hexagon' : 'hexagon');
                setActiveTool('room');
              }}
              className={`aspect-square rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                baseShape === 'hexagon'
                  ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                  : 'border-dm-border hover:border-dm-highlight'
              }`}
              title="Hexagon"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" strokeWidth="2"/>
              </svg>
            </button>

            {/* Octagon */}
            <button
              onClick={() => {
                setRoomSubTool(isSubtractMode ? 'subtract-octagon' : 'octagon');
                setActiveTool('room');
              }}
              className={`aspect-square rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                baseShape === 'octagon'
                  ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                  : 'border-dm-border hover:border-dm-highlight'
              }`}
              title="Octagon"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" strokeWidth="2"/>
              </svg>
            </button>

            {/* Custom */}
            <button
              onClick={() => {
                setRoomSubTool(isSubtractMode ? 'subtract-custom' : 'custom');
                setActiveTool('room');
              }}
              className={`aspect-square rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                baseShape === 'custom'
                  ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                  : 'border-dm-border hover:border-dm-highlight'
              }`}
              title="Custom Polygon"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18 L12 8 L20 12" strokeWidth="2"/>
                <circle cx="6" cy="18" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="20" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>

          <h3 className="text-xs text-gray-400 mb-2">Mode</h3>
          
          {/* Add/Subtract Toggle */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => {
                if (baseShape) {
                  setRoomSubTool(baseShape);
                  setActiveTool('room');
                }
              }}
              className={`px-2 py-1.5 rounded border-2 transition-all flex items-center justify-center gap-1 ${
                !isSubtractMode
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
              }`}
              title="Add Room"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M12 4v16m8-8H4" strokeLinecap="round"/>
              </svg>
            </button>
            
            <button
              onClick={() => {
                if (baseShape) {
                  setRoomSubTool(`subtract-${baseShape}` as RoomSubTool);
                  setActiveTool('room');
                }
              }}
              className={`px-2 py-1.5 rounded border-2 transition-all flex items-center justify-center gap-1 ${
                isSubtractMode
                  ? 'border-red-500 bg-red-500/20 text-red-400'
                  : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
              }`}
              title="Subtract"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M20 12H4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Colors Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs text-gray-400 text-center mb-1">Colors</h3>
        <div className="grid grid-cols-2 gap-1">
          {COLORS.map(color => (
            <button
              key={color.name}
              onClick={() => setActiveColor(color.name)}
              className={`w-7 h-7 rounded border-2 transition-all ${
                activeColor === color.name
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Icons Section */}
      <div className="flex flex-col gap-2 w-full px-2">
        <h3 className="text-xs text-gray-400 text-center mb-1">Icons</h3>
        <div className="grid grid-cols-2 gap-1">
          {ICONS.map(icon => (
            <button
              key={icon}
              onClick={() => setActiveIcon(icon)}
              className={`p-2 rounded text-xs transition-colors ${
                activeIcon === icon
                  ? 'bg-dm-highlight text-white'
                  : 'bg-dm-dark hover:bg-dm-border text-gray-400'
              }`}
              title={icon}
            >
              {getIconSymbol(icon)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to get icon symbols
function getIconSymbol(icon: IconType): string {
  const symbols: Record<IconType, string> = {
    circle: '●',
    square: '■',
    triangle: '▲',
    star: '★',
    diamond: '◆',
    heart: '♥',
    skull: '☠',
    quest: '?',
    clue: '!',
    hidden: '👁',
    door: '🚪',
    landmark: '📍',
    footprint: '👣',
    info: 'ℹ'
  };
  return symbols[icon];
}

export default Toolbar;
