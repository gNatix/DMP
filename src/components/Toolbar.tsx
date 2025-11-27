import { MousePointer2, MapPin, Users } from 'lucide-react';
import { ToolType, ColorType, IconType } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeColor: ColorType;
  setActiveColor: (color: ColorType) => void;
  activeIcon: IconType;
  setActiveIcon: (icon: IconType) => void;
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
  setActiveIcon
}: ToolbarProps) => {
  return (
    <div className="w-20 bg-dm-panel border-r border-dm-border flex flex-col items-center py-4 gap-6">
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
      </div>

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
