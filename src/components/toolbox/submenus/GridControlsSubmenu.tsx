interface GridControlsSubmenuProps {
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  onWheel?: (e: React.WheelEvent) => void;
}

// Snap threshold - values within this range of 128 will snap to 128
const SNAP_TARGET = 128;
const SNAP_RANGE = 12; // +/- 12px from 128 will snap

const snapToTarget = (value: number): number => {
  if (Math.abs(value - SNAP_TARGET) <= SNAP_RANGE) {
    return SNAP_TARGET;
  }
  return value;
};

const GridControlsSubmenu = ({ 
  gridSize,
  onGridSizeChange,
  onWheel
}: GridControlsSubmenuProps) => {
  return (
    <div>
      {/* Grid Badge */}
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
        Scroll to Resize Grid (G)
      </div>
      
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-3 z-[100] min-w-[200px]"
        onWheel={onWheel}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Grid Size</span>
            <span className="text-xs text-gray-300">{gridSize}px</span>
          </div>
          <input
            type="range"
            min="4"
            max="512"
            step="4"
            value={gridSize}
            onChange={(e) => onGridSizeChange(snapToTarget(parseInt(e.target.value)))}
            className="w-full h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((gridSize - 4) / 508) * 100}%, #1f2937 ${((gridSize - 4) / 508) * 100}%, #1f2937 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GridControlsSubmenu;
