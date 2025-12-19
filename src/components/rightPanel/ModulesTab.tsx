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
import { DEFAULT_FLOOR_STYLE_ID } from '../../constants';

interface ModulesTabProps {
  selectedModularRoom: ModularRoomElement | null;
  selectedModularRooms: ModularRoomElement[]; // All selected modular rooms
  wallGroups: WallGroup[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  updateWallGroup: (groupId: string, updates: Partial<WallGroup>) => void;
  onStartDragFloor: (floorStyleId: string, tilesW: number, tilesH: number, imageUrl: string) => void;
  // Default wall style for new rooms
  defaultWallStyleId: string;
  onDefaultWallStyleChange: (styleId: string) => void;
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

// Module-level cache to avoid reloading on every mount
let cachedFloorStyles: FloorStyle[] | null = null;
let cachedWallStyles: WallStyle[] | null = null;
let floorStylesPromise: Promise<FloorStyle[]> | null = null;
let wallStylesPromise: Promise<WallStyle[]> | null = null;
let imagesPreloaded = false;

/**
 * Preload images into browser cache
 */
const preloadImages = (urls: string[]): void => {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

/**
 * Preload floor and wall styles during loading screen.
 * This starts the fetch early so data is ready when user opens Modules tab.
 * Also preloads all floor and wall sprite images into browser cache.
 */
export const preloadModuleStyles = (): void => {
  // Start loading floor styles if not already cached or loading
  if (!cachedFloorStyles && !floorStylesPromise) {
    floorStylesPromise = (async (): Promise<FloorStyle[]> => {
      try {
        const response = await fetch(getFloorStylesApiUrl());
        const data = await response.json();
        const folders = data.folders || [];
        
        const styles: FloorStyle[] = [];
        const allFloorImageUrls: string[] = [];
        
        for (const folder of folders) {
          const styleId = folder.name.replace(/\/$/, '');
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
              allFloorImageUrls.push(file.download_url);
            }
          }
          
          if (floors.length > 0) {
            styles.push({
              id: styleId,
              name: styleId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              floors: floors.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true })),
            });
          }
        }
        
        // Preload all floor images
        if (!imagesPreloaded) {
          console.log(`[Preload] Preloading ${allFloorImageUrls.length} floor tile images...`);
          preloadImages(allFloorImageUrls);
        }
        
        cachedFloorStyles = styles;
        return styles;
      } catch (error) {
        console.error('Failed to preload floor styles:', error);
        return [];
      }
    })();
  }

  // Start loading wall styles if not already cached or loading
  if (!cachedWallStyles && !wallStylesPromise) {
    wallStylesPromise = (async (): Promise<WallStyle[]> => {
      try {
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
        
        // Preload all wall sprite images
        if (!imagesPreloaded) {
          const wallImageUrls = styles.flatMap(s => [s.wallSprite1x, s.wallSprite2x, s.pillarSprite, s.doorSprite]);
          console.log(`[Preload] Preloading ${wallImageUrls.length} wall sprite images...`);
          preloadImages(wallImageUrls);
          imagesPreloaded = true;
        }
        
        cachedWallStyles = styles;
        return styles;
      } catch (error) {
        console.error('Failed to preload wall styles:', error);
        return [];
      }
    })();
  }
};

