import { useRef, useState, useEffect } from 'react';
import { Scene, MapElement, AnnotationElement, TokenElement, RoomElement, WallElement, ToolType, IconType, ColorType, TokenTemplate, RoomSubTool, Point, TerrainTile, TerrainStamp, TerrainShapeMode, ViewMode, WallOpening } from '../types';
import { Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark, Footprints, Info, Gamepad2, StopCircle } from 'lucide-react';
import Toolbox from './toolbox/Toolbox';
import polygonClipping from 'polygon-clipping';
import { useTextInput } from '../contexts/TextInputContext';

interface CanvasProps {
  scene: Scene | null;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  activeTool: ToolType;
  activeColor: ColorType;
  activeIcon: IconType;
  activeTokenTemplate: TokenTemplate | null;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;
  addElement: (element: MapElement) => void;
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  updateElements: (updates: Map<string, Partial<MapElement>>) => void;
  deleteElements: (ids: string[]) => void;
  replaceElements: (idsToRemove: string[], elementsToAdd: MapElement[]) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  activateAutoCreatedScene: () => void;
  setActiveTool: (tool: ToolType) => void;
  activeSceneId: string | null;
  leftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  showTokenBadges: boolean;
  setShowTokenBadges: (show: boolean) => void;
  onDoubleClickElement?: (elementId: string) => void;
  recentTokens: TokenTemplate[];
  tokenTemplates: TokenTemplate[];
  onSelectToken: (token: TokenTemplate) => void;
  selectedColor: ColorType;
  onColorChange: (color: ColorType) => void;
  selectedFloorTexture: string | null;
  tileSize: number;
  showWalls: boolean;
  selectedWallTexture: string | null;
  wallThickness: number;
  wallTileSize: number;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  onMergeRooms?: (handler: () => void) => void;
  onMergeWalls?: (handler: () => void) => void;
  onCenterElementReady?: (centerFn: (elementId: string) => void) => void;
  selectedBackgroundTexture: string | null;
  backgroundBrushSize: number;
  terrainBrushes: Array<{ name: string; download_url: string }>;
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  wallTextures?: Array<{ name: string; download_url: string }>;
  onSelectWallTexture?: (url: string) => void;
  onSwitchToDrawTab: () => void;
  wallCutterToolBrushSize: number;
  setWallCutterToolBrushSize: (size: number) => void;
  xlabShapeMode: TerrainShapeMode;
  setXlabShapeMode: (mode: TerrainShapeMode) => void;
  onElementSelected?: (elementId: string) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

// Visual stacking order (back → front):
// Layer 1: Map (base background image or infinite canvas background)
// Layer 2: Terrain brush (tile-based terrain painting)
// Layer 3: Floor tiles (floor parts of rooms, floor textures)
// Layer 4: Grid (grid pattern overlay)
// Layer 5: Wall textures (walls, wall strokes/segments)
// Layer 6: Tokens (tokens, creatures, NPCs, markers - interactive elements on top)

const Z_MAP = 0;          // Layer 1: Map background
const Z_TERRAIN = 1;      // Layer 2: Terrain brush tiles
const Z_FLOOR = 2;        // Layer 3: Floor tiles (room floors)
const Z_GRID = 3;         // Layer 4: Grid overlay
const Z_WALL = 4;         // Layer 5: Wall textures
const Z_TOKENS = 5;       // Layer 6: Tokens and interactive elements

// Element base offsets for scene.elements
// Rooms are split into floor (below grid) and walls (above grid)

const Canvas = ({
  scene,
  viewMode,
  onToggleViewMode,
  activeTool,
  activeColor,
  activeIcon,
  activeTokenTemplate,
  selectedElementId,
  setSelectedElementId,
  selectedElementIds,
  setSelectedElementIds,
  addElement,
  updateElement,
  updateElements,
  deleteElements,
  replaceElements,
  updateScene,
  activateAutoCreatedScene,
  setActiveTool,
  activeSceneId,
  leftPanelOpen,
  onToggleLeftPanel,
  showTokenBadges,
  setShowTokenBadges: _setShowTokenBadges,
  onDoubleClickElement,
  recentTokens,
  tokenTemplates,
  onSelectToken,
  selectedColor,
  onColorChange,
  selectedFloorTexture,
  tileSize,
  showWalls,
  selectedWallTexture,
  wallThickness,
  wallTileSize,
  roomSubTool,
  setRoomSubTool,
  onMergeRooms,
  onMergeWalls,
  onCenterElementReady,
  selectedBackgroundTexture,
  backgroundBrushSize,
  terrainBrushes,
  selectedTerrainBrush,
  onSelectTerrainBrush,
  wallTextures = [],
  onSelectWallTexture = () => {},
  wallCutterToolBrushSize: wallCutterToolBrushSizeProp,
  setWallCutterToolBrushSize: setWallCutterToolBrushSizeProp,
  xlabShapeMode,
  setXlabShapeMode: _setXlabShapeMode,
  onElementSelected,
  onViewportChange
}: CanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Global text input state to disable shortcuts when typing
  const { isUserTyping } = useTextInput();
  
  // Tile-based terrain system
  const TILE_SIZE = 2000; // Each tile is 2000×2000 px
  const [terrainTiles, setTerrainTiles] = useState<Map<string, TerrainTile>>(new Map());
  const tileCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const hasActivatedSceneRef = useRef(false); // Track if we've activated auto-created scene
  const isFillingShapeRef = useRef(false); // Track if we're currently filling a shape (prevents clearing tiles during activation)
  
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0, padding: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedElement, setDraggedElement] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState<{ x: number; y: number } | null>(null);
  const [tempElement, setTempElement] = useState<MapElement | null>(null);
  const [resizingElement, setResizingElement] = useState<{ id: string; handle: string } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [draggedMultiple, setDraggedMultiple] = useState<{ offsetX: number; offsetY: number; initialOffsets?: Map<string, {x: number, y: number}> } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasInitializedViewport, setHasInitializedViewport] = useState(false);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [roomDrawStart, setRoomDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempRoom, setTempRoom] = useState<RoomElement | null>(null);
  const [rotatingElement, setRotatingElement] = useState<{ id: string; startAngle: number; centerX: number; centerY: number; initialRotation: number } | null>(null);
  const [isHoveringRotateHandle, setIsHoveringRotateHandle] = useState(false);
  const [hoveringVertex, setHoveringVertex] = useState<{ id: string; index: number; cursorDirection: string } | null>(null);
  const [hoveringEdge, setHoveringEdge] = useState<{ id: string; edgeIndex: number } | null>(null);
  const [scalingElement, setScalingElement] = useState<{ id: string; cornerIndex: number; startX: number; startY: number; initialVertices: { x: number; y: number }[]; initialHoles?: { x: number; y: number }[][] } | null>(null);
  const [movingVertex, setMovingVertex] = useState<{ id: string; vertexIndex: number; segmentBased?: boolean; holeIndex?: number } | null>(null);
  const [isPaintingBackground, setIsPaintingBackground] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [lastClickedElement, setLastClickedElement] = useState<string | null>(null);
  const [fitToViewLocked, setFitToViewLocked] = useState(false);
  const [zoomLimitError, setZoomLimitError] = useState(false);
  const [canvasInfiniteError, setCanvasInfiniteError] = useState(false);
  const [shouldRotateMap, setShouldRotateMap] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [mergeNotification, setMergeNotification] = useState<string | null>(null);
  const [lockedElementError, setLockedElementError] = useState<string | null>(null);
  const [mergeWidgetConflict, setMergeWidgetConflict] = useState<{
    rooms: RoomElement[];
    mergedVertices: { x: number; y: number }[];
  } | null>(null);
  const [customRoomVertices, setCustomRoomVertices] = useState<{ x: number; y: number }[]>([]);
  const [wallVertices, setWallVertices] = useState<{ x: number; y: number }[]>([]);
  const [wallLineStart, setWallLineStart] = useState<{ x: number; y: number } | null>(null);
  const [wallLinePreview, setWallLinePreview] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [showTokenSubmenuForShift, setShowTokenSubmenuForShift] = useState(false);
  const [showTerrainSubmenuForT, setShowTerrainSubmenuForT] = useState(false);
  const [showGridSubmenuForG, setShowGridSubmenuForG] = useState(false);
  const shiftScrollTimeoutRef = useRef<number | null>(null);
  const [lastBrushStamp, setLastBrushStamp] = useState<{ x: number; y: number } | null>(null);
  const [brushAnchorPoint, setBrushAnchorPoint] = useState<{ x: number; y: number } | null>(null);
  const brushImageRef = useRef<HTMLImageElement | null>(null);

  // X-Lab: Terrain shape fill state (separate from normal terrain brush)
  const [xlabTerrainShapeStart, setXlabTerrainShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [xlabTerrainShapeEnd, setXlabTerrainShapeEnd] = useState<{ x: number; y: number } | null>(null);

  // Wall Cutter Tool state - rectangle mode only
  const wallCutterToolBrushSize = wallCutterToolBrushSizeProp;
  const [wallCutterToolStart, setWallCutterToolStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCutterToolEnd, setWallCutterToolEnd] = useState<{ x: number; y: number } | null>(null);

  // Tile management helper functions
  const getTileKey = (worldX: number, worldY: number): string => {
    const tileX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;
    return `${tileX},${tileY}`;
  };

  const getTileCoords = (tileKey: string): { x: number; y: number } => {
    const [x, y] = tileKey.split(',').map(Number);
    return { x, y };
  };

  const getVisibleTileKeys = (): string[] => {
    if (!containerRef.current) return [];
    
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate world coordinates of viewport corners
    const topLeftX = -viewport.x / viewport.zoom;
    const topLeftY = -viewport.y / viewport.zoom;
    const bottomRightX = (rect.width - viewport.x) / viewport.zoom;
    const bottomRightY = (rect.height - viewport.y) / viewport.zoom;
    
    // Add 1 tile margin
    const startTileX = Math.floor(topLeftX / TILE_SIZE) - 1;
    const startTileY = Math.floor(topLeftY / TILE_SIZE) - 1;
    const endTileX = Math.floor(bottomRightX / TILE_SIZE) + 1;
    const endTileY = Math.floor(bottomRightY / TILE_SIZE) + 1;
    
    const visibleKeys: string[] = [];
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const key = `${tileX * TILE_SIZE},${tileY * TILE_SIZE}`;
        visibleKeys.push(key);
      }
    }
    
    return visibleKeys;
  };

  // Generate unique room name
  const generateRoomName = (): string => {
    if (!scene) return 'Room 1';
    
    const existingRooms = scene.elements.filter(el => el.type === 'room') as RoomElement[];
    const existingNames = new Set(existingRooms.map(r => r.name));
    
    let counter = 1;
    while (existingNames.has(`Room ${counter}`)) {
      counter++;
    }
    return `Room ${counter}`;
  };

  // Generate unique wall name
  const generateWallName = (textureUrl: string = ''): string => {
    if (!scene) return 'Wall 1';
    
    const existingWalls = scene.elements.filter(el => el.type === 'wall') as WallElement[];
    const existingNames = new Set(existingWalls.map(w => w.name || ''));
    
    const textureName = textureUrl ? getTextureName(textureUrl) : '';
    const baseName = textureName ? `${textureName} Wall` : 'Wall';
    
    let counter = 1;
    while (existingNames.has(`${baseName} ${counter}`)) {
      counter++;
    }
    return `${baseName} ${counter}`;
  };

  const generateUniqueName = (baseName: string): string => {
    if (!scene) return baseName;
    
    const existingRooms = scene.elements.filter(el => el.type === 'room') as RoomElement[];
    const existingNames = new Set(existingRooms.map(r => r.name));
    
    // If base name is unique, use it
    if (!existingNames.has(baseName)) {
      return baseName;
    }
    
    // Otherwise add (1), (2), etc.
    let counter = 1;
    while (existingNames.has(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  };

  // Helper to check if roomSubTool is a subtract mode
  const isSubtractMode = (tool: RoomSubTool): boolean => {
    return tool.startsWith('subtract-');
  };

  // Get base shape from subtract tool (e.g., 'subtract-rectangle' -> 'rectangle')
  const getBaseShape = (tool: RoomSubTool): RoomSubTool => {
    if (tool.startsWith('subtract-')) {
      return tool.replace('subtract-', '') as RoomSubTool;
    }
    return tool;
  };

  // Geometry helper functions for polygon operations
  const pointInPolygon = (point: { x: number; y: number }, vertices: { x: number; y: number }[]): boolean => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const distanceToLineSegment = (
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): { distance: number; ratio: number } => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      const dist = Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
      return { distance: dist, ratio: 0 };
    }
    
    let ratio = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    ratio = Math.max(0, Math.min(1, ratio));
    
    const projX = start.x + ratio * dx;
    const projY = start.y + ratio * dy;
    const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    
    return { distance, ratio };
  };

  // Auto-apply fit to view when locked and panel opens/closes OR when map dimensions change
  useEffect(() => {
    if (fitToViewLocked && mapDimensions.width > 0 && mapDimensions.height > 0) {
      applyFitToView();
    }
  }, [leftPanelOpen, fitToViewLocked, mapDimensions.width, mapDimensions.height, shouldRotateMap]);

  // Handle map load and center viewport
  useEffect(() => {
    if (scene && imgRef.current && containerRef.current) {
      const img = imgRef.current;
      const container = containerRef.current;
      
      const handleImageLoad = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        // Check if this is a canvas (transparent background) - infinite drawing area
        const isCanvas = scene.backgroundMapUrl.includes('fill="transparent"') ||
                        scene.backgroundMapUrl.includes('fill=%22transparent%22');
        
        if (isCanvas) {
          // For canvas mode, use scene dimensions if provided, otherwise infinite
          const canvasWidth = scene.width || 0;
          const canvasHeight = scene.height || 0;
          const canvasPadding = 0;
          
          setMapDimensions({ width: canvasWidth, height: canvasHeight, padding: canvasPadding });
          setShouldRotateMap(false);
          
          // For canvas, center viewport on (0,0) in world space
          if (!fitToViewLocked && !hasInitializedViewport) {
            const containerRect = container.getBoundingClientRect();
            // Center the viewport so (0,0) in world space is in center of visible area
            // Account for left panel if open
            const availableWidth = leftPanelOpen ? containerRect.width - 450 : containerRect.width;
            const xOffset = leftPanelOpen ? 450 : 0;
            setViewport({ 
              x: xOffset + availableWidth / 2, 
              y: containerRect.height / 2, 
              zoom: 1 
            });
            setHasInitializedViewport(true);
          }
        } else {
          // Check if image is landscape (width > height) - just set rotation flag
          const isLandscape = width > height;
          setShouldRotateMap(isLandscape);
          
          // Use actual image dimensions - rotation is purely visual via CSS
          const padding = Math.max(width, height) * 0.2;
          
          setMapDimensions({ width, height, padding });
        
          // If NOT fit-to-view locked, center the map
          if (!fitToViewLocked && !hasInitializedViewport) {
            // Center the map in viewport only on initial load when not locked
            const containerRect = container.getBoundingClientRect();
            const visualWidth = isLandscape ? height : width;
            const visualHeight = isLandscape ? width : height;
            const totalWidth = visualWidth + padding * 2;
            const totalHeight = visualHeight + padding * 2;
            
            setViewport({
              x: (containerRect.width - totalWidth) / 2,
              y: (containerRect.height - totalHeight) / 2,
              zoom: 1
            });
            setHasInitializedViewport(true);
          }
        }
        // If fit-to-view IS locked, the useEffect above will handle it
      };
      
      if (img.complete) {
        handleImageLoad();
      } else {
        img.addEventListener('load', handleImageLoad);
        return () => img.removeEventListener('load', handleImageLoad);
      }
    }
  }, [scene, hasInitializedViewport]);

  // Reset initialization flag when scene changes
  useEffect(() => {
    setHasInitializedViewport(false);
    hasActivatedSceneRef.current = false; // Reset terrain activation flag
    // Initialize history with current scene state
    if (scene) {
      setHistory([{ elements: JSON.parse(JSON.stringify(scene.elements)) }]);
      setHistoryIndex(0);
    }
  }, [scene?.id]);

  // Notify parent about viewport changes
  useEffect(() => {
    if (onViewportChange) {
      onViewportChange(viewport);
    }
  }, [viewport, onViewportChange]);

  // Load terrain tiles from scene
  useEffect(() => {
    if (!scene) {
      setTerrainTiles(new Map());
      return;
    }
    
    // Load from new tile-based format if available
    if (scene.terrainTiles) {
      const tilesMap = new Map<string, TerrainTile>();
      Object.entries(scene.terrainTiles).forEach(([key, tile]) => {
        tilesMap.set(key, tile);
      });
      setTerrainTiles(tilesMap);
    }
    // Legacy: convert old terrainStamps to tiles
    else if (scene.terrainStamps && scene.terrainStamps.length > 0) {
      const tilesMap = new Map<string, TerrainTile>();
      scene.terrainStamps.forEach(stamp => {
        const tileKey = getTileKey(stamp.x, stamp.y);
        let tile = tilesMap.get(tileKey);
        if (!tile) {
          const { x, y } = getTileCoords(tileKey);
          tile = { x, y, stamps: [] };
          tilesMap.set(tileKey, tile);
        }
        tile.stamps.push(stamp);
      });
      setTerrainTiles(tilesMap);
    } 
    // Only clear if we're not currently filling a shape (prevents race condition)
    else if (!isFillingShapeRef.current) {
      setTerrainTiles(new Map());
    }
  }, [scene?.id]);

  // Save terrain tiles to scene when they change
  useEffect(() => {
    if (!scene || !activeSceneId) return;
    
    // Convert Map to plain object for JSON serialization
    const tilesObject: { [key: string]: TerrainTile } = {};
    terrainTiles.forEach((tile, key) => {
      tilesObject[key] = tile;
    });
    
    // Only update if tiles actually changed
    const currentTilesJSON = JSON.stringify(scene.terrainTiles || {});
    const newTilesJSON = JSON.stringify(tilesObject);
    
    if (currentTilesJSON !== newTilesJSON) {
      updateScene(activeSceneId, { terrainTiles: tilesObject });
    }
  }, [terrainTiles, scene?.id, activeSceneId]);

  // Expose merge handler to parent (only pass the function reference, don't call it)
  useEffect(() => {
    if (onMergeRooms) {
      onMergeRooms(handleMergeRooms);
    }
  }, [onMergeRooms]);

  // Expose merge walls handler to parent
  useEffect(() => {
    if (onMergeWalls) {
      onMergeWalls(handleMergeWalls);
    }
  }, [onMergeWalls]);

  // Expose center element function to parent
  useEffect(() => {
    if (onCenterElementReady) {
      onCenterElementReady(centerViewportOnElement);
    }
  }, [onCenterElementReady]);

  // Clear custom room vertices when changing tool or room sub-tool
  useEffect(() => {
    if (activeTool !== 'room' || roomSubTool !== 'custom') {
      setCustomRoomVertices([]);
    }
  }, [activeTool, roomSubTool]);

  // Listen for color application from FloatingToolbar
  useEffect(() => {
    const handleApplyColor = (e: CustomEvent<{ color: ColorType }>) => {
      const color = e.detail.color;
      if (selectedElementIds.length > 0) {
        // Apply to all selected elements
        saveToHistory();
        const updates = new Map<string, Partial<MapElement>>();
        selectedElementIds.forEach(id => {
          const element = scene?.elements.find(el => el.id === id);
          if (element && element.type === 'token') {
            updates.set(id, { color });
          }
        });
        if (updates.size > 0) {
          updateElements(updates);
        }
      } else if (selectedElementId) {
        // Apply to single selected element
        const element = scene?.elements.find(el => el.id === selectedElementId);
        if (element && element.type === 'token') {
          saveToHistory();
          updateElement(selectedElementId, { color });
        }
      }
    };

    window.addEventListener('applyColorToSelection', handleApplyColor as EventListener);
    return () => window.removeEventListener('applyColorToSelection', handleApplyColor as EventListener);
  }, [selectedElementId, selectedElementIds, scene, updateElement, updateElements]);

  // Render terrain tiles based on visible tiles
  useEffect(() => {
    const visibleTileKeys = getVisibleTileKeys();
    
    console.log('[TILE RENDER] useEffect triggered, visible tiles:', visibleTileKeys.length, 'total tiles:', terrainTiles.size);
    
    // Render each visible tile
    visibleTileKeys.forEach(tileKey => {
      const tile = terrainTiles.get(tileKey);
      if (!tile) return;
      
      const canvas = tileCanvasRefs.current.get(tileKey);
      if (!canvas) {
        console.log('[TILE RENDER] Canvas not found for tile:', tileKey);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      
      // Render all stamps on this tile
      const imageCache = new Map<string, HTMLImageElement>();
      let pendingImages = 0;
      
      tile.stamps.forEach(stamp => {
        let img = imageCache.get(stamp.textureUrl);
        
        if (!img) {
          img = new Image();
          img.src = stamp.textureUrl;
          imageCache.set(stamp.textureUrl, img);
          
          if (!img.complete) {
            pendingImages++;
            img.onload = () => {
              pendingImages--;
              if (pendingImages === 0) {
                // All images loaded, re-render this tile
                ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                tile.stamps.forEach(s => {
                  const cachedImg = imageCache.get(s.textureUrl);
                  if (cachedImg && cachedImg.complete) {
                    // Convert world coordinates to tile-local coordinates
                    const localX = s.x - tile.x;
                    const localY = s.y - tile.y;
                    ctx.drawImage(
                      cachedImg,
                      localX - s.size / 2,
                      localY - s.size / 2,
                      s.size,
                      s.size
                    );
                  }
                });
              }
            };
          }
        }
        
        if (img.complete) {
          // Convert world coordinates to tile-local coordinates
          const localX = stamp.x - tile.x;
          const localY = stamp.y - tile.y;
          ctx.drawImage(
            img,
            localX - stamp.size / 2,
            localY - stamp.size / 2,
            stamp.size,
            stamp.size
          );
        }
      });
    });
  }, [terrainTiles, viewport.x, viewport.y, viewport.zoom]);

  // Helper to check if text input is focused
  // Helper to check if user is typing (uses global context)
  const isTextInputFocused = (): boolean => {
    return isUserTyping;
  };

  // Helper to get all elements in order
  const getAllElementsInOrder = (): MapElement[] => {
    if (!scene) return [];
    return [...scene.elements].sort((a, b) => {
      const aZ = (a as any).zIndex || 0;
      const bZ = (b as any).zIndex || 0;
      return aZ - bZ;
    });
  };

  // Helper to center viewport on element
  const centerViewportOnElement = (elementId: string) => {
    if (!scene || !containerRef.current) return;
    const element = scene.elements.find(e => e.id === elementId);
    if (!element) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    let elementCenterX: number, elementCenterY: number;
    
    if (element.type === 'room' && element.vertices) {
      // Calculate center from vertices
      const xs = element.vertices.map(v => v.x);
      const ys = element.vertices.map(v => v.y);
      elementCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
      elementCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
    } else if ('x' in element && 'y' in element) {
      // Other elements with x/y
      elementCenterX = element.x;
      elementCenterY = element.y;
    } else {
      return; // Can't center on this element
    }

    setViewport(prev => ({
      ...prev,
      x: centerX - elementCenterX * prev.zoom,
      y: centerY - elementCenterY * prev.zoom
    }));
  };

  // Mouse position state for zoom
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Zoom functions - zoom at mouse position
  const handleZoomIn = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = lastMousePos.x;
    const mouseY = lastMousePos.y;
    
    setViewport(prev => {
      const newZoom = Math.min(prev.zoom * 1.2, 5); // Max 5x zoom
      
      // Calculate world coordinates at mouse position before zoom
      const worldX = (mouseX - prev.x) / prev.zoom;
      const worldY = (mouseY - prev.y) / prev.zoom;
      
      // Calculate new viewport offset to keep world point under mouse
      const newX = mouseX - worldX * newZoom;
      const newY = mouseY - worldY * newZoom;
      
      return {
        ...prev,
        zoom: newZoom,
        x: newX,
        y: newY
      };
    });
  };

  const handleZoomOut = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !mapDimensions.width) return;
    
    const mouseX = lastMousePos.x;
    const mouseY = lastMousePos.y;
    
    setViewport(prev => {
      // Calculate minimum zoom (100% width fit)
      const availableWidth = leftPanelOpen ? rect.width - 450 : rect.width;
      const visualWidth = shouldRotateMap ? mapDimensions.height : mapDimensions.width;
      const minZoomForFit = availableWidth / visualWidth;
      
      // When locked, don't allow zooming out beyond 100% width fit
      const minZoom = fitToViewLocked ? minZoomForFit : 0.1;
      const desiredZoom = prev.zoom / 1.2;
      const newZoom = Math.max(desiredZoom, minZoom);
      
      // Show error if we hit the limit while locked
      if (fitToViewLocked && desiredZoom < minZoomForFit) {
        setZoomLimitError(true);
        setTimeout(() => setZoomLimitError(false), 2000);
      }
      
      // Calculate world coordinates at mouse position before zoom
      const worldX = (mouseX - prev.x) / prev.zoom;
      const worldY = (mouseY - prev.y) / prev.zoom;
      
      // Calculate new viewport offset to keep world point under mouse
      const newX = mouseX - worldX * newZoom;
      const newY = mouseY - worldY * newZoom;
      
      return {
        ...prev,
        zoom: newZoom,
        x: newX,
        y: newY
      };
    });
  };

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<MapElement[]>([]);

  // Undo/Redo state
  const [history, setHistory] = useState<{ elements: MapElement[]; terrainTiles?: { [key: string]: TerrainTile } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save state to history
  const saveToHistory = (customTerrainTiles?: { [key: string]: TerrainTile }) => {
    if (!scene) return;
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Use custom terrainTiles if provided (for brush painting), otherwise use scene.terrainTiles
    const tilesToSave = customTerrainTiles !== undefined 
      ? customTerrainTiles 
      : (scene.terrainTiles ? JSON.parse(JSON.stringify(scene.terrainTiles)) : undefined);
    
    newHistory.push({ 
      elements: JSON.parse(JSON.stringify(scene.elements)),
      terrainTiles: tilesToSave
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0 && scene && activeSceneId) {
      const prevState = history[historyIndex - 1];
      
      // Update scene
      updateScene(activeSceneId, { 
        elements: JSON.parse(JSON.stringify(prevState.elements)),
        terrainTiles: prevState.terrainTiles ? JSON.parse(JSON.stringify(prevState.terrainTiles)) : undefined
      });
      
      // Update local terrainTiles state immediately
      if (prevState.terrainTiles) {
        const tilesMap = new Map<string, TerrainTile>();
        Object.entries(prevState.terrainTiles).forEach(([key, tile]) => {
          tilesMap.set(key, tile);
        });
        setTerrainTiles(tilesMap);
      } else {
        setTerrainTiles(new Map());
      }
      
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1 && scene && activeSceneId) {
      const nextState = history[historyIndex + 1];
      
      // Update scene
      updateScene(activeSceneId, { 
        elements: JSON.parse(JSON.stringify(nextState.elements)),
        terrainTiles: nextState.terrainTiles ? JSON.parse(JSON.stringify(nextState.terrainTiles)) : undefined
      });
      
      // Update local terrainTiles state immediately
      if (nextState.terrainTiles) {
        const tilesMap = new Map<string, TerrainTile>();
        Object.entries(nextState.terrainTiles).forEach(([key, tile]) => {
          tilesMap.set(key, tile);
        });
        setTerrainTiles(tilesMap);
      } else {
        setTerrainTiles(new Map());
      }
      
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Toggle badges on selected tokens individually
  const handleToggleBadges = () => {
    const idsToUpdate = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
    if (idsToUpdate.length === 0) return;
    
    const updates = new Map<string, Partial<MapElement>>();
    idsToUpdate.forEach(id => {
      const element = scene?.elements.find(e => e.id === id);
      if (element && element.type === 'token') {
        const tokenElement = element as TokenElement;
        updates.set(id, { showBadge: !tokenElement.showBadge });
      }
    });
    updateElements(updates);
  };

  // Toggle lock on selected elements
  const handleToggleLock = () => {
    const idsToUpdate = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
    if (idsToUpdate.length === 0) return;
    
    const updates = new Map<string, Partial<MapElement>>();
    idsToUpdate.forEach(id => {
      const element = scene?.elements.find(e => e.id === id);
      if (element) {
        updates.set(id, { locked: !element.locked });
      }
    });
    updateElements(updates);
  };

  // Apply fit to view - zoom map to fill container width exactly (100% width only)
  const applyFitToView = () => {
    if (!containerRef.current || !mapDimensions.width || !mapDimensions.height) return;

    // Check if this is a canvas scene (infinite drawing area)
    const isCanvas = scene?.backgroundMapUrl.includes('fill="transparent"') ||
                    scene?.backgroundMapUrl.includes('fill=%22transparent%22');
    if (isCanvas) {
      setCanvasInfiniteError(true);
      setTimeout(() => setCanvasInfiniteError(false), 3000);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Account for left panel width when it's open (450px fixed width)
    const availableWidth = leftPanelOpen ? containerRect.width - 450 : containerRect.width;
    
    // When rotated, the visual width is the height and visual height is the width
    const visualWidth = shouldRotateMap ? mapDimensions.height : mapDimensions.width;
    const visualHeight = shouldRotateMap ? mapDimensions.width : mapDimensions.height;
    
    // Calculate zoom based on map image width only (not including padding)
    const newZoom = availableWidth / visualWidth;
    
    // The map image dimensions when scaled
    const scaledHeight = visualHeight * newZoom;
    const scaledPadding = mapDimensions.padding * newZoom;
    
    // Position to center the map image (not the padded container)
    const xOffset = leftPanelOpen ? 450 : 0;
    setViewport({
      x: xOffset - scaledPadding,
      y: (containerRect.height - scaledHeight) / 2 - scaledPadding,
      zoom: newZoom
    });
  };

  // Toggle fit to view lock
  const handleFitToView = () => {
    // Check if this is a canvas scene - don't allow fit to view on infinite canvas
    const isCanvas = scene?.backgroundMapUrl.includes('fill="transparent"') ||
                    scene?.backgroundMapUrl.includes('fill=%22transparent%22');
    if (isCanvas) {
      setCanvasInfiniteError(true);
      setTimeout(() => setCanvasInfiniteError(false), 3000);
      return;
    }
    
    setFitToViewLocked(!fitToViewLocked);
    if (!fitToViewLocked) {
      applyFitToView();
    }
  };

  // Toolbar action handlers
  const handleDuplicate = () => {
    if (!scene || !activeSceneId) return;
    const toDuplicate = selectedElementIds.length > 0 
      ? scene.elements.filter(el => selectedElementIds.includes(el.id))
      : selectedElementId 
        ? scene.elements.filter(el => el.id === selectedElementId)
        : [];

    if (toDuplicate.length > 0) {
      saveToHistory();
      
      // Calculate offset that ensures no overlap with original
      // Use a fixed offset based on average element size
      const totalSize = toDuplicate.reduce((sum, el) => {
        if (el.type === 'room' && el.vertices) {
          const xs = el.vertices.map(v => v.x);
          const ys = el.vertices.map(v => v.y);
          return sum + Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        } else if ('size' in el) {
          return sum + el.size;
        }
        return sum;
      }, 0);
      const avgSize = totalSize / toDuplicate.length;
      const offset = avgSize * 0.7; // 70% of average size ensures no overlap

      const duplicates = toDuplicate.map(el => {
        if (el.type === 'room' && el.vertices) {
          const room = el as RoomElement;
          return {
            ...room,
            id: `${el.type}-${Date.now()}-${Math.random()}`,
            name: generateUniqueName(room.name || 'Room'),
            vertices: room.vertices.map(v => ({ x: v.x + offset, y: v.y + offset })),
            holes: room.holes?.map(hole =>
              hole.map(v => ({ x: v.x + offset, y: v.y + offset }))
            )
          };
        } else if ('x' in el && 'y' in el) {
          return {
            ...el,
            id: `${el.type}-${Date.now()}-${Math.random()}`,
            x: el.x + offset,
            y: el.y + offset
          };
        }
        return el; // Fallback
      });

      updateScene(activeSceneId, {
        elements: [...scene.elements, ...duplicates]
      });
      // Always select the duplicated elements
      setSelectedElementIds(duplicates.map(el => el.id));
      setSelectedElementId(null);
    }
  };

  const handleDelete = () => {
    if (selectedElementIds.length > 0) {
      saveToHistory();
      deleteElements(selectedElementIds);
    } else if (selectedElementId) {
      saveToHistory();
      deleteElements([selectedElementId]);
    }
  };

  const handleLayerUp = () => {
    if (!scene || !activeSceneId) return;
    const selectedIds = selectedElementIds.length > 0 
      ? selectedElementIds 
      : selectedElementId 
        ? [selectedElementId] 
        : [];

    if (selectedIds.length === 0) return;

    saveToHistory();
    const updatedElements = scene.elements.map(el => {
      if (selectedIds.includes(el.id)) {
        const currentZ = (el as any).zIndex || 0;
        const newZ = currentZ + 1;
        // Rooms stay in range -200 to -1, tokens/others stay in range 0+
        if (el.type === 'room') {
          return { ...el, zIndex: Math.min(newZ, -1) };
        } else {
          return { ...el, zIndex: Math.max(newZ, 0) };
        }
      }
      return el;
    });

    updateScene(activeSceneId, { elements: updatedElements });
  };

  const handleLayerDown = () => {
    if (!scene || !activeSceneId) return;
    const selectedIds = selectedElementIds.length > 0 
      ? selectedElementIds 
      : selectedElementId 
        ? [selectedElementId] 
        : [];

    if (selectedIds.length === 0) return;

    saveToHistory();
    const updatedElements = scene.elements.map(el => {
      if (selectedIds.includes(el.id)) {
        const currentZ = (el as any).zIndex || 0;
        const newZ = currentZ - 1;
        // Rooms stay in range -200 to -1, tokens/others stay in range 0+
        if (el.type === 'room') {
          return { ...el, zIndex: Math.max(newZ, -200) };
        } else {
          return { ...el, zIndex: Math.max(newZ, 0) };
        }
      }
      return el;
    });

    updateScene(activeSceneId, { elements: updatedElements });
  };

  // Check if two rooms overlap or touch (considering wall thickness)
  const doRoomsOverlap = (room1: RoomElement, room2: RoomElement): boolean => {
    if (!room1.vertices || !room2.vertices) return false;

    // Use the maximum wall thickness from both rooms as tolerance
    const wallThickness1 = room1.wallThickness || wallThickness;
    const wallThickness2 = room2.wallThickness || wallThickness;
    const tolerance = Math.max(wallThickness1, wallThickness2);

    const getBounds = (vertices: { x: number; y: number }[]) => {
      const xs = vertices.map(v => v.x);
      const ys = vertices.map(v => v.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
    };

    const bounds1 = getBounds(room1.vertices);
    const bounds2 = getBounds(room2.vertices);

    // Expand bounds by tolerance to detect touching walls
    const expandedBounds1 = {
      minX: bounds1.minX - tolerance,
      maxX: bounds1.maxX + tolerance,
      minY: bounds1.minY - tolerance,
      maxY: bounds1.maxY + tolerance
    };

    // Check if expanded boxes overlap (this includes touching walls)
    return !(expandedBounds1.maxX < bounds2.minX || 
             expandedBounds1.minX > bounds2.maxX || 
             expandedBounds1.maxY < bounds2.minY || 
             expandedBounds1.minY > bounds2.maxY);
  };

  const completeCustomRoom = async (selectedRoom?: RoomElement) => {
    if (!scene || !activeSceneId || customRoomVertices.length < 3) return;
    
    // Check if in subtract mode
    if (isSubtractMode(roomSubTool)) {
      // Perform subtract operation with custom polygon
      const polygonClipping = await import('polygon-clipping');
      
      const subtractVertices = [...customRoomVertices];
      const roomsToSubtract = scene.elements.filter(el => {
        if (el.type !== 'room' || !el.vertices) return false;
        
        // Check if ANY vertex of the subtract polygon is inside the room
        const hasVertexInside = subtractVertices.some(v => pointInPolygon(v, el.vertices!));
        
        // Also check if ANY vertex of the room is inside the subtract polygon
        const hasRoomVertexInside = el.vertices.some(v => pointInPolygon(v, subtractVertices));
        
        return hasVertexInside || hasRoomVertexInside;
      });
      
      if (roomsToSubtract.length > 0) {
        saveToHistory();
        
        const roomsToDelete = new Set<string>();
        const newRooms: RoomElement[] = [];
        
        roomsToSubtract.forEach(room => {
          if (room.type !== 'room' || !room.vertices) return;
          
          try {
            const roomPoly = [
              room.vertices.map(v => [v.x, v.y]),
              ...(room.holes || []).map(hole => hole.map(v => [v.x, v.y]))
            ];
            const subtractPoly = [subtractVertices.map(v => [v.x, v.y])];
            
            const result = polygonClipping.default.difference(roomPoly as any, subtractPoly as any);
            
            if (result.length > 0) {
              roomsToDelete.add(room.id);
              
              result.forEach((polygon, polyIdx) => {
                if (polygon.length >= 1) {
                  const outerRing = polygon[0].map(([x, y]) => ({ x, y }));
                  const holes = polygon.slice(1).map(ring => 
                    ring.map(([x, y]) => ({ x, y }))
                  );
                  
                  if (outerRing.length >= 3) {
                    const newRoom: RoomElement = {
                      ...room,
                      id: polyIdx === 0 ? room.id : `room-${Date.now()}-${polyIdx}`,
                      name: polyIdx === 0 ? room.name : generateUniqueName(room.name || 'Room'),
                      vertices: outerRing,
                      holes: holes.length > 0 ? holes : undefined
                    };
                    newRooms.push(newRoom);
                  }
                }
              });
            }
          } catch (error) {
            console.error('Subtract operation failed:', error);
          }
        });
        
        if (activeSceneId && (roomsToDelete.size > 0 || newRooms.length > 0)) {
          const updatedElements = scene.elements.filter(el => !roomsToDelete.has(el.id));
          updatedElements.push(...newRooms);
          updateScene(activeSceneId, { elements: updatedElements });
        }
      }
      
      setCustomRoomVertices([]);
      return;
    }
    
    // Normal room creation (not subtract mode)
    const useFloorTexture = selectedRoom?.floorTextureUrl || selectedFloorTexture;
    
    if (!useFloorTexture) {
      console.warn('[CUSTOM ROOM] No floor texture selected!');
      return;
    }
    
    saveToHistory();
    
    const useTileSize = selectedRoom?.tileSize || tileSize;
    const useShowWalls = selectedRoom?.showWalls ?? showWalls;
    const useWallTexture = selectedRoom?.wallTextureUrl || selectedWallTexture || '';
    const useWallThickness = selectedRoom?.wallThickness || wallThickness;
    const useWallTileSize = selectedRoom?.wallTileSize || wallTileSize;
    
    const newRoom: RoomElement = {
      id: `room-${Date.now()}-${Math.random()}`,
      type: 'room',
      vertices: [...customRoomVertices],
      wallOpenings: [],
      floorTextureUrl: useFloorTexture,
      tileSize: useTileSize,
      showWalls: useShowWalls,
      wallTextureUrl: useWallTexture,
      wallThickness: useWallThickness,
      wallTileSize: useWallTileSize,
      name: generateRoomName(),
      notes: '',
      zIndex: -100,
      visible: true,
      widgets: []
    };
    
    updateScene(activeSceneId, {
      elements: [...scene.elements, newRoom]
    });
    
    setCustomRoomVertices([]);
    setSelectedElementId(newRoom.id);
  };

  // Helper function to extract texture name from URL
  const getTextureName = (url: string): string => {
    if (!url || url === 'transparent') return 'Wall';
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0].replace(/_/g, ' ');
  };

  const completeWall = () => {
    if (!scene || !activeSceneId) {
      // Just clear vertices if no scene
      setWallVertices([]);
      return;
    }
    
    if (wallVertices.length < 2) {
      // If less than 2 vertices, just clear without creating wall
      setWallVertices([]);
      return;
    }

    console.log('[WALL DRAW] Completing wall with', wallVertices.length, 'vertices');
    
    const newWall: WallElement = {
      id: `wall-${Date.now()}-${Math.random()}`,
      type: 'wall',
      vertices: [...wallVertices],
      wallTextureUrl: selectedWallTexture || '',
      wallThickness: wallThickness,
      wallTileSize: wallTileSize,
      name: generateWallName(selectedWallTexture || ''),
      notes: '',
      zIndex: -99,
      visible: true,
      widgets: [],
      locked: false
    };

    // Save history AFTER adding wall
    const newElements = [...scene.elements, newWall];
    const newHistoryEntry = {
      elements: newElements,
      terrainTiles: (() => {
        const tilesObj: { [key: string]: TerrainTile } = {};
        terrainTiles.forEach((tile, key) => {
          tilesObj[key] = tile;
        });
        return tilesObj;
      })()
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newHistoryEntry]);
    setHistoryIndex(prev => prev + 1);

    updateScene(activeSceneId, {
      elements: newElements
    });

    setWallVertices([]);
    setSelectedElementId(newWall.id);
  };

  // Auto-complete polyline when switching away from wall tool
  useEffect(() => {
    // If we have vertices but are no longer using wall tool, complete the wall
    if (wallVertices.length > 0 && activeTool !== 'wall') {
      console.log('[WALL AUTO-COMPLETE] Tool changed to', activeTool, '- completing wall');
      completeWall();
    }
  }, [activeTool]);

  const handleWidgetConflictResolved = (selectedRoomId: string | 'all') => {
    if (!mergeWidgetConflict || !scene || !activeSceneId) return;
    
    saveToHistory(); // Save history when conflict is resolved
    
    const { rooms, mergedVertices } = mergeWidgetConflict;
    
    // Determine which widgets to use
    let widgetsToUse: any[] = [];
    if (selectedRoomId === 'all') {
      // Combine all widgets from all rooms
      rooms.forEach(room => {
        if (room.widgets && room.widgets.length > 0) {
          widgetsToUse = [...widgetsToUse, ...room.widgets];
        }
      });
      // Re-order widgets
      widgetsToUse = widgetsToUse.map((w, idx) => ({ ...w, order: idx }));
    } else {
      // Use widgets from selected room
      const selectedRoom = rooms.find(r => r.id === selectedRoomId);
      if (selectedRoom && selectedRoom.widgets) {
        widgetsToUse = selectedRoom.widgets;
      }
    }
    
    // Create merged room
    const firstRoom = rooms[0];
    const mergedRoom: RoomElement = {
      ...firstRoom,
      id: `room-${Date.now()}-${Math.random()}`,
      name: generateUniqueName(firstRoom.name || 'Room'),
      vertices: mergedVertices,
      wallOpenings: [],
      widgets: widgetsToUse
    };
    
    // Remove original rooms and add merged room
    const roomIds = rooms.map(r => r.id);
    let updatedElements = scene.elements.filter(el => !roomIds.includes(el.id));
    updatedElements.push(mergedRoom);
    
    updateScene(activeSceneId, { elements: updatedElements });
    setSelectedElementId(mergedRoom.id);
    setSelectedElementIds([]);
    setMergeWidgetConflict(null);
  };

  // Add vertices at all edge intersections in a polygon
  const addIntersectionVertices = (vertices: Point[]): Point[] => {
    if (vertices.length < 3) return vertices;
    
    console.log('🔍 addIntersectionVertices called with', vertices.length, 'vertices');
    
    // Helper: Calculate line segment intersection
    const getLineIntersection = (
      p1: Point, p2: Point, p3: Point, p4: Point
    ): Point | null => {
      const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
      const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
      
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-10) return null; // Parallel or coincident
      
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
      
      // Check if intersection is within both line segments (not at endpoints)
      const epsilon = 1e-6;
      if (t > epsilon && t < 1 - epsilon && u > epsilon && u < 1 - epsilon) {
        return {
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1)
        };
      }
      
      return null;
    };
    
    // Build list of segments with their intersections
    const segmentData: { start: Point; end: Point; intersections: { point: Point; t: number }[] }[] = [];
    
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      segmentData.push({ start: v1, end: v2, intersections: [] });
    }
    
    // Find all intersections between non-adjacent segments
    let totalIntersections = 0;
    for (let i = 0; i < segmentData.length; i++) {
      const seg1 = segmentData[i];
      
      for (let j = i + 2; j < segmentData.length; j++) {
        // Skip adjacent segments and last-to-first comparison
        if (j === segmentData.length - 1 && i === 0) continue;
        
        const seg2 = segmentData[j];
        const intersection = getLineIntersection(seg1.start, seg1.end, seg2.start, seg2.end);
        
        if (intersection) {
          totalIntersections++;
          // Calculate parametric t value for both segments
          const dx1 = seg1.end.x - seg1.start.x;
          const dy1 = seg1.end.y - seg1.start.y;
          const t1 = dx1 !== 0 
            ? (intersection.x - seg1.start.x) / dx1
            : (intersection.y - seg1.start.y) / dy1;
          
          const dx2 = seg2.end.x - seg2.start.x;
          const dy2 = seg2.end.y - seg2.start.y;
          const t2 = dx2 !== 0
            ? (intersection.x - seg2.start.x) / dx2
            : (intersection.y - seg2.start.y) / dy2;
          
          seg1.intersections.push({ point: intersection, t: t1 });
          seg2.intersections.push({ point: intersection, t: t2 });
        }
      }
    }
    
    console.log('✅ Found', totalIntersections, 'intersections');
    
    // Build new vertices array with intersections inserted
    const newVertices: Point[] = [];
    
    for (const seg of segmentData) {
      newVertices.push(seg.start);
      
      // Sort intersections by t value (distance along segment)
      seg.intersections.sort((a, b) => a.t - b.t);
      
      // Add all intersection points
      for (const intersection of seg.intersections) {
        newVertices.push(intersection.point);
      }
    }
    
    console.log('📊 Returning', newVertices.length, 'vertices (was', vertices.length, ')');
    return newVertices;
  };

  // Add intersection vertices BETWEEN multiple wall segments (for merged walls)
  const addIntersectionsBetweenSegments = (segments: Point[][]): Point[][] => {
    console.log('🔍 addIntersectionsBetweenSegments called with', segments.length, 'segments');
    
    // Helper: Calculate line segment intersection
    const getLineIntersection = (
      p1: Point, p2: Point, p3: Point, p4: Point
    ): Point | null => {
      const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
      const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
      
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-10) return null; // Parallel or coincident
      
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
      
      // Check if intersection is within both line segments (not at endpoints)
      const epsilon = 1e-6;
      if (t > epsilon && t < 1 - epsilon && u > epsilon && u < 1 - epsilon) {
        return {
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1)
        };
      }
      
      return null;
    };

    // For each segment, build list of edges with their intersections from OTHER segments
    const newSegments: Point[][] = [];
    let totalIntersections = 0;

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx];
      
      // Build edge data for this segment
      const edgeData: { start: Point; end: Point; intersections: { point: Point; t: number }[] }[] = [];
      
      for (let i = 0; i < segment.length - 1; i++) {
        edgeData.push({ 
          start: segment[i], 
          end: segment[i + 1], 
          intersections: [] 
        });
      }
      
      // Check each edge against all edges in ALL OTHER segments
      for (let otherSegIdx = 0; otherSegIdx < segments.length; otherSegIdx++) {
        if (otherSegIdx === segIdx) continue; // Skip same segment
        
        const otherSegment = segments[otherSegIdx];
        
        // Check each edge in this segment against each edge in other segment
        for (let i = 0; i < edgeData.length; i++) {
          const edge = edgeData[i];
          
          for (let j = 0; j < otherSegment.length - 1; j++) {
            const otherV1 = otherSegment[j];
            const otherV2 = otherSegment[j + 1];
            
            const intersection = getLineIntersection(edge.start, edge.end, otherV1, otherV2);
            
            if (intersection) {
              totalIntersections++;
              // Calculate t value along this edge
              const dx = edge.end.x - edge.start.x;
              const dy = edge.end.y - edge.start.y;
              const t = dx !== 0
                ? (intersection.x - edge.start.x) / dx
                : (intersection.y - edge.start.y) / dy;
              
              edge.intersections.push({ point: intersection, t });
            }
          }
        }
      }
      
      // Build new segment with intersections inserted
      const newSegment: Point[] = [];
      
      for (const edge of edgeData) {
        newSegment.push(edge.start);
        
        // Sort intersections by t value
        edge.intersections.sort((a, b) => a.t - b.t);
        
        // Add all intersection points
        for (const intersection of edge.intersections) {
          newSegment.push(intersection.point);
        }
      }
      
      // Add last vertex of original segment
      if (segment.length > 0) {
        newSegment.push(segment[segment.length - 1]);
      }
      
      newSegments.push(newSegment);
    }
    
    console.log('✅ Found', totalIntersections, 'intersections between segments');
    console.log('📊 Returning', newSegments.length, 'segments');
    
    return newSegments;
  };

  const handleMergeRooms = () => {
    if (!scene || !activeSceneId) return;
    
    // Get selected room elements
    const selectedIds = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
    const selectedRooms = scene.elements.filter(el => 
      selectedIds.includes(el.id) && el.type === 'room'
    ) as RoomElement[];

    if (selectedRooms.length < 2) {
      return;
    }

    // Collect all vertices from all selected rooms
    const allVertices: { x: number; y: number }[] = [];
    selectedRooms.forEach(room => {
      if (room.vertices) {
        allVertices.push(...room.vertices);
      }
    });

    if (allVertices.length < 3) {
      return;
    }

    // Find groups of overlapping rooms
    const findOverlappingGroups = (rooms: RoomElement[]): RoomElement[][] => {
      const groups: RoomElement[][] = [];
      const assigned = new Set<string>();

      for (let i = 0; i < rooms.length; i++) {
        if (assigned.has(rooms[i].id)) continue;

        const group = [rooms[i]];
        assigned.add(rooms[i].id);

        // Find all rooms that overlap with any room in this group
        let changed = true;
        while (changed) {
          changed = false;
          for (let j = 0; j < rooms.length; j++) {
            if (assigned.has(rooms[j].id)) continue;
            
            // Check if this room overlaps with any room in the group
            for (const groupRoom of group) {
              if (doRoomsOverlap(rooms[j], groupRoom)) {
                group.push(rooms[j]);
                assigned.add(rooms[j].id);
                changed = true;
                break;
              }
            }
          }
        }

        groups.push(group);
      }

      return groups;
    };

    // Merge polygons using proper polygon clipping union
    const mergePolygons = (rooms: RoomElement[]): { vertices: { x: number; y: number }[], holes?: { x: number; y: number }[][] } => {
      if (rooms.length === 0) return { vertices: [] };
      if (rooms.length === 1) return { vertices: rooms[0].vertices || [], holes: rooms[0].holes };
      
      // Convert room vertices and holes to polygon-clipping format
      const polygons = rooms.map(room => {
        if (!room.vertices || room.vertices.length < 3) return null;
        
        // Apply rotation to outer vertices
        const rotatedVertices = applyRotation(room.vertices, room.rotation || 0);
        const outerCoords = rotatedVertices.map(v => [v.x, v.y] as [number, number]);
        outerCoords.push(outerCoords[0]); // Close the outer ring
        
        // Include holes if they exist, also applying rotation
        const innerRings = (room.holes || []).map(hole => {
          const rotatedHole = applyRotation(hole, room.rotation || 0);
          const holeCoords = rotatedHole.map(v => [v.x, v.y] as [number, number]);
          holeCoords.push(holeCoords[0]); // Close the hole ring
          return holeCoords;
        });
        
        return [outerCoords, ...innerRings];
      }).filter(p => p !== null);

      if (polygons.length === 0) return { vertices: rooms[0]?.vertices || [], holes: rooms[0]?.holes };

      try {
        // Perform union of all polygons
        let result: any = polygons[0];
        for (let i = 1; i < polygons.length; i++) {
          result = polygonClipping.union(result, polygons[i] as any);
        }

        if (result.length === 0 || result[0].length === 0) {
          return { vertices: rooms[0].vertices || [], holes: rooms[0].holes };
        }

        // Take the first polygon's outer ring
        const outerRing = result[0][0] as [number, number][];
        let vertices = outerRing.slice(0, -1).map(coord => ({ x: coord[0], y: coord[1] }));
        
        // Add vertices at all edge intersections
        vertices = addIntersectionVertices(vertices);
        
        // Extract holes (inner rings) and add intersection vertices
        const holes = result[0].slice(1).map((ring: [number, number][]) => {
          const holeVertices = ring.slice(0, -1).map(coord => ({ x: coord[0], y: coord[1] }));
          return addIntersectionVertices(holeVertices);
        });
        
        return { 
          vertices,
          holes: holes.length > 0 ? holes : undefined
        };
      } catch (error) {
        console.error('Polygon union error:', error);
        return { vertices: rooms[0].vertices || [], holes: rooms[0].holes };
      }
    };

    // Group rooms by overlap
    const groups = findOverlappingGroups(selectedRooms);
    
    console.log('Selected rooms:', selectedRooms.length);
    console.log('Groups found:', groups.map(g => g.length));
    
    // Helper function to apply rotation to vertices (used by both merge and wallOpening preservation)
    const applyRotation = (vertices: Point[], rotation: number): Point[] => {
      if (!rotation || rotation === 0) return vertices;
      
      // Calculate bounding box (same as how SVG is positioned)
      const xs = vertices.map(v => v.x);
      const ys = vertices.map(v => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      // Center of the bounding box (matches SVG transformOrigin: center center)
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      // Rotate each vertex around bounding box center
      const radians = (rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      
      return vertices.map(v => {
        const dx = v.x - centerX;
        const dy = v.y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        };
      });
    };
    
    // Check for widget conflicts in any group that will be merged
    for (const group of groups) {
      if (group.length > 1) {
        const roomsWithWidgets = group.filter(room => room.widgets && room.widgets.length > 0);
        if (roomsWithWidgets.length > 1) {
          // Multiple rooms have widgets - show conflict dialog and stop
          const { vertices: mergedVertices } = mergePolygons(group);
          setMergeWidgetConflict({
            rooms: group,
            mergedVertices
          });
          return; // Don't complete merge yet - wait for user choice
        }
      }
    }
    
    // No conflicts - proceed with merge
    const nonMergedCount = groups.filter(group => group.length === 1).length;
    
    // Process each group
    const mergedRooms: RoomElement[] = [];
    const roomsToRemove = new Set<string>();

    groups.forEach((group, index) => {
      console.log(`Group ${index}: ${group.length} rooms`);
      if (group.length === 1) {
        // Single room, don't add to removal list - it stays in place
        console.log(`  Keeping room ${group[0].id} unchanged`);
        // Do nothing, the room remains unchanged in the scene
      } else {
        // Multiple overlapping rooms, merge them
        console.log(`  Merging ${group.length} rooms`);
        const { vertices: mergedVertices, holes: mergedHoles } = mergePolygons(group);
        
        // Determine which widgets to use (we already checked for conflicts above)
        const roomsWithWidgets = group.filter(room => room.widgets && room.widgets.length > 0);
        let widgetsToUse = roomsWithWidgets.length === 1 ? roomsWithWidgets[0].widgets : [];
        
        // Collect and preserve wallOpenings from all rooms
        const mergedWallOpenings: WallOpening[] = [];
        const mergedHoleWallOpenings: any[] = [];
        
        group.forEach(room => {
          // Process regular wallOpenings
          if (room.wallOpenings && room.wallOpenings.length > 0) {
            const rotatedVertices = applyRotation(room.vertices, room.rotation || 0);
            
            room.wallOpenings.forEach(opening => {
              const segmentStart = rotatedVertices[opening.segmentIndex];
              const segmentEnd = rotatedVertices[(opening.segmentIndex + 1) % rotatedVertices.length];
              
              if (!segmentStart || !segmentEnd) return;
              
              // Calculate world position of the opening on this segment
              const dx = segmentEnd.x - segmentStart.x;
              const dy = segmentEnd.y - segmentStart.y;
              const openingStartX = segmentStart.x + dx * opening.startRatio;
              const openingStartY = segmentStart.y + dy * opening.startRatio;
              const openingEndX = segmentStart.x + dx * opening.endRatio;
              const openingEndY = segmentStart.y + dy * opening.endRatio;
              
              // Find matching segment in merged room
              for (let i = 0; i < mergedVertices.length; i++) {
                const v1 = mergedVertices[i];
                const v2 = mergedVertices[(i + 1) % mergedVertices.length];
                
                // Check if this segment contains our opening points
                const segDx = v2.x - v1.x;
                const segDy = v2.y - v1.y;
                const segLength = Math.sqrt(segDx * segDx + segDy * segDy);
                
                if (segLength < 0.1) continue;
                
                // Project opening points onto this segment
                const t1 = ((openingStartX - v1.x) * segDx + (openingStartY - v1.y) * segDy) / (segLength * segLength);
                const t2 = ((openingEndX - v1.x) * segDx + (openingEndY - v1.y) * segDy) / (segLength * segLength);
                
                // Check if points are on this segment (with tolerance)
                if (t1 >= -0.01 && t1 <= 1.01 && t2 >= -0.01 && t2 <= 1.01) {
                  // Calculate distance from projected points to actual points
                  const proj1X = v1.x + t1 * segDx;
                  const proj1Y = v1.y + t1 * segDy;
                  const dist1 = Math.sqrt((proj1X - openingStartX) ** 2 + (proj1Y - openingStartY) ** 2);
                  
                  const proj2X = v1.x + t2 * segDx;
                  const proj2Y = v1.y + t2 * segDy;
                  const dist2 = Math.sqrt((proj2X - openingEndX) ** 2 + (proj2Y - openingEndY) ** 2);
                  
                  if (dist1 < 5 && dist2 < 5) {
                    // Found matching segment - add wallOpening
                    mergedWallOpenings.push({
                      segmentIndex: i,
                      startRatio: Math.max(0, Math.min(1, t1)),
                      endRatio: Math.max(0, Math.min(1, t2))
                    });
                    break;
                  }
                }
              }
            });
          }
          
          // Process holeWallOpenings
          if (room.holeWallOpenings && room.holeWallOpenings.length > 0 && room.holes && mergedHoles) {
            room.holeWallOpenings.forEach(opening => {
              const originalHole = room.holes![opening.holeIndex];
              if (!originalHole) return;
              
              const rotatedHole = applyRotation(originalHole, room.rotation || 0);
              const segmentStart = rotatedHole[opening.segmentIndex];
              const segmentEnd = rotatedHole[(opening.segmentIndex + 1) % rotatedHole.length];
              
              if (!segmentStart || !segmentEnd) return;
              
              // Calculate world position of the opening
              const dx = segmentEnd.x - segmentStart.x;
              const dy = segmentEnd.y - segmentStart.y;
              const openingStartX = segmentStart.x + dx * opening.startRatio;
              const openingStartY = segmentStart.y + dy * opening.startRatio;
              const openingEndX = segmentStart.x + dx * opening.endRatio;
              const openingEndY = segmentStart.y + dy * opening.endRatio;
              
              // Find matching hole and segment in merged room
              for (let holeIdx = 0; holeIdx < mergedHoles.length; holeIdx++) {
                const mergedHole = mergedHoles[holeIdx];
                
                for (let segIdx = 0; segIdx < mergedHole.length; segIdx++) {
                  const v1 = mergedHole[segIdx];
                  const v2 = mergedHole[(segIdx + 1) % mergedHole.length];
                  
                  const segDx = v2.x - v1.x;
                  const segDy = v2.y - v1.y;
                  const segLength = Math.sqrt(segDx * segDx + segDy * segDy);
                  
                  if (segLength < 0.1) continue;
                  
                  // Project opening points onto this segment
                  const t1 = ((openingStartX - v1.x) * segDx + (openingStartY - v1.y) * segDy) / (segLength * segLength);
                  const t2 = ((openingEndX - v1.x) * segDx + (openingEndY - v1.y) * segDy) / (segLength * segLength);
                  
                  if (t1 >= -0.01 && t1 <= 1.01 && t2 >= -0.01 && t2 <= 1.01) {
                    const proj1X = v1.x + t1 * segDx;
                    const proj1Y = v1.y + t1 * segDy;
                    const dist1 = Math.sqrt((proj1X - openingStartX) ** 2 + (proj1Y - openingStartY) ** 2);
                    
                    const proj2X = v1.x + t2 * segDx;
                    const proj2Y = v1.y + t2 * segDy;
                    const dist2 = Math.sqrt((proj2X - openingEndX) ** 2 + (proj2Y - openingEndY) ** 2);
                    
                    if (dist1 < 5 && dist2 < 5) {
                      mergedHoleWallOpenings.push({
                        holeIndex: holeIdx,
                        segmentIndex: segIdx,
                        startRatio: Math.max(0, Math.min(1, t1)),
                        endRatio: Math.max(0, Math.min(1, t2))
                      });
                      break;
                    }
                  }
                }
              }
            });
          }
        });
        
        const firstRoom = group[0];
        const mergedRoom: RoomElement = {
          ...firstRoom,
          id: `room-${Date.now()}-${Math.random()}`,
          name: generateUniqueName(firstRoom.name || 'Room'),
          vertices: mergedVertices,
          holes: mergedHoles,
          wallOpenings: mergedWallOpenings,
          holeWallOpenings: mergedHoleWallOpenings.length > 0 ? mergedHoleWallOpenings : undefined,
          widgets: widgetsToUse,
          rotation: 0  // Reset rotation - merged vertices are already in final position
        };
        mergedRooms.push(mergedRoom);
        
        // Mark original rooms for removal
        group.forEach(room => {
          console.log(`  Marking ${room.id} for removal`);
          roomsToRemove.add(room.id);
        });
      }
    });

    console.log('Total rooms to remove:', roomsToRemove.size);
    console.log('Total merged rooms to add:', mergedRooms.length);
    
    // Save to history before making changes
    saveToHistory();
    
    // Remove only the rooms that were actually merged, keep all others
    let updatedElements = scene.elements.filter(el => !roomsToRemove.has(el.id));
    // Add the newly merged rooms
    updatedElements = updatedElements.concat(mergedRooms);

    updateScene(activeSceneId, { elements: updatedElements });
    
    // Show notification if some rooms were not merged
    if (nonMergedCount > 0) {
      const roomText = nonMergedCount === 1 ? 'room was' : 'rooms were';
      setMergeNotification(`${nonMergedCount} ${roomText} not merged. Only overlapping rooms can merge.`);
      setTimeout(() => setMergeNotification(null), 4000);
    }
    
    // Select the first merged room if any, otherwise clear selection
    if (mergedRooms.length > 0) {
      setSelectedElementId(mergedRooms[0].id);
    }
    setSelectedElementIds([]);
  };

  const handleMergeWalls = () => {
    if (!scene || !activeSceneId) return;
    
    // Get selected wall elements
    const selectedIds = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
    const selectedWalls = scene.elements.filter(el => 
      selectedIds.includes(el.id) && el.type === 'wall'
    ) as WallElement[];

    if (selectedWalls.length < 2) {
      return;
    }

    console.log('[MERGE WALLS] Merging', selectedWalls.length, 'walls into segments');

    // Collect all segments from all selected walls
    const allSegments: Point[][] = [];
    selectedWalls.forEach(wall => {
      if (wall.segments) {
        // Wall already has multiple segments
        allSegments.push(...wall.segments);
      } else if (wall.vertices && wall.vertices.length >= 2) {
        // Wall has single vertices array - treat as one segment
        allSegments.push(wall.vertices);
      }
    });

    if (allSegments.length < 2) {
      return;
    }

    // Add intersection vertices BETWEEN segments (where walls cross each other)
    const segmentsWithIntersections = addIntersectionsBetweenSegments(allSegments);

    const firstWall = selectedWalls[0];
    
    const mergedWall: WallElement = {
      id: `wall-${Date.now()}-${Math.random()}`,
      type: 'wall',
      vertices: [], // Empty - we use segments instead
      segments: segmentsWithIntersections,
      wallTextureUrl: firstWall.wallTextureUrl,
      wallThickness: firstWall.wallThickness,
      wallTileSize: firstWall.wallTileSize,
      name: generateWallName(firstWall.wallTextureUrl),
      notes: '',
      zIndex: firstWall.zIndex || -99,
      visible: true,
      widgets: [],
      locked: false
    };

    // Remove original walls and add merged wall
    const updatedElements = scene.elements.filter(el => !selectedIds.includes(el.id));
    updatedElements.push(mergedWall);

    // Save history AFTER merging walls
    const newHistoryEntry = {
      elements: updatedElements,
      terrainTiles: (() => {
        const tilesObj: { [key: string]: TerrainTile } = {};
        terrainTiles.forEach((tile, key) => {
          tilesObj[key] = tile;
        });
        return tilesObj;
      })()
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newHistoryEntry]);
    setHistoryIndex(prev => prev + 1);

    updateScene(activeSceneId, { elements: updatedElements });
    
    // Select the merged wall
    setSelectedElementId(mergedWall.id);
    setSelectedElementIds([]);
    
    console.log('[MERGE WALLS] Created merged wall with', segmentsWithIntersections.length, 'segments');
  };

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip ALL shortcuts and preventDefault if text input is focused
      if (isTextInputFocused()) return;

      // Track Ctrl and Shift keys
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }

      // Always track Space
      if (e.key === ' ') {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // NOTE: Tool selection (V, B, T, R, D, Z) is now handled by individual button components
      // NOTE: Actions (F, L, N, G, C) are now handled by individual button components

      // Deselect all or return to pointer tool
      if (e.key === 'Escape') {
        // Cancel custom room drawing if in progress
        if (customRoomVertices.length > 0) {
          setCustomRoomVertices([]);
          return;
        }
        
        // Cancel wall drawing if in progress
        if (wallVertices.length > 0) {
          setWallVertices([]);
          return;
        }
        
        // Cancel wall line drawing if in progress
        if (wallLineStart || wallLinePreview) {
          setWallLineStart(null);
          setWallLinePreview(null);
          return;
        }
        
        // Cancel room drawing if in progress
        if (roomDrawStart || tempRoom) {
          setRoomDrawStart(null);
          setTempRoom(null);
          return;
        }
        
        // Check if any modal/dialog/popup is open - if so, don't deselect
        // Let the modal handlers close them first
        const hasOpenModal = document.querySelector('[role="dialog"], .fixed.inset-0, [data-popup="true"]');
        if (hasOpenModal) {
          return; // Let popup/dialog handlers handle ESC first
        }
        
        if (selectedElementId || selectedElementIds.length > 0) {
          // If something is selected, deselect it
          setSelectedElementId(null);
          setSelectedElementIds([]);
        } else if (activeTool !== 'pointer') {
          // If on any other tool with no selection, go back to pointer tool
          setActiveTool('pointer');
        }
        return;
      }

      // Arrow keys - move selected elements
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        if (!scene) return;
        
        const selectedIds = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
        if (selectedIds.length === 0) return;

        // Determine offset based on arrow key (shift = 10px, normal = 1px)
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        saveToHistory();

        // Update all selected elements
        const updates = new Map<string, Partial<MapElement>>();
        selectedIds.forEach(id => {
          const element = scene.elements.find(el => el.id === id);
          if (!element) return;

          if (element.type === 'room' && element.vertices) {
            // Move room vertices
            const newVertices = element.vertices.map(v => ({
              x: v.x + dx,
              y: v.y + dy
            }));
            
            // Move holes if any
            const newHoles = element.holes?.map(hole => 
              hole.map(v => ({
                x: v.x + dx,
                y: v.y + dy
              }))
            );
            
            updates.set(id, { 
              vertices: newVertices,
              holes: newHoles
            });
          } else if ('x' in element && 'y' in element) {
            // Move other elements (tokens, annotations, etc)
            updates.set(id, { x: element.x + dx, y: element.y + dy });
          }
        });

        updateElements(updates);
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deletion in game mode
        if (viewMode === 'game') {
          e.preventDefault();
          return;
        }
        
        e.preventDefault();
        if (selectedElementIds.length > 0) {
          saveToHistory();
          deleteElements(selectedElementIds);
        } else if (selectedElementId) {
          saveToHistory();
          deleteElements([selectedElementId]);
        }
        return;
      }

      // Copy
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        const toCopy = selectedElementIds.length > 0 
          ? scene?.elements.filter(el => selectedElementIds.includes(el.id)) || []
          : selectedElementId 
            ? scene?.elements.filter(el => el.id === selectedElementId) || []
            : [];
        if (toCopy.length > 0) {
          setClipboard(JSON.parse(JSON.stringify(toCopy)));
        }
        return;
      }

      // Paste
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        if (clipboard.length > 0 && scene && activeSceneId) {
          saveToHistory();
          
          // Use same offset logic as duplicate
          const totalSize = clipboard.reduce((sum, el) => {
            if (el.type === 'room' && el.vertices) {
              const xs = el.vertices.map((v: { x: number }) => v.x);
              const ys = el.vertices.map((v: { y: number }) => v.y);
              return sum + Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
            } else if ('size' in el) {
              return sum + el.size;
            }
            return sum;
          }, 0);
          const avgSize = totalSize / clipboard.length;
          const offset = avgSize * 0.7;

          const newElements = clipboard.map(el => {
            if (el.type === 'room' && el.vertices) {
              const room = el as RoomElement;
              return {
                ...room,
                id: `${el.type}-${Date.now()}-${Math.random()}`,
                name: generateUniqueName(room.name || 'Room'),
                vertices: room.vertices.map((v: { x: number; y: number }) => ({ x: v.x + offset, y: v.y + offset })),
                holes: room.holes?.map(hole => 
                  hole.map((v: { x: number; y: number }) => ({ x: v.x + offset, y: v.y + offset }))
                )
              };
            } else if ('x' in el && 'y' in el) {
              return {
                ...el,
                id: `${el.type}-${Date.now()}-${Math.random()}`,
                x: el.x + offset,
                y: el.y + offset
              };
            }
            return el; // Fallback
          });

          updateScene(activeSceneId, {
            elements: [...scene.elements, ...newElements]
          });
          setSelectedElementIds(newElements.map(el => el.id));
          setSelectedElementId(null);
        }
        return;
      }

      // Duplicate
      if ((e.ctrlKey && e.key === 'd') || (e.shiftKey && e.key === 'D')) {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      // Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Arrow key navigation (no modifiers)
      if (!e.ctrlKey && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const orderedElements = getAllElementsInOrder();
        if (orderedElements.length === 0) return;

        let currentIndex = selectedElementId 
          ? orderedElements.findIndex(el => el.id === selectedElementId)
          : -1;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          currentIndex = (currentIndex + 1) % orderedElements.length;
        } else {
          currentIndex = currentIndex <= 0 ? orderedElements.length - 1 : currentIndex - 1;
        }

        const newSelection = orderedElements[currentIndex];
        setSelectedElementId(newSelection.id);
        setSelectedElementIds([]);
        centerViewportOnElement(newSelection.id);
        return;
      }

      // Layer control (Ctrl + Arrow Up/Down)
      if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (!scene || !activeSceneId) return;

        const selectedIds = selectedElementIds.length > 0 
          ? selectedElementIds 
          : selectedElementId 
            ? [selectedElementId] 
            : [];

        if (selectedIds.length === 0) return;

        saveToHistory();
        const direction = e.key === 'ArrowUp' ? 1 : -1;

        const updatedElements = scene.elements.map(el => {
          if (selectedIds.includes(el.id)) {
            const currentZ = (el as any).zIndex || 0;
            const newZ = currentZ + direction;
            // Rooms stay in range -200 to -1, tokens/others stay in range 0+
            if (el.type === 'room') {
              if (direction > 0) {
                return { ...el, zIndex: Math.min(newZ, -1) };
              } else {
                return { ...el, zIndex: Math.max(newZ, -200) };
              }
            } else {
              return { ...el, zIndex: Math.max(newZ, 0) };
            }
          }
          return el;
        });

        updateScene(activeSceneId, { elements: updatedElements });
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setIsSpacePressed(false);
        setIsPanning(false);
      }
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, selectedElementIds, deleteElements, scene, activeSceneId, activeTool, clipboard, history, historyIndex, viewport]);

  // Hide token submenu when shift is released
  useEffect(() => {
    if (!isShiftPressed && showTokenSubmenuForShift) {
      const timeout = setTimeout(() => {
        setShowTokenSubmenuForShift(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isShiftPressed, showTokenSubmenuForShift]);

  // Auto-hide grid submenu after G key
  useEffect(() => {
    if (showGridSubmenuForG) {
      const timeout = setTimeout(() => {
        setShowGridSubmenuForG(false);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [showGridSubmenuForG]);

  // Hide grid submenu when grid is turned off
  useEffect(() => {
    if (!showGrid && showGridSubmenuForG) {
      setShowGridSubmenuForG(false);
    }
  }, [showGrid, showGridSubmenuForG]);

  // Hide terrain submenu when switching away from background tool
  useEffect(() => {
    if (activeTool !== 'background' && showTerrainSubmenuForT) {
      setShowTerrainSubmenuForT(false);
    }
  }, [activeTool, showTerrainSubmenuForT]);

  const handleWallErase = (room: RoomElement, clickX: number, clickY: number) => {
    const { vertices, wallThickness, wallOpenings } = room;
    const brushSize = 10; // Small brush for painting effect
    
    if (!vertices || vertices.length < 3) return;
    
    // Find the nearest edge to the click point
    let nearestEdgeIndex = -1;
    let nearestDistance = Infinity;
    let nearestRatio = 0;
    
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      
      const { distance, ratio } = distanceToLineSegment({ x: clickX, y: clickY }, start, end);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEdgeIndex = i;
        nearestRatio = ratio;
      }
    }
    
    // Only erase if click is within wall thickness distance from an edge
    if (nearestEdgeIndex === -1 || nearestDistance > wallThickness) {
      return;
    }
    
    // Calculate edge length to convert brush size to ratio
    const start = vertices[nearestEdgeIndex];
    const end = vertices[(nearestEdgeIndex + 1) % vertices.length];
    const edgeLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    
    if (edgeLength === 0) return;
    
    const brushRatio = brushSize / edgeLength;
    const startRatio = Math.max(0, nearestRatio - brushRatio / 2);
    const endRatio = Math.min(1, nearestRatio + brushRatio / 2);
    
    // Create new wall opening
    const newOpening: import('../types').WallOpening = {
      segmentIndex: nearestEdgeIndex,
      startRatio,
      endRatio
    };
    
    // Merge with existing openings on the same segment
    const existingOpenings = (wallOpenings || []).filter(o => o.segmentIndex !== nearestEdgeIndex);
    const sameSegmentOpenings = (wallOpenings || []).filter(o => o.segmentIndex === nearestEdgeIndex);
    
    sameSegmentOpenings.push(newOpening);
    sameSegmentOpenings.sort((a, b) => a.startRatio - b.startRatio);
    
    // Merge overlapping openings
    const mergedOpenings: import('../types').WallOpening[] = [];
    let current = sameSegmentOpenings[0];
    
    for (let i = 1; i < sameSegmentOpenings.length; i++) {
      const next = sameSegmentOpenings[i];
      if (next.startRatio <= current.endRatio) {
        // Overlapping, merge
        current = {
          segmentIndex: current.segmentIndex,
          startRatio: current.startRatio,
          endRatio: Math.max(current.endRatio, next.endRatio)
        };
      } else {
        mergedOpenings.push(current);
        current = next;
      }
    }
    mergedOpenings.push(current);
    
    const updatedOpenings = [...existingOpenings, ...mergedOpenings];
    updateElement(room.id, { wallOpenings: updatedOpenings });
  };

  // Draw a straight line with brush stamps
  // Line drawing temporarily disabled during tile system migration
  // TODO: Reimplement with tile-based system
  /*
  const drawBrushLine = (startX: number, startY: number, endX: number, endY: number) => {
    // Calculate line length
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      stampBrush(startX, startY);
      return;
    }
    
    // Calculate number of stamps based on brush size (40% overlap)
    const stampSpacing = backgroundBrushSize * 0.4;
    const numStamps = Math.ceil(length / stampSpacing) + 1;
    
    // Draw stamps along the line
    for (let i = 0; i < numStamps; i++) {
      const t = i / (numStamps - 1);
      const x = startX + dx * t;
      const y = startY + dy * t;
      stampBrush(x, y);
    }
  };
  */

  // Stamp brush at world coordinates - tile-based version
  const stampBrush = (worldX: number, worldY: number, saveStamp: boolean = true) => {
    const brush = brushImageRef.current;
    
    if (!brush || !brush.complete || !selectedBackgroundTexture) {
      return;
    }

    // Activate auto-created scene on first terrain brush stroke
    if (!hasActivatedSceneRef.current && terrainTiles.size === 0 && saveStamp) {
      activateAutoCreatedScene();
      hasActivatedSceneRef.current = true;
    }

    // Calculate which tile(s) this stamp affects
    const stampHalfSize = backgroundBrushSize / 2;
    const minX = worldX - stampHalfSize;
    const maxX = worldX + stampHalfSize;
    const minY = worldY - stampHalfSize;
    const maxY = worldY + stampHalfSize;
    
    // Find all tiles that overlap with this stamp
    const startTileX = Math.floor(minX / TILE_SIZE) * TILE_SIZE;
    const endTileX = Math.floor(maxX / TILE_SIZE) * TILE_SIZE;
    const startTileY = Math.floor(minY / TILE_SIZE) * TILE_SIZE;
    const endTileY = Math.floor(maxY / TILE_SIZE) * TILE_SIZE;
    
    const affectedTileKeys: string[] = [];
    for (let tileY = startTileY; tileY <= endTileY; tileY += TILE_SIZE) {
      for (let tileX = startTileX; tileX <= endTileX; tileX += TILE_SIZE) {
        const tileKey = `${tileX},${tileY}`;
        affectedTileKeys.push(tileKey);
        
        // Create tile if it doesn't exist
        if (!terrainTiles.has(tileKey)) {
          const newTile: TerrainTile = {
            x: tileX,
            y: tileY,
            stamps: []
          };
          terrainTiles.set(tileKey, newTile);
        }
      }
    }
    
    // Add stamp to affected tiles
    if (saveStamp) {
      const stamp: TerrainStamp = {
        x: worldX,
        y: worldY,
        size: backgroundBrushSize,
        textureUrl: selectedBackgroundTexture
      };
      
      setTerrainTiles(prev => {
        const updated = new Map(prev);
        affectedTileKeys.forEach(tileKey => {
          const tile = updated.get(tileKey);
          if (tile) {
            updated.set(tileKey, {
              ...tile,
              stamps: [...tile.stamps, stamp]
            });
          }
        });
        return updated;
      });
    }
    
    // Draw stamp on affected tile canvases
    affectedTileKeys.forEach(tileKey => {
      const canvas = tileCanvasRefs.current.get(tileKey);
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const { x: tileX, y: tileY } = getTileCoords(tileKey);
      
      // Convert world coordinates to tile-local coordinates
      const localX = worldX - tileX;
      const localY = worldY - tileY;
      
      ctx.drawImage(
        brush,
        localX - stampHalfSize,
        localY - stampHalfSize,
        backgroundBrushSize,
        backgroundBrushSize
      );
    });
  };

  // Start brush painting
  const startBrushPainting = (worldX: number, worldY: number) => {
    // Use terrain brush (primary) or background texture (X-Lab shapes)
    const brushUrl = selectedTerrainBrush || selectedBackgroundTexture;
    if (!brushUrl) return;
    
    // Load brush image if not already loaded or if texture changed
    if (!brushImageRef.current || brushImageRef.current.src !== brushUrl) {
      const img = new Image();
      img.src = brushUrl;
      img.onload = () => {
        brushImageRef.current = img;
        
        // If shift is pressed, just set anchor for line mode
        if (isShiftPressed) {
          setBrushAnchorPoint({ x: worldX, y: worldY });
        } else {
          // Normal mode: stamp immediately
          stampBrush(worldX, worldY);
          setLastBrushStamp({ x: worldX, y: worldY });
        }
      };
      img.onerror = () => {
        console.error('[BRUSH PAINT] Failed to load brush image:', brushUrl);
      };
    } else {
      // Image already loaded - check if we need to reload for new URL
      if (brushImageRef.current.src !== brushUrl) {
        const img = new Image();
        img.src = brushUrl;
        img.onload = () => {
          brushImageRef.current = img;
          if (isShiftPressed) {
            setBrushAnchorPoint({ x: worldX, y: worldY });
          } else {
            stampBrush(worldX, worldY);
            setLastBrushStamp({ x: worldX, y: worldY });
          }
        };
        return;
      }
      
      // If shift is pressed, just set anchor for line mode
      if (isShiftPressed) {
        setBrushAnchorPoint({ x: worldX, y: worldY });
      } else {
        // Normal mode: stamp immediately
        stampBrush(worldX, worldY);
        setLastBrushStamp({ x: worldX, y: worldY });
      }
    }
  };

  // Continue brush painting with distance check
  const continueBrushPainting = (worldX: number, worldY: number) => {
    if (!lastBrushStamp) {
      startBrushPainting(worldX, worldY);
      return;
    }

    let constrainedX = worldX;
    let constrainedY = worldY;

    // If shift is pressed and we have an anchor point, constrain to horizontal or vertical
    if (isShiftPressed && brushAnchorPoint) {
      const deltaX = Math.abs(worldX - brushAnchorPoint.x);
      const deltaY = Math.abs(worldY - brushAnchorPoint.y);
      
      // Lock to the axis with greater movement
      if (deltaX > deltaY) {
        // Horizontal movement - lock Y to anchor
        constrainedY = brushAnchorPoint.y;
      } else {
        // Vertical movement - lock X to anchor
        constrainedX = brushAnchorPoint.x;
      }
    }

    // Calculate distance from last stamp
    const dx = constrainedX - lastBrushStamp.x;
    const dy = constrainedY - lastBrushStamp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Stamp if distance >= 40% of brush size
    const stampThreshold = backgroundBrushSize * 0.4;
    
    if (distance >= stampThreshold) {
      stampBrush(constrainedX, constrainedY);
      setLastBrushStamp({ x: constrainedX, y: constrainedY });
    }
  };

  // Door Tool: DISABLED - All door tool functions have been commented out

  // Wall Cutter Tool: Apply freehand path cut (DISABLED)

  // Wall Cutter Tool: Actually cut and remove wall geometry (rectangle mode)
  const applyWallCutterRectangle = () => {
    console.log('[WALL CUTTER RECT] Starting rectangle cut operation');
    if (!scene || !wallCutterToolStart || !wallCutterToolEnd) return;
    
    const minX = Math.min(wallCutterToolStart.x, wallCutterToolEnd.x);
    const maxX = Math.max(wallCutterToolStart.x, wallCutterToolEnd.x);
    const minY = Math.min(wallCutterToolStart.y, wallCutterToolEnd.y);
    const maxY = Math.max(wallCutterToolStart.y, wallCutterToolEnd.y);
    
    console.log('[WALL CUTTER RECT] Rectangle bounds:', { minX, maxX, minY, maxY });
    
    // Helper function to check line-rectangle intersection
    const lineIntersectsRect = (p1: Point, p2: Point): { start: number; end: number } | null => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) return null;
      
      let tMin = 0;
      let tMax = 1;
      
      // Check intersection with vertical edges
      if (dx !== 0) {
        const t1 = (minX - p1.x) / dx;
        const t2 = (maxX - p1.x) / dx;
        tMin = Math.max(tMin, Math.min(t1, t2));
        tMax = Math.min(tMax, Math.max(t1, t2));
      } else if (p1.x < minX || p1.x > maxX) {
        return null;
      }
      
      // Check intersection with horizontal edges
      if (dy !== 0) {
        const t1 = (minY - p1.y) / dy;
        const t2 = (maxY - p1.y) / dy;
        tMin = Math.max(tMin, Math.min(t1, t2));
        tMax = Math.min(tMax, Math.max(t1, t2));
      } else if (p1.y < minY || p1.y > maxY) {
        return null;
      }
      
      if (tMin <= tMax && tMax >= 0 && tMin <= 1) {
        return { start: tMin, end: tMax };
      }
      
      return null;
    };
    
    const wallsToRemove: string[] = [];
    const wallsToAdd: WallElement[] = [];
    const roomUpdates: Array<{ id: string; updates: Partial<RoomElement> }> = [];
    
    scene.elements.forEach(element => {
      if (element.type === 'wall') {
        const wall = element as WallElement;
        const vertices = wall.vertices;
        
        // Check each segment of the wall
        for (let i = 0; i < vertices.length - 1; i++) {
          const p1 = vertices[i];
          const p2 = vertices[i + 1];
          
          const intersection = lineIntersectsRect(p1, p2);
          
          if (intersection && intersection.end - intersection.start > 0.01) {
            console.log('[WALL CUTTER RECT] Cutting wall:', wall.id, 'segment:', i, 'intersection:', intersection);
            console.log('[WALL CUTTER RECT] Original wall vertices:', JSON.stringify(vertices));
            console.log('[WALL CUTTER RECT] Segment p1:', p1, 'p2:', p2);
            wallsToRemove.push(wall.id);
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            
            // Create wall segment BEFORE the cut (if significant)
            if (intersection.start > 0.01) {
              const beforeVertices = vertices.slice(0, i + 1);
              beforeVertices.push({
                x: p1.x + intersection.start * dx,
                y: p1.y + intersection.start * dy
              });
              
              const beforeWall = {
                ...wall,
                id: `${wall.id}_before_${Date.now()}`,
                vertices: beforeVertices
              };
              console.log('[WALL CUTTER RECT] Creating BEFORE segment:', beforeWall);
              console.log('[WALL CUTTER RECT] BEFORE vertices:', JSON.stringify(beforeVertices));
              wallsToAdd.push(beforeWall);
            }
            
            // Create wall segment AFTER the cut (if significant)
            if (intersection.end < 0.99) {
              const afterVertices = [{
                x: p1.x + intersection.end * dx,
                y: p1.y + intersection.end * dy
              }];
              afterVertices.push(...vertices.slice(i + 1));
              
              const afterWall = {
                ...wall,
                id: `${wall.id}_after_${Date.now()}`,
                vertices: afterVertices
              };
              console.log('[WALL CUTTER RECT] Creating AFTER segment:', afterWall);
              console.log('[WALL CUTTER RECT] AFTER vertices:', JSON.stringify(afterVertices));
              wallsToAdd.push(afterWall);
            }
            
            break; // Only cut once per wall
          }
        }
      } else if (element.type === 'room') {
        const room = element as RoomElement;
        const vertices = room.vertices;
        const newVertices: Point[] = [];
        const newWallOpenings: any[] = [];
        
        let modified = false;
        
        // Map old vertex index to new vertex index
        const vertexIndexMap = new Map<number, number>();
        
        for (let i = 0; i < vertices.length; i++) {
          const p1 = vertices[i];
          const p2 = vertices[(i + 1) % vertices.length];
          
          // Check if p1 is inside the rectangle
          const p1Inside = p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY;
          
          // If p1 is NOT inside, add it normally
          if (!p1Inside) {
            vertexIndexMap.set(i, newVertices.length);
            newVertices.push(p1);
          } else {
            // p1 is inside rectangle - skip it (will be replaced by intersection points)
            modified = true;
          }
          
          const intersection = lineIntersectsRect(p1, p2);
          
          if (intersection && intersection.end - intersection.start > 0.01) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            
            // Check if this segment already has a wall opening (is already "empty")
            const existingOpening = room.wallOpenings?.find(o => o.segmentIndex === i);
            
            if (!existingOpening) {
              // Only add intersection points if we're cutting through an actual wall
              
              // Add intersection start point if we're entering the rectangle
              if (intersection.start > 0.01) {
                newVertices.push({
                  x: p1.x + intersection.start * dx,
                  y: p1.y + intersection.start * dy
                });
              }
              
              // Add intersection end point if we're exiting the rectangle
              if (intersection.end < 0.99) {
                newVertices.push({
                  x: p1.x + intersection.end * dx,
                  y: p1.y + intersection.end * dy
                });
                
                // Add wallOpening for the segment between entry and exit points
                const openingSegmentIndex = newVertices.length - 2;
                newWallOpenings.push({
                  segmentIndex: openingSegmentIndex,
                  startRatio: 0,
                  endRatio: 1
                });
              }
              
              modified = true;
            } else {
              // Segment already has opening - preserve it but update the segment index
              const newSegmentIndex = vertexIndexMap.get(i);
              if (newSegmentIndex !== undefined) {
                newWallOpenings.push({
                  ...existingOpening,
                  segmentIndex: newSegmentIndex
                });
              }
            }
          } else {
            // No intersection - preserve existing wallOpening if any
            const existingOpening = room.wallOpenings?.find(o => o.segmentIndex === i);
            if (existingOpening) {
              const newSegmentIndex = vertexIndexMap.get(i);
              if (newSegmentIndex !== undefined) {
                newWallOpenings.push({
                  ...existingOpening,
                  segmentIndex: newSegmentIndex
                });
              }
            }
          }
        }
        
        // Update room with new vertices and wallOpenings if modified
        if (modified && newVertices.length >= 3) {
          roomUpdates.push({
            id: room.id,
            updates: {
              vertices: newVertices,
              wallOpenings: newWallOpenings
            }
          });
        }
        
        // Process holes (if any) - apply wall cutter to hole edges
        if (room.holes && room.holes.length > 0) {
          const updatedHoles: Point[][] = [];
          let updatedHoleWallOpenings: any[] = [];
          let holesModified = false;
          
          room.holes.forEach((hole, holeIndex) => {
            const newHoleVertices: Point[] = [];
            let holeModified = false;
            
            // Map old vertex index to new vertex index for this hole
            const holeVertexIndexMap = new Map<number, number>();
            
            for (let i = 0; i < hole.length; i++) {
              const p1 = hole[i];
              const p2 = hole[(i + 1) % hole.length];
              
              // Check if p1 is inside the rectangle
              const p1Inside = p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY;
              
              // If p1 is NOT inside, add it normally
              if (!p1Inside) {
                holeVertexIndexMap.set(i, newHoleVertices.length);
                newHoleVertices.push(p1);
              } else {
                // p1 is inside rectangle - skip it (will be replaced by intersection points)
                holeModified = true;
              }
              
              const intersection = lineIntersectsRect(p1, p2);
              
              if (intersection && intersection.end - intersection.start > 0.01) {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                
                // Check if original segment had a wall opening
                const existingOpening = room.holeWallOpenings?.find(
                  o => o.holeIndex === holeIndex && o.segmentIndex === i
                );
                
                if (!existingOpening) {
                  // Only add intersection points if we're cutting through an actual wall
                  
                  // Add intersection start point if we're entering the rectangle
                  if (intersection.start > 0.01) {
                    newHoleVertices.push({
                      x: p1.x + intersection.start * dx,
                      y: p1.y + intersection.start * dy
                    });
                  }
                  
                  // Add intersection end point if we're exiting the rectangle
                  if (intersection.end < 0.99) {
                    newHoleVertices.push({
                      x: p1.x + intersection.end * dx,
                      y: p1.y + intersection.end * dy
                    });
                    
                    // Add holeWallOpening for the segment between entry and exit points
                    const openingSegmentIndex = newHoleVertices.length - 2;
                    updatedHoleWallOpenings.push({
                      holeIndex: updatedHoles.length, // Use index in updatedHoles array
                      segmentIndex: openingSegmentIndex,
                      startRatio: 0,
                      endRatio: 1
                    });
                  }
                  
                  holeModified = true;
                } else {
                  // Segment already has opening - preserve it but update the indices
                  const newSegmentIndex = holeVertexIndexMap.get(i);
                  if (newSegmentIndex !== undefined) {
                    updatedHoleWallOpenings.push({
                      ...existingOpening,
                      holeIndex: updatedHoles.length,
                      segmentIndex: newSegmentIndex
                    });
                  }
                }
              } else {
                // No intersection - preserve existing wallOpening if any
                const existingOpening = room.holeWallOpenings?.find(
                  o => o.holeIndex === holeIndex && o.segmentIndex === i
                );
                if (existingOpening) {
                  const newSegmentIndex = holeVertexIndexMap.get(i);
                  if (newSegmentIndex !== undefined) {
                    updatedHoleWallOpenings.push({
                      ...existingOpening,
                      holeIndex: updatedHoles.length,
                      segmentIndex: newSegmentIndex
                    });
                  }
                }
              }
            }
            
            // Only keep hole if it still has at least 3 vertices
            if (newHoleVertices.length >= 3) {
              updatedHoles.push(newHoleVertices);
              if (holeModified) holesModified = true;
            } else {
              holesModified = true; // Hole was removed
            }
          });
          
          // Collect hole updates for this room
          if (holesModified) {
            // Find existing update for this room or create new one
            const existingUpdate = roomUpdates.find(u => u.id === room.id);
            if (existingUpdate) {
              existingUpdate.updates.holes = updatedHoles.length > 0 ? updatedHoles : undefined;
              existingUpdate.updates.holeWallOpenings = updatedHoleWallOpenings.length > 0 ? updatedHoleWallOpenings : undefined;
            } else {
              roomUpdates.push({
                id: room.id,
                updates: {
                  holes: updatedHoles.length > 0 ? updatedHoles : undefined,
                  holeWallOpenings: updatedHoleWallOpenings.length > 0 ? updatedHoleWallOpenings : undefined
                }
              });
            }
          }
        }
      }
    });
    
    // Apply all room updates in one batch
    if (roomUpdates.length > 0) {
      const updatedElements = scene.elements.map(el => {
        const update = roomUpdates.find(u => u.id === el.id);
        if (update && el.type === 'room') {
          return { ...el, ...update.updates } as RoomElement;
        }
        return el;
      });
      
      if (activeSceneId) {
        updateScene(activeSceneId, { elements: updatedElements });
      }
    }
    
    // Apply wall changes - use atomic replace to avoid React batching issues
    if (wallsToRemove.length > 0 || wallsToAdd.length > 0) {
      console.log('[WALL CUTTER RECT] Replacing walls - removing:', wallsToRemove.length, 'adding:', wallsToAdd.length);
      replaceElements(wallsToRemove, wallsToAdd);
      
      // Log what's actually in the scene after the operation
      setTimeout(() => {
        const wallsInScene = scene?.elements.filter(e => e.type === 'wall') || [];
        console.log('[WALL CUTTER RECT] FINAL RESULT - Walls in scene:', wallsInScene.length);
        wallsInScene.forEach(w => {
          const wall = w as any;
          console.log('  -', wall.id, 'vertices:', JSON.stringify(wall.vertices));
        });
      }, 100);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Handle double-click for custom room completion
    const baseShape = getBaseShape(roomSubTool);
    if (e.detail === 2 && activeTool === 'room' && baseShape === 'custom' && customRoomVertices.length >= 3) {
      const selectedRoom = scene?.elements.find(el => el.id === selectedElementId && el.type === 'room') as RoomElement | undefined;
      completeCustomRoom(selectedRoom);
      return;
    }

    // Handle double-click for wall completion
    if (e.detail === 2 && activeTool === 'wall' && wallVertices.length >= 2) {
      completeWall();
      return;
    }

    // Right click for panning
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    // Left click + spacebar for panning
    if (e.button === 0 && isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    // Pan tool - any click starts panning
    if (activeTool === 'pan' && e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (!scene || e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convert screen coordinates to canvas coordinates
    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    // Check if clicking on resize handle
    if (selectedElementId) {
      const handle = getResizeHandleAtPosition(x, y, selectedElementId, scene.elements);
      if (handle) {
        setResizingElement({ id: selectedElementId, handle });
        return;
      }
      
      // Check if clicking on rotation handle or corner interaction for room
      const element = scene.elements.find(el => el.id === selectedElementId);
      if (element && element.type === 'room' && element.vertices) {
        const xs = element.vertices.map(v => v.x);
        const ys = element.vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate rotation handle position (above center, inside SVG but relative)
        const handleDistance = 20 / viewport.zoom;
        const rotation = (element.rotation || 0) * Math.PI / 180;
        
        // Transform click position to SVG local space
        const relX = x - minX - width / 2;
        const relY = y - minY - height / 2;
        const cosR = Math.cos(-rotation);
        const sinR = Math.sin(-rotation);
        const localX = relX * cosR - relY * sinR + width / 2;
        const localY = relX * sinR + relY * cosR + height / 2;
        
        // Check center rotation handle (top of room in local space)
        const distToCenterHandle = Math.sqrt(
          Math.pow(localX - width / 2, 2) + Math.pow(localY - (-handleDistance), 2)
        );
        
        if (distToCenterHandle < 15 / viewport.zoom) {
          const startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
          setRotatingElement({
            id: element.id,
            startAngle,
            centerX,
            centerY,
            initialRotation: element.rotation || 0
          });
          return;
        }
        
        // Check corner interactions
        const relativeVertices = element.vertices.map(v => ({
          x: v.x - minX,
          y: v.y - minY
        }));
        
        for (let i = 0; i < relativeVertices.length; i++) {
          const v = relativeVertices[i];
          // Rotate vertex around center
          const vRelX = v.x - width / 2;
          const vRelY = v.y - height / 2;
          const rotatedX = vRelX * Math.cos(rotation) - vRelY * Math.sin(rotation);
          const rotatedY = vRelX * Math.sin(rotation) + vRelY * Math.cos(rotation);
          
          const worldX = minX + width / 2 + rotatedX;
          const worldY = minY + height / 2 + rotatedY;
          
          // Check direct click on vertex (CTRL + click to move vertex)
          const distToVertex = Math.sqrt(
            Math.pow(x - worldX, 2) + Math.pow(y - worldY, 2)
          );
          
          if (distToVertex < 6 / viewport.zoom) {
            if (e.ctrlKey || e.shiftKey) {
              // CTRL/SHIFT + click on vertex: Move vertex
              setMovingVertex({ id: element.id, vertexIndex: i });
              return;
            } else {
              // Direct click on vertex: Scale from opposite corner
              setScalingElement({
                id: element.id,
                cornerIndex: i,
                startX: x,
                startY: y,
                initialVertices: [...element.vertices],
                initialHoles: element.holes ? element.holes.map(hole => [...hole]) : undefined
              });
              return;
            }
          }
        }
        
        // Check for CTRL/SHIFT + click on edge to add new vertex and start dragging it
        if (e.ctrlKey || e.shiftKey) {
          // Need to transform edges to world space to check distance correctly
          for (let i = 0; i < relativeVertices.length; i++) {
            const v1 = relativeVertices[i];
            const v2 = relativeVertices[(i + 1) % relativeVertices.length];
            
            // Rotate both vertices around center
            const v1RelX = v1.x - width / 2;
            const v1RelY = v1.y - height / 2;
            const v1RotX = v1RelX * Math.cos(rotation) - v1RelY * Math.sin(rotation);
            const v1RotY = v1RelX * Math.sin(rotation) + v1RelY * Math.cos(rotation);
            const v1WorldX = minX + width / 2 + v1RotX;
            const v1WorldY = minY + height / 2 + v1RotY;
            
            const v2RelX = v2.x - width / 2;
            const v2RelY = v2.y - height / 2;
            const v2RotX = v2RelX * Math.cos(rotation) - v2RelY * Math.sin(rotation);
            const v2RotY = v2RelX * Math.sin(rotation) + v2RelY * Math.cos(rotation);
            const v2WorldX = minX + width / 2 + v2RotX;
            const v2WorldY = minY + height / 2 + v2RotY;
            
            const { distance } = distanceToLineSegment(
              { x, y }, 
              { x: v1WorldX, y: v1WorldY }, 
              { x: v2WorldX, y: v2WorldY }
            );
            
            if (distance < 8 / viewport.zoom) {
              // Click is on edge - insert new vertex and immediately start moving it
              saveToHistory();
              const newVertices = [...element.vertices];
              const newVertexIndex = i + 1;
              newVertices.splice(newVertexIndex, 0, { x, y });
              updateElement(element.id, { vertices: newVertices });
              // Start moving the newly created vertex immediately
              setMovingVertex({ id: element.id, vertexIndex: newVertexIndex });
              return;
            }
          }
        }
        
        // Check hole vertices and edges
        if (element.holes) {
          for (let holeIndex = 0; holeIndex < element.holes.length; holeIndex++) {
            const hole = element.holes[holeIndex];
            const relativeHole = hole.map(v => ({
              x: v.x - minX,
              y: v.y - minY
            }));
            
            // Check direct click on hole vertex (CTRL/SHIFT + click to move)
            for (let vertexIndex = 0; vertexIndex < relativeHole.length; vertexIndex++) {
              const v = relativeHole[vertexIndex];
              // Rotate vertex around center
              const vRelX = v.x - width / 2;
              const vRelY = v.y - height / 2;
              const rotatedX = vRelX * Math.cos(rotation) - vRelY * Math.sin(rotation);
              const rotatedY = vRelX * Math.sin(rotation) + vRelY * Math.cos(rotation);
              
              const worldX = minX + width / 2 + rotatedX;
              const worldY = minY + height / 2 + rotatedY;
              
              const distToVertex = Math.sqrt(
                Math.pow(x - worldX, 2) + Math.pow(y - worldY, 2)
              );
              
              if (distToVertex < 6 / viewport.zoom) {
                if (e.ctrlKey || e.shiftKey) {
                  // CTRL/SHIFT + click on hole vertex: Move vertex
                  setMovingVertex({ id: element.id, vertexIndex, holeIndex });
                  return;
                }
              }
            }
            
            // Check for CTRL/SHIFT + click on hole edge to add new vertex
            if (e.ctrlKey || e.shiftKey) {
              for (let i = 0; i < relativeHole.length; i++) {
                const v1 = relativeHole[i];
                const v2 = relativeHole[(i + 1) % relativeHole.length];
                
                // Rotate both vertices around center
                const v1RelX = v1.x - width / 2;
                const v1RelY = v1.y - height / 2;
                const v1RotX = v1RelX * Math.cos(rotation) - v1RelY * Math.sin(rotation);
                const v1RotY = v1RelX * Math.sin(rotation) + v1RelY * Math.cos(rotation);
                const v1WorldX = minX + width / 2 + v1RotX;
                const v1WorldY = minY + height / 2 + v1RotY;
                
                const v2RelX = v2.x - width / 2;
                const v2RelY = v2.y - height / 2;
                const v2RotX = v2RelX * Math.cos(rotation) - v2RelY * Math.sin(rotation);
                const v2RotY = v2RelX * Math.sin(rotation) + v2RelY * Math.cos(rotation);
                const v2WorldX = minX + width / 2 + v2RotX;
                const v2WorldY = minY + height / 2 + v2RotY;
                
                const { distance } = distanceToLineSegment(
                  { x, y },
                  { x: v1WorldX, y: v1WorldY },
                  { x: v2WorldX, y: v2WorldY }
                );
                
                if (distance < 8 / viewport.zoom) {
                  // Click is on hole edge - insert new vertex and immediately start moving it
                  saveToHistory();
                  const newHoles = element.holes!.map((h, idx) => {
                    if (idx === holeIndex) {
                      const newHole = [...h];
                      newHole.splice(i + 1, 0, { x, y });
                      return newHole;
                    }
                    return h;
                  });
                  updateElement(element.id, { holes: newHoles });
                  // Start moving the newly created vertex immediately
                  setMovingVertex({ id: element.id, vertexIndex: i + 1, holeIndex });
                  return;
                }
              }
            }
          }
        }
        
        // Continue with other checks - rotation handles on corners
        for (let i = 0; i < relativeVertices.length; i++) {
          const v = relativeVertices[i];
          
          // Rotate vertex around center
          const vRelX = v.x - width / 2;
          const vRelY = v.y - height / 2;
          const rotatedX = vRelX * Math.cos(rotation) - vRelY * Math.sin(rotation);
          const rotatedY = vRelX * Math.sin(rotation) + vRelY * Math.cos(rotation);
          
          const worldX = minX + width / 2 + rotatedX;
          const worldY = minY + height / 2 + rotatedY;
          
          // Calculate rotation handle offset (outside corner)
          const handleOffset = 15 / viewport.zoom;
          const angle = Math.atan2(rotatedY, rotatedX);
          const handleX = worldX + handleOffset * Math.cos(angle);
          const handleY = worldY + handleOffset * Math.sin(angle);
          
          const distToCornerHandle = Math.sqrt(
            Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2)
          );
          
          if (distToCornerHandle < 12 / viewport.zoom) {
            // Click outside corner: Rotate
            const startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
            setRotatingElement({
              id: element.id,
              startAngle,
              centerX,
              centerY,
              initialRotation: element.rotation || 0
            });
            return;
          }
        }
      }
      
      // Check if clicking on vertex or edge for wall element (similar to room)
      if (element && element.type === 'wall') {
        // Handle both segments (merged walls) and vertices (single walls)
        const hasSegments = element.segments && element.segments.length > 0;
        const vertices = hasSegments ? element.segments!.flat() : element.vertices;
        
        if (vertices && vertices.length > 0) {
          // Check direct click on vertex (CTRL/SHIFT + click to move vertex)
          for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            if (!v) continue;
            const distToVertex = Math.sqrt(
              Math.pow(x - v.x, 2) + Math.pow(y - v.y, 2)
            );
            
            if (distToVertex < 6 / viewport.zoom) {
              if (e.ctrlKey || e.shiftKey) {
                // CTRL/SHIFT + click on vertex: Move vertex
                setMovingVertex({ id: element.id, vertexIndex: i, segmentBased: hasSegments });
                return;
              }
            }
          }
          
          // Check for CTRL/SHIFT + click on edge to add new vertex
          if (e.ctrlKey || e.shiftKey) {
            const segments = hasSegments ? element.segments! : [element.vertices];
            let globalVertexIndex = 0;
            
            for (const segment of segments) {
              for (let i = 0; i < segment.length - 1; i++) {
                const v1 = segment[i];
                const v2 = segment[i + 1];
                
                const { distance } = distanceToLineSegment({ x, y }, v1, v2);
                
                if (distance < 8 / viewport.zoom) {
                  // Click is on edge - insert new vertex and immediately start moving it
                  saveToHistory();
                  
                  if (hasSegments) {
                    // Insert into the specific segment
                    const newSegments = element.segments!.map((seg) => {
                      if (seg === segment) {
                        const newSeg = [...seg];
                        newSeg.splice(i + 1, 0, { x, y });
                        return newSeg;
                      }
                      return seg;
                    });
                    updateElement(element.id, { segments: newSegments });
                  } else {
                    // Insert into vertices array
                    const newVertices = [...element.vertices];
                    newVertices.splice(i + 1, 0, { x, y });
                    updateElement(element.id, { vertices: newVertices });
                  }
                  
                  // Start moving the newly created vertex
                  const newVertexIndex = globalVertexIndex + i + 1;
                  setMovingVertex({ id: element.id, vertexIndex: newVertexIndex, segmentBased: hasSegments });
                  return;
                }
              }
              globalVertexIndex += segment.length;
            }
          }
        }
      }
    }

    // Check if clicking on an element
    const clickedElement = findElementAtPosition(x, y, scene.elements);

    // Double-click detection
    const now = Date.now();
    const isDoubleClick = clickedElement && 
      clickedElement.id === lastClickedElement && 
      now - lastClickTime < 300; // 300ms double-click threshold
    
    if (isDoubleClick && onDoubleClickElement) {
      onDoubleClickElement(clickedElement.id);
      setLastClickTime(0); // Reset to prevent triple-click
      setLastClickedElement(null);
      return;
    }
    
    // Update click tracking
    if (clickedElement) {
      setLastClickTime(now);
      setLastClickedElement(clickedElement.id);
    } else {
      setLastClickTime(0);
      setLastClickedElement(null);
    }

    // Zoom tool - click to zoom in, alt+click to zoom out at mouse position
    if (activeTool === 'zoom-in') {
      if (e.altKey) {
        handleZoomOut();
      } else {
        handleZoomIn();
      }
      return;
    }
    if (activeTool === 'zoom-out') {
      handleZoomOut();
      return;
    }

    // Effective tool (CTRL or ALT overrides to pointer, even in room mode)
    // Use e.ctrlKey directly from the mouse event to be accurate
    const effectiveTool = (e.ctrlKey || e.altKey) ? 'pointer' : activeTool;

    if (effectiveTool === 'pointer') {
      if (clickedElement) {
        // Ctrl or Shift click: Toggle element in multi-selection
        if (e.ctrlKey || e.shiftKey) {
          if (selectedElementIds.includes(clickedElement.id)) {
            // Remove from selection
            const newSelection = selectedElementIds.filter(id => id !== clickedElement.id);
            setSelectedElementIds(newSelection);
            setSelectedElementId(null);
          } else {
            // Add to selection
            const newIds = selectedElementIds.length > 0 
              ? [...selectedElementIds, clickedElement.id]
              : selectedElementId 
                ? [selectedElementId, clickedElement.id]
                : [clickedElement.id];
            setSelectedElementIds(newIds);
            setSelectedElementId(null);
          }
          return; // Don't start dragging when modifying selection
        }
        // Check if clicking on element that's part of current multi-selection
        else if (selectedElementIds.length > 0 && selectedElementIds.includes(clickedElement.id)) {
          // Check if any selected elements are locked
          const lockedElement = selectedElementIds
            .map(id => scene.elements.find(e => e.id === id))
            .find(el => el?.locked);
          
          if (lockedElement) {
            // Don't allow dragging if any element is locked
            const elementName = lockedElement.type === 'token' 
              ? lockedElement.name 
              : lockedElement.type === 'room'
              ? lockedElement.name || 'Room'
              : 'Annotation';
            setLockedElementError(`The ${lockedElement.type} "${elementName}" is locked. Unlock before moving.`);
            setTimeout(() => setLockedElementError(null), 3000);
            return;
          }
          
          // Start dragging multiple elements - DON'T change selection
          const dragOffsets = new Map<string, {x: number, y: number}>();
          selectedElementIds.forEach(id => {
            const el = scene.elements.find(e => e.id === id);
            if (el) {
              let elX, elY;
              if (el.type === 'room' && el.vertices) {
                const xs = el.vertices.map(v => v.x);
                const ys = el.vertices.map(v => v.y);
                elX = (Math.min(...xs) + Math.max(...xs)) / 2;
                elY = (Math.min(...ys) + Math.max(...ys)) / 2;
              } else if (el.type === 'wall' && el.vertices) {
                const xs = el.vertices.map(v => v.x);
                const ys = el.vertices.map(v => v.y);
                elX = (Math.min(...xs) + Math.max(...xs)) / 2;
                elY = (Math.min(...ys) + Math.max(...ys)) / 2;
              } else if ('x' in el && 'y' in el) {
                elX = el.x;
                elY = el.y;
              } else {
                return; // Skip this element
              }
              dragOffsets.set(id, { x: x - elX, y: y - elY });
            }
          });
          setDraggedMultiple({ offsetX: x, offsetY: y, initialOffsets: dragOffsets });
        } else {
          // Check if element is locked
          if (clickedElement.locked) {
            // Select but don't drag
            setSelectedElementId(clickedElement.id);
            setSelectedElementIds([]);
            
            // In game mode, notify parent to open InfoBox (even for locked elements)
            if (viewMode === 'game' && onElementSelected) {
              onElementSelected(clickedElement.id);
              // Don't show error in game mode - locked is normal state
              return;
            }
            
            // In planning mode, show lock error
            const elementName = clickedElement.type === 'token' 
              ? clickedElement.name 
              : clickedElement.type === 'room'
              ? clickedElement.name || 'Room'
              : 'Annotation';
            setLockedElementError(`The ${clickedElement.type} "${elementName}" is locked. Unlock before moving.`);
            setTimeout(() => setLockedElementError(null), 3000);
            return;
          }

          // Game mode: Check movement restrictions
          if (viewMode === 'game') {
            // Rooms and walls are permanently locked in game mode
            if (clickedElement.type === 'room' || clickedElement.type === 'wall') {
              setSelectedElementId(clickedElement.id);
              setSelectedElementIds([]);
              const elementName = clickedElement.type === 'room' 
                ? (clickedElement.name || 'Room')
                : (clickedElement.name || 'Wall');
              setLockedElementError(`${elementName} cannot be moved in Game Mode.`);
              setTimeout(() => setLockedElementError(null), 3000);
              return;
            }
            
            // Check if element is in playlist (has playlistObject flag)
            if (!clickedElement.playlistObject) {
              setSelectedElementId(clickedElement.id);
              setSelectedElementIds([]);
              const elementName = clickedElement.type === 'token' 
                ? clickedElement.name 
                : clickedElement.type;
              setLockedElementError(`End Game Mode to move "${elementName}"`);
              setTimeout(() => setLockedElementError(null), 3000);
              return;
            }
            
            // Tokens require explicit unlock via InfoBox (checked via locked property above)
          }
          
          // Regular click: Select single and start dragging
          setSelectedElementId(clickedElement.id);
          setSelectedElementIds([]);
          
          // In game mode, notify parent to open InfoBox and scroll playlist
          if (viewMode === 'game' && onElementSelected) {
            onElementSelected(clickedElement.id);
          }
          
          let offsetX, offsetY;
          if (clickedElement.type === 'room' && clickedElement.vertices) {
            const xs = clickedElement.vertices.map(v => v.x);
            const ys = clickedElement.vertices.map(v => v.y);
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            offsetX = x - centerX;
            offsetY = y - centerY;
          } else if (clickedElement.type === 'wall') {
            const wallElement = clickedElement as WallElement;
            const hasSegments = wallElement.segments && wallElement.segments.length > 0;
            const allVertices = hasSegments ? wallElement.segments!.flat() : wallElement.vertices || [];
            if (allVertices.length > 0) {
              const xs = allVertices.filter(v => v).map(v => v.x);
              const ys = allVertices.filter(v => v).map(v => v.y);
              const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
              const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
              offsetX = x - centerX;
              offsetY = y - centerY;
            } else {
              offsetX = 0;
              offsetY = 0;
            }
          } else if ('x' in clickedElement && 'y' in clickedElement) {
            offsetX = x - clickedElement.x;
            offsetY = y - clickedElement.y;
          } else {
            offsetX = 0;
            offsetY = 0;
          }
          
          setDraggedElement({
            id: clickedElement.id,
            offsetX,
            offsetY
          });
        }
      } else {
        // Click on empty space: Start selection box
        setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
    } else if (effectiveTool === 'marker') {
      // Start creating annotation with drag-to-size
      setIsCreating(true);
      setCreateStart({ x, y });
      const tempAnnotation: AnnotationElement = {
        id: 'temp',
        type: 'annotation',
        x,
        y,
        size: 20,
        color: activeColor,
        icon: activeIcon,
        notes: '',
        label: ''
      };
      setTempElement(tempAnnotation);
    } else if (effectiveTool === 'token' && activeTokenTemplate) {
      // Prevent browser's default drag behavior
      e.preventDefault();
      
      // Start creating token with drag-to-size
      setIsCreating(true);
      setCreateStart({ x, y });
      const tempToken: TokenElement = {
        id: 'temp',
        type: 'token',
        x,
        y,
        size: 40,
        name: activeTokenTemplate.name,
        imageUrl: activeTokenTemplate.imageUrl,
        notes: '',
        isShape: activeTokenTemplate.isShape,
        isPOI: activeTokenTemplate.isPOI,
        icon: activeTokenTemplate.icon,
        color: activeTokenTemplate.color || activeColor // Always set color for border (use template color or selected color)
      };
      setTempElement(tempToken);
    } else if (effectiveTool === 'room') {
      const baseShape = getBaseShape(roomSubTool);
      if (baseShape === 'custom') {
        // Custom/Magnetic room drawing - click to place vertices
        const selectedRoom = scene.elements.find(el => el.id === selectedElementId && el.type === 'room') as RoomElement | undefined;
        const useFloorTexture = selectedRoom?.floorTextureUrl || selectedFloorTexture;
        
        if (!useFloorTexture) {
          console.warn('[CUSTOM ROOM] No floor texture selected!');
          return;
        }
        
        // Add vertex at clicked point
        const verticesToAdd = [{ x, y }];
        
        // Check if clicking on first vertex to close the shape
        if (customRoomVertices.length >= 3) {
          const firstVertex = customRoomVertices[0];
          const checkPoint = verticesToAdd[verticesToAdd.length - 1];
          const distance = Math.sqrt(
            (checkPoint.x - firstVertex.x) ** 2 + 
            (checkPoint.y - firstVertex.y) ** 2
          );
          
          if (distance < 10 / viewport.zoom) {
            // Close the shape and create the room
            completeCustomRoom(selectedRoom);
            return;
          }
        }
        
        // Add new vertex
        setCustomRoomVertices([...customRoomVertices, ...verticesToAdd]);
        return;
      } else if (roomSubTool !== 'erase') {
        // Start creating floor tile area with drag-to-draw shape (rectangle, pentagon, hexagon, or octagon)
        console.log('[ROOM DRAW] Starting - selectedFloorTexture:', selectedFloorTexture);
        
        // Check if a room is currently selected - if so, use its settings
        const selectedRoom = scene.elements.find(el => el.id === selectedElementId && el.type === 'room') as RoomElement | undefined;
        
        // Determine which settings to use (selected room or global)
        const useFloorTexture = selectedRoom?.floorTextureUrl || selectedFloorTexture;
        const useTileSize = selectedRoom?.tileSize || tileSize;
        const useShowWalls = selectedRoom?.showWalls ?? showWalls;
        const useWallTexture = selectedRoom?.wallTextureUrl || selectedWallTexture || '';
        const useWallThickness = selectedRoom?.wallThickness || wallThickness;
        const useWallTileSize = selectedRoom?.wallTileSize || wallTileSize;
        
        if (!useFloorTexture) {
          console.warn('[ROOM DRAW] No floor texture selected!');
          // Cannot draw floor without texture selected
          return;
        }
        
        // Determine number of vertices based on roomSubTool
        let numVertices = 4; // default rectangle
        if (roomSubTool === 'pentagon') numVertices = 5;
        else if (roomSubTool === 'hexagon') numVertices = 6;
        else if (roomSubTool === 'octagon') numVertices = 8;
        
        setRoomDrawStart({ x, y });
        const tempRoomElement: RoomElement = {
          id: 'temp',
          type: 'room',
          vertices: Array(numVertices).fill(null).map(() => ({ x, y })),
          wallOpenings: [],
          floorTextureUrl: useFloorTexture,
          tileSize: useTileSize,
          showWalls: useShowWalls,
          wallTextureUrl: useWallTexture,
          wallThickness: useWallThickness,
          wallTileSize: useWallTileSize,
          name: generateRoomName(),
          notes: '',
          zIndex: -100,
          visible: true,
          widgets: []
        };
        console.log('[ROOM DRAW] Created tempRoom:', tempRoomElement);
        setTempRoom(tempRoomElement);
      } else if (roomSubTool === 'erase') {
        // Start erasing walls - find all rooms under cursor using point-in-polygon
        const roomsUnderCursor = scene.elements.filter(el => {
          if (el.type !== 'room') return false;
          const room = el as RoomElement;
          return room.vertices && pointInPolygon({ x, y }, room.vertices);
        });
        
        if (roomsUnderCursor.length > 0) {
          setIsErasing(true);
          // Erase on all rooms under cursor
          roomsUnderCursor.forEach(room => {
            if (room.type === 'room') {
              handleWallErase(room as RoomElement, x, y);
            }
          });
        }
      } else if (isSubtractMode(roomSubTool)) {
        // Subtract mode - draw rectangle to subtract from existing room
        setRoomDrawStart({ x, y });
        const tempRoomElement: RoomElement = {
          id: 'temp',
          type: 'room',
          vertices: [{ x, y }, { x, y }, { x, y }, { x, y }],
          floorTextureUrl: 'transparent', // Use transparent for subtract preview
          tileSize: tileSize,
          rotation: 0,
          showWalls: true,
          wallTextureUrl: 'transparent',
          wallThickness: 2,
          wallTileSize: 50,
          wallOpenings: [],
          zIndex: -100,
          visible: true,
          widgets: [],
          name: '',
          notes: ''
        };
        setTempRoom(tempRoomElement);
      }
    } else if (effectiveTool === 'wall') {
      // Wall drawing - click to place vertices
      console.log('[WALL DRAW] Adding vertex at', x, y);
      
      if (!selectedWallTexture) {
        console.warn('[WALL DRAW] No wall texture selected!');
        return;
      }
      
      // Add vertex at clicked point
      const newVertices = [...wallVertices, { x, y }];
      setWallVertices(newVertices);
      
      console.log('[WALL DRAW] Total vertices:', newVertices.length);
      
      // Auto-activate scene on first wall vertex (like terrain brushes)
      if (newVertices.length === 1 && !hasActivatedSceneRef.current) {
        activateAutoCreatedScene();
        hasActivatedSceneRef.current = true;
      }
      
      return;
    } else if (effectiveTool === 'wall-line') {
      // Wall line drawing - click and drag to draw single wall line
      console.log('[WALL LINE] Starting wall line at', x, y);
      
      if (!selectedWallTexture) {
        console.warn('[WALL LINE] No wall texture selected!');
        return;
      }
      
      // Start wall line at clicked point
      setWallLineStart({ x, y });
      setWallLinePreview({ x, y });
      
      // Auto-activate scene on first wall line start (like terrain brushes)
      if (!hasActivatedSceneRef.current) {
        activateAutoCreatedScene();
        hasActivatedSceneRef.current = true;
      }
      
      return;
    } else if (effectiveTool === 'background') {
      // X-Lab Shape Fill Mode
      if (xlabShapeMode !== null) {
        if (!selectedBackgroundTexture) {
          console.warn('[XLAB SHAPE] No texture selected!');
          return;
        }
        
        setXlabTerrainShapeStart({ x, y });
        setXlabTerrainShapeEnd({ x, y });
        return;
      }
      
      // Normal brush painting (default behavior - supports both terrain brush and background texture)
      if (!selectedBackgroundTexture && !selectedTerrainBrush) {
        console.warn('[BRUSH PAINT] No texture selected!');
        return;
      }
      
      setIsPaintingBackground(true);
      startBrushPainting(x, y);
    } else if (effectiveTool === 'doorTool') {
      // Door Tool - DISABLED
      return;
    } else if (effectiveTool === 'wallCutterTool') {
      // Wall Cutter Tool - rectangle mode only
      setWallCutterToolStart({ x, y });
      setWallCutterToolEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    // Update cursor position for custom room preview
    if (activeTool === 'room' && getBaseShape(roomSubTool) === 'custom') {
      setCursorPosition({ x, y });
    }

    // Update cursor position for wall preview
    if (activeTool === 'wall') {
      setCursorPosition({ x, y });
    }

    // Update wall line preview while dragging
    if (activeTool === 'wall-line' && wallLineStart) {
      let previewX = x;
      let previewY = y;
      
      // Snap to 45-degree angles if shift is held
      if (isShiftPressed) {
        const dx = x - wallLineStart.x;
        const dy = y - wallLineStart.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Round to nearest 45 degrees (π/4 radians)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        
        // Calculate snapped position
        previewX = wallLineStart.x + distance * Math.cos(snapAngle);
        previewY = wallLineStart.y + distance * Math.sin(snapAngle);
      }
      
      setWallLinePreview({ x: previewX, y: previewY });
    }

    // Check if hovering over rotation handle or vertices
    if (scene && selectedElementId && !rotatingElement && !draggedElement) {
      const element = scene.elements.find(el => el.id === selectedElementId);
      if (element && element.type === 'room' && element.vertices) {
        const xs = element.vertices.map(v => v.x);
        const ys = element.vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;
        
        const handleDistance = 20 / viewport.zoom;
        const rotation = (element.rotation || 0) * Math.PI / 180;
        
        // Transform mouse position to SVG local space for center handle
        const relX = x - minX - width / 2;
        const relY = y - minY - height / 2;
        const cosR = Math.cos(-rotation);
        const sinR = Math.sin(-rotation);
        const localX = relX * cosR - relY * sinR + width / 2;
        const localY = relX * sinR + relY * cosR + height / 2;
        
        // Check center rotation handle
        const distToCenterHandle = Math.sqrt(
          Math.pow(localX - width / 2, 2) + Math.pow(localY - (-handleDistance), 2)
        );
        
        let hoveringAnyHandle = distToCenterHandle < 15 / viewport.zoom;
        let foundHoveringVertex: { id: string; index: number; cursorDirection: string } | null = null;
        
        // Check vertices and corner rotation handles
        if (!hoveringAnyHandle) {
          const relativeVertices = element.vertices.map(v => ({
            x: v.x - minX,
            y: v.y - minY
          }));
          
          // Calculate center for cursor direction
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          
          for (let i = 0; i < relativeVertices.length; i++) {
            const v = relativeVertices[i];
            const vRelX = v.x - width / 2;
            const vRelY = v.y - height / 2;
            const rotatedX = vRelX * Math.cos(rotation) - vRelY * Math.sin(rotation);
            const rotatedY = vRelX * Math.sin(rotation) + vRelY * Math.cos(rotation);
            
            const worldX = minX + width / 2 + rotatedX;
            const worldY = minY + height / 2 + rotatedY;
            
            // Check if hovering over vertex itself
            const distToVertex = Math.sqrt(
              Math.pow(x - worldX, 2) + Math.pow(y - worldY, 2)
            );
            
            if (distToVertex < 6 / viewport.zoom) {
              // Calculate cursor direction based on vertex position relative to center
              const dx = worldX - centerX;
              const dy = worldY - centerY;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              // Map angle to cursor direction (nwse or nesw)
              // -45° to 45° and 135° to -135° = nwse-resize
              // 45° to 135° and -135° to -45° = nesw-resize
              let cursorDirection;
              if ((angle >= -45 && angle < 45) || (angle >= 135 || angle < -135)) {
                cursorDirection = 'nwse-resize'; // ↖↘ diagonal
              } else {
                cursorDirection = 'nesw-resize'; // ↗↙ diagonal
              }
              
              foundHoveringVertex = { id: element.id, index: i, cursorDirection };
              break;
            }
            
            // Check corner rotation handle (only if not hovering vertex)
            const handleOffset = 15 / viewport.zoom;
            const angle = Math.atan2(rotatedY, rotatedX);
            const handleX = worldX + handleOffset * Math.cos(angle);
            const handleY = worldY + handleOffset * Math.sin(angle);
            
            const distToCornerHandle = Math.sqrt(
              Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2)
            );
            
            if (distToCornerHandle < 12 / viewport.zoom) {
              hoveringAnyHandle = true;
              break;
            }
          }
        }
        
        setIsHoveringRotateHandle(hoveringAnyHandle);
        setHoveringVertex(foundHoveringVertex);
        
        // Check for hovering over edge (when CTRL or SHIFT is pressed)
        if ((isCtrlPressed || isShiftPressed) && !foundHoveringVertex && !hoveringAnyHandle) {
          let foundHoveringEdge: { id: string; edgeIndex: number } | null = null;
          for (let i = 0; i < element.vertices.length; i++) {
            const v1 = element.vertices[i];
            const v2 = element.vertices[(i + 1) % element.vertices.length];
            
            const { distance } = distanceToLineSegment({ x, y }, v1, v2);
            
            if (distance < 8 / viewport.zoom) {
              foundHoveringEdge = { id: element.id, edgeIndex: i };
              break;
            }
          }
          setHoveringEdge(foundHoveringEdge);
        } else {
          setHoveringEdge(null);
        }
      } else {
        setIsHoveringRotateHandle(false);
        setHoveringVertex(null);
        setHoveringEdge(null);
      }
    } else {
      setIsHoveringRotateHandle(false);
      setHoveringVertex(null);
      setHoveringEdge(null);
    }

    // Track mouse position for zoom
    setLastMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Check if mouse is over toolbar or any UI element
    const target = e.target as HTMLElement;
    const isOverUI = target.closest('.floating-toolbar') || 
                     target.closest('button') || 
                     target.closest('[role="button"]') ||
                     target.tagName === 'BUTTON';

    // Update cursor position for token preview - only if scene exists and not over UI
    if (activeTool === 'token' && activeTokenTemplate && scene && !isOverUI) {
      setCursorPosition({ x, y });
    } else if (activeTool === 'background' && selectedTerrainBrush && scene && !isOverUI) {
      // Update cursor position for terrain brush preview
      setCursorPosition({ x, y });
    } else if (activeTool === 'doorTool' && scene && !isOverUI) {
      // Update cursor position for door tool preview
      setCursorPosition({ x, y });
    } else if (activeTool === 'wallCutterTool' && scene && !isOverUI) {
      // Update cursor position for wall cutter tool preview
      setCursorPosition({ x, y });
    } else if (activeTool !== 'room' || roomSubTool !== 'custom') {
      // Only clear cursor position if NOT in custom/magnetic room mode
      setCursorPosition(null);
    }

    // Handle wall erasing (paint-style) - erase on all rooms under cursor
    if (isErasing && scene) {
      const roomsUnderCursor = scene.elements.filter(el => {
        if (el.type !== 'room') return false;
        const room = el as RoomElement;
        return room.vertices && pointInPolygon({ x, y }, room.vertices);
      });
      
      roomsUnderCursor.forEach(room => {
        if (room.type === 'room') {
          handleWallErase(room as RoomElement, x, y);
        }
      });
      return;
    }

    if (isPanning) {
      setViewport(prev => {
        const newX = fitToViewLocked ? prev.x : e.clientX - panStart.x;
        const newY = e.clientY - panStart.y;
        
        return {
          ...prev,
          x: newX,
          y: newY
        };
      });
      return;
    }

    // X-Lab: Handle shape dragging (all shapes)
    if (xlabTerrainShapeStart && xlabShapeMode !== null) {
      setXlabTerrainShapeEnd({ x, y });
      return;
    }

    // Door Tool: DISABLED
    
    // Wall Cutter Tool: Handle rectangle dragging
    if (wallCutterToolStart) {
      setWallCutterToolEnd({ x, y });
      return;
    }

    // Handle brush painting
    if (isPaintingBackground && selectedBackgroundTexture) {
      // Shift+drag line drawing temporarily disabled during tile system migration
      // TODO: Reimplement line drawing with tile-based system
      
      // Normal painting mode
      continueBrushPainting(x, y);
      return;
    }

    // Handle selection box
    if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
      return;
    }

    // Handle multi-element dragging
    if (draggedMultiple && scene && selectedElementIds.length > 0) {
      const updates = new Map<string, Partial<MapElement>>();
      selectedElementIds.forEach(id => {
        const element = scene.elements.find(e => e.id === id);
        const initialOffset = draggedMultiple.initialOffsets?.get(id);
        if (element && initialOffset) {
          if (element.type === 'room' && element.vertices) {
            // Calculate current center
            const xs = element.vertices.map(v => v.x);
            const ys = element.vertices.map(v => v.y);
            const currentCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const currentCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
            
            // Calculate new center
            const newCenterX = x - initialOffset.x;
            const newCenterY = y - initialOffset.y;
            
            // Calculate delta
            const dx = newCenterX - currentCenterX;
            const dy = newCenterY - currentCenterY;
            
            // Move all vertices
            const newVertices = element.vertices.map(v => ({
              x: v.x + dx,
              y: v.y + dy
            }));
            
            // Move holes if any
            const newHoles = element.holes?.map(hole =>
              hole.map(v => ({
                x: v.x + dx,
                y: v.y + dy
              }))
            );
            
            updates.set(id, { 
              vertices: newVertices,
              holes: newHoles
            });
          } else if (element.type === 'wall') {
            const wallElement = element as WallElement;
            const hasSegments = wallElement.segments && wallElement.segments.length > 0;
            const allVertices = hasSegments ? wallElement.segments!.flat() : wallElement.vertices || [];
            
            if (allVertices.length > 0) {
              // Calculate current center
              const xs = allVertices.filter(v => v).map(v => v.x);
              const ys = allVertices.filter(v => v).map(v => v.y);
              const currentCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
              const currentCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
              
              // Calculate new center
              const newCenterX = x - initialOffset.x;
              const newCenterY = y - initialOffset.y;
              
              // Calculate delta
              const dx = newCenterX - currentCenterX;
              const dy = newCenterY - currentCenterY;
              
              if (hasSegments) {
                // Move all segments
                const newSegments = wallElement.segments!.map(segment =>
                  segment.map(v => ({
                    x: v.x + dx,
                    y: v.y + dy
                  }))
                );
                updates.set(id, { segments: newSegments });
              } else {
                // Move all vertices
                const newVertices = wallElement.vertices!.map(v => ({
                  x: v.x + dx,
                  y: v.y + dy
                }));
                updates.set(id, { vertices: newVertices });
              }
            }
          } else if ('x' in element && 'y' in element) {
            updates.set(id, {
              x: x - initialOffset.x,
              y: y - initialOffset.y
            });
          }
        }
      });
      if (updates.size > 0) {
        updateElements(updates);
      }
      return;
    }

    // Handle resizing
    if (resizingElement && scene) {
      const element = scene.elements.find(e => e.id === resizingElement.id);
      if (element) {
        if (element.type === 'room' && element.vertices) {
          // Polygon room vertex dragging
          const handleMatch = resizingElement.handle.match(/^v(\d+)$/);
          if (handleMatch) {
            const vertexIndex = parseInt(handleMatch[1]);
            if (vertexIndex >= 0 && vertexIndex < element.vertices.length) {
              // Update the specific vertex position
              const newVertices = [...element.vertices];
              newVertices[vertexIndex] = { x, y };
              updateElement(resizingElement.id, { vertices: newVertices });
            }
          }
        } else if ('x' in element && 'y' in element && 'size' in element) {
          // Handle circular element resizing (annotations and tokens)
          const distance = Math.sqrt((x - element.x) ** 2 + (y - element.y) ** 2) * 2;
          updateElement(resizingElement.id, { size: Math.max(10, distance) });
        }
      }
      return;
    }

    // Handle element creation (drag-to-size)
    if (isCreating && createStart && tempElement) {
      const distance = Math.sqrt((x - createStart.x) ** 2 + (y - createStart.y) ** 2) * 2;
      const size = Math.max(10, distance);
      
      // Only update size for elements that have a size property (not rooms or walls)
      if (tempElement.type !== 'room' && tempElement.type !== 'wall') {
        setTempElement({ ...tempElement, size } as MapElement);
      }
      return;
    }

    // Handle rotation
    if (rotatingElement && scene) {
      const element = scene.elements.find(el => el.id === rotatingElement.id);
      if (element && element.type === 'room') {
        // Calculate current angle from center to mouse
        const currentAngle = Math.atan2(y - rotatingElement.centerY, x - rotatingElement.centerX) * (180 / Math.PI);
        
        // Calculate rotation delta
        const angleDelta = currentAngle - rotatingElement.startAngle;
        
        // Apply rotation
        const newRotation = (rotatingElement.initialRotation + angleDelta) % 360;
        
        updateElement(element.id, { rotation: newRotation });
      }
      return;
    }

    // Handle scaling from corner
    if (scalingElement && scene) {
      const element = scene.elements.find(el => el.id === scalingElement.id);
      if (element && element.type === 'room') {
        const { cornerIndex, initialVertices, initialHoles } = scalingElement;
        
        // Get the opposite corner index
        const oppositeIndex = (cornerIndex + Math.floor(initialVertices.length / 2)) % initialVertices.length;
        const oppositeCorner = initialVertices[oppositeIndex];
        
        // Calculate scale factor based on distance from opposite corner
        const initialDist = Math.sqrt(
          Math.pow(initialVertices[cornerIndex].x - oppositeCorner.x, 2) +
          Math.pow(initialVertices[cornerIndex].y - oppositeCorner.y, 2)
        );
        const currentDist = Math.sqrt(
          Math.pow(x - oppositeCorner.x, 2) +
          Math.pow(y - oppositeCorner.y, 2)
        );
        
        const scale = currentDist / initialDist;
        
        // Scale all vertices from opposite corner
        const newVertices = initialVertices.map(v => ({
          x: oppositeCorner.x + (v.x - oppositeCorner.x) * scale,
          y: oppositeCorner.y + (v.y - oppositeCorner.y) * scale
        }));
        
        // Scale holes from initialHoles if they exist
        const newHoles = initialHoles?.map(hole =>
          hole.map(v => ({
            x: oppositeCorner.x + (v.x - oppositeCorner.x) * scale,
            y: oppositeCorner.y + (v.y - oppositeCorner.y) * scale
          }))
        );
        
        updateElement(element.id, { 
          vertices: newVertices,
          holes: newHoles
        });
      }
      return;
    }

    // Handle moving single vertex
    if (movingVertex && scene) {
      const element = scene.elements.find(el => el.id === movingVertex.id);
      
      if (element && element.type === 'room') {
        // Check if moving a hole vertex
        if (movingVertex.holeIndex !== undefined && element.holes) {
          const newHoles = element.holes.map((hole, idx) => {
            if (idx === movingVertex.holeIndex) {
              const newHole = [...hole];
              newHole[movingVertex.vertexIndex] = { x, y };
              return newHole;
            }
            return hole;
          });
          updateElement(element.id, { holes: newHoles });
        } else if (element.vertices) {
          // Moving main polygon vertex
          const newVertices = [...element.vertices];
          newVertices[movingVertex.vertexIndex] = { x, y };
          updateElement(element.id, { vertices: newVertices });
        }
      } else if (element && element.type === 'wall') {
        if (movingVertex.segmentBased && element.segments) {
          // Handle segment-based walls (merged walls)
          const newSegments = [...element.segments];
          
          // Find which segment contains this vertex
          let remainingIndex = movingVertex.vertexIndex;
          let targetSegmentIdx = 0;
          let vertexIdxInSegment = 0;
          
          for (let i = 0; i < newSegments.length; i++) {
            if (remainingIndex < newSegments[i].length) {
              targetSegmentIdx = i;
              vertexIdxInSegment = remainingIndex;
              break;
            }
            remainingIndex -= newSegments[i].length;
          }
          
          // Update the vertex in that segment
          newSegments[targetSegmentIdx] = [...newSegments[targetSegmentIdx]];
          newSegments[targetSegmentIdx][vertexIdxInSegment] = { x, y };
          
          updateElement(element.id, { segments: newSegments });
        } else if (element.vertices) {
          // Handle single vertices array
          const newVertices = [...element.vertices];
          newVertices[movingVertex.vertexIndex] = { x, y };
          updateElement(element.id, { vertices: newVertices });
        }
      }
      return;
    }

    // Handle room drawing - update vertices based on shape
    const baseShape = getBaseShape(roomSubTool);
    if (roomDrawStart && tempRoom && (baseShape === 'rectangle' || baseShape === 'pentagon' || baseShape === 'hexagon' || baseShape === 'octagon')) {
      // roomDrawStart is the FIXED anchor point - it never moves
      const deltaX = x - roomDrawStart.x;
      const deltaY = y - roomDrawStart.y;
      const width = Math.abs(deltaX);
      const height = Math.abs(deltaY);
      
      console.log('[SHAPE DEBUG]', {
        shape: baseShape,
        roomDrawStart: `(${roomDrawStart.x.toFixed(0)}, ${roomDrawStart.y.toFixed(0)})`,
        mouse: `(${x.toFixed(0)}, ${y.toFixed(0)})`,
        delta: `(${deltaX.toFixed(0)}, ${deltaY.toFixed(0)})`
      });
      
      let vertices: { x: number; y: number; }[];
      
      if (baseShape === 'rectangle') {
        // Rectangle vertices with roomDrawStart as northwest corner when dragging right+down
        const minX = deltaX >= 0 ? roomDrawStart.x : roomDrawStart.x - width;
        const maxX = deltaX >= 0 ? roomDrawStart.x + width : roomDrawStart.x;
        const minY = deltaY >= 0 ? roomDrawStart.y : roomDrawStart.y - height;
        const maxY = deltaY >= 0 ? roomDrawStart.y + height : roomDrawStart.y;
        
        vertices = [
          { x: minX, y: minY },  // Northwest - this is roomDrawStart when dragging right+down
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY }
        ];
      } else {
        // For polygons: inscribe inside SQUARE bounding box for regular shapes
        // Compute drag bounds - roomDrawStart is anchor corner
        const left = Math.min(roomDrawStart.x, x);
        const top = Math.min(roomDrawStart.y, y);
        const right = Math.max(roomDrawStart.x, x);
        const bottom = Math.max(roomDrawStart.y, y);
        const boxWidth = right - left;
        const boxHeight = bottom - top;
        
        // Force square: use the smaller dimension for both width and height
        const size = Math.min(boxWidth, boxHeight);
        
        // Adjust box to be square, keeping the anchor corner (roomDrawStart) fixed
        const squareRight = roomDrawStart.x + (x >= roomDrawStart.x ? size : 0);
        const squareLeft = roomDrawStart.x + (x >= roomDrawStart.x ? 0 : -size);
        const squareBottom = roomDrawStart.y + (y >= roomDrawStart.y ? size : 0);
        const squareTop = roomDrawStart.y + (y >= roomDrawStart.y ? 0 : -size);
        
        // Center and radius for inscribed polygon in the SQUARE
        const centerX = (squareLeft + squareRight) / 2;
        const centerY = (squareTop + squareBottom) / 2;
        const radius = size / 2;
        
        let numSides = 5;
        if (baseShape === 'hexagon') numSides = 6;
        else if (baseShape === 'octagon') numSides = 8;
        
        // Generate polygon vertices around center - already in world coordinates
        vertices = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2; // Start from top
          vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        }
        
        console.log('[POLYGON]', {
          dragBox: `(${left.toFixed(0)},${top.toFixed(0)}) to (${right.toFixed(0)},${bottom.toFixed(0)})`,
          squareBox: `(${squareLeft.toFixed(0)},${squareTop.toFixed(0)}) to (${squareRight.toFixed(0)},${squareBottom.toFixed(0)})`,
          center: `(${centerX.toFixed(0)},${centerY.toFixed(0)})`,
          radius: radius.toFixed(0)
        });
      }
      
      const calcMinX = Math.min(...vertices.map(v => v.x));
      const calcMinY = Math.min(...vertices.map(v => v.y));
      console.log('[VERTICES CHECK]', {
        count: vertices.length,
        calculatedMin: `(${calcMinX.toFixed(0)},${calcMinY.toFixed(0)})`,
        roomDrawStart: `(${roomDrawStart.x.toFixed(0)},${roomDrawStart.y.toFixed(0)})`,
        matches: Math.abs(calcMinX - roomDrawStart.x) < 1 && Math.abs(calcMinY - roomDrawStart.y) < 1
      });
      
      setTempRoom({ 
        ...tempRoom, 
        vertices
      });
      return;
    }

    // Handle dragging
    if (draggedElement && scene) {
      const element = scene.elements.find(e => e.id === draggedElement.id);
      if (element) {
        if (element.type === 'room' && element.vertices) {
          // Calculate current center
          const xs = element.vertices.map(v => v.x);
          const ys = element.vertices.map(v => v.y);
          const currentCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
          const currentCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
          
          // Calculate new center
          const newCenterX = x - draggedElement.offsetX;
          const newCenterY = y - draggedElement.offsetY;
          
          // Calculate delta
          const dx = newCenterX - currentCenterX;
          const dy = newCenterY - currentCenterY;
          
          // Move all vertices
          const newVertices = element.vertices.map(v => ({
            x: v.x + dx,
            y: v.y + dy
          }));
          
          // Move holes if any
          const newHoles = element.holes?.map(hole =>
            hole.map(v => ({
              x: v.x + dx,
              y: v.y + dy
            }))
          );
          
          updateElement(draggedElement.id, { 
            vertices: newVertices,
            holes: newHoles
          });
        } else if (element.type === 'wall') {
          const wallElement = element as WallElement;
          const hasSegments = wallElement.segments && wallElement.segments.length > 0;
          const allVertices = hasSegments ? wallElement.segments!.flat() : wallElement.vertices || [];
          
          if (allVertices.length > 0) {
            // Calculate current center of wall
            const xs = allVertices.filter(v => v).map(v => v.x);
            const ys = allVertices.filter(v => v).map(v => v.y);
            const currentCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const currentCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
            
            // Calculate new center
            const newCenterX = x - draggedElement.offsetX;
            const newCenterY = y - draggedElement.offsetY;
            
            // Calculate delta
            const dx = newCenterX - currentCenterX;
            const dy = newCenterY - currentCenterY;
            
            if (hasSegments) {
              // Move all segments
              const newSegments = wallElement.segments!.map(segment =>
                segment.map(v => ({
                  x: v.x + dx,
                  y: v.y + dy
                }))
              );
              updateElement(draggedElement.id, { segments: newSegments });
            } else {
              // Move all vertices
              const newVertices = wallElement.vertices!.map(v => ({
                x: v.x + dx,
                y: v.y + dy
              }));
              updateElement(draggedElement.id, { vertices: newVertices });
            }
          }
        } else if ('x' in element && 'y' in element) {
          updateElement(draggedElement.id, {
            x: x - draggedElement.offsetX,
            y: y - draggedElement.offsetY
          });
        }
      }
    }
  };

  const handleMouseUp = async () => {
    // X-Lab: Finalize terrain shape fill (rectangle, circle, polygon)
    if (xlabTerrainShapeStart && xlabTerrainShapeEnd && xlabShapeMode && selectedBackgroundTexture) {
      const minX = Math.min(xlabTerrainShapeStart.x, xlabTerrainShapeEnd.x);
      const maxX = Math.max(xlabTerrainShapeStart.x, xlabTerrainShapeEnd.x);
      const minY = Math.min(xlabTerrainShapeStart.y, xlabTerrainShapeEnd.y);
      const maxY = Math.max(xlabTerrainShapeStart.y, xlabTerrainShapeEnd.y);
      const width = maxX - minX;
      const height = maxY - minY;
      
      // Only fill if shape has minimum size
      if (width >= 20 && height >= 20) {
        console.log(`[XLAB SHAPE] Filling ${xlabShapeMode} with terrain brush`);
        
        // Mark that we're filling a shape (prevents race condition with scene activation)
        isFillingShapeRef.current = true;
        
        // Ensure brush image is loaded before stamping
        const ensureBrushLoaded = (): Promise<void> => {
          return new Promise((resolve) => {
            // Check if we have the correct image already loaded
            if (brushImageRef.current?.src === selectedBackgroundTexture && brushImageRef.current?.complete) {
              console.log('[XLAB SHAPE] Brush already loaded');
              resolve();
              return;
            }
            
            console.log('[XLAB SHAPE] Loading brush image...');
            const img = new Image();
            img.src = selectedBackgroundTexture;
            img.onload = () => {
              console.log('[XLAB SHAPE] Brush image loaded successfully');
              brushImageRef.current = img;
              resolve();
            };
            img.onerror = () => {
              console.error('[XLAB SHAPE] Failed to load brush image:', selectedBackgroundTexture);
              resolve(); // Resolve anyway to prevent hanging
            };
          });
        };
        
        await ensureBrushLoaded();
        
        const spacing = backgroundBrushSize * 0.5; // 50% overlap for smooth fill
        
        if (xlabShapeMode === 'rectangle') {
          // Fill rectangle with overlapping brush stamps
          for (let y = minY; y <= maxY; y += spacing) {
            for (let x = minX; x <= maxX; x += spacing) {
              stampBrush(x, y, true);
            }
          }
        } else if (xlabShapeMode === 'circle') {
          // Fill circle with radial pattern (concentric circles) for smooth organic look
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const radiusX = width / 2;
          const radiusY = height / 2;
          const maxRadius = Math.max(radiusX, radiusY);
          
          // Start from center
          stampBrush(centerX, centerY, true);
          
          // Fill in concentric elliptical rings
          for (let r = spacing; r <= maxRadius; r += spacing) {
            // Calculate how many stamps we need around this ring based on circumference
            const circumference = 2 * Math.PI * r;
            const numStamps = Math.max(8, Math.ceil(circumference / spacing));
            
            for (let i = 0; i < numStamps; i++) {
              const angle = (i / numStamps) * 2 * Math.PI;
              const x = centerX + Math.cos(angle) * (r / maxRadius) * radiusX;
              const y = centerY + Math.sin(angle) * (r / maxRadius) * radiusY;
              
              // Only stamp if within the ellipse bounds
              const dx = (x - centerX) / radiusX;
              const dy = (y - centerY) / radiusY;
              if (dx * dx + dy * dy <= 1) {
                stampBrush(x, y, true);
              }
            }
          }
        } else if (xlabShapeMode === 'polygon') {
          // TODO: Implement polygon shape - for now treat as rectangle
          for (let y = minY; y <= maxY; y += spacing) {
            for (let x = minX; x <= maxX; x += spacing) {
              stampBrush(x, y, true);
            }
          }
        }
        
        // Use setTimeout to ensure state updates have completed before saving history
        setTimeout(() => {
          const tilesObject: { [key: string]: TerrainTile } = {};
          setTerrainTiles(currentTiles => {
            currentTiles.forEach((tile, key) => {
              tilesObject[key] = tile;
            });
            saveToHistory(tilesObject);
            
            // Mark shape fill as complete
            isFillingShapeRef.current = false;
            
            return currentTiles; // Return unchanged to avoid re-render
          });
        }, 0);
      }
      
      setXlabTerrainShapeStart(null);
      setXlabTerrainShapeEnd(null);
      return; // Exit early to prevent double history save
    }

    // Door Tool: DISABLED

    // Finalize wall cutter tool rectangle
    if (wallCutterToolStart && wallCutterToolEnd) {
      applyWallCutterRectangle();
      setWallCutterToolStart(null);
      setWallCutterToolEnd(null);
      saveToHistory();
    }

    // Wall Cutter freehand and Door Tool: DISABLED

    // Save to history if we were dragging or resizing
    if (draggedElement || resizingElement || draggedMultiple || rotatingElement || scalingElement || movingVertex) {
      saveToHistory();
    }

    // Stop background painting
    if (isPaintingBackground) {
      setIsPaintingBackground(false);
      setLastBrushStamp(null);
      setBrushAnchorPoint(null);
      
      // Use setTimeout to ensure state updates have completed before saving history
      setTimeout(() => {
        const tilesObject: { [key: string]: TerrainTile } = {};
        setTerrainTiles(currentTiles => {
          currentTiles.forEach((tile, key) => {
            tilesObject[key] = tile;
          });
          saveToHistory(tilesObject);
          return currentTiles; // Return unchanged to avoid re-render
        });
      }, 0);
    }

    // Stop erasing
    if (isErasing) {
      saveToHistory();
      setIsErasing(false);
    }

    setIsPanning(false);
    setDraggedElement(null);
    setResizingElement(null);
    setDraggedMultiple(null);
    setRotatingElement(null);
    setScalingElement(null);
    setMovingVertex(null);

    // Finalize selection box
    if (selectionBox && scene) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const selected = scene.elements.filter(element => {
        if (element.type === 'room' && element.vertices) {
          const xs = element.vertices.map(v => v.x);
          const ys = element.vertices.map(v => v.y);
          const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
          return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
        } else if (element.type === 'wall' && element.vertices) {
          const xs = element.vertices.map(v => v.x);
          const ys = element.vertices.map(v => v.y);
          const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
          return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
        } else if ('x' in element && 'y' in element) {
          return element.x >= minX && element.x <= maxX && element.y >= minY && element.y <= maxY;
        }
        return false;
      }).map(e => e.id);

      setSelectedElementIds(selected);
      setSelectedElementId(null);
      setSelectionBox(null);
      return;
    }

    // Finalize element creation
    if (isCreating && tempElement && tempElement.id === 'temp') {
      const finalElement = { ...tempElement, id: `${tempElement.type}-${Date.now()}` };
      
      // Save history immediately BEFORE adding - but with the new element included
      if (scene) {
        const elementWithZIndex = {
          ...finalElement,
          zIndex: finalElement.type === 'room' ? -100 : (finalElement.zIndex ?? 0)
        };
        const newElements = [...scene.elements, elementWithZIndex];
        const newHistoryEntry = {
          elements: newElements,
          terrainTiles: (() => {
            const tilesObj: { [key: string]: TerrainTile } = {};
            terrainTiles.forEach((tile, key) => {
              tilesObj[key] = tile;
            });
            return tilesObj;
          })()
        };
        setHistory(prev => [...prev.slice(0, historyIndex + 1), newHistoryEntry]);
        setHistoryIndex(prev => prev + 1);
      }
      
      addElement(finalElement);
      setSelectedElementId(finalElement.id);
      setSelectedElementIds([]);
      // No viewport centering when placing tokens
    }

    // Finalize room creation
    if (roomDrawStart && tempRoom && tempRoom.id === 'temp') {
      console.log('[MOUSE UP] Finalizing room creation');
      console.log('[MOUSE UP] roomDrawStart:', roomDrawStart);
      console.log('[MOUSE UP] tempRoom:', tempRoom);
      
      // Calculate room dimensions from vertices
      const xs = tempRoom.vertices.map(v => v.x);
      const ys = tempRoom.vertices.map(v => v.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      
      console.log('[MOUSE UP] Calculated dimensions:', { width, height });
      
      // Only create room if it has some size (at least 20x20)
      if (width >= 20 && height >= 20) {
        console.log('[MOUSE UP] Size OK, processing room');
        
        // Check if this is subtract mode
        if (isSubtractMode(roomSubTool) && scene) {
          // Find all rooms that contain or overlap with the subtract rectangle
          const subtractVertices = tempRoom.vertices;
          const roomsToSubtract = scene.elements.filter(el => {
            if (el.type !== 'room' || !el.vertices) return false;
            
            // Check if ANY vertex of the subtract rectangle is inside the room
            const hasVertexInside = subtractVertices.some(v => pointInPolygon(v, el.vertices!));
            
            // Also check if ANY vertex of the room is inside the subtract rectangle
            const hasRoomVertexInside = el.vertices.some(v => pointInPolygon(v, subtractVertices));
            
            // If either condition is true, there's overlap/containment
            return hasVertexInside || hasRoomVertexInside;
          });
          
          if (roomsToSubtract.length > 0) {
            saveToHistory();
            // Use polygon-clipping to subtract the area
            const polygonClipping = await import('polygon-clipping');
            
            const roomsToDelete = new Set<string>();
            const newRooms: RoomElement[] = [];
            
            roomsToSubtract.forEach(room => {
              if (room.type !== 'room' || !room.vertices) return;
              
              try {
                // Convert vertices to polygon-clipping format
                // Include existing holes if any
                const roomPoly = [
                  room.vertices.map(v => [v.x, v.y]),
                  ...(room.holes || []).map(hole => hole.map(v => [v.x, v.y]))
                ];
                const subtractPoly = [subtractVertices.map(v => [v.x, v.y])];
                
                // Perform difference operation
                const result = polygonClipping.default.difference(roomPoly as any, subtractPoly as any);
                
                console.log('[SUBTRACT] Result polygons:', result.length);
                
                if (result.length > 0) {
                  // Mark original room for deletion
                  roomsToDelete.add(room.id);
                  
                  // Process each resulting polygon
                  result.forEach((polygon, polyIdx) => {
                    console.log('[SUBTRACT] Polygon', polyIdx, 'has', polygon.length, 'rings');
                    
                    if (polygon.length >= 1) {
                      // Outer ring + optional holes
                      const outerRing = polygon[0].map(([x, y]) => ({ x, y }));
                      const holes = polygon.slice(1).map(ring => 
                        ring.map(([x, y]) => ({ x, y }))
                      );
                      
                      if (outerRing.length >= 3) {
                        const newRoom: RoomElement = {
                          ...room,
                          id: polyIdx === 0 ? room.id : `room-${Date.now()}-${polyIdx}`,
                          name: polyIdx === 0 ? room.name : generateUniqueName(room.name || 'Room'),
                          vertices: outerRing,
                          holes: holes.length > 0 ? holes : undefined
                        };
                        newRooms.push(newRoom);
                      }
                    }
                  });
                }
              } catch (error) {
                console.error('Subtract operation failed:', error);
              }
            });
            
            // Update scene: remove old rooms and add new ones
            if (activeSceneId && (roomsToDelete.size > 0 || newRooms.length > 0)) {
              const updatedElements = scene.elements.filter(el => !roomsToDelete.has(el.id));
              updatedElements.push(...newRooms);
              updateScene(activeSceneId, { elements: updatedElements });
            }
          }
        } else {
          // Normal room creation
          const finalRoom = { ...tempRoom, id: `room-${Date.now()}`, tileSize, showWalls, wallTextureUrl: selectedWallTexture || '', wallThickness };
          
          // Save history AFTER adding element
          if (scene) {
            const newElements = [...scene.elements, finalRoom];
            const newHistoryEntry = {
              elements: newElements,
              terrainTiles: (() => {
                const tilesObj: { [key: string]: TerrainTile } = {};
                terrainTiles.forEach((tile, key) => {
                  tilesObj[key] = tile;
                });
                return tilesObj;
              })()
            };
            setHistory(prev => [...prev.slice(0, historyIndex + 1), newHistoryEntry]);
            setHistoryIndex(prev => prev + 1);
          }
          
          addElement(finalRoom);
          setSelectedElementId(finalRoom.id);
          setSelectedElementIds([]);
        }
      } else {
        console.log('[MOUSE UP] Room too small, not creating');
      }
      setRoomDrawStart(null);
      setTempRoom(null);
      return;
    }

    // Finalize wall line creation
    if (wallLineStart && wallLinePreview && activeTool === 'wall-line') {
      console.log('[WALL LINE] Completing wall line');
      
      // Calculate distance to ensure we have a valid line
      const dx = wallLinePreview.x - wallLineStart.x;
      const dy = wallLinePreview.y - wallLineStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only create wall if it's long enough (at least 10 pixels)
      if (distance >= 10) {
        const newWall: WallElement = {
          id: `wall-${Date.now()}`,
          type: 'wall',
          vertices: [wallLineStart, wallLinePreview],
          wallTextureUrl: selectedWallTexture || '',
          wallThickness: wallThickness,
          wallTileSize: wallTileSize,
          name: generateWallName(selectedWallTexture || ''),
          notes: '',
          zIndex: -50,
          visible: true,
          widgets: []
        };
        
        // Save history AFTER adding wall
        if (scene) {
          const newElements = [...scene.elements, newWall];
          const newHistoryEntry = {
            elements: newElements,
            terrainTiles: (() => {
              const tilesObj: { [key: string]: TerrainTile } = {};
              terrainTiles.forEach((tile, key) => {
                tilesObj[key] = tile;
              });
              return tilesObj;
            })()
          };
          setHistory(prev => [...prev.slice(0, historyIndex + 1), newHistoryEntry]);
          setHistoryIndex(prev => prev + 1);
        }
        
        addElement(newWall);
        setSelectedElementId(newWall.id);
        setSelectedElementIds([]);
        console.log('[WALL LINE] Created wall:', newWall);
      }
      
      setWallLineStart(null);
      setWallLinePreview(null);
      return;
    }

    setIsCreating(false);
    setCreateStart(null);
    setTempElement(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Check if shift is pressed and token tool is active
    if (e.shiftKey && activeTool === 'token' && tokenTemplates.length > 0) {
      e.preventDefault();
      
      // Show token submenu
      setShowTokenSubmenuForShift(true);
      
      // Clear existing timeout
      if (shiftScrollTimeoutRef.current) {
        clearTimeout(shiftScrollTimeoutRef.current);
      }
      
      // Cycle through tokens
      const currentIndex = activeTokenTemplate 
        ? tokenTemplates.findIndex((t: TokenTemplate) => t.id === activeTokenTemplate.id)
        : -1;
      
      let newIndex;
      if (e.deltaY < 0) {
        // Scroll up - previous token
        newIndex = currentIndex <= 0 ? tokenTemplates.length - 1 : currentIndex - 1;
      } else {
        // Scroll down - next token
        newIndex = (currentIndex + 1) % tokenTemplates.length;
      }
      
      onSelectToken(tokenTemplates[newIndex]);
      
      // Set timeout to hide submenu after shift is released
      shiftScrollTimeoutRef.current = window.setTimeout(() => {
        if (!isShiftPressed) {
          setShowTokenSubmenuForShift(false);
        }
      }, 500);
      
      return;
    }
    
    // Otherwise, handle zoom as before
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const isCanvas = mapDimensions.width === 0 && mapDimensions.height === 0;
    
    // For regular maps, need valid dimensions
    if (!isCanvas && !mapDimensions.width) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(prev => {
      // For canvas, no fit to view restrictions
      if (isCanvas) {
        const desiredZoom = prev.zoom * delta;
        const newZoom = Math.max(0.1, Math.min(5, desiredZoom));
        const worldX = (mouseX - prev.x) / prev.zoom;
        const worldY = (mouseY - prev.y) / prev.zoom;
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;
        return {
          ...prev,
          zoom: newZoom,
          x: newX,
          y: newY
        };
      }
      
      // For maps with fit to view
      const availableWidth = leftPanelOpen ? rect.width - 450 : rect.width;
      const visualWidth = shouldRotateMap ? mapDimensions.height : mapDimensions.width;
      const minZoomForFit = availableWidth / visualWidth;
      const minZoom = fitToViewLocked ? minZoomForFit : 0.1;
      const desiredZoom = prev.zoom * delta;
      const newZoom = Math.max(minZoom, Math.min(5, desiredZoom));
      if (fitToViewLocked && e.deltaY > 0 && desiredZoom < minZoomForFit) {
        setZoomLimitError(true);
        setTimeout(() => setZoomLimitError(false), 2000);
      }
      const worldX = (mouseX - prev.x) / prev.zoom;
      const worldY = (mouseY - prev.y) / prev.zoom;
      const newX = mouseX - worldX * newZoom;
      const newY = mouseY - worldY * newZoom;
      return {
        ...prev,
        zoom: newZoom,
        x: newX,
        y: newY
      };
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const findElementAtPosition = (x: number, y: number, elements: MapElement[]): MapElement | null => {
    // Sort elements by z-index (highest first) to check top elements first
    const sortedElements = [...elements].sort((a, b) => {
      const aZ = (a as any).zIndex || 0;
      const bZ = (b as any).zIndex || 0;
      return bZ - aZ; // Descending order (highest z-index first)
    });

    for (let i = 0; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      
      // Handle room elements (polygon-based) - for selection only
      if (element.type === 'room') {
        const room = element as RoomElement;
        if (room.vertices && pointInPolygon({ x, y }, room.vertices)) {
          return element;
        }
      } else if (element.type === 'wall') {
        // Handle wall elements - check if clicking near the wall line(s)
        const wall = element as WallElement;
        const threshold = (wall.wallThickness / 2) + 5; // Add 5px margin for easier selection
        
        // Get segments (either from segments array or single vertices array)
        const segments = wall.segments && wall.segments.length > 0 
          ? wall.segments 
          : (wall.vertices && wall.vertices.length >= 2 ? [wall.vertices] : []);
        
        // Check each segment
        for (const segment of segments) {
          if (segment.length < 2) continue;
          
          // Check each line segment within this segment
          for (let j = 0; j < segment.length - 1; j++) {
            const v1 = segment[j];
            const v2 = segment[j + 1];
            
            // Calculate distance from point to line segment
            const dx = v2.x - v1.x;
            const dy = v2.y - v1.y;
            const lengthSquared = dx * dx + dy * dy;
            
            if (lengthSquared === 0) continue; // Zero-length segment
            
            // Calculate projection of point onto line
            const t = Math.max(0, Math.min(1, ((x - v1.x) * dx + (y - v1.y) * dy) / lengthSquared));
            const projX = v1.x + t * dx;
            const projY = v1.y + t * dy;
            
            // Calculate distance from point to projection
            const distX = x - projX;
            const distY = y - projY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            
            if (distance <= threshold) {
              return element;
            }
          }
        }
      } else if ('x' in element && 'y' in element && 'size' in element) {
        // Handle circular elements (annotations and tokens)
        const distance = Math.sqrt((x - element.x) ** 2 + (y - element.y) ** 2);
        if (distance <= element.size / 2) {
          return element;
        }
      }
    }
    return null;
  };

  const getResizeHandleAtPosition = (x: number, y: number, elementId: string, elements: MapElement[]): string | null => {
    const element = elements.find(e => e.id === elementId);
    if (!element) return null;

    const handleSize = 8 / viewport.zoom;

    // Skip room elements - they use their own scaling/rotation system
    if (element.type === 'room') {
      return null;
    }

    // Handle circular elements (annotations and tokens)
    if (!('x' in element && 'y' in element && 'size' in element)) {
      return null;
    }
    
    const radius = element.size / 2;

    const handles = [
      { name: 'nw', x: element.x - radius, y: element.y - radius },
      { name: 'ne', x: element.x + radius, y: element.y - radius },
      { name: 'sw', x: element.x - radius, y: element.y + radius },
      { name: 'se', x: element.x + radius, y: element.y + radius }
    ];

    for (const handle of handles) {
      const distance = Math.sqrt((x - handle.x) ** 2 + (y - handle.y) ** 2);
      if (distance <= handleSize) {
        return handle.name;
      }
    }

    return null;
  };

  // Determine cursor based on state
  const getCursor = () => {
    if (rotatingElement) return 'cursor-rotating';
    if (scalingElement) return 'cursor-nwse-resize';
    if (movingVertex) return 'cursor-grab'; // Show grab hand when moving vertex
    
    // Hovering over edge with Ctrl/Shift = grab hand (will add and immediately drag)
    if (hoveringEdge && (isCtrlPressed || isShiftPressed)) return 'cursor-grab';
    
    // Hovering over vertex with Ctrl/Shift = grab hand (can drag vertex)
    if (hoveringVertex && (isCtrlPressed || isShiftPressed)) return 'cursor-grab';
    
    // Hovering over vertex without Ctrl/Shift = scale cursor (direction based on position)
    if (hoveringVertex && !isCtrlPressed && !isShiftPressed) {
      return hoveringVertex.cursorDirection === 'nesw-resize' ? 'cursor-nesw-resize' : 'cursor-nwse-resize';
    }
    
    // Hovering over rotation handle = rotate cursor
    if (isHoveringRotateHandle) return 'cursor-rotate';
    
    if (isPanning || isSpacePressed || activeTool === 'pan') return 'cursor-grab';
    if (activeTool === 'marker') return 'cursor-copy';
    if (activeTool === 'token' && scene) return 'cursor-none'; // Hide default cursor for token mode only when scene exists
    if (activeTool === 'background') return 'cursor-crosshair'; // Crosshair for painting background
    if (activeTool === 'room') {
      // Show cell cursor (precision cursor) when in erase mode
      if (roomSubTool === 'erase') return 'cursor-cell';
      // Show custom cursor with minus for subtract mode (like Photoshop)
      if (isSubtractMode(roomSubTool)) {
        return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M12 2v20M2 12h20' stroke='white' stroke-width='2'/><path d='M12 2v20M2 12h20' stroke='black' stroke-width='1'/><circle cx='17' cy='7' r='6' fill='white' stroke='black' stroke-width='1.5'/><path d='M14 7h6' stroke='black' stroke-width='2' stroke-linecap='round'/></svg>") 12 12, crosshair`;
      }
      // Default crosshair for add mode
      return 'cursor-crosshair';
    }
    if (activeTool === 'zoom-in') {
      // Show zoom-out cursor when Alt is pressed
      return isAltPressed ? 'cursor-zoom-out' : 'cursor-zoom-in';
    }
    if (activeTool === 'zoom-out') return 'cursor-zoom-out';
    return 'cursor-default';
  };

  const getColorHex = (color: ColorType): string => {
    const colorMap: Record<ColorType, string> = {
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#22c55e',
      yellow: '#eab308',
      purple: '#a855f7',
      orange: '#f97316',
      pink: '#ec4899',
      brown: '#92400e',
      gray: '#6b7280',
      black: '#000000',
      white: '#ffffff',
      cyan: '#06b6d4',
      magenta: '#d946ef',
      lime: '#84cc16',
      indigo: '#6366f1',
      teal: '#14b8a6'
    };
    return colorMap[color];
  };

  const getLucideIcon = (icon: IconType) => {
    const iconMap: Record<IconType, any> = {
      circle: Circle,
      square: Square,
      triangle: Triangle,
      star: Star,
      diamond: Diamond,
      heart: Heart,
      skull: Skull,
      quest: MapPin,
      clue: Search,
      hidden: Eye,
      door: DoorOpen,
      landmark: Landmark,
      footprint: Footprints,
      info: Info
    };
    return iconMap[icon];
  };

  return (
    <div className="flex-1 relative bg-dm-dark overflow-hidden">
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={`w-full h-full relative ${getCursor()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        {/* ...no token submenu rendered... */}
        {scene && (() => {
          // Check if this is canvas mode (transparent background SVG)
          const isCanvas = scene.backgroundMapUrl.includes('fill="transparent"') ||
                          scene.backgroundMapUrl.includes('fill=%22transparent%22');
          
          if (isCanvas) {
            // INFINITE CANVAS MODE:
            // No static 50000×50000 grid - instead we use the dynamic grid overlay below
            // that adjusts its pattern offset based on viewport position and gridSize.
            // This ensures the grid center aligns with world (0,0) at all times.
            const canvasSize = 50000; // Large but not infinite
            
            return (
              <>
                {/* Layer 1: MAP - Hidden img for canvas to trigger load event */}
                <img
                  ref={imgRef}
                  src={scene.backgroundMapUrl}
                  alt="canvas"
                  draggable={false}
                  style={{ display: 'none', zIndex: Z_MAP }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: viewport.x - canvasSize / 2 * viewport.zoom,
                    top: viewport.y - canvasSize / 2 * viewport.zoom,
                    transform: `scale(${viewport.zoom})`,
                    transformOrigin: '0 0',
                    width: canvasSize,
                    height: canvasSize,
                    zIndex: Z_MAP
                  }}
                >
                {/* Layer 2: TERRAIN BRUSH - Tile-based terrain painting
                    In canvas-mode, world origin (0,0) is at canvasSize/2.
                    TerrainTile.x/y are in world coordinates, so we offset them
                    by canvasSize/2 to align with the Elements wrapper below.
                */}
                {(() => {
                  const tiles = Array.from(terrainTiles.entries());
                  
                  return tiles.map(([tileKey, tile]) => {
                    const visibleKeys = getVisibleTileKeys();
                    if (!visibleKeys.includes(tileKey)) return null;
                    
                    return (
                      <canvas
                        key={tileKey}
                        ref={el => {
                          if (el) {
                            tileCanvasRefs.current.set(tileKey, el);
                          } else {
                            tileCanvasRefs.current.delete(tileKey);
                          }
                        }}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        style={{
                          position: 'absolute',
                          // Offset by canvasSize/2 to align with world origin (0,0)
                          left: canvasSize / 2 + tile.x,
                          top: canvasSize / 2 + tile.y,
                          width: TILE_SIZE,
                          height: TILE_SIZE,
                          pointerEvents: 'none',
                          zIndex: Z_TERRAIN
                        }}
                      />
                    );
                  });
                })()}

                {/* Layer 3: FLOORS - Room floors (BELOW grid) - separate stacking context */}
                <div
                  style={{
                    position: 'absolute',
                    left: canvasSize / 2,
                    top: canvasSize / 2,
                    width: 0,
                    height: 0,
                    zIndex: Z_FLOOR
                  }}
                >
                  {/* Room floors rendered in separate layer below grid */}
                  {scene.elements
                    .filter(el => el.type === 'room')
                    .sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
                    .map(element => (
                      <MapElementComponent
                        key={`${element.id}-floor`}
                        element={element}
                        isSelected={false}
                        viewport={viewport}
                        showTokenBadges={showTokenBadges}
                        renderLayer="floor"
                      />
                    ))}
                </div>

                {/* Layer 4: GRID - Infinite scrolling grid overlay */}
                {showGrid && (() => {
                  // Helper: modulo that handles negative values correctly
                  const mod = (n: number, m: number) => ((n % m) + m) % m;
                  
                  // Grid lives in WORLD SPACE (inside transform: scale(viewport.zoom) container)
                  // So we use gridSize directly, NO zoom multiplication here
                  // World origin is at canvasSize/2, we want cell center at (0,0)
                  const worldOriginX = canvasSize / 2;
                  const worldOriginY = canvasSize / 2;
                  
                  // Pattern offset to align cell center with world origin
                  // We want the grid to be centered at world (0,0), which is canvas center
                  const patternOffsetX = mod(worldOriginX - gridSize / 2, gridSize);
                  const patternOffsetY = mod(worldOriginY - gridSize / 2, gridSize);
                  
                  return (
                    <svg
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        opacity: 0.3,
                        zIndex: Z_GRID
                      }}
                    >
                      <defs>
                        <pattern
                          id="canvas-grid-pattern"
                          x={patternOffsetX}
                          y={patternOffsetY}
                          width={gridSize}
                          height={gridSize}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                            fill="none"
                            stroke="rgba(255, 128, 0, 1)"
                            strokeWidth="2"
                          />
                        </pattern>
                      </defs>
                      <rect
                        x={0}
                        y={0}
                        width="100%"
                        height="100%"
                        fill="url(#canvas-grid-pattern)"
                      />
                    </svg>
                  );
                })()}

                {/* Layer 5: WALLS & SELECTION - Room walls, selection, labels (ABOVE grid) */}
                <div
                  style={{
                    position: 'absolute',
                    left: canvasSize / 2,
                    top: canvasSize / 2,
                    width: 0,
                    height: 0,
                    zIndex: Z_WALL
                  }}
                >
                  {/* Room walls, selection, and labels rendered above grid */}
                  {scene.elements
                    .filter(el => el.type === 'room')
                    .sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
                    .map(element => (
                      <MapElementComponent
                        key={`${element.id}-walls`}
                        element={element}
                        isSelected={selectedElementId === element.id || selectedElementIds.includes(element.id)}
                        viewport={viewport}
                        showTokenBadges={showTokenBadges}
                        renderLayer="walls"
                      />
                    ))}
                </div>

                {/* Layer 6: TOKENS & OTHER ELEMENTS - Tokens, annotations, etc. */}
                <div
                  style={{
                    position: 'absolute',
                    left: canvasSize / 2,
                    top: canvasSize / 2,
                    width: 0,
                    height: 0,
                    zIndex: Z_TOKENS
                  }}
                >
                  {/* Other elements (wall elements, tokens, annotations, etc.) */}
                  {scene.elements
                    .filter(el => el.type !== 'room')
                    .sort((a, b) => {
                      const getLayerOffset = (el: MapElement) => {
                        if (el.type === 'wall') return 0;
                        return 0; // All at same level within this layer
                      };
                      const aLayer = getLayerOffset(a);
                      const bLayer = getLayerOffset(b);
                      if (aLayer !== bLayer) return aLayer - bLayer;
                      return ((a as any).zIndex || 0) - ((b as any).zIndex || 0);
                    })
                    .map(element => (
                      <MapElementComponent
                        key={element.id}
                        element={element}
                        isSelected={selectedElementId === element.id || selectedElementIds.includes(element.id)}
                        viewport={viewport}
                        showTokenBadges={showTokenBadges}
                      />
                    ))}

                  {/* Temp element during creation */}
                  {tempElement && tempElement.id === 'temp' && (
                    <MapElementComponent
                      element={tempElement}
                      isSelected={false}
                      viewport={viewport}
                      showTokenBadges={showTokenBadges}
                      renderLayer="full"
                    />
                  )}
                </div>
              </div>
              </>
            );
          }
          
          // Regular map with fixed dimensions
          // Visual stacking order (back → front):
          // 1: Map | 2: Terrain brush | 3: Floor tiles | 4: Grid | 5: Wall textures | 6: Tokens
          return (
          <>
          <div
            style={{
              position: 'absolute',
              left: viewport.x,
              top: viewport.y,
              transform: `scale(${viewport.zoom})`,
              transformOrigin: '0 0',
              width: (shouldRotateMap ? mapDimensions.height : mapDimensions.width) + mapDimensions.padding * 2,
              height: (shouldRotateMap ? mapDimensions.width : mapDimensions.height) + mapDimensions.padding * 2
            }}
          >
            {/* Layer 1: MAP - Background Map Image */}
            {!scene.backgroundMapUrl.includes('fill=%22transparent%22') && !scene.backgroundMapUrl.includes('fill="transparent"') && (
              <img
                ref={imgRef}
                src={scene.backgroundMapUrl}
                alt={scene.name}
                draggable={false}
                className={shouldRotateMap ? 'rotate-90' : ''}
                style={{ 
                  userSelect: 'none', 
                  pointerEvents: 'none',
                  position: 'absolute',
                  left: shouldRotateMap ? mapDimensions.padding + (mapDimensions.height - mapDimensions.width) / 2 : mapDimensions.padding,
                  top: shouldRotateMap ? mapDimensions.padding + (mapDimensions.width - mapDimensions.height) / 2 : mapDimensions.padding,
                  width: mapDimensions.width,
                  height: mapDimensions.height,
                  zIndex: Z_MAP
                }}
              />
            )}

            {/* Layer 2: TERRAIN BRUSH - Tile-based terrain painting */}
            {Array.from(terrainTiles.entries()).map(([tileKey, tile]) => {
              const visibleKeys = getVisibleTileKeys();
              if (!visibleKeys.includes(tileKey)) return null;
              
              return (
                <canvas
                  key={tileKey}
                  ref={el => {
                    if (el) {
                      tileCanvasRefs.current.set(tileKey, el);
                    } else {
                      tileCanvasRefs.current.delete(tileKey);
                    }
                  }}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  style={{
                    position: 'absolute',
                    left: tile.x,
                    top: tile.y,
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    pointerEvents: 'none',
                    zIndex: Z_TERRAIN
                  }}
                />
              );
            })}

            {/* Layer 3: FLOORS - Room floors (BELOW grid) */}
            <div style={{ position: 'relative', zIndex: Z_FLOOR }}>
              {/* Room floors rendered in separate layer below grid */}
              {scene.elements
                .filter(el => el.type === 'room')
                .sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
                .map(element => (
                  <MapElementComponent
                    key={`${element.id}-floor`}
                    element={element}
                    isSelected={false}
                    viewport={viewport}
                    showTokenBadges={showTokenBadges}
                    renderLayer="floor"
                  />
                ))}
            </div>
            
            {/* Layer 5: WALLS & SELECTION - Room walls, selection, labels (ABOVE grid) */}
            <div style={{ position: 'relative', zIndex: Z_WALL }}>
              {/* Room walls, selection, and labels rendered above grid */}
              {scene.elements
                .filter(el => el.type === 'room')
                .sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
                .map(element => (
                  <MapElementComponent
                    key={`${element.id}-walls`}
                    element={element}
                    isSelected={selectedElementId === element.id || selectedElementIds.includes(element.id)}
                    viewport={viewport}
                    showTokenBadges={showTokenBadges}
                    renderLayer="walls"
                  />
                ))}
            </div>
            
            {/* Layer 6: TOKENS & OTHER ELEMENTS */}
            <div style={{ position: 'relative', zIndex: Z_TOKENS }}>
              {/* Other elements (wall elements, tokens, annotations, etc.) */}
              {scene.elements
                .filter(el => el.type !== 'room')
                .sort((a, b) => {
                  const getLayerOffset = (el: MapElement) => {
                    if (el.type === 'wall') return 0;
                    return 0; // All at same level within this layer
                  };
                  const aLayer = getLayerOffset(a);
                  const bLayer = getLayerOffset(b);
                  if (aLayer !== bLayer) return aLayer - bLayer;
                  return ((a as any).zIndex || 0) - ((b as any).zIndex || 0);
                })
                .map(element => (
                  <MapElementComponent
                    key={element.id}
                    element={element}
                    isSelected={selectedElementId === element.id || selectedElementIds.includes(element.id)}
                    viewport={viewport}
                    showTokenBadges={showTokenBadges}
                  />
                ))}

              {/* Temp element during creation */}
              {tempElement && tempElement.id === 'temp' && (
                <MapElementComponent
                  element={tempElement}
                  isSelected={false}
                  viewport={viewport}
                  showTokenBadges={showTokenBadges}
                  renderLayer="full"
                />
              )}
            </div>
          </div>

          {/* Layer 4: GRID - Infinite scrolling grid overlay (OUTSIDE transformed container) */}
          {showGrid && (() => {
            // Helper: modulo that handles negative values correctly
            const mod = (n: number, m: number) => ((n % m) + m) % m;
            
            // Grid is OUTSIDE the transform: scale(viewport.zoom) container
            // So it's in SCREEN SPACE, must convert world coords to screen coords
            // Screen coord = viewport.x/y + world_coord * viewport.zoom
            
            // Grid size in screen pixels (world size scaled by zoom)
            const scaledGridSize = gridSize * viewport.zoom;
            
            // Pattern offset: we want cell center at world (0,0)
            // World (0,0) maps to screen (viewport.x + 0 * zoom, viewport.y + 0 * zoom) = (viewport.x, viewport.y)
            // We want that point to be at center of a cell, so offset by -gridSize/2 in world coords
            // In screen space: viewport.x/y + (-gridSize/2) * viewport.zoom
            const patternOffsetX = mod(viewport.x - (gridSize / 2) * viewport.zoom, scaledGridSize);
            const patternOffsetY = mod(viewport.y - (gridSize / 2) * viewport.zoom, scaledGridSize);
            
            console.log('[🟠 MAP GRID RENDERING]', {
              mode: 'REGULAR MAP (SCREEN SPACE)',
              viewport,
              gridSize,
              scaledGridSize,
              patternOffset: { x: patternOffsetX, y: patternOffsetY },
              note: 'Grid outside transform - world(0,0) at screen(' + viewport.x + ',' + viewport.y + ')'
            });
            
            return (
              <svg
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  opacity: 0.3,
                  zIndex: Z_GRID
                }}
              >
                <defs>
                  <pattern
                    id="map-grid-pattern"
                    x={patternOffsetX}
                    y={patternOffsetY}
                    width={scaledGridSize}
                    height={scaledGridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${scaledGridSize} 0 L 0 0 0 ${scaledGridSize}`}
                      fill="none"
                      stroke="rgba(255, 128, 0, 1)"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>
                <rect
                  x={0}
                  y={0}
                  width="100%"
                  height="100%"
                  fill="url(#map-grid-pattern)"
                />
              </svg>
            );
          })()}
          </>
          );
        })()}

        {/* Temp room preview during drawing - works for both canvas and maps */}
        {scene && (() => {
              if (!tempRoom || tempRoom.id !== 'temp' || !tempRoom.vertices || tempRoom.vertices.length < 3) {
                return null;
              }
              
              const xs = tempRoom.vertices.map(v => v.x);
              const ys = tempRoom.vertices.map(v => v.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);
              const width = maxX - minX;
              const height = maxY - minY;
              
              // Don't render if too small (prevents 0-width SVG issues)
              if (width < 1 || height < 1) {
                return null;
              }
              
              // Convert vertices to relative coordinates (relative to minX, minY)
              const relativeVertices = tempRoom.vertices.map(v => ({
                x: v.x - minX,
                y: v.y - minY
              }));
              
              const polygonPath = relativeVertices.map((v, i) => 
                `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
              ).join(' ') + ' Z';
              
              // Calculate positioning - same for both canvas and maps
              const leftPos = viewport.x + minX * viewport.zoom;
              const topPos = viewport.y + minY * viewport.zoom;
              
              return (
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  style={{
                    position: 'absolute',
                    left: leftPos,
                    top: topPos,
                    width: width * viewport.zoom,
                    height: height * viewport.zoom,
                    opacity: 0.7,
                    pointerEvents: 'none',
                    overflow: 'visible'
                  }}
                >
                  <defs>
                    {tempRoom.floorTextureUrl !== 'transparent' && (
                      <pattern
                        id="temp-floor-pattern"
                        x="0"
                        y="0"
                        width={tempRoom.tileSize}
                        height={tempRoom.tileSize}
                        patternUnits="userSpaceOnUse"
                      >
                        <image
                          href={tempRoom.floorTextureUrl}
                          x="0"
                          y="0"
                          width={tempRoom.tileSize}
                          height={tempRoom.tileSize}
                        />
                      </pattern>
                    )}
                    {tempRoom.showWalls && tempRoom.wallTextureUrl && tempRoom.wallTextureUrl !== 'transparent' && (
                      <pattern
                        id="temp-wall-pattern"
                        x="0"
                        y="0"
                        width={tempRoom.wallTileSize}
                        height={tempRoom.wallTileSize}
                        patternUnits="userSpaceOnUse"
                      >
                        <image
                          href={tempRoom.wallTextureUrl}
                          x="0"
                          y="0"
                          width={tempRoom.wallTileSize}
                          height={tempRoom.wallTileSize}
                        />
                      </pattern>
                    )}
                  </defs>
                  
                  {/* Floor */}
                  <path
                    d={polygonPath}
                    fill={tempRoom.floorTextureUrl === 'transparent' ? 'none' : 'url(#temp-floor-pattern)'}
                    stroke={isSubtractMode(roomSubTool) ? '#ef4444' : 'none'}
                    strokeWidth={isSubtractMode(roomSubTool) ? 2 : 0}
                    strokeDasharray={isSubtractMode(roomSubTool) ? '5,5' : 'none'}
                  />
                  
                  {/* Walls - as stroke on the polygon edge */}
                  {tempRoom.showWalls && (
                    <path
                      d={polygonPath}
                      fill="none"
                      stroke={tempRoom.wallTextureUrl ? "url(#temp-wall-pattern)" : "rgba(100, 100, 100, 0.8)"}
                      strokeWidth={tempRoom.wallThickness}
                      strokeLinejoin="miter"
                      strokeLinecap="square"
                    />
                  )}
                  
                  {/* Preview border - outside walls if they exist */}
                  {tempRoom.showWalls && tempRoom.wallThickness > 0 ? (
                    <>
                      {/* Invisible larger stroke to create offset */}
                      <path
                        d={polygonPath}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={tempRoom.wallThickness}
                        strokeLinejoin="miter"
                        strokeLinecap="square"
                      />
                      {/* Actual preview line on top */}
                      <path
                        d={polygonPath}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        strokeLinejoin="miter"
                        strokeLinecap="square"
                        style={{
                          transform: `scale(${1 + tempRoom.wallThickness / Math.max(maxX - minX, maxY - minY)})`,
                          transformOrigin: `${(maxX - minX) / 2}px ${(maxY - minY) / 2}px`
                        }}
                      />
                    </>
                  ) : (
                    <path
                      d={polygonPath}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  )}
                </svg>
              );
            })()}

        {/* Terrain shape preview (rectangle, circle, polygon) - works on both scenes and maps */}
        {xlabTerrainShapeStart && xlabTerrainShapeEnd && xlabShapeMode && (selectedBackgroundTexture || selectedTerrainBrush) && (() => {
              const minX = Math.min(xlabTerrainShapeStart.x, xlabTerrainShapeEnd.x);
              const maxX = Math.max(xlabTerrainShapeStart.x, xlabTerrainShapeEnd.x);
              const minY = Math.min(xlabTerrainShapeStart.y, xlabTerrainShapeEnd.y);
              const maxY = Math.max(xlabTerrainShapeStart.y, xlabTerrainShapeEnd.y);
              const width = maxX - minX;
              const height = maxY - minY;
              
              // Don't render if too small
              if (width < 1 || height < 1) {
                return null;
              }
              
              // Generate brush stamp positions with 50% overlap (same as actual fill)
              const spacing = backgroundBrushSize * 0.5;
              const stampPositions: { x: number; y: number }[] = [];
              
              if (xlabShapeMode === 'rectangle') {
                for (let y = minY; y <= maxY; y += spacing) {
                  for (let x = minX; x <= maxX; x += spacing) {
                    stampPositions.push({ x, y });
                  }
                }
              } else if (xlabShapeMode === 'circle') {
                // Use radial pattern (concentric circles) for smooth organic look
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const radiusX = width / 2;
                const radiusY = height / 2;
                const maxRadius = Math.max(radiusX, radiusY);
                
                // Center stamp
                stampPositions.push({ x: centerX, y: centerY });
                
                // Concentric elliptical rings
                for (let r = spacing; r <= maxRadius; r += spacing) {
                  const circumference = 2 * Math.PI * r;
                  const numStamps = Math.max(8, Math.ceil(circumference / spacing));
                  
                  for (let i = 0; i < numStamps; i++) {
                    const angle = (i / numStamps) * 2 * Math.PI;
                    const x = centerX + Math.cos(angle) * (r / maxRadius) * radiusX;
                    const y = centerY + Math.sin(angle) * (r / maxRadius) * radiusY;
                    
                    const dx = (x - centerX) / radiusX;
                    const dy = (y - centerY) / radiusY;
                    if (dx * dx + dy * dy <= 1) {
                      stampPositions.push({ x, y });
                    }
                  }
                }
              } else if (xlabShapeMode === 'polygon') {
                // TODO: Implement polygon - for now use rectangle
                for (let y = minY; y <= maxY; y += spacing) {
                  for (let x = minX; x <= maxX; x += spacing) {
                    stampPositions.push({ x, y });
                  }
                }
              }
              
              return (
                <svg
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'visible',
                    zIndex: 1000,
                  }}
                >
                  {/* Border shape */}
                  {xlabShapeMode === 'rectangle' && (
                    <rect
                      x={viewport.x + minX * viewport.zoom}
                      y={viewport.y + minY * viewport.zoom}
                      width={width * viewport.zoom}
                      height={height * viewport.zoom}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  )}
                  {xlabShapeMode === 'circle' && (
                    <ellipse
                      cx={viewport.x + (minX + maxX) / 2 * viewport.zoom}
                      cy={viewport.y + (minY + maxY) / 2 * viewport.zoom}
                      rx={width / 2 * viewport.zoom}
                      ry={height / 2 * viewport.zoom}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  )}
                  {xlabShapeMode === 'polygon' && (
                    <rect
                      x={viewport.x + minX * viewport.zoom}
                      y={viewport.y + minY * viewport.zoom}
                      width={width * viewport.zoom}
                      height={height * viewport.zoom}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  )}
                  
                  {/* Overlapping brush stamps - exactly like stampBrush() rendering */}
                  <g opacity={0.5}>
                    {stampPositions.map((pos, idx) => {
                      const centerX = viewport.x + pos.x * viewport.zoom;
                      const centerY = viewport.y + pos.y * viewport.zoom;
                      const radius = (backgroundBrushSize / 2) * viewport.zoom;
                      const clipId = `xlab-clip-${idx}`;
                      const textureUrl = selectedTerrainBrush || selectedBackgroundTexture;
                      
                      if (!textureUrl) return null;

                      return (
                        <g key={idx}>
                          <defs>
                            <clipPath id={clipId}>
                              <circle cx={centerX} cy={centerY} r={radius} />
                            </clipPath>
                          </defs>
                          <image
                            href={textureUrl}
                            x={centerX - radius}
                            y={centerY - radius}
                            width={backgroundBrushSize * viewport.zoom}
                            height={backgroundBrushSize * viewport.zoom}
                            clipPath={`url(#${clipId})`}
                          />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              );
            })()}

        {/* Custom room drawing preview - works for both canvas and maps */}
        {scene && customRoomVertices.length > 0 && (() => {
          const isCanvas = mapDimensions.width === 0 && mapDimensions.height === 0;
          const canvasSize = 50000;
          const offset = isCanvas ? canvasSize / 2 : 0;
          
          return (
              <svg
                style={{
                  position: 'absolute',
                  left: isCanvas ? viewport.x - canvasSize / 2 * viewport.zoom : viewport.x,
                  top: isCanvas ? viewport.y - canvasSize / 2 * viewport.zoom : viewport.y,
                  transform: `scale(${viewport.zoom})`,
                  transformOrigin: '0 0',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                <defs>
                  <filter id="blackGlow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                    <feOffset dx="0" dy="0" result="offsetblur"/>
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="1.5"/>
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Lines between vertices */}
                {customRoomVertices.map((vertex, i) => {
                  if (i === 0) return null;
                  const prev = customRoomVertices[i - 1];
                  return (
                    <line
                      key={`line-${i}`}
                      x1={prev.x + offset}
                      y1={prev.y + offset}
                      x2={vertex.x + offset}
                      y2={vertex.y + offset}
                      stroke={isSubtractMode(roomSubTool) ? "#ef4444" : "#22c55e"}
                      strokeWidth={3}
                      filter="url(#blackGlow)"
                    />
                  );
                })}
                
                {/* Line from last vertex to cursor */}
                {cursorPosition && customRoomVertices.length > 0 && (
                  <line
                    x1={customRoomVertices[customRoomVertices.length - 1].x + offset}
                    y1={customRoomVertices[customRoomVertices.length - 1].y + offset}
                    x2={cursorPosition.x + offset}
                    y2={cursorPosition.y + offset}
                    stroke={isSubtractMode(roomSubTool) ? "#ef4444" : "#22c55e"}
                    strokeWidth={3}
                    strokeDasharray="5,5"
                    filter="url(#blackGlow)"
                  />
                )}
                
                {/* Closing line preview when near first vertex */}
                {customRoomVertices.length >= 3 && cursorPosition && (() => {
                  const firstVertex = customRoomVertices[0];
                  const distance = Math.sqrt(
                    (cursorPosition.x - firstVertex.x) ** 2 + 
                    (cursorPosition.y - firstVertex.y) ** 2
                  );
                  if (distance < 10 / viewport.zoom) {
                    return (
                      <line
                        x1={customRoomVertices[customRoomVertices.length - 1].x + offset}
                        y1={customRoomVertices[customRoomVertices.length - 1].y + offset}
                        x2={firstVertex.x + offset}
                        y2={firstVertex.y + offset}
                        stroke={isSubtractMode(roomSubTool) ? "#ef4444" : "#22c55e"}
                        strokeWidth={3}
                        filter="url(#blackGlow)"
                      />
                    );
                  }
                  return null;
                })()}
                
                {/* Vertices */}
                {customRoomVertices.map((vertex, i) => {
                  // Check if hovering near first vertex to highlight it
                  const isHoveringFirst = i === 0 && customRoomVertices.length >= 3 && cursorPosition && (() => {
                    const distance = Math.sqrt(
                      (cursorPosition.x - vertex.x) ** 2 + 
                      (cursorPosition.y - vertex.y) ** 2
                    );
                    return distance < 10 / viewport.zoom;
                  })();
                  
                  return (
                    <circle
                      key={`vertex-${i}`}
                      cx={vertex.x + offset}
                      cy={vertex.y + offset}
                      r={isHoveringFirst ? 8 / viewport.zoom : 5 / viewport.zoom}
                      fill={isSubtractMode(roomSubTool) ? "#ef4444" : "#22c55e"}
                      stroke="#000000"
                      strokeWidth={2 / viewport.zoom}
                      filter="url(#blackGlow)"
                    />
                  );
                })}
              </svg>
          );
        })()}

        {/* Wall drawing preview - works for both canvas and maps */}
        {scene && wallVertices.length > 0 && (() => {
          const isCanvas = mapDimensions.width === 0 && mapDimensions.height === 0;
          const canvasSize = 50000;
          
          // Build preview vertices including cursor position
          const previewVertices = [...wallVertices];
          if (cursorPosition) {
            previewVertices.push(cursorPosition);
          }
          
          // Calculate bounding box
          const xs = previewVertices.map(v => v.x);
          const ys = previewVertices.map(v => v.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          const width = maxX - minX + wallThickness * 2;
          const height = maxY - minY + wallThickness * 2;
          
          // Convert vertices to relative coordinates
          const relativeVertices = previewVertices.map(v => ({
            x: v.x - minX + wallThickness,
            y: v.y - minY + wallThickness
          }));
          
          // Create polyline path
          const polylinePath = relativeVertices.map((v, i) => 
            `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
          ).join(' ');
          
          const wallPatternId = 'wall-preview-pattern';
          
          return (
              <svg
                style={{
                  position: 'absolute',
                  left: isCanvas ? viewport.x + (minX - wallThickness - canvasSize / 2) * viewport.zoom : viewport.x + (minX - wallThickness) * viewport.zoom,
                  top: isCanvas ? viewport.y + (minY - wallThickness - canvasSize / 2) * viewport.zoom : viewport.y + (minY - wallThickness) * viewport.zoom,
                  transform: `scale(${viewport.zoom})`,
                  transformOrigin: '0 0',
                  width,
                  height,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                <defs>
                  {selectedWallTexture && (
                    <pattern
                      id={wallPatternId}
                      patternUnits="userSpaceOnUse"
                      width={wallTileSize}
                      height={wallTileSize}
                    >
                      <image
                        href={selectedWallTexture}
                        width={wallTileSize}
                        height={wallTileSize}
                      />
                    </pattern>
                  )}
                </defs>
                
                {/* Wall preview polyline with texture */}
                <path
                  d={polylinePath}
                  fill="none"
                  stroke={selectedWallTexture ? `url(#${wallPatternId})` : '#8b5cf6'}
                  strokeWidth={wallThickness}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  opacity={cursorPosition ? 0.7 : 1}
                />
                
                {/* Wall vertices */}
                {wallVertices.map((vertex, i) => (
                  <circle
                    key={`wall-vertex-${i}`}
                    cx={vertex.x - minX + wallThickness}
                    cy={vertex.y - minY + wallThickness}
                    r={5 / viewport.zoom}
                    fill="#ffffff"
                    stroke="#22c55e"
                    strokeWidth={2 / viewport.zoom}
                  />
                ))}
              </svg>
          );
        })()}

        {/* Wall line preview - drag to draw single wall */}
        {scene && wallLineStart && wallLinePreview && activeTool === 'wall-line' && (() => {
          const isCanvas = mapDimensions.width === 0 && mapDimensions.height === 0;
          const canvasSize = 50000;
          
          const previewVertices = [wallLineStart, wallLinePreview];
          
          // Calculate bounding box
          const xs = previewVertices.map(v => v.x);
          const ys = previewVertices.map(v => v.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          const width = maxX - minX + wallThickness * 2;
          const height = maxY - minY + wallThickness * 2;
          
          // Convert vertices to relative coordinates
          const relativeVertices = previewVertices.map(v => ({
            x: v.x - minX + wallThickness,
            y: v.y - minY + wallThickness
          }));
          
          const wallLinePatternId = 'wall-line-preview-pattern';
          
          return (
              <svg
                style={{
                  position: 'absolute',
                  left: isCanvas ? viewport.x + (minX - wallThickness - canvasSize / 2) * viewport.zoom : viewport.x + (minX - wallThickness) * viewport.zoom,
                  top: isCanvas ? viewport.y + (minY - wallThickness - canvasSize / 2) * viewport.zoom : viewport.y + (minY - wallThickness) * viewport.zoom,
                  transform: `scale(${viewport.zoom})`,
                  transformOrigin: '0 0',
                  width,
                  height,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                <defs>
                  {selectedWallTexture && (
                    <pattern
                      id={wallLinePatternId}
                      patternUnits="userSpaceOnUse"
                      width={wallTileSize}
                      height={wallTileSize}
                    >
                      <image
                        href={selectedWallTexture}
                        width={wallTileSize}
                        height={wallTileSize}
                      />
                    </pattern>
                  )}
                </defs>
                
                {/* Wall line preview with texture */}
                <line
                  x1={relativeVertices[0].x}
                  y1={relativeVertices[0].y}
                  x2={relativeVertices[1].x}
                  y2={relativeVertices[1].y}
                  stroke={selectedWallTexture ? `url(#${wallLinePatternId})` : '#8b5cf6'}
                  strokeWidth={wallThickness}
                  strokeLinecap="square"
                  opacity={0.7}
                />
                
                {/* Start and end point markers */}
                <circle
                  cx={relativeVertices[0].x}
                  cy={relativeVertices[0].y}
                  r={6 / viewport.zoom}
                  fill="#8b5cf6"
                  stroke="#ffffff"
                  strokeWidth={2 / viewport.zoom}
                />
                <circle
                  cx={relativeVertices[1].x}
                  cy={relativeVertices[1].y}
                  r={6 / viewport.zoom}
                  fill="#8b5cf6"
                  stroke="#ffffff"
                  strokeWidth={2 / viewport.zoom}
                />
              </svg>
          );
        })()}

        {/* Selection box - works for both canvas and maps */}
        {scene && selectionBox && (
              <div
                style={{
                  position: 'absolute',
                  left: viewport.x + Math.min(selectionBox.startX, selectionBox.endX) * viewport.zoom,
                  top: viewport.y + Math.min(selectionBox.startY, selectionBox.endY) * viewport.zoom,
                  width: Math.abs(selectionBox.endX - selectionBox.startX) * viewport.zoom,
                  height: Math.abs(selectionBox.endY - selectionBox.startY) * viewport.zoom,
                  border: '2px dashed #22c55e',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  pointerEvents: 'none'
                }}
              />
            )}

        {/* Merge Rooms Button - works for both canvas and maps */}
        {scene && (() => {
              
              const selectedIds = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
              const selectedRooms = scene.elements.filter(el => 
                selectedIds.includes(el.id) && el.type === 'room'
              ) as RoomElement[];

              if (selectedRooms.length < 2) return null;

              // Check if at least 2 rooms can merge (overlap)
              let mergableCount = 0;
              for (let i = 0; i < selectedRooms.length - 1; i++) {
                for (let j = i + 1; j < selectedRooms.length; j++) {
                  if (doRoomsOverlap(selectedRooms[i], selectedRooms[j])) {
                    mergableCount++;
                    if (mergableCount >= 1) break; // At least one pair can merge
                  }
                }
                if (mergableCount >= 1) break;
              }

              if (mergableCount === 0) return null;

              // Calculate position: to the right of the selection bounding box
              const allVertices: { x: number; y: number }[] = [];
              selectedRooms.forEach(room => {
                if (room.vertices) allVertices.push(...room.vertices);
              });

              const xs = allVertices.map(v => v.x);
              const ys = allVertices.map(v => v.y);
              const maxX = Math.max(...xs);
              const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMergeRooms();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{
                    position: 'absolute',
                    left: viewport.x + (maxX + 20) * viewport.zoom,
                    top: viewport.y + (centerY - 20) * viewport.zoom,
                    padding: '8px 16px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #4ade80',
                    borderRadius: '4px',
                    color: '#4ade80',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    zIndex: 1000,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    pointerEvents: 'auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#374151';
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.color = '#22c55e';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2937';
                    e.currentTarget.style.borderColor = '#4ade80';
                    e.currentTarget.style.color = '#4ade80';
                  }}
                >
                  Merge Rooms
                </button>
              );
            })()}

        {/* Merge Walls Button */}
        {scene && (() => {
              const selectedIds = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
              const selectedWalls = scene.elements.filter(el => 
                selectedIds.includes(el.id) && el.type === 'wall'
              ) as WallElement[];

              if (selectedWalls.length < 2) return null;

              // Calculate position: to the right of the selection bounding box
              const allVertices: { x: number; y: number }[] = [];
              selectedWalls.forEach(wall => {
                if (wall.vertices) allVertices.push(...wall.vertices);
              });

              const xs = allVertices.map(v => v.x);
              const ys = allVertices.map(v => v.y);
              const maxX = Math.max(...xs);
              const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMergeWalls();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{
                    position: 'absolute',
                    left: viewport.x + (maxX + 20) * viewport.zoom,
                    top: viewport.y + (centerY - 20) * viewport.zoom,
                    padding: '8px 16px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #8b5cf6',
                    borderRadius: '4px',
                    color: '#8b5cf6',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    zIndex: 1000,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    pointerEvents: 'auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#374151';
                    e.currentTarget.style.borderColor = '#a78bfa';
                    e.currentTarget.style.color = '#a78bfa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2937';
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.color = '#8b5cf6';
                  }}
                >
                  Merge Walls
                </button>
              );
            })()}

        {/* Token cursor preview - works for both canvas and maps */}
        {scene && activeTool === 'token' && activeTokenTemplate && cursorPosition && (
              <div
                style={{
                  position: 'absolute',
                  left: viewport.x + cursorPosition.x * viewport.zoom - 30,
                  top: viewport.y + cursorPosition.y * viewport.zoom - 30,
                  width: 60,
                  height: 60,
                  pointerEvents: 'none',
                  opacity: 0.7,
                  zIndex: 40
                }}
              >
                {(activeTokenTemplate.isShape || activeTokenTemplate.isPOI) && activeTokenTemplate.icon ? (
                  (() => {
                    const IconComponent = getLucideIcon(activeTokenTemplate.icon);
                    const color = getColorHex(activeTokenTemplate.color || 'blue');
                    return (
                      <IconComponent
                        size={60}
                        style={{ color }}
                        fill={activeTokenTemplate.isShape ? color : 'none'}
                        strokeWidth={activeTokenTemplate.isPOI ? 2 : 1.5}
                      />
                    );
                  })()
                ) : activeTokenTemplate.imageUrl ? (
                  <div 
                    className="w-full h-full rounded-full overflow-hidden"
                    style={{
                      border: `3px solid ${getColorHex(activeTokenTemplate.color || 'blue')}`
                    }}
                  >
                    <img src={activeTokenTemplate.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
              </div>
            )}
      </div>

      {/* Mode Toggle Button - Top Center */}
      <button
        onClick={onToggleViewMode}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-dm-panel border border-dm-border rounded-lg hover:bg-dm-hover transition-colors shadow-lg"
        title={viewMode === 'planning' ? 'Switch to Game Mode' : 'Switch to Planning Mode'}
      >
        {viewMode === 'planning' ? (
          <>
            <Gamepad2 className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-200">Start Game Mode</span>
          </>
        ) : (
          <>
            <StopCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-200">End Game Mode</span>
          </>
        )}
      </button>

      {/* Toolbox - shows different buttons based on mode */}
      <Toolbox
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onLayerUp={handleLayerUp}
        onLayerDown={handleLayerDown}
        onFitToView={handleFitToView}
        fitToViewLocked={fitToViewLocked}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        hasSelection={selectedElementId !== null || selectedElementIds.length > 0}
        showTokenBadges={showTokenBadges}
        selectedTokenHasBadge={
          selectedElementId && scene
            ? (scene.elements.find(e => e.id === selectedElementId) as any)?.showBadge || false
            : selectedElementIds.length === 1 && scene
              ? (scene.elements.find(e => e.id === selectedElementIds[0]) as any)?.showBadge || false
              : false
        }
        onToggleBadges={handleToggleBadges}
        recentTokens={recentTokens}
        tokenTemplates={tokenTemplates}
        activeTokenTemplate={activeTokenTemplate}
        onSelectToken={onSelectToken}
        selectedColor={selectedColor}
        onColorChange={onColorChange}
        roomSubTool={roomSubTool}
        setRoomSubTool={setRoomSubTool}
        selectedElementLocked={
          selectedElementId && scene
            ? (scene.elements.find(e => e.id === selectedElementId) as any)?.locked || false
            : selectedElementIds.length === 1 && scene
              ? (scene.elements.find(e => e.id === selectedElementIds[0]) as any)?.locked || false
              : false
        }
        onToggleLock={handleToggleLock}
        showGrid={showGrid}
        gridSize={gridSize}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onGridSizeChange={setGridSize}
        forceShowTokenSubmenu={showTokenSubmenuForShift}
        forceShowTerrainSubmenu={showTerrainSubmenuForT}
        forceShowGridSubmenu={showGridSubmenuForG}
        terrainBrushes={terrainBrushes}
        selectedTerrainBrush={selectedTerrainBrush}
        onSelectTerrainBrush={onSelectTerrainBrush}
        wallTextures={wallTextures}
        selectedWallTexture={selectedWallTexture}
        onSelectWallTexture={onSelectWallTexture}
        wallCutterToolBrushSize={wallCutterToolBrushSize}
        setWallCutterToolBrushSize={setWallCutterToolBrushSizeProp}
        onHideTokenPreview={() => setCursorPosition(null)}
        isLeftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={onToggleLeftPanel}
        viewMode={viewMode}
      />

      {/* Zoom Limit Error Message */}
      {zoomLimitError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-900/80 border border-red-700/50 rounded-lg shadow-lg px-5 py-3">
            <p className="text-red-200 text-sm text-center">
              Disable fit to screen to zoom further out
            </p>
          </div>
        </div>
      )}

      {/* Canvas Infinite Error Message */}
      {canvasInfiniteError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-yellow-900/80 border border-yellow-700/50 rounded-lg shadow-lg px-5 py-3">
            <p className="text-yellow-200 text-sm text-center">
              Fit to view only works on maps with fixed dimensions. This is a freeform canvas.
            </p>
          </div>
        </div>
      )}

      {/* Merge Notification */}
      {mergeNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-yellow-900/80 border border-yellow-700/50 rounded-lg shadow-lg px-5 py-3">
            <p className="text-yellow-200 text-sm text-center">
              {mergeNotification}
            </p>
          </div>
        </div>
      )}

      {/* Locked Element Error */}
      {lockedElementError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-900/80 border border-red-700/50 rounded-lg shadow-lg px-5 py-3">
            <p className="text-red-200 text-sm text-center">
              {lockedElementError}
            </p>
          </div>
        </div>
      )}

      {/* Widget Conflict Dialog */}
      {mergeWidgetConflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Widget Conflict
            </h3>
            
            <p className="text-gray-300 text-sm mb-4">
              {mergeWidgetConflict.rooms.filter(r => r.widgets && r.widgets.length > 0).length} rooms have widgets in their properties. 
              Select which room's properties you want to use.
            </p>

            <div className="space-y-2 mb-4">
              {mergeWidgetConflict.rooms
                .filter(room => room.widgets && room.widgets.length > 0)
                .map(room => (
                  <button
                    key={room.id}
                    onClick={() => handleWidgetConflictResolved(room.id)}
                    className="w-full px-4 py-3 bg-dm-dark hover:bg-dm-border border border-dm-border rounded text-left transition-colors"
                  >
                    <div className="font-medium text-gray-200">{room.name || 'Unnamed Room'}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {room.widgets?.length || 0} widget{room.widgets?.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))
              }
              
              <button
                onClick={() => handleWidgetConflictResolved('all')}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 border border-blue-500 rounded text-left transition-colors mt-3"
              >
                <div className="font-medium text-white">Add all widgets to new room</div>
                <div className="text-xs text-blue-200 mt-1">
                  Combine all widgets from all rooms
                </div>
              </button>
            </div>

            <button
              onClick={() => setMergeWidgetConflict(null)}
              className="w-full px-4 py-2 bg-dm-dark hover:bg-dm-border border border-dm-border rounded text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terrain Brush Preview */}
      {cursorPosition && activeTool === 'background' && selectedTerrainBrush && (
        <div
          style={{
            position: 'absolute',
            left: viewport.x + cursorPosition.x * viewport.zoom,
            top: viewport.y + cursorPosition.y * viewport.zoom,
            width: backgroundBrushSize * viewport.zoom,
            height: backgroundBrushSize * viewport.zoom,
            borderRadius: '50%',
            border: '2px solid #10b981',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            backgroundImage: `url(${selectedTerrainBrush})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.7
          }}
        />
      )}

      {/* Door Tool: DISABLED */}

      {/* Wall Cutter Tool: Freehand mode DISABLED */}

      {/* Wall Cutter Tool Rectangle Preview (rectangle mode) */}
      {wallCutterToolStart && wallCutterToolEnd && activeTool === 'wallCutterTool' && (
        <div
          style={{
            position: 'absolute',
            left: viewport.x + Math.min(wallCutterToolStart.x, wallCutterToolEnd.x) * viewport.zoom,
            top: viewport.y + Math.min(wallCutterToolStart.y, wallCutterToolEnd.y) * viewport.zoom,
            width: Math.abs(wallCutterToolEnd.x - wallCutterToolStart.x) * viewport.zoom,
            height: Math.abs(wallCutterToolEnd.y - wallCutterToolStart.y) * viewport.zoom,
            border: '2px dashed #8b5cf6',
            pointerEvents: 'none',
            zIndex: 40,
            backgroundColor: 'rgba(139, 92, 246, 0.1)'
          }}
        />
      )}
    </div>
  );
};

interface MapElementComponentProps {
  element: MapElement;
  isSelected: boolean;
  viewport: { x: number; y: number; zoom: number };
  showTokenBadges: boolean;
  renderLayer?: 'floor' | 'walls' | 'full'; // Split room rendering into floor/walls layers
}

const MapElementComponent = ({ element, isSelected, viewport, showTokenBadges, renderLayer = 'full' }: MapElementComponentProps) => {
  const colorMap: Record<ColorType, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    brown: '#92400e',
    gray: '#6b7280',
    black: '#000000',
    white: '#ffffff',
    cyan: '#06b6d4',
    magenta: '#d946ef',
    lime: '#84cc16',
    indigo: '#6366f1',
    teal: '#14b8a6'
  };

  const getLucideIcon = (icon: IconType) => {
    const iconMap: Record<IconType, any> = {
      circle: Circle,
      square: Square,
      triangle: Triangle,
      star: Star,
      diamond: Diamond,
      heart: Heart,
      skull: Skull,
      quest: MapPin,
      clue: Search,
      hidden: Eye,
      door: DoorOpen,
      landmark: Landmark,
      footprint: Footprints,
      info: Info
    };
    return iconMap[icon];
  };

  const getIconSymbol = (icon: IconType): string => {
    const symbols: Record<IconType, string> = {
      circle: '●',
      square: '■',
      triangle: '▲',
      star: '★',
      diamond: '◆',
      heart: '♥',
      skull: '☠',
      quest: '📍',
      clue: '🔍',
      hidden: '👁',
      door: '🚪',
      landmark: '🏛',
      footprint: '👣',
      info: 'ℹ'
    };
    return symbols[icon];
  };

  const getIconPath = (icon: IconType): string | null => {
    // SVG paths for shapes
    const paths: Record<IconType, string | null> = {
      circle: null, // Use circle element
      square: 'M-0.4,-0.4 L0.4,-0.4 L0.4,0.4 L-0.4,0.4 Z',
      triangle: 'M0,-0.5 L0.43,0.35 L-0.43,0.35 Z',
      star: 'M0,-0.5 L0.12,-0.15 L0.48,-0.15 L0.19,0.07 L0.29,0.41 L0,0.19 L-0.29,0.41 L-0.19,0.07 L-0.48,-0.15 L-0.12,-0.15 Z',
      diamond: 'M0,-0.5 L0.35,0 L0,0.5 L-0.35,0 Z',
      heart: 'M0,0.3 L-0.4,-0.1 Q-0.5,-0.3,-0.3,-0.4 Q0,-0.3,0,-0.5 Q0,-0.3,0.3,-0.4 Q0.5,-0.3,0.4,-0.1 Z',
      skull: 'M0,-0.4 Q-0.3,-0.4,-0.3,-0.1 L-0.3,0.2 Q-0.3,0.4,0,0.4 Q0.3,0.4,0.3,0.2 L0.3,-0.1 Q0.3,-0.4,0,-0.4 M-0.15,-0.15 Q-0.2,-0.15,-0.2,-0.1 Q-0.2,-0.05,-0.15,-0.05 Q-0.1,-0.05,-0.1,-0.1 Q-0.1,-0.15,-0.15,-0.15 M0.15,-0.15 Q0.1,-0.15,0.1,-0.1 Q0.1,-0.05,0.15,-0.05 Q0.2,-0.05,0.2,-0.1 Q0.2,-0.15,0.15,-0.15',
      quest: 'M-0.15,-0.5 L0.15,-0.5 L0.15,0.1 L-0.15,0.1 Z M-0.15,0.25 L0.15,0.25 L0.15,0.5 L-0.15,0.5 Z',
      clue: 'M0,-0.5 Q0.3,-0.4,0.3,-0.1 Q0.3,0.1,0.1,0.25 L0.15,0.5 L-0.15,0.5 L-0.1,0.25 Q-0.3,0.1,-0.3,-0.1 Q-0.3,-0.4,0,-0.5',
      hidden: 'M-0.5,0 Q-0.3,-0.3,0,-0.3 Q0.3,-0.3,0.5,0 Q0.3,0.3,0,0.3 Q-0.3,0.3,-0.5,0 M-0.2,0 Q-0.1,-0.1,0,-0.1 Q0.1,-0.1,0.2,0 Q0.1,0.1,0,0.1 Q-0.1,0.1,-0.2,0',
      door: 'M-0.4,-0.5 L0.4,-0.5 L0.4,0.5 L-0.4,0.5 Z M-0.3,-0.4 L-0.3,0.4 L0.3,0.4 L0.3,-0.4 Z M0.1,-0.05 Q0.15,-0.05,0.15,0 Q0.15,0.05,0.1,0.05 Q0.05,0.05,0.05,0 Q0.05,-0.05,0.1,-0.05',
      landmark: 'M0,-0.5 L-0.15,-0.1 L-0.5,-0.1 L-0.2,0.15 L-0.3,0.5 L0,0.25 L0.3,0.5 L0.2,0.15 L0.5,-0.1 L0.15,-0.1 Z',
      footprint: 'M0,-0.3 Q0.15,-0.3,0.2,-0.15 Q0.2,0,0.1,0.1 L0.15,0.2 Q0.15,0.25,0.1,0.3 L0,0.35 L-0.1,0.3 Q-0.15,0.25,-0.15,0.2 L-0.1,0.1 Q-0.2,0,-0.2,-0.15 Q-0.15,-0.3,0,-0.3',
      info: 'M0,-0.5 Q0.3,-0.5,0.5,-0.3 Q0.5,0,0.5,0.3 Q0.3,0.5,0,0.5 Q-0.3,0.5,-0.5,0.3 Q-0.5,0,-0.5,-0.3 Q-0.3,-0.5,0,-0.5 M-0.1,-0.3 L0.1,-0.3 L0.1,-0.15 L-0.1,-0.15 Z M-0.1,0 L0.1,0 L0.1,0.35 L-0.1,0.35 Z'
    };
    return paths[icon];
  };

  if (element.type === 'annotation') {
    const iconPath = getIconPath(element.icon);
    const tooltipText = element.label ? `${getIconSymbol(element.icon)} ${element.label}` : getIconSymbol(element.icon);

    return (
      <div
        style={{
          position: 'absolute',
          left: element.x - element.size / 2,
          top: element.y - element.size / 2,
          width: element.size,
          height: element.size,
          pointerEvents: 'none'
        }}
        title={tooltipText}
      >
        {/* Icon Shape */}
        <svg width={element.size} height={element.size} viewBox="-0.5 -0.5 1 1">
          {iconPath ? (
            <path d={iconPath} fill={colorMap[element.color]} />
          ) : (
            <circle cx="0" cy="0" r="0.45" fill={colorMap[element.color]} />
          )}
        </svg>

        {/* Label Text */}
        {element.label && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: `${element.size * 0.4}px`,
              textShadow: '0 0 3px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
              userSelect: 'none',
              textAlign: 'center',
              lineHeight: 1
            }}
          >
            {element.label}
          </div>
        )}

        {/* Resize Handles */}
        {isSelected && (
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
          </>
        )}
      </div>
    );
  }

  if (element.type === 'token') {
    const shouldShowBadge = element.showBadge || (showTokenBadges && element.showBadge !== false);
    const badgeColor = element.color ? colorMap[element.color] : colorMap.blue;

    // POI token rendering (no background circle)
    if (element.isPOI && element.icon) {
      const IconComponent = getLucideIcon(element.icon);
      const fillColor = element.color ? colorMap[element.color] : colorMap.blue;

      return (
        <div
          style={{
            position: 'absolute',
            left: element.x - element.size / 2,
            top: element.y - element.size / 2,
            width: element.size,
            height: element.size,
            pointerEvents: 'none',
            filter: isSelected ? 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.6))' : 'none'
          }}
          title={element.name}
        >
          <IconComponent
            size={element.size}
            style={{ color: fillColor }}
            fill="none"
            strokeWidth={2}
          />

          {/* Token Badge */}
          {shouldShowBadge && element.name && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -(element.size * 0.12),
                transform: 'translate(-50%, -100%)',
                backgroundColor: badgeColor,
                color: 'white',
                padding: `${element.size * 0.02}px ${element.size * 0.08}px`,
                borderRadius: `${element.size * 0.08}px`,
                fontSize: `${element.size * 0.18}px`,
                fontWeight: '600',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                letterSpacing: '0.01em'
              }}
            >
              {element.name}
            </div>
          )}

          {/* Resize Handles */}
          {isSelected && (
            <>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', left: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', right: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
            </>
          )}
        </div>
      );
    }

    // Shape token rendering
    if (element.isShape && element.icon) {
      const IconComponent = getLucideIcon(element.icon);
      const fillColor = element.color ? colorMap[element.color] : colorMap.blue;

      return (
        <div
          style={{
            position: 'absolute',
            left: element.x - element.size / 2,
            top: element.y - element.size / 2,
            width: element.size,
            height: element.size,
            pointerEvents: 'none'
          }}
          title={element.name}
        >
          <IconComponent
            size={element.size}
            style={{ color: fillColor }}
            fill={fillColor}
            strokeWidth={1.5}
            stroke={isSelected ? '#22c55e' : fillColor}
          />

          {/* Token Badge */}
          {shouldShowBadge && element.name && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -(element.size * 0.12),
                transform: 'translate(-50%, -100%)',
                backgroundColor: badgeColor,
                color: 'white',
                padding: `${element.size * 0.02}px ${element.size * 0.08}px`,
                borderRadius: `${element.size * 0.08}px`,
                fontSize: `${element.size * 0.18}px`,
                fontWeight: '600',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                letterSpacing: '0.01em'
              }}
            >
              {element.name}
            </div>
          )}

          {/* Resize Handles */}
          {isSelected && (
            <>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', left: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
              <div style={{ position: 'absolute', right: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
            </>
          )}
        </div>
      );
    }

    // Image token rendering
    const borderColor = element.color ? colorMap[element.color] : undefined;
    // Border width as percentage of token size (3% of size)
    const borderWidth = element.color ? element.size * 0.03 : 0;

    return (
      <div
        style={{
          position: 'absolute',
          left: element.x - element.size / 2,
          top: element.y - element.size / 2,
          width: element.size,
          height: element.size,
          pointerEvents: 'none'
        }}
        title={element.name}
      >
        {element.imageUrl && (
          <img
            src={element.imageUrl}
            alt={element.name}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: isSelected 
                ? `${element.size * 0.04}px solid #22c55e` 
                : 'none',
              boxShadow: borderColor ? `0 0 0 ${borderWidth}px ${borderColor}` : 'none',
              objectFit: 'cover'
            }}
            draggable={false}
          />
        )}

        {/* Token Badge */}
        {shouldShowBadge && element.name && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -(element.size * 0.12),
              transform: 'translate(-50%, -100%)',
              backgroundColor: badgeColor,
              color: 'white',
              padding: `${element.size * 0.02}px ${element.size * 0.08}px`,
              borderRadius: `${element.size * 0.08}px`,
              fontSize: `${element.size * 0.18}px`,
              fontWeight: '600',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              letterSpacing: '0.01em'
            }}
          >
            {element.name}
          </div>
        )}

        {/* Resize Handles */}
        {isSelected && (
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
          </>
        )}
      </div>
    );
  }

  if (element.type === 'room') {
    if (!element.vertices || element.vertices.length < 3) {
      return null; // Invalid polygon
    }

    const hasWalls = element.showWalls && element.wallTextureUrl;
    
    // Calculate bounding box for container
    const xs = element.vertices.map(v => v.x);
    const ys = element.vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Create pattern ID for floor texture
    const floorPatternId = `floor-pattern-${element.id}`;
    const wallPatternId = `wall-pattern-${element.id}`;
    
    // Convert vertices to relative coordinates (relative to minX, minY)
    const roomElement = element as RoomElement;
    
    const relativeVertices = element.vertices.map(v => ({
      x: v.x - minX,
      y: v.y - minY
    }));
    
    // Recreate polygon path with relative vertices
    // Include holes if any - each hole is a separate subpath
    const outerPath = relativeVertices.map((v, i) => 
      `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
    ).join(' ') + ' Z';
    
    let relativePolygonPath = outerPath;
    
    // Add holes as additional subpaths (they will be subtracted due to evenodd fill-rule)
    if (roomElement.holes && roomElement.holes.length > 0) {
      const holePaths = roomElement.holes.map(hole => {
        const relativeHole = hole.map(v => ({
          x: v.x - minX,
          y: v.y - minY
        }));
        return relativeHole.map((v, i) => 
          `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
        ).join(' ') + ' Z';
      });
      relativePolygonPath = outerPath + ' ' + holePaths.join(' ');
    }
    
    // Layer-specific rendering
    // When renderLayer='floor', only render floor
    // When renderLayer='walls', only render walls and selection
    // When renderLayer='full', render everything (for temp elements, etc.)
    
    if (renderLayer === 'floor') {
      // FLOOR LAYER (below grid) - only floor texture
      // Now renders in separate Z_FLOOR container, so use element's own zIndex
      return (
        <svg
          style={{
            position: 'absolute',
            left: minX,
            top: minY,
            width,
            height,
            overflow: 'visible',
            pointerEvents: 'none',
            transform: roomElement.rotation ? `rotate(${roomElement.rotation}deg)` : undefined,
            transformOrigin: 'center center',
            zIndex: (element as any).zIndex || 0
          }}
        >
          <defs>
            {/* Floor texture pattern */}
            {element.floorTextureUrl !== 'transparent' && (
              <pattern
                id={floorPatternId}
                x="0"
                y="0"
                width={element.tileSize}
                height={element.tileSize}
                patternUnits="userSpaceOnUse"
              >
                <image
                  href={element.floorTextureUrl}
                  x="0"
                  y="0"
                  width={element.tileSize}
                  height={element.tileSize}
                />
              </pattern>
            )}
          </defs>
          
          {/* Floor fill */}
          <path
            d={relativePolygonPath}
            fill={element.floorTextureUrl === 'transparent' ? 'none' : `url(#${floorPatternId})`}
            fillRule="evenodd"
            stroke="none"
          />
        </svg>
      );
    }
    
    if (renderLayer === 'walls') {
      // WALLS LAYER (above grid) - walls, selection, and label
      return (
        <>
          {/* Walls texture (if hasWalls) */}
          {hasWalls && (
            <svg
              style={{
                position: 'absolute',
                left: minX,
                top: minY,
                width,
                height,
                overflow: 'visible',
                pointerEvents: 'none',
                transform: roomElement.rotation ? `rotate(${roomElement.rotation}deg)` : undefined,
                transformOrigin: 'center center',
                zIndex: (element as any).zIndex || 0
              }}
            >
              <defs>
                {element.wallTextureUrl && element.wallTextureUrl !== 'transparent' && (
                  <pattern
                    id={wallPatternId}
                    x="0"
                    y="0"
                    width={element.wallTileSize}
                    height={element.wallTileSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <image
                      href={element.wallTextureUrl}
                      x="0"
                      y="0"
                      width={element.wallTileSize}
                      height={element.wallTileSize}
                    />
                  </pattern>
                )}
              </defs>
              
              {/* Walls - render each edge segment individually to support wallOpenings */}
              {relativeVertices.map((v1, i) => {
                const v2 = relativeVertices[(i + 1) % relativeVertices.length];
                const wallOpening = roomElement.wallOpenings?.find(o => o.segmentIndex === i);
                
                if (!wallOpening) {
                  // No opening - render full segment
                  return (
                    <line
                      key={`wall-${i}`}
                      x1={v1.x}
                      y1={v1.y}
                      x2={v2.x}
                      y2={v2.y}
                      stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                      strokeWidth={element.wallThickness}
                      strokeLinecap="square"
                    />
                  );
                }
                
                // Has opening - render two segments (before and after opening)
                const dx = v2.x - v1.x;
                const dy = v2.y - v1.y;
                
                return (
                  <g key={`wall-${i}`}>
                    {/* Segment before opening */}
                    {wallOpening.startRatio > 0 && (
                      <line
                        x1={v1.x}
                        y1={v1.y}
                        x2={v1.x + dx * wallOpening.startRatio}
                        y2={v1.y + dy * wallOpening.startRatio}
                        stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                        strokeWidth={element.wallThickness}
                        strokeLinecap="square"
                      />
                    )}
                    {/* Segment after opening */}
                    {wallOpening.endRatio < 1 && (
                      <line
                        x1={v1.x + dx * wallOpening.endRatio}
                        y1={v1.y + dy * wallOpening.endRatio}
                        x2={v2.x}
                        y2={v2.y}
                        stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                        strokeWidth={element.wallThickness}
                        strokeLinecap="square"
                      />
                    )}
                  </g>
                );
              })}
              
              {/* Hole walls - render wall texture around each hole */}
              {roomElement.holes?.flatMap((hole, holeIdx) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                
                return relativeHole.map((v1, i) => {
                  const v2 = relativeHole[(i + 1) % relativeHole.length];
                  const holeWallOpening = roomElement.holeWallOpenings?.find(
                    o => o.holeIndex === holeIdx && o.segmentIndex === i
                  );
                  
                  if (!holeWallOpening) {
                    // No opening - render full segment
                    return (
                      <line
                        key={`hole-wall-${holeIdx}-${i}`}
                        x1={v1.x}
                        y1={v1.y}
                        x2={v2.x}
                        y2={v2.y}
                        stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                        strokeWidth={element.wallThickness}
                        strokeLinecap="square"
                      />
                    );
                  }
                  
                  // Has opening - render two segments (before and after opening)
                  const dx = v2.x - v1.x;
                  const dy = v2.y - v1.y;
                  
                  return (
                    <g key={`hole-wall-${holeIdx}-${i}`}>
                      {/* Segment before opening */}
                      {holeWallOpening.startRatio > 0 && (
                        <line
                          x1={v1.x}
                          y1={v1.y}
                          x2={v1.x + dx * holeWallOpening.startRatio}
                          y2={v1.y + dy * holeWallOpening.startRatio}
                          stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                          strokeWidth={element.wallThickness}
                          strokeLinecap="square"
                        />
                      )}
                      {/* Segment after opening */}
                      {holeWallOpening.endRatio < 1 && (
                        <line
                          x1={v1.x + dx * holeWallOpening.endRatio}
                          y1={v1.y + dy * holeWallOpening.endRatio}
                          x2={v2.x}
                          y2={v2.y}
                          stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
                          strokeWidth={element.wallThickness}
                          strokeLinecap="square"
                        />
                      )}
                    </g>
                  );
                });
              })}
            </svg>
          )}
          
          {/* Selection indicator - always render when selected */}
          {isSelected && (
            <svg
              style={{
                position: 'absolute',
                left: minX,
                top: minY,
                width,
                height,
                overflow: 'visible',
                pointerEvents: 'none',
                transform: roomElement.rotation ? `rotate(${roomElement.rotation}deg)` : undefined,
                transformOrigin: 'center center',
                zIndex: ((element as any).zIndex || 0) + 1
              }}
            >
              {/* If walls exist, draw selection border outside the wall */}
              {hasWalls && element.wallThickness > 0 ? (
                <>
                  {/* Invisible larger stroke to create offset */}
                  <path
                    d={relativePolygonPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={element.wallThickness}
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                  />
                  {/* Actual selection line on top */}
                  <path
                    d={relativePolygonPath}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                    style={{
                      transform: `scale(${1 + element.wallThickness / Math.max(width, height)})`,
                      transformOrigin: `${width / 2}px ${height / 2}px`
                    }}
                  />
                </>
              ) : (
                <path
                  d={relativePolygonPath}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              )}
              {/* Vertex handles for polygon */}
              {relativeVertices.map((v, i) => (
                <circle
                  key={`handle-${i}`}
                  cx={v.x}
                  cy={v.y}
                  r={4 / viewport.zoom}
                  fill="white"
                  stroke="#22c55e"
                  strokeWidth={1}
                  style={{ pointerEvents: 'auto' }}
                />
              ))}
              
              {/* Vertex handles for holes */}
              {roomElement.holes && roomElement.holes.map((hole, holeIndex) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                return relativeHole.map((v, vertexIndex) => (
                  <circle
                    key={`hole-${holeIndex}-handle-${vertexIndex}`}
                    cx={v.x}
                    cy={v.y}
                    r={4 / viewport.zoom}
                    fill="white"
                    stroke="#ef4444"
                    strokeWidth={1}
                    style={{ pointerEvents: 'auto' }}
                  />
                ));
              })}
              
              {/* Rotation handle - center top */}
              <line
                x1={width / 2}
                y1={height / 2}
                x2={width / 2}
                y2={-20 / viewport.zoom}
                stroke="#22c55e"
                strokeWidth={1.5 / viewport.zoom}
                strokeDasharray="3,3"
              />
              <circle
                cx={width / 2}
                cy={-20 / viewport.zoom}
                r={12 / viewport.zoom}
                fill="transparent"
                style={{ 
                  cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                  pointerEvents: 'auto'
                }}
              />
              <circle
                cx={width / 2}
                cy={-20 / viewport.zoom}
                r={7 / viewport.zoom}
                fill="#22c55e"
                stroke="white"
                strokeWidth={2 / viewport.zoom}
                style={{ 
                  cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                  pointerEvents: 'none'
                }}
              />
            </svg>
          )}
          
          {/* Room Label */}
          {element.label && (
            <div
              style={{
                position: 'absolute',
                left: minX + width / 2,
                top: minY + height / 2,
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontSize: Math.max(12, 16 / viewport.zoom),
                fontWeight: 'bold',
                textShadow: '0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                zIndex: ((element as any).zIndex || 0) + 2,
                lineHeight: 1
              }}
            >
              {element.label}
            </div>
          )}
          
          {/* Corner rotation handles - rendered outside SVG */}
          {isSelected && relativeVertices.map((v, i) => {
            const rotationRadians = (roomElement.rotation || 0) * Math.PI / 180;
            const cosR = Math.cos(rotationRadians);
            const sinR = Math.sin(rotationRadians);
            
            // Rotate vertex around center
            const relX = v.x - width / 2;
            const relY = v.y - height / 2;
            const rotatedX = relX * cosR - relY * sinR;
            const rotatedY = relX * sinR + relY * cosR;
            
            const worldX = minX + width / 2 + rotatedX;
            const worldY = minY + height / 2 + rotatedY;
            
            // Calculate handle offset (outside corner)
            const handleOffset = 15 / viewport.zoom;
            const angle = Math.atan2(rotatedY, rotatedX);
            const handleX = worldX + handleOffset * Math.cos(angle);
            const handleY = worldY + handleOffset * Math.sin(angle);
            
            return (
              <div
                key={`corner-rotate-${i}`}
                style={{
                  position: 'absolute',
                  left: handleX,
                  top: handleY,
                  width: 20 / viewport.zoom,
                  height: 20 / viewport.zoom,
                  marginLeft: -10 / viewport.zoom,
                  marginTop: -10 / viewport.zoom,
                  borderRadius: '50%',
                  pointerEvents: 'auto',
                  cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                  zIndex: 1000
                }}
              />
            );
          })}
        </>
      );
    }
    
    // 'full' renderLayer - render both floor and walls together (for temp elements, etc.)
    return (
      <>
        <svg
          style={{
            position: 'absolute',
            left: minX,
            top: minY,
            width,
            height,
            overflow: 'visible',
            pointerEvents: 'none',
            transform: roomElement.rotation ? `rotate(${roomElement.rotation}deg)` : undefined,
            transformOrigin: 'center center'
          }}
        >
          <defs>
            {/* Floor texture pattern */}
            {element.floorTextureUrl !== 'transparent' && (
              <pattern
                id={floorPatternId}
                x="0"
                y="0"
                width={element.tileSize}
                height={element.tileSize}
                patternUnits="userSpaceOnUse"
              >
                <image
                  href={element.floorTextureUrl}
                  x="0"
                  y="0"
                  width={element.tileSize}
                  height={element.tileSize}
                />
              </pattern>
            )}
            {hasWalls && element.wallTextureUrl && element.wallTextureUrl !== 'transparent' && (
              <pattern
                id={wallPatternId}
                x="0"
                y="0"
                width={element.wallTileSize}
                height={element.wallTileSize}
                patternUnits="userSpaceOnUse"
              >
                <image
                  href={element.wallTextureUrl}
                  x="0"
                  y="0"
                  width={element.wallTileSize}
                  height={element.wallTileSize}
                />
              </pattern>
            )}
          </defs>
          
          {/* Floor fill */}
          <path
            d={relativePolygonPath}
            fill={element.floorTextureUrl === 'transparent' ? 'none' : `url(#${floorPatternId})`}
            fillRule="evenodd"
            stroke="none"
          />
          
          {/* Walls - as stroke on the polygon edge */}
          {hasWalls && (
            <path
              d={relativePolygonPath}
              fill="none"
              stroke={element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)")}
              strokeWidth={element.wallThickness}
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          )}
          
          {/* Selection indicator */}
          {isSelected && (
            <>
              {/* If walls exist, draw selection border outside the wall */}
              {hasWalls && element.wallThickness > 0 ? (
                <>
                  {/* Invisible larger stroke to create offset */}
                  <path
                    d={relativePolygonPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={element.wallThickness}
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                  />
                  {/* Actual selection line on top */}
                  <path
                    d={relativePolygonPath}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                    style={{
                      transform: `scale(${1 + element.wallThickness / Math.max(width, height)})`,
                      transformOrigin: `${width / 2}px ${height / 2}px`
                    }}
                  />
                </>
              ) : (
                <path
                  d={relativePolygonPath}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              )}
              {/* Vertex handles for polygon */}
              {relativeVertices.map((v, i) => (
                <circle
                  key={`handle-${i}`}
                  cx={v.x}
                  cy={v.y}
                  r={4 / viewport.zoom}
                  fill="white"
                  stroke="#22c55e"
                  strokeWidth={1}
                  style={{ pointerEvents: 'auto' }}
                />
              ))}
              
              {/* Vertex handles for holes */}
              {roomElement.holes && roomElement.holes.map((hole, holeIndex) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                return relativeHole.map((v, vertexIndex) => (
                  <circle
                    key={`hole-${holeIndex}-handle-${vertexIndex}`}
                    cx={v.x}
                    cy={v.y}
                    r={4 / viewport.zoom}
                    fill="white"
                    stroke="#ef4444"
                    strokeWidth={1}
                    style={{ pointerEvents: 'auto' }}
                  />
                ));
              })}
              
              {/* Rotation handle - center top */}
              <line
                x1={width / 2}
                y1={height / 2}
                x2={width / 2}
                y2={-20 / viewport.zoom}
                stroke="#22c55e"
                strokeWidth={1.5 / viewport.zoom}
                strokeDasharray="3,3"
              />
              <circle
                cx={width / 2}
                cy={-20 / viewport.zoom}
                r={12 / viewport.zoom}
                fill="transparent"
                style={{ 
                  cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                  pointerEvents: 'auto'
                }}
              />
              <circle
                cx={width / 2}
                cy={-20 / viewport.zoom}
                r={7 / viewport.zoom}
                fill="#22c55e"
                stroke="white"
                strokeWidth={2 / viewport.zoom}
                style={{ 
                  cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                  pointerEvents: 'none'
                }}
              />
            </>
          )}
        </svg>
        
        {/* Room Label */}
        {element.label && (
          <div
            style={{
              position: 'absolute',
              left: minX + width / 2,
              top: minY + height / 2,
              transform: 'translate(-50%, -50%)',
              color: 'white',
              fontSize: Math.max(12, 16 / viewport.zoom),
              fontWeight: 'bold',
              textShadow: '0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              zIndex: 100,
              lineHeight: 1
            }}
          >
            {element.label}
          </div>
        )}
        
        {/* Corner rotation handles - rendered outside SVG */}
        {isSelected && (
          <>
            {/* Calculate corner positions in world space with rotation */}
            {relativeVertices.map((v, i) => {
              const rotationRadians = (roomElement.rotation || 0) * Math.PI / 180;
              const cosR = Math.cos(rotationRadians);
              const sinR = Math.sin(rotationRadians);
              
              // Rotate vertex around center
              const relX = v.x - width / 2;
              const relY = v.y - height / 2;
              const rotatedX = relX * cosR - relY * sinR;
              const rotatedY = relX * sinR + relY * cosR;
              
              const worldX = minX + width / 2 + rotatedX;
              const worldY = minY + height / 2 + rotatedY;
              
              // Calculate handle offset (outside corner)
              const handleOffset = 15 / viewport.zoom;
              const angle = Math.atan2(rotatedY, rotatedX);
              const handleX = worldX + handleOffset * Math.cos(angle);
              const handleY = worldY + handleOffset * Math.sin(angle);
              
              return (
                <div
                  key={`corner-rotate-${i}`}
                  style={{
                    position: 'absolute',
                    left: handleX,
                    top: handleY,
                    width: 20 / viewport.zoom,
                    height: 20 / viewport.zoom,
                    marginLeft: -10 / viewport.zoom,
                    marginTop: -10 / viewport.zoom,
                    borderRadius: '50%',
                    pointerEvents: 'auto',
                    cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 12 12, grab',
                    zIndex: 1000
                  }}
                />
              );
            })}
          </>
        )}
      </>
    );
  }

  if (element.type === 'wall') {
    const wallElement = element as WallElement;
    
    // Determine if we have segments or single vertices
    const hasSegments = wallElement.segments && wallElement.segments.length > 0;
    const allVertices = hasSegments 
      ? wallElement.segments!.flat()
      : wallElement.vertices || [];
    
    if (allVertices.length < 2) {
      return null; // Invalid wall
    }
    
    // Calculate bounding box from all vertices
    const xs = allVertices.map(v => v.x);
    const ys = allVertices.map(v => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const width = maxX - minX + wallElement.wallThickness * 2;
    const height = maxY - minY + wallElement.wallThickness * 2;
    
    const wallPatternId = `wall-pattern-${element.id}`;
    const transparentTiles = wallElement.transparentTiles || new Set<string>();
    
    // Create paths for each segment, broken into tiles with transparency support
    const segments = hasSegments ? wallElement.segments! : [wallElement.vertices || []];
    const tileSize = wallElement.wallTileSize || 50;
    
    // Render wall as individual tile segments (respecting transparent tiles)
    const tileSegments: JSX.Element[] = [];
    
    segments.forEach((segmentVertices, segIdx) => {
      for (let i = 0; i < segmentVertices.length - 1; i++) {
        const v1 = segmentVertices[i];
        const v2 = segmentVertices[i + 1];
        
        // Calculate segment length and direction
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        const numTiles = Math.ceil(segmentLength / tileSize);
        
        // Render each tile along this segment
        for (let t = 0; t < numTiles; t++) {
          const t1 = t / numTiles;
          const t2 = Math.min((t + 1) / numTiles, 1);
          
          const tileX1 = v1.x + dx * t1;
          const tileY1 = v1.y + dy * t1;
          const tileX2 = v1.x + dx * t2;
          const tileY2 = v1.y + dy * t2;
          
          // Check if this tile should be transparent (door/opening)
          const tileCenterX = (tileX1 + tileX2) / 2;
          const tileCenterY = (tileY1 + tileY2) / 2;
          const tileKey = `${Math.floor(tileCenterX / tileSize)},${Math.floor(tileCenterY / tileSize)}`;
          
          if (transparentTiles.has(tileKey)) {
            continue; // Skip transparent tiles (doors/openings)
          }
          
          // Render this tile segment
          const relX1 = tileX1 - minX + wallElement.wallThickness;
          const relY1 = tileY1 - minY + wallElement.wallThickness;
          const relX2 = tileX2 - minX + wallElement.wallThickness;
          const relY2 = tileY2 - minY + wallElement.wallThickness;
          
          tileSegments.push(
            <line
              key={`seg-${segIdx}-${i}-${t}`}
              x1={relX1}
              y1={relY1}
              x2={relX2}
              y2={relY2}
              stroke={wallElement.wallTextureUrl ? `url(#${wallPatternId})` : '#8b5cf6'}
              strokeWidth={wallElement.wallThickness}
              strokeLinecap="square"
            />
          );
        }
      }
    });
    
    return (
      <>
        <svg
          key={element.id}
          style={{
            position: 'absolute',
            left: minX - wallElement.wallThickness,
            top: minY - wallElement.wallThickness,
            width,
            height,
            pointerEvents: 'auto',
            overflow: 'visible'
          }}
        >
          <defs>
            {wallElement.wallTextureUrl && (
              <pattern
                id={wallPatternId}
                patternUnits="userSpaceOnUse"
                width={wallElement.wallTileSize}
                height={wallElement.wallTileSize}
              >
                <image
                  href={wallElement.wallTextureUrl}
                  width={wallElement.wallTileSize}
                  height={wallElement.wallTileSize}
                />
              </pattern>
            )}
          </defs>
          
          {/* Render wall as individual tile segments */}
          {tileSegments}
        </svg>
        
        {/* Selection indicator */}
        {isSelected && (
          <svg
            style={{
              position: 'absolute',
              left: minX - wallElement.wallThickness,
              top: minY - wallElement.wallThickness,
              width,
              height,
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            {/* Selection outline - render full path */}
            {segments.map((segmentVertices, segIdx) => {
              const relativeVertices = segmentVertices.map(v => ({
                x: v.x - minX + wallElement.wallThickness,
                y: v.y - minY + wallElement.wallThickness
              }));
              const pathD = relativeVertices.map((v, i) => 
                `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
              ).join(' ');
              
              return (
                <path
                  key={`outline-${segIdx}`}
                  d={pathD}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={(wallElement.wallThickness + 4) / viewport.zoom}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  opacity={0.5}
                />
              );
            })}
            
            {/* Vertex handles for all segments */}
            {allVertices.map((v, i) => (
              <circle
                key={`vertex-${i}`}
                cx={v.x - minX + wallElement.wallThickness}
                cy={v.y - minY + wallElement.wallThickness}
                r={6 / viewport.zoom}
                fill="#22c55e"
                stroke="#ffffff"
                strokeWidth={2 / viewport.zoom}
              />
            ))}
          </svg>
        )}
      </>
    );
  }

  return null;
};

export default Canvas;
