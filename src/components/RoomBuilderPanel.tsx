import { useState, useEffect } from 'react';
import { RoomElement, MapElement, RoomSubTool } from '../types';

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
  wallTileSize: number;
  onWallTileSizeChange: (size: number) => void;
  selectedRoom: RoomElement | null;
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  setActiveTool: (tool: 'room') => void;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  onMergeRooms?: () => void;
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
  onShowWallsChange: _onShowWallsChange,
  selectedWallTexture,
  onSelectWallTexture,
  wallThickness,
  onWallThicknessChange,
  wallTileSize,
  onWallTileSizeChange,
  selectedRoom,
  updateElement,
  setActiveTool,
  roomSubTool,
  setRoomSubTool
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

  // Set default floor texture when textures load and none is selected
  useEffect(() => {
    if (floorTextures.length > 0 && !selectedFloorTexture) {
      onSelectFloorTexture(floorTextures[0].download_url);
    }
  }, [floorTextures, selectedFloorTexture, onSelectFloorTexture]);

  // Set default wall texture when textures load and none is selected
  useEffect(() => {
    if (wallTextures.length > 0 && !selectedWallTexture) {
      onSelectWallTexture(wallTextures[0].download_url);
    }
  }, [wallTextures, selectedWallTexture, onSelectWallTexture]);

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

  // Tab state
  const [activeTab, setActiveTab] = useState<'shape-room' | 'draw-walls'>('shape-room');

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-0">
          <button
            onClick={() => setActiveTab('shape-room')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'shape-room'
                ? 'bg-dm-dark/50 text-dm-highlight border-t border-l border-r border-dm-border/50'
                : 'bg-dm-panel/30 text-gray-400 hover:text-gray-300 border-t border-l border-r border-transparent'
            }`}
          >
            Shape Room
          </button>
          <button
            onClick={() => setActiveTab('draw-walls')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'draw-walls'
                ? 'bg-dm-dark/50 text-dm-highlight border-t border-l border-r border-dm-border/50'
                : 'bg-dm-panel/30 text-gray-400 hover:text-gray-300 border-t border-l border-r border-transparent'
            }`}
          >
            Draw Walls
          </button>
        </div>

        {/* Content Widget */}
        <div className="bg-dm-dark/50 rounded-b-lg rounded-tr-lg p-4 border border-dm-border/50">

        {activeTab === 'shape-room' && (
          <>
            {/* Shape Picker */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">Room Shape</label>
              <div className="grid grid-cols-6 gap-2">
                {/* Rectangle */}
                <button
                  onClick={() => {
                    setRoomSubTool('rectangle');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === 'rectangle'
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Rectangle (4 corners)"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="6" width="16" height="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Pentagon */}
                <button
                  onClick={() => {
                    setRoomSubTool('pentagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === 'pentagon'
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Pentagon (5 corners)"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3 L21 9 L18 19 L6 19 L3 9 Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Hexagon */}
                <button
                  onClick={() => {
                    setRoomSubTool('hexagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === 'hexagon'
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Hexagon (6 corners)"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Octagon */}
                <button
                  onClick={() => {
                    setRoomSubTool('octagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === 'octagon'
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Octagon (8 corners)"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Custom Polygon Tool */}
                <button
                  onClick={() => {
                    setRoomSubTool('custom');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === 'custom'
                      ? 'border-amber-500 ring-2 ring-amber-500/50'
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Custom Polygon (Click to place vertices, double-click or click first point to finish)"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18 L12 8 L20 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="6" cy="18" r="2" fill="currentColor"/>
                    <circle cx="12" cy="8" r="2" fill="currentColor"/>
                    <circle cx="20" cy="12" r="2" fill="currentColor"/>
                  </svg>
                </button>

              </div>
            </div>

            {/* Wall Texture and Thickness */}
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
                  <div className="grid grid-cols-6 gap-2">
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

              {/* Wall Tile Size */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-2 block">Wall Tile Size</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={wallTileSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      onWallTileSizeChange(newSize);
                      // Update selected room if one exists
                      if (selectedRoom) {
                        updateElement(selectedRoom.id, { wallTileSize: newSize });
                      }
                    }}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-12 text-right">{wallTileSize}px</span>
                </div>
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

          {/* Floor Textures */}
          <div className="mt-4 pt-4 border-t border-dm-border">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-600 rounded"></span>
            Select Floor Texture
          </h4>
          
          {loadingFloors ? (
            <div className="text-sm text-gray-400">Loading floors...</div>
          ) : floorTextures.length === 0 ? (
            <div className="text-sm text-gray-400">No floor textures found</div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-2 mb-3">
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
            
            {/* Floor Tile Size */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Floor Tile Size</label>
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
          </>
          )}
        </div>
        </>
        )}

        {activeTab === 'draw-walls' && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Draw Walls functionality coming soon...</p>
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
