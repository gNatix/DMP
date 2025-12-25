import { useState, useEffect } from 'react';
import { ToolType, TerrainShapeMode } from '../../types';

interface EnvironmentTabProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushOpacity: number;
  onBrushOpacityChange: (opacity: number) => void;
  shapeMode: TerrainShapeMode;
  onShapeModeChange: (mode: TerrainShapeMode) => void;
}

interface AssetFile {
  name: string;
  type: string;
  download_url: string;
}

const EnvironmentTab = ({
  activeTool: _activeTool,
  setActiveTool,
  selectedTerrainBrush,
  onSelectTerrainBrush,
  brushSize,
  onBrushSizeChange,
  brushOpacity,
  onBrushOpacityChange,
  shapeMode,
  onShapeModeChange,
}: EnvironmentTabProps) => {
  const [terrainBrushes, setTerrainBrushes] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load terrain brushes
  useEffect(() => {
    const loadBrushes = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=terrain-brushes');
        const data = await response.json();
        const files = data.files || data;
        setTerrainBrushes(Array.isArray(files) ? files : []);
        
        // Auto-select first brush if none selected
        if (!selectedTerrainBrush && files.length > 0) {
          onSelectTerrainBrush(files[0].download_url);
        }
      } catch (error) {
        console.error('Failed to load terrain brushes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBrushes();
  }, []);

  const handleBrushSelect = (url: string) => {
    onSelectTerrainBrush(url);
    setActiveTool('background');
  };

  const getTextureName = (url: string): string => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0].replace(/_/g, ' ');
  };

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        
        {/* Section Header */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            🌲 Environment Brush
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Paint terrain textures on your map
          </p>
        </div>

        {/* Brush Controls */}
        <div className="mb-6 p-3 bg-dm-dark/30 rounded-lg border border-dm-border/30 space-y-3">
          {/* Brush Size */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 w-20 shrink-0">Size: {brushSize}px</label>
            <input
              type="range"
              min="128"
              max="512"
              step="64"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="flex-1 accent-dm-highlight"
            />
          </div>
          {/* Brush Opacity */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 w-20 shrink-0">Opacity: {Math.round(brushOpacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={brushOpacity}
              onChange={(e) => onBrushOpacityChange(Number(e.target.value))}
              className="flex-1 accent-dm-highlight"
            />
          </div>
        </div>

        {/* Shape Mode */}
        <div className="mb-6 p-3 bg-dm-dark/30 rounded-lg border border-dm-border/30">
          <label className="text-xs text-gray-400 mb-2 block">Paint Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => onShapeModeChange(null)}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                shapeMode === null
                  ? 'bg-dm-highlight text-white'
                  : 'bg-dm-dark text-gray-400 hover:text-gray-200'
              }`}
            >
              Freehand
            </button>
            <button
              onClick={() => onShapeModeChange('rectangle')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                shapeMode === 'rectangle'
                  ? 'bg-dm-highlight text-white'
                  : 'bg-dm-dark text-gray-400 hover:text-gray-200'
              }`}
            >
              Rectangle
            </button>
            <button
              onClick={() => onShapeModeChange('circle')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                shapeMode === 'circle'
                  ? 'bg-dm-highlight text-white'
                  : 'bg-dm-dark text-gray-400 hover:text-gray-200'
              }`}
            >
              Circle
            </button>
          </div>
        </div>

        {/* Terrain Brushes Grid */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-2 block">Terrain Textures</label>
          
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading brushes...</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {terrainBrushes.map((brush) => (
                <button
                  key={brush.download_url}
                  onClick={() => handleBrushSelect(brush.download_url)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedTerrainBrush === brush.download_url
                      ? 'border-dm-highlight ring-2 ring-dm-highlight/50'
                      : 'border-dm-border/50 hover:border-gray-500'
                  }`}
                  title={getTextureName(brush.download_url)}
                >
                  <img
                    src={brush.download_url}
                    alt={brush.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-3 bg-dm-dark/20 rounded-lg border border-dm-border/20">
          <p className="text-xs text-gray-500">
            <span className="text-gray-400 font-medium">Tip:</span> Click and drag on the canvas to paint terrain. 
            Use the Modules tab for building rooms with walls and doors.
          </p>
        </div>

      </div>
    </div>
  );
};

export default EnvironmentTab;
