import { Hand, Square } from 'lucide-react';

interface WallCutterToolSubmenuProps {
  wallCutterToolMode: 'freehand' | 'rectangle';
  setWallCutterToolMode: (mode: 'freehand' | 'rectangle') => void;
  wallCutterToolBrushSize: number;
  setWallCutterToolBrushSize: (size: number) => void;
  setActiveTool: (tool: string) => void;
  onMouseLeave?: () => void;
}

const WallCutterToolSubmenu = ({
  wallCutterToolMode,
  setWallCutterToolMode,
  wallCutterToolBrushSize,
  setWallCutterToolBrushSize,
  onMouseLeave,
}: WallCutterToolSubmenuProps) => {
  return (
    <div
      className="bg-dm-panel border border-dm-border rounded-lg shadow-xl p-3 min-w-[200px]"
      onMouseLeave={onMouseLeave}
    >
      <div className="text-xs font-semibold text-gray-400 mb-2">WALL CUTTER MODE</div>
      
      {/* Mode Selection */}
      <div className="space-y-2 mb-3">
        <button
          onClick={() => setWallCutterToolMode('freehand')}
          className={`w-full px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
            wallCutterToolMode === 'freehand'
              ? 'bg-purple-600 text-white'
              : 'bg-dm-dark text-gray-300 hover:bg-dm-border'
          }`}
        >
          <Hand className="w-4 h-4" />
          Freehand
        </button>
        
        <button
          onClick={() => setWallCutterToolMode('rectangle')}
          className={`w-full px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
            wallCutterToolMode === 'rectangle'
              ? 'bg-purple-600 text-white'
              : 'bg-dm-dark text-gray-300 hover:bg-dm-border'
          }`}
        >
          <Square className="w-4 h-4" />
          Rectangle
        </button>
      </div>
      
      {/* Brush Size (only for freehand) */}
      {wallCutterToolMode === 'freehand' && (
        <>
          <div className="text-xs font-semibold text-gray-400 mb-2 mt-3">BRUSH SIZE</div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="10"
              max="100"
              value={wallCutterToolBrushSize}
              onChange={(e) => setWallCutterToolBrushSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-gray-400 w-12 text-right">
              {wallCutterToolBrushSize}px
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default WallCutterToolSubmenu;
