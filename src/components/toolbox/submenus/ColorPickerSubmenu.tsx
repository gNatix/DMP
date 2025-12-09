import { ColorType } from '../../../types';

interface ColorPickerSubmenuProps {
  selectedColor: ColorType;
  onSelectColor: (color: ColorType) => void;
}

const ColorPickerSubmenu = ({ 
  selectedColor, 
  onSelectColor
}: ColorPickerSubmenuProps) => {
  const colorMap: Record<ColorType, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    brown: '#92400e',
    gray: '#6b7280',
    black: '#000000',
    white: '#ffffff',
    cyan: '#06b6d4',
    magenta: '#d946ef',
    lime: '#84cc16',
    indigo: '#6366f1',
    teal: '#14b8a6',
    green: '#22c55e'
  };

  return (
    <div>
      {/* Color name badge */}
      <div 
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '12px',
          color: '#9ca3af',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
        }}
      >
        {selectedColor.charAt(0).toUpperCase() + selectedColor.slice(1)}
      </div>
      
      <div
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px'
        }}>
          {(Object.keys(colorMap) as ColorType[]).map((color) => (
            <button
              key={color}
              onClick={() => onSelectColor(color)}
              style={{
                backgroundColor: colorMap[color],
                width: '28px',
                height: '28px',
                border: color === 'white' || color === 'black' ? '1px solid #4b5563' : '1px solid transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                outline: selectedColor === color ? '2px solid #facc15' : 'none',
                outlineOffset: '2px'
              }}
              className="hover:scale-110 transition-transform"
              title={color.charAt(0).toUpperCase() + color.slice(1)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPickerSubmenu;