const ModulesTab = ({
  selectedModularRoom,
  selectedModularRooms = [],
  wallGroups,
  updateElement, // Used for changing floor style
  updateWallGroup,
  onStartDragFloor,
  defaultWallStyleId,
  onDefaultWallStyleChange,
}: ModulesTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'walls'>('rooms');
  const [floorStyles, setFloorStyles] = useState<FloorStyle[]>(cachedFloorStyles || []);
  const [wallStyles, setWallStyles] = useState<WallStyle[]>(cachedWallStyles || []);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set([DEFAULT_FLOOR_STYLE_ID]));
  const [loadingFloors, setLoadingFloors] = useState(!cachedFloorStyles);
  const [loadingWalls, setLoadingWalls] = useState(!cachedWallStyles);
  const [draggedFloor, setDraggedFloor] = useState<{ styleId: string; tilesW: number; tilesH: number; imageUrl: string } | null>(null);

  // Load floor styles (with caching)
  useEffect(() => {
    // If already cached, use cached data
    if (cachedFloorStyles) {
      setFloorStyles(cachedFloorStyles);
      setLoadingFloors(false);
      return;
    }

    // If already loading, wait for the existing promise
    if (floorStylesPromise) {
      floorStylesPromise.then(styles => {
        setFloorStyles(styles);
        setLoadingFloors(false);
      });
      return;
    }

    const loadFloorStyles = async (): Promise<FloorStyle[]> => {
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
              floors: floors.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true })),
            });
          }
        }
        
        // Cache the results
        cachedFloorStyles = styles;
        return styles;
      } catch (error) {
        console.error('Failed to load floor styles:', error);
        return [];
      }
    };

    floorStylesPromise = loadFloorStyles();
    floorStylesPromise.then(styles => {
      setFloorStyles(styles);
      setLoadingFloors(false);
    });
  }, []);

  // Load wall styles (with caching)
  useEffect(() => {
    // If already cached, use cached data
    if (cachedWallStyles) {
      setWallStyles(cachedWallStyles);
      setLoadingWalls(false);
      return;
    }

    // If already loading, wait for the existing promise
    if (wallStylesPromise) {
      wallStylesPromise.then(styles => {
        setWallStyles(styles);
        setLoadingWalls(false);
      });
      return;
    }

    const loadWallStyles = async (): Promise<WallStyle[]> => {
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
        
        // Cache the results
        cachedWallStyles = styles;
        return styles;
      } catch (error) {
        console.error('Failed to load wall styles:', error);
        return [];
      }
    };

    wallStylesPromise = loadWallStyles();
    wallStylesPromise.then(styles => {
      setWallStyles(styles);
      setLoadingWalls(false);
    });
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
    // If we have multiple selected rooms, update all their wall groups
    if (selectedModularRooms.length > 0) {
      // Collect unique wall group IDs from all selected rooms
      const wallGroupIds = new Set<string>();
      selectedModularRooms.forEach(room => {
        if (room.wallGroupId) {
          wallGroupIds.add(room.wallGroupId);
        }
      });
      // Update all wall groups
      wallGroupIds.forEach(groupId => {
        updateWallGroup(groupId, { wallStyleId: styleId });
      });
    } else if (selectedModularRoom) {
      // Single selected room fallback
      const wallGroup = wallGroups.find(g => g.id === selectedModularRoom.wallGroupId);
      if (wallGroup) {
        updateWallGroup(wallGroup.id, { wallStyleId: styleId });
      }
    } else {
      // No room selected - update the default wall style for new rooms
      onDefaultWallStyleChange(styleId);
    }
  };

  // Handle floor style change for multi-selection
  const handleFloorStyleChange = (styleId: string) => {
    if (selectedModularRooms.length > 0) {
      // Update all selected rooms individually
      selectedModularRooms.forEach(room => {
        updateElement(room.id, { floorStyleId: styleId });
      });
    } else if (selectedModularRoom) {
      updateElement(selectedModularRoom.id, { floorStyleId: styleId });
    }
  };

  // Get current wall style - from selected room if any, otherwise use default
  const currentWallStyleId = selectedModularRoom
    ? wallGroups.find(g => g.id === selectedModularRoom.wallGroupId)?.wallStyleId || defaultWallStyleId
    : defaultWallStyleId;

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
              {selectedModularRooms.length > 0 || selectedModularRoom
                ? 'Click a style to apply to selected rooms. Drag floor tiles to place new rooms.'
                : 'Drag floor tiles onto the canvas to place modular rooms.'}
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
                      // Click on header selects the floor style for all selected rooms
                      handleFloorStyleChange(style.id);
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
                    <div className="p-1.5 grid grid-cols-4 gap-1">
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
                          <div className="aspect-square">
                            <img
                              src={floor.url}
                              alt={`${floor.tilesW}×${floor.tilesH}`}
                              className="w-full h-full object-cover"
                              draggable={false}
                            />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-0.5 py-0 text-[9px] text-gray-300 text-center">
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
          <div className="space-y-0.5">
            <p className="text-xs text-gray-400 mb-1">
              {selectedModularRooms.length > 0 || selectedModularRoom 
                ? 'Select a wall style. Changes apply to all connected rooms.'
                : 'Select a wall style for new rooms.'}
            </p>
            
            {loadingWalls ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dm-highlight"></div>
              </div>
            ) : wallStyles.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No wall styles found</p>
                <p className="text-xs mt-1">Add wall assets to modular-rooms/walls/</p>
              </div>
            ) : (
              wallStyles.map(style => (
                <div 
                  key={style.id} 
                  onClick={() => handleWallStyleChange(style.id)}
                  className={`border border-dm-border rounded overflow-hidden cursor-pointer transition-all hover:brightness-110 ${
                    currentWallStyleId === style.id ? 'ring-1 ring-dm-highlight' : ''
                  }`}
                >
                  {/* Style Header with wall preview background */}
                  <div
                    className="w-full flex items-center justify-between px-1.5 py-0.5 relative overflow-hidden"
                  >
                    {/* Background preview with wall texture */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${style.wallSprite2x})`,
                        backgroundSize: '128px 32px',
                        backgroundRepeat: 'repeat-x',
                        backgroundPosition: 'center',
                        mask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                        WebkitMask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                      }}
                    />
                    <span 
                      className="text-sm font-medium text-white relative z-10 flex-1"
                      style={{
                        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 1px 1px 2px rgba(0,0,0,0.9)',
                      }}
                    >
                      {style.name}
                    </span>
                    {/* Pillar preview on the right */}
                    <div className="relative z-10 w-6 h-6 flex items-center justify-center">
                      <img
                        src={style.pillarSprite}
                        alt="Pillar"
                        className="max-w-full max-h-full object-contain"
                        style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulesTab;
