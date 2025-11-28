import { useState, useEffect } from 'react';
import { RoomElement, MapElement } from '../types';

interface RoomBuilderPanelProps {
  selectedFloorTexture: string | null;
  onSelectFloorTexture: (url: string) => void;
  tileSize: number;
  onTileSizeChange: (size: number) => void;
  showWalls: boolean;
  onShowWallsChange: (show: boolean) => void;
  selectedWallTexture: string | null;
  onSelectWallTexture: (url: string) => void;
  wallThickness: number;
  onWallThicknessChange: (thickness: number) => void;
  selectedRoom: RoomElement | null;
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  setActiveTool: (tool: 'room') => void;
}

interface AssetFile {
  name: string;
  type: string;
  download_url: string;
}

const RoomBuilderPanel = ({
  selectedFloorTexture,
  onSelectFloorTexture,
  tileSize,
  onTileSizeChange,
  showWalls,
  onShowWallsChange,
  selectedWallTexture,
  onSelectWallTexture,
  wallThickness,
  onWallThicknessChange,
  selectedRoom,
  updateElement,
  setActiveTool
}: RoomBuilderPanelProps) => {
  const [floorTextures, setFloorTextures] = useState<AssetFile[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(true);
  const [wallTextures, setWallTextures] = useState<AssetFile[]>([]);
  const [loadingWalls, setLoadingWalls] = useState(true);

  // Load floor textures
  useEffect(() => {
    const loadFloorTextures = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=room-elements/floors');
        const data = await response.json();
        setFloorTextures(data);
      } catch (error) {
        console.error('Failed to load floor textures:', error);
      } finally {
        setLoadingFloors(false);
      }
    };

    loadFloorTextures();
  }, []);

  // Load wall textures
  useEffect(() => {
    const loadWallTextures = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=room-elements/walls');
        const data = await response.json();
        setWallTextures(data);
      } catch (error) {
        console.error('Failed to load wall textures:', error);
      } finally {
        setLoadingWalls(false);
      }
    };

    loadWallTextures();
  }, []);

  // Handle texture change for selected room
  const handleTextureClick = (url: string) => {
    if (selectedRoom) {
      updateElement(selectedRoom.id, { floorTextureUrl: url });
    } else {
      onSelectFloorTexture(url);
      // Auto-switch to room tool when selecting a floor texture
      setActiveTool('room');
    }
  };

  // Handle tile size change
  const handleTileSizeChange = (size: number) => {
    if (selectedRoom) {
      updateElement(selectedRoom.id, { tileSize: size });
    } else {
      onTileSizeChange(size);
    }
  };

  // Handle wall show/hide change
  const handleShowWallsChange = (show: boolean) => {
    if (selectedRoom) {
      updateElement(selectedRoom.id, { showWalls: show });
    } else {
      onShowWallsChange(show);
    }
  };

  // Handle wall texture change
  const handleWallTextureClick = (url: string) => {
    if (selectedRoom) {
      updateElement(selectedRoom.id, { wallTextureUrl: url });
    } else {
      onSelectWallTexture(url);
    }
  };

  // Handle wall thickness change
  const handleWallThicknessChange = (thickness: number) => {
    if (selectedRoom) {
      updateElement(selectedRoom.id, { wallThickness: thickness });
    } else {
      onWallThicknessChange(thickness);
    }
  };

  // Get current values (from selected room or global state)
  const currentTexture = selectedRoom?.floorTextureUrl ?? selectedFloorTexture;
  const currentTileSize = selectedRoom?.tileSize ?? tileSize;
  const currentShowWalls = selectedRoom?.showWalls ?? showWalls;
  const currentWallTexture = selectedRoom?.wallTextureUrl ?? selectedWallTexture;
  const currentWallThickness = selectedRoom?.wallThickness ?? wallThickness;

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-dm-border">
        <h3 className="text-lg font-semibold text-dm-highlight">
          {selectedRoom ? `Editing: ${selectedRoom.name}` : 'Floor Tiles'}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {selectedRoom ? 'Change texture or tile size for selected room' : 'Click and drag on the map to draw floor areas'}
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tile Size Slider */}
        <div className="p-4 border-b border-dm-border">
          <h4 className="text-sm font-medium mb-2">Tile Size</h4>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="200"
              value={currentTileSize}
              onChange={(e) => handleTileSizeChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-gray-400 w-12 text-right">{currentTileSize}px</span>
          </div>
        </div>

        {/* Wall Controls */}
        <div className="p-4 border-b border-dm-border">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-600 rounded"></span>
            Walls
          </h4>
          
          {/* Wall Toggle */}
          <div className="mb-3">
            <label className="text-xs text-gray-400 mb-2 block">Show Walls</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleShowWallsChange(false)}
                className={`flex-1 py-2 px-3 text-sm rounded transition-all ${
                  !currentShowWalls
                    ? 'bg-dm-highlight text-black font-medium'
                    : 'bg-dm-dark text-gray-300 hover:bg-dm-dark/70'
                }`}
              >
                No Walls
              </button>
              <button
                onClick={() => handleShowWallsChange(true)}
                className={`flex-1 py-2 px-3 text-sm rounded transition-all ${
                  currentShowWalls
                    ? 'bg-dm-highlight text-black font-medium'
                    : 'bg-dm-dark text-gray-300 hover:bg-dm-dark/70'
                }`}
              >
                Show Walls
              </button>
            </div>
          </div>

          {/* Wall Texture and Thickness - only show if walls are enabled */}
          {currentShowWalls && (
            <>
              {/* Wall Texture Selection */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-2 block">Wall Texture</label>
                {loadingWalls ? (
                  <div className="text-sm text-gray-400">Loading walls...</div>
                ) : wallTextures.length === 0 ? (
                  <div className="text-sm text-gray-400">No wall textures found</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {wallTextures.map((texture) => (
                      <button
                        key={texture.download_url}
                        onClick={() => handleWallTextureClick(texture.download_url)}
                        className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                          currentWallTexture === texture.download_url
                            ? 'border-amber-500 ring-2 ring-amber-500/50'
                            : 'border-dm-border hover:border-dm-highlight'
                        }`}
                        title={texture.name}
                      >
                        <img
                          src={texture.download_url}
                          alt={texture.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Wall Thickness */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Wall Thickness</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="4"
                    max="30"
                    value={currentWallThickness}
                    onChange={(e) => handleWallThicknessChange(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-10 text-right">{currentWallThickness}px</span>
                </div>
                
                {/* Clear all openings button - only show when a room is selected with openings */}
                {selectedRoom && selectedRoom.wallOpenings && selectedRoom.wallOpenings.length > 0 && (
                  <button
                    onClick={() => updateElement(selectedRoom.id, { wallOpenings: [] })}
                    className="w-full mt-3 py-1.5 px-3 text-xs rounded bg-dm-panel text-gray-400 hover:text-red-400 hover:bg-dm-dark transition-all"
                  >
                    Clear All Wall Openings ({selectedRoom.wallOpenings.length})
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Floor Textures */}
        <div className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-600 rounded"></span>
            Select Floor Texture
          </h4>
          
          {loadingFloors ? (
            <div className="text-sm text-gray-400">Loading floors...</div>
          ) : floorTextures.length === 0 ? (
            <div className="text-sm text-gray-400">No floor textures found</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {floorTextures.map((texture) => (
                <button
                  key={texture.download_url}
                  onClick={() => handleTextureClick(texture.download_url)}
                  className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                    currentTexture === texture.download_url
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title={texture.name}
                >
                  <img
                    src={texture.download_url}
                    alt={texture.name}
                    className="w-full h-full object-cover"
                    onError={(e) => console.error('Failed to load texture:', texture.download_url, e)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-dm-border bg-dm-dark/50">
        <p className="text-xs text-gray-400">
          <strong className="text-gray-300">Click and drag</strong> on the map to draw a floor area
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Press <kbd className="px-1 py-0.5 bg-dm-panel border border-dm-border rounded text-xs">ESC</kbd> to cancel
        </p>
      </div>
    </div>
  );
};

export default RoomBuilderPanel;
