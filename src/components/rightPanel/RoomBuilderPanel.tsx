import { useState, useEffect } from 'react';
import { RoomElement, WallElement, MapElement, RoomSubTool, ToolType, TerrainShapeMode } from '../../types';

interface RoomBuilderPanelProps {
  activeTool: ToolType;
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
  selectedWall: WallElement | null;
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  setActiveTool: (tool: ToolType) => void;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  onMergeRooms?: () => void;
  onMergeWalls?: () => void;
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  backgroundBrushSize: number;
  onBrushSizeChange: (size: number) => void;
  activeDrawTab?: 'room' | 'terrain' | 'walls';
  onActiveDrawTabChange?: (tab: 'room' | 'terrain' | 'walls') => void;
  // Terrain shape mode
  terrainShapeMode?: TerrainShapeMode;
  onTerrainShapeModeChange?: (mode: TerrainShapeMode) => void;
}

interface AssetFile {
  name: string;
  type: string;
  download_url: string;
}

const RoomBuilderPanel = ({
  activeTool,
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
  selectedWall,
  updateElement,
  setActiveTool,
  roomSubTool,
  setRoomSubTool,
  // onMergeRooms,
  // onMergeWalls,
  selectedTerrainBrush,
  onSelectTerrainBrush,
  backgroundBrushSize,
  onBrushSizeChange,
  activeDrawTab: externalActiveTab,
  onActiveDrawTabChange,
  terrainShapeMode = null,
  onTerrainShapeModeChange
}: RoomBuilderPanelProps) => {
  const [floorTextures, setFloorTextures] = useState<AssetFile[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(true);
  const [wallTextures, setWallTextures] = useState<AssetFile[]>([]);
  const [loadingWalls, setLoadingWalls] = useState(true);
  const [backgroundTextures, setBackgroundTextures] = useState<AssetFile[]>([]);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(true);
  const [isSubtractMode, setIsSubtractMode] = useState(false);
  const [internalActiveTab, setInternalActiveTab] = useState<'room' | 'terrain' | 'walls'>('room');
  
  // Use external tab if provided, otherwise use internal
  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = onActiveDrawTabChange || setInternalActiveTab;

  // Get base shape from subtract tool (e.g., 'subtract-rectangle' -> 'rectangle')
  const getBaseShape = (tool: RoomSubTool): RoomSubTool => {
    if (tool.startsWith('subtract-')) {
      return tool.replace('subtract-', '') as RoomSubTool;
    }
    return tool;
  };

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

  // Load background textures
  useEffect(() => {
    const loadBackgroundTextures = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=terrain-brushes');
        const data = await response.json();
        setBackgroundTextures(data);
      } catch (error) {
        console.error('Failed to load terrain brushes:', error);
      } finally {
        setLoadingBackgrounds(false);
      }
    };

    loadBackgroundTextures();
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

  // Sync isSubtractMode with roomSubTool
  useEffect(() => {
    setIsSubtractMode(roomSubTool.startsWith('subtract-'));
  }, [roomSubTool]);

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
    if (selectedWall) {
      updateElement(selectedWall.id, { wallTextureUrl: url });
    } else if (selectedRoom) {
      updateElement(selectedRoom.id, { wallTextureUrl: url });
    } else {
      onSelectWallTexture(url);
    }
  };

  // Handle wall thickness change
  const handleWallThicknessChange = (thickness: number) => {
    if (selectedWall) {
      updateElement(selectedWall.id, { wallThickness: thickness });
    } else if (selectedRoom) {
      updateElement(selectedRoom.id, { wallThickness: thickness });
    } else {
      onWallThicknessChange(thickness);
    }
  };

  // Handle wall tile size change
  const handleWallTileSizeChange = (size: number) => {
    if (selectedWall) {
      updateElement(selectedWall.id, { wallTileSize: size });
    } else if (selectedRoom) {
      updateElement(selectedRoom.id, { wallTileSize: size });
    } else {
      onWallTileSizeChange(size);
    }
  };

  // Get current values (from selected wall, selected room, or global state)
  const currentTexture = selectedRoom?.floorTextureUrl ?? selectedFloorTexture;
  const currentTileSize = selectedRoom?.tileSize ?? tileSize;
  const currentShowWalls = selectedRoom?.showWalls ?? showWalls;
  const currentWallTexture = selectedWall?.wallTextureUrl ?? selectedRoom?.wallTextureUrl ?? selectedWallTexture;
  const currentWallThickness = selectedWall?.wallThickness ?? selectedRoom?.wallThickness ?? wallThickness;
  const currentWallTileSize = selectedWall?.wallTileSize ?? selectedRoom?.wallTileSize ?? wallTileSize;

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-0">
          <button
            onClick={() => setActiveTab('room')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'room'
                ? 'bg-dm-dark/50 text-dm-highlight border-t border-l border-r border-dm-border/50'
                : 'bg-dm-panel/30 text-gray-400 hover:text-gray-300 border-t border-l border-r border-transparent'
            }`}
          >
            Room
          </button>
          <button
            onClick={() => setActiveTab('terrain')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'terrain'
                ? 'bg-dm-dark/50 text-dm-highlight border-t border-l border-r border-dm-border/50'
                : 'bg-dm-panel/30 text-gray-400 hover:text-gray-300 border-t border-l border-r border-transparent'
            }`}
          >
            Environment
          </button>
          <button
            onClick={() => setActiveTab('walls')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'walls'
                ? 'bg-dm-dark/50 text-dm-highlight border-t border-l border-r border-dm-border/50'
                : 'bg-dm-panel/30 text-gray-400 hover:text-gray-300 border-t border-l border-r border-transparent'
            }`}
          >
            Walls
          </button>
        </div>

        {/* Content Widget */}
        <div className="bg-dm-dark/50 rounded-b-lg rounded-tr-lg p-4 border border-dm-border/50">

        {activeTab === 'room' && (
          <>
            {/* Shape Picker with Mode Badges */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">Select Shape</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const baseShape = getBaseShape(roomSubTool);
                      if (baseShape !== 'erase') {
                        setRoomSubTool(baseShape);
                        setActiveTool('room');
                      }
                    }}
                    className={`px-2 py-0.5 text-xs rounded transition-all ${
                      !isSubtractMode
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : 'bg-dm-panel text-gray-400 border border-dm-border hover:border-dm-highlight'
                    }`}
                  >
                    Add
                  </button>
                  
                  <button
                    onClick={() => {
                      const baseShape = getBaseShape(roomSubTool);
                      if (baseShape !== 'erase') {
                        setRoomSubTool(`subtract-${baseShape}` as RoomSubTool);
                        setActiveTool('room');
                      }
                    }}
                    className={`px-2 py-0.5 text-xs rounded transition-all ${
                      isSubtractMode
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-dm-panel text-gray-400 border border-dm-border hover:border-dm-highlight'
                    }`}
                  >
                    Subtract
                  </button>
                </div>
              </div>

            {/* Shape Picker */}
              <div className="grid grid-cols-5 gap-2">
                {/* Rectangle */}
                <button
                  onClick={() => {
                    setRoomSubTool(isSubtractMode ? 'subtract-rectangle' : 'rectangle');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === (isSubtractMode ? 'subtract-rectangle' : 'rectangle')
                      ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
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
                    setRoomSubTool(isSubtractMode ? 'subtract-pentagon' : 'pentagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === (isSubtractMode ? 'subtract-pentagon' : 'pentagon')
                      ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
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
                    setRoomSubTool(isSubtractMode ? 'subtract-hexagon' : 'hexagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === (isSubtractMode ? 'subtract-hexagon' : 'hexagon')
                      ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
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
                    setRoomSubTool(isSubtractMode ? 'subtract-octagon' : 'octagon');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === (isSubtractMode ? 'subtract-octagon' : 'octagon')
                      ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
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
                    setRoomSubTool(isSubtractMode ? 'subtract-custom' : 'custom');
                    setActiveTool('room');
                  }}
                  className={`aspect-square rounded border-2 transition-all bg-dm-panel flex items-center justify-center ${
                    roomSubTool === (isSubtractMode ? 'subtract-custom' : 'custom')
                      ? (isSubtractMode ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title={isSubtractMode ? "Custom Polygon Subtract" : "Custom Polygon (Click to place vertices, double-click or click first point to finish)"}
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
                    {/* Transparent option */}
                    <button
                      onClick={() => handleWallTextureClick('transparent')}
                      className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                        currentWallTexture === 'transparent'
                          ? 'border-amber-500 ring-2 ring-amber-500/50'
                          : 'border-dm-border hover:border-dm-highlight'
                      }`}
                      title="Transparent (No wall texture)"
                    >
                      <div className="w-full h-full relative" style={{
                        backgroundImage: 'repeating-conic-gradient(#808080 0% 25%, #a0a0a0 0% 50%) 50% / 8px 8px'
                      }}>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </button>
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
                    className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((wallTileSize - 10) / 190) * 100}%, #1f2937 ${((wallTileSize - 10) / 190) * 100}%, #1f2937 100%)`
                    }}
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
                    className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((currentWallThickness - 4) / 26) * 100}%, #1f2937 ${((currentWallThickness - 4) / 26) * 100}%, #1f2937 100%)`
                    }}
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
              {/* Transparent option */}
              <button
                onClick={() => handleTextureClick('transparent')}
                className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                  currentTexture === 'transparent'
                    ? 'border-amber-500 ring-2 ring-amber-500/50'
                    : 'border-dm-border hover:border-dm-highlight'
                }`}
                title="Transparent (No floor texture)"
              >
                <div className="w-full h-full relative" style={{
                  backgroundImage: 'repeating-conic-gradient(#808080 0% 25%, #a0a0a0 0% 50%) 50% / 8px 8px'
                }}>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>
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
                  className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((currentTileSize - 10) / 190) * 100}%, #1f2937 ${((currentTileSize - 10) / 190) * 100}%, #1f2937 100%)`
                  }}
                />
                <span className="text-sm text-gray-400 w-12 text-right">{currentTileSize}px</span>
              </div>
            </div>
          </>
          )}
        </div>
        </>
        )}

        {activeTab === 'terrain' && (
          <div>
            <p className="text-sm text-gray-300 mb-4">Paint environment textures on the background</p>
            
            {/* Shape Mode Selector */}
            {onTerrainShapeModeChange && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">Draw Mode</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      onTerrainShapeModeChange(null);
                      setActiveTool('background');
                      // Auto-select first texture if none selected
                      if (!selectedTerrainBrush && backgroundTextures.length > 0) {
                        onSelectTerrainBrush(backgroundTextures[0].download_url);
                      }
                    }}
                    className={`p-3 rounded border-2 transition-all flex items-center justify-center ${
                      terrainShapeMode === null
                        ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                        : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                    }`}
                    title="Freehand brush"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => {
                      onTerrainShapeModeChange('rectangle');
                      setActiveTool('background');
                      // Auto-select first texture if none selected
                      if (!selectedTerrainBrush && backgroundTextures.length > 0) {
                        onSelectTerrainBrush(backgroundTextures[0].download_url);
                      }
                    }}
                    className={`p-3 rounded border-2 transition-all flex items-center justify-center ${
                      terrainShapeMode === 'rectangle'
                        ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                        : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                    }`}
                    title="Rectangle fill"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="4" y="6" width="16" height="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => {
                      onTerrainShapeModeChange('circle');
                      setActiveTool('background');
                      // Auto-select first texture if none selected
                      if (!selectedTerrainBrush && backgroundTextures.length > 0) {
                        onSelectTerrainBrush(backgroundTextures[0].download_url);
                      }
                    }}
                    className={`p-3 rounded border-2 transition-all flex items-center justify-center ${
                      terrainShapeMode === 'circle'
                        ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                        : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                    }`}
                    title="Circle fill"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="8" strokeWidth="2"/>
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => {
                      onTerrainShapeModeChange('polygon');
                      setActiveTool('background');
                      // Auto-select first texture if none selected
                      if (!selectedTerrainBrush && backgroundTextures.length > 0) {
                        onSelectTerrainBrush(backgroundTextures[0].download_url);
                      }
                    }}
                    className={`p-3 rounded border-2 transition-all flex items-center justify-center ${
                      terrainShapeMode === 'polygon'
                        ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                        : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                    }`}
                    title="Polygon fill"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2 L22 9 L18 21 L6 21 L2 9 Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {/* Brush Size Slider */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Brush Size</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={backgroundBrushSize}
                  onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((backgroundBrushSize - 50) / 250) * 100}%, #1f2937 ${((backgroundBrushSize - 50) / 250) * 100}%, #1f2937 100%)`
                  }}
                />
                <span className="text-sm text-gray-400 w-12 text-right">{backgroundBrushSize}px</span>
              </div>
            </div>

            {/* Texture Selection */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Select Texture</label>
              {loadingBackgrounds ? (
                <div className="text-center py-4 text-sm text-gray-500">Loading textures...</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-2">
                  {backgroundTextures.map((texture) => (
                    <button
                      key={texture.download_url}
                      onClick={() => {
                        console.log('[TERRAIN PANEL] Texture selected:', texture.name, texture.download_url);
                        onSelectTerrainBrush(texture.download_url);
                        console.log('[TERRAIN PANEL] Setting tool to background');
                        setActiveTool('background');
                      }}
                      className={`aspect-square rounded border-2 overflow-hidden transition-all ${
                        selectedTerrainBrush === texture.download_url
                          ? 'border-dm-highlight ring-2 ring-dm-highlight/50'
                          : 'border-dm-border hover:border-dm-highlight/50'
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
          </div>
        )}

        {activeTab === 'walls' && (
          <div>
            <p className="text-sm text-gray-300 mb-4">Draw walls with different tools</p>
            
            {/* Wall Tool Buttons */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {/* Wall Line Tool Button */}
              <button
                onClick={() => {
                  console.log('[WALL PANEL] Wall line tool activated');
                  setActiveTool('wall-line');
                }}
                className={`p-3 rounded border-2 transition-all ${
                  activeTool === 'wall-line'
                    ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                    : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span className="font-medium text-sm">Wall Line</span>
                </div>
              </button>
              
              {/* Freeform Wall Tool Button */}
              <button
                onClick={() => {
                  console.log('[WALL PANEL] Freeform wall tool activated');
                  setActiveTool('wall');
                }}
                className={`p-3 rounded border-2 transition-all ${
                  activeTool === 'wall'
                    ? 'border-dm-highlight bg-dm-highlight/20 text-white'
                    : 'border-dm-border bg-dm-dark hover:border-dm-highlight/50 text-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l10 10M7 17L17 7" />
                  </svg>
                  <span className="font-medium text-sm">Polyline</span>
                </div>
              </button>
            </div>
            
            <p className="text-xs text-gray-400 mb-4">
              <strong>Wall Line:</strong> Click and drag to draw a single wall.<br/>
              <strong>Polyline:</strong> Click to place vertices. Double-click or ESC to finish.
            </p>

            {/* Wall Texture Selection */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Wall Texture</label>
              {loadingWalls ? (
                <div className="text-center py-4 text-sm text-gray-500">Loading textures...</div>
              ) : (
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {wallTextures.map((texture) => (
                    <button
                      key={texture.download_url}
                      onClick={() => handleWallTextureClick(texture.download_url)}
                      className={`aspect-square rounded border-2 overflow-hidden transition-all ${
                        currentWallTexture === texture.download_url
                          ? 'border-dm-highlight ring-2 ring-dm-highlight/50'
                          : 'border-dm-border hover:border-dm-highlight/50'
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

            {/* Wall Thickness Slider */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Wall Thickness</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={currentWallThickness}
                  onChange={(e) => handleWallThicknessChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((currentWallThickness - 10) / 90) * 100}%, #1f2937 ${((currentWallThickness - 10) / 90) * 100}%, #1f2937 100%)`
                  }}
                />
                <span className="text-sm text-gray-400 w-12 text-right">{currentWallThickness}px</span>
              </div>
            </div>

            {/* Wall Tile Size Slider */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Texture Tile Size</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={currentWallTileSize}
                  onChange={(e) => handleWallTileSizeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((currentWallTileSize - 50) / 250) * 100}%, #1f2937 ${((currentWallTileSize - 50) / 250) * 100}%, #1f2937 100%)`
                  }}
                />
                <span className="text-sm text-gray-400 w-12 text-right">{currentWallTileSize}px</span>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-dm-border bg-dm-dark/50">
        {activeTab === 'room' && (
          <>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Select shape</strong> in the top of this tab
            </p>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Select Add</strong> or <strong className="text-gray-300">Subtract</strong> mode to build or cut rooms
            </p>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Sliders</strong> handles tile size, wall thickness, and wall texture size
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <strong className="text-gray-300">Merge button</strong> apears when two or more selected rooms are overlapping
            </p>
          </>
        )}
        {activeTab === 'terrain' && (
          <>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Click and drag</strong> to paint environment textures on the background
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <strong className="text-gray-300">Move Slider</strong> to adjust brush size
            </p>
          </>
        )}
        {activeTab === 'walls' && (
          <>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Select </strong> Polyline of Wall line 
            </p>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Select </strong> wall texture to draw with
            </p>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Click and drag</strong> to draw walls 
            </p>
            <p className="text-xs text-gray-400 mt-1">
             <strong className="text-gray-300">Move Sliders</strong> to adjust wall thickness and texture size
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default RoomBuilderPanel;
