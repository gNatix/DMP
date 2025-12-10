import { Hand, Square } from 'lucide-react';

interface DoorToolSubmenuProps {
  doorToolMode: 'freehand' | 'rectangle';
  setDoorToolMode: (mode: 'freehand' | 'rectangle') => void;
  doorToolBrushSize: number;
  setDoorToolBrushSize: (size: number) => void;
  setActiveTool: (tool: 'doorTool') => void;
  onMouseLeave?: () => void;
}

const DoorToolSubmenu = ({ 
  doorToolMode, 
  setDoorToolMode,
  doorToolBrushSize,
  setDoorToolBrushSize,
  setActiveTool,
  onMouseLeave
}: DoorToolSubmenuProps) => {
  return (
    <div>
      {/* Door tool badge */}
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
        Door Tool - {doorToolMode === 'freehand' ? 'Freehand' : 'Rectangle'} (D)
      </div>
      
      <div
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
        onMouseLeave={onMouseLeave}
      >
        <div className="flex flex-col gap-2">
          {/* Mode Selection */}
          <div className="flex gap-1">
            {/* Freehand */}
            <button
              onClick={() => {
                setDoorToolMode('freehand');
                setActiveTool('doorTool');
              }}
              className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex flex-col items-center justify-center ${
                doorToolMode === 'freehand'
                  ? 'border-dm-highlight text-dm-highlight'
                  : 'border-dm-border text-gray-400 hover:border-dm-highlight hover:text-dm-highlight'
              }`}
              title="Freehand"
            >
              <Hand size={16} />
              <span className="text-[8px] mt-0.5">Free</span>
            </button>

            {/* Rectangle */}
            <button
              onClick={() => {
                setDoorToolMode('rectangle');
                setActiveTool('doorTool');
              }}
              className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex flex-col items-center justify-center ${
                doorToolMode === 'rectangle'
                  ? 'border-dm-highlight text-dm-highlight'
                  : 'border-dm-border text-gray-400 hover:border-dm-highlight hover:text-dm-highlight'
              }`}
              title="Rectangle"
            >
              <Square size={16} />
              <span className="text-[8px] mt-0.5">Rect</span>
            </button>
          </div>

          {/* Brush Size (only for freehand) */}
          {doorToolMode === 'freehand' && (
            <div className="pt-2 border-t border-dm-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">Brush Size</span>
                <span className="text-xs text-dm-highlight font-medium">{doorToolBrushSize}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={doorToolBrushSize}
                onChange={(e) => setDoorToolBrushSize(Number(e.target.value))}
                className="w-full h-1.5 bg-dm-dark rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${((doorToolBrushSize - 10) / 90) * 100}%, #1f2937 ${((doorToolBrushSize - 10) / 90) * 100}%, #1f2937 100%)`
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoorToolSubmenu;
