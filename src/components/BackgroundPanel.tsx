import { useState, useEffect } from 'react';

interface BackgroundPanelProps {
  selectedTexture: string | null;
  onSelectTexture: (url: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
}

interface AssetFile {
  name: string;
  type: string;
  download_url: string;
}

const BackgroundPanel = ({
  selectedTexture,
  onSelectTexture,
  brushSize,
  onBrushSizeChange
}: BackgroundPanelProps) => {
  const [textures, setTextures] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load background textures
  useEffect(() => {
    const loadTextures = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=backgrounds');
        const data = await response.json();
        setTextures(data);
      } catch (error) {
        console.error('Failed to load background textures:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTextures();
  }, []);

  // Set default texture when textures load and none is selected
  useEffect(() => {
    if (textures.length > 0 && !selectedTexture) {
      onSelectTexture(`https://dmp.natixlabs.com/assets/backgrounds/${textures[0].name}`);
    }
  }, [textures, selectedTexture, onSelectTexture]);

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-dm-border">
        <h2 className="text-lg font-semibold text-gray-200">Background Painter</h2>
        <p className="text-xs text-gray-400 mt-1">Paint loopable terrain textures</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Brush Size */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Brush Size: {brushSize}px
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
            className="w-full accent-dm-highlight"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>50px</span>
            <span>500px</span>
          </div>
        </div>

        {/* Texture Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Texture
          </label>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading textures...
            </div>
          ) : textures.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No background textures found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {textures.map((texture) => {
                const textureUrl = `https://dmp.natixlabs.com/assets/backgrounds/${texture.name}`;
                const isSelected = selectedTexture === textureUrl;
                
                return (
                  <button
                    key={texture.name}
                    onClick={() => onSelectTexture(textureUrl)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-dm-highlight ring-2 ring-dm-highlight/50'
                        : 'border-dm-border hover:border-dm-highlight/50'
                    }`}
                    title={texture.name}
                  >
                    <img
                      src={textureUrl}
                      alt={texture.name}
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-3 bg-dm-dark rounded-lg border border-dm-border">
          <h3 className="text-sm font-medium text-gray-300 mb-2">How to use:</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Click and drag to paint terrain</li>
            <li>• Tiles are loopable/tileable</li>
            <li>• Appears above map, below rooms</li>
            <li>• Adjust brush size with slider</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BackgroundPanel;
