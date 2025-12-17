/**
 * ModulesTab - Right panel tab for modular rooms
 * 
 * Contains two sub-tabs:
 * 1. Room Style - Floor style selector with collapsible categories
 * 2. Wall Style - Wall style selector with preview
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Layers } from 'lucide-react';
import { ModularRoomElement, MapElement, WallGroup } from '../../types';
import {
  getFloorStylesApiUrl,
  getFloorImagesApiUrl,
  getWallStylesApiUrl,
  getWallSpriteUrl,
  getPillarSpriteUrl,
  getDoorSpriteUrl,
  parseFloorFilename,
} from '../../utils/modularRooms';
import { DEFAULT_FLOOR_STYLE_ID, DEFAULT_WALL_STYLE_ID } from '../../constants';

interface ModulesTabProps {
  selectedModularRoom: ModularRoomElement | null;
  wallGroups: WallGroup[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  updateWallGroup: (groupId: string, updates: Partial<WallGroup>) => void;
  onStartDragFloor: (floorStyleId: string, tilesW: number, tilesH: number, imageUrl: string) => void;
}

interface FloorStyle {
  id: string;
  name: string;
  floors: FloorImage[];
}

interface FloorImage {
  url: string;
  tilesW: number;
  tilesH: number;
  filename: string;
}

interface WallStyle {
  id: string;
  name: string;
  wallSprite1x: string;
  wallSprite2x: string;
  pillarSprite: string;
  doorSprite: string;
}

const ModulesTab = ({
  selectedModularRoom,
  wallGroups,
  updateElement, // Used for changing floor style
  updateWallGroup,
  onStartDragFloor,
}: ModulesTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'walls'>('rooms');
  const [floorStyles, setFloorStyles] = useState<FloorStyle[]>([]);
  const [wallStyles, setWallStyles] = useState<WallStyle[]>([]);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set([DEFAULT_FLOOR_STYLE_ID]));
  const [loadingFloors, setLoadingFloors] = useState(true);
  const [loadingWalls, setLoadingWalls] = useState(true);
  const [draggedFloor, setDraggedFloor] = useState<{ styleId: string; tilesW: number; tilesH: number; imageUrl: string } | null>(null);

  // Load floor styles
  useEffect(() => {
    const loadFloorStyles = async () => {
      try {
        setLoadingFloors(true);
        
        // First, get list of floor style folders
        const response = await fetch(getFloorStylesApiUrl());
        const data = await response.json();
        const folders = data.folders || [];
        
        // For each folder, load the floor images
        const styles: FloorStyle[] = [];
        
        for (const folder of folders) {
          const styleId = folder.name.replace(/\/$/, ''); // Remove trailing slash
          const imagesResponse = await fetch(getFloorImagesApiUrl(styleId));
          const imagesData = await imagesResponse.json();
          const files = imagesData.files || imagesData || [];
          
          const floors: FloorImage[] = [];
          for (const file of files) {
            const dimensions = parseFloorFilename(file.name);
            if (dimensions) {
              floors.push({
                url: file.download_url,
                tilesW: dimensions.tilesW,
                tilesH: dimensions.tilesH,
                filename: file.name,
              });
            }
          }
          
          if (floors.length > 0) {
            styles.push({
              id: styleId,
              name: styleId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              floors: floors.sort((a, b) => (a.tilesW * a.tilesH) - (b.tilesW * b.tilesH)),
            });
          }
        }
        
        setFloorStyles(styles);
      } catch (error) {
        console.error('Failed to load floor styles:', error);
      } finally {
        setLoadingFloors(false);
      }
    };

    loadFloorStyles();
  }, []);

  // Load wall styles
  useEffect(() => {
    const loadWallStyles = async () => {
      try {
        setLoadingWalls(true);
        
        const response = await fetch(getWallStylesApiUrl());
        const data = await response.json();
        const folders = data.folders || [];
        
        const styles: WallStyle[] = folders.map((folder: { name: string }) => {
          const styleId = folder.name.replace(/\/$/, '');
          return {
            id: styleId,
            name: styleId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            wallSprite1x: getWallSpriteUrl(styleId, 1),
            wallSprite2x: getWallSpriteUrl(styleId, 2),
            pillarSprite: getPillarSpriteUrl(styleId),
            doorSprite: getDoorSpriteUrl(styleId),
          };
        });
        
        setWallStyles(styles);
      } catch (error) {
        console.error('Failed to load wall styles:', error);
      } finally {
        setLoadingWalls(false);
      }
    };

    loadWallStyles();
  }, []);

  const toggleStyleExpanded = (styleId: string) => {
    setExpandedStyles(prev => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  };

  const handleFloorDragStart = (
    e: React.DragEvent,
    styleId: string,
    tilesW: number,
    tilesH: number,
    imageUrl: string
  ) => {
    e.dataTransfer.setData('application/modular-floor', JSON.stringify({
      styleId,
      tilesW,
      tilesH,
      imageUrl,
    }));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Use transparent 1x1 pixel image to hide native drag preview
    // Our custom preview in Canvas.tsx will be shown instead
    const transparentImg = new Image();
    transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(transparentImg, 0, 0);
    
    setDraggedFloor({ styleId, tilesW, tilesH, imageUrl });
    onStartDragFloor(styleId, tilesW, tilesH, imageUrl);
  };

  const handleFloorDragEnd = () => {
    setDraggedFloor(null);
  };

  const handleWallStyleChange = (styleId: string) => {
    if (selectedModularRoom) {
      // Find the wall group for this room and update its style
      const wallGroup = wallGroups.find(g => g.id === selectedModularRoom.wallGroupId);
      if (wallGroup) {
        updateWallGroup(wallGroup.id, { wallStyleId: styleId });
      }
    }
  };

  // Get current wall style for selected room
  const currentWallStyleId = selectedModularRoom
    ? wallGroups.find(g => g.id === selectedModularRoom.wallGroupId)?.wallStyleId || DEFAULT_WALL_STYLE_ID
    : DEFAULT_WALL_STYLE_ID;

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Sub-tab Navigation */}
      <div className="flex gap-1 p-2 border-b border-dm-border">
        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
            activeSubTab === 'rooms'
              ? 'bg-dm-highlight/20 text-dm-highlight border border-dm-highlight/30'
              : 'bg-dm-dark/30 text-gray-400 hover:text-gray-300 border border-transparent'
          }`}
        >
          <Layers className="w-3 h-3 inline-block mr-1" />
          Room Style
        </button>
        <button
          onClick={() => setActiveSubTab('walls')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
            activeSubTab === 'walls'
              ? 'bg-dm-highlight/20 text-dm-highlight border border-dm-highlight/30'
              : 'bg-dm-dark/30 text-gray-400 hover:text-gray-300 border border-transparent'
          }`}
        >
          <GripVertical className="w-3 h-3 inline-block mr-1" />
          Wall Style
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSubTab === 'rooms' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">
              Drag floor tiles onto the canvas to place modular rooms.
            </p>
            
            {loadingFloors ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dm-highlight"></div>
              </div>
            ) : floorStyles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No floor styles found</p>
                <p className="text-xs mt-1">Add floor images to modular-rooms/floors/</p>
              </div>
            ) : (
              floorStyles.map(style => {
                // Get the smallest floor image for preview (usually 1x1 or 2x2)
                const previewFloor = style.floors.length > 0 
                  ? style.floors.reduce((smallest, floor) => 
                      (floor.tilesW * floor.tilesH) < (smallest.tilesW * smallest.tilesH) ? floor : smallest
                    )
                  : null;
                
                return (
                <div key={style.id} className="border border-dm-border rounded-lg overflow-hidden">
                  {/* Style Header with floor preview background */}
                  <div
                    onClick={() => {
                      // Click on header selects the floor style for the selected room
                      if (selectedModularRoom) {
                        updateElement(selectedModularRoom.id, { floorStyleId: style.id });
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 hover:brightness-110 transition-all relative overflow-hidden cursor-pointer ${
                      selectedModularRoom?.floorStyleId === style.id ? 'ring-1 ring-dm-highlight' : ''
                    }`}
                  >
                    {/* Background preview with gradient fade to edges */}
                    {previewFloor && (
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${previewFloor.url})`,
                          backgroundSize: '64px 64px',
                          backgroundRepeat: 'repeat',
                          backgroundPosition: 'center',
                          mask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                          WebkitMask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                        }}
                      />
                    )}
                    <span 
                      className="text-sm font-medium text-white relative z-10"
                      style={{
                        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 1px 1px 2px rgba(0,0,0,0.9)',
                      }}
                    >
                      {style.name}
                    </span>
                    {/* Arrow button - click to expand/collapse */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger parent click
                        toggleStyleExpanded(style.id);
                      }}
                      className="relative z-10 p-1 hover:bg-black/30 rounded transition-colors"
                    >
                      {expandedStyles.has(style.id) ? (
                        <ChevronDown className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }} />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }} />
                      )}
                    </button>
                  </div>
                  
                  {/* Floor Images */}
                  {expandedStyles.has(style.id) && (
                    <div className="p-2 grid grid-cols-2 gap-2">
                      {style.floors.map(floor => (
                        <div
                          key={floor.filename}
                          draggable
                          onDragStart={(e) => handleFloorDragStart(e, style.id, floor.tilesW, floor.tilesH, floor.url)}
                          onDragEnd={handleFloorDragEnd}
                          className={`relative cursor-grab active:cursor-grabbing rounded border border-dm-border/50 overflow-hidden hover:border-dm-highlight/50 transition-colors ${
                            draggedFloor?.imageUrl === floor.url ? 'opacity-50' : ''
                          }`}
                          title={`${floor.tilesW}×${floor.tilesH} tiles`}
                        >
                          <img
                            src={floor.url}
                            alt={`${floor.tilesW}×${floor.tilesH}`}
                            className="w-full h-auto"
                            draggable={false}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-gray-300 text-center">
                            {floor.tilesW}×{floor.tilesH}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );})
            )}
          </div>
        )}

        {activeSubTab === 'walls' && (
          <div className="space-y-3">
            {selectedModularRoom ? (
              <>
                <p className="text-xs text-gray-400">
                  Select a wall style for this modular room group.
                </p>
                
                {loadingWalls ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dm-highlight"></div>
                  </div>
                ) : wallStyles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No wall styles found</p>
                    <p className="text-xs mt-1">Add wall assets to modular-rooms/walls/</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wallStyles.map(style => (
                      <button
                        key={style.id}
                        onClick={() => handleWallStyleChange(style.id)}
                        className={`w-full p-3 rounded-lg border transition-all ${
                          currentWallStyleId === style.id
                            ? 'border-dm-highlight bg-dm-highlight/10'
                            : 'border-dm-border hover:border-dm-border/80 hover:bg-dm-dark/20'
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-200 mb-2">{style.name}</div>
                        <div className="flex gap-2">
                          {/* Wall preview */}
                          <div className="flex-1 bg-dm-dark/50 rounded p-1">
                            <img
                              src={style.wallSprite1x}
                              alt="Wall"
                              className="w-full h-8 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          {/* Pillar preview */}
                          <div className="w-10 h-10 bg-dm-dark/50 rounded p-1 flex items-center justify-center">
                            <img
                              src={style.pillarSprite}
                              alt="Pillar"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Select a modular room</p>
                <p className="text-xs mt-1">to change its wall style</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulesTab;
