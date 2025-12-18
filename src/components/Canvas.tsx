import { useRef, useState, useEffect } from 'react';
import { Scene, MapElement, AnnotationElement, TokenElement, RoomElement, WallElement, ModularRoomElement, ToolType, IconType, ColorType, TokenTemplate, RoomSubTool, Point, TerrainTile, TerrainStamp, TerrainShapeMode, ViewMode, WallOpening, WallGroup } from '../types';
import { Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark, Footprints, Info, Gamepad2, StopCircle } from 'lucide-react';
import Toolbox from './toolbox/Toolbox';
import polygonClipping from 'polygon-clipping';
import ModularRoomRenderer from './canvas/ModularRoomRenderer';
import ModularRoomContextMenu from './canvas/ModularRoomContextMenu';
import {
  MODULAR_TILE_PX,
} from '../constants';
import {
  getModularRooms,
  generateModularRoomId,
  generateWallGroupId,
  getRoomPixelRect,
  createDoorsForNewRoom,
  recalculateAllDoors,
  findMagneticSnapPosition,
  getWallSpriteUrl,
  getPillarSpriteUrl,
  roomsOverlapPx,
  checkGroupSplitAfterRemoval,
  generateSplitUpdates,
  findAdjacentGroups,
  generateMergeUpdates,
  areRoomsAdjacent,
} from '../utils/modularRooms';

// Helper function to create rounded polygon path (for room shapes)
// Uses quadratic bezier curves at corners for smooth rounding
const createRoundedPolygonPath = (vertices: { x: number; y: number }[], cornerRadius: number = 8): string => {
  if (!vertices || vertices.length < 3) return '';
  
  // Filter out any invalid vertices and check for NaN
  const validVertices = vertices.filter(v => 
    v && typeof v.x === 'number' && typeof v.y === 'number' && 
    !isNaN(v.x) && !isNaN(v.y) && isFinite(v.x) && isFinite(v.y)
  );
  
  if (validVertices.length < 3) {
    // Fallback to simple polygon path if not enough valid vertices
    return vertices.map((v, i) => 
      `${i === 0 ? 'M' : 'L'} ${v?.x || 0},${v?.y || 0}`
    ).join(' ') + ' Z';
  }
  
  const n = validVertices.length;
  let path = '';
  
  for (let i = 0; i < n; i++) {
    const prev = validVertices[(i - 1 + n) % n];
    const curr = validVertices[i];
    const next = validVertices[(i + 1) % n];
    
    // Calculate vectors to previous and next vertices
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    
    // Calculate distances
    const distToPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
    const distToNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
    
    // Skip if distances are too small (would cause NaN)
    if (distToPrev < 0.001 || distToNext < 0.001) {
      if (i === 0) {
        path = `M ${curr.x},${curr.y}`;
      } else {
        path += ` L ${curr.x},${curr.y}`;
      }
      continue;
    }
    
    // Limit radius to half the shortest edge
    const maxRadius = Math.min(distToPrev, distToNext) / 2;
    const radius = Math.min(cornerRadius, maxRadius);
    
    // Calculate points where the curve starts and ends
    const startPoint = {
      x: curr.x + (toPrev.x / distToPrev) * radius,
      y: curr.y + (toPrev.y / distToPrev) * radius
    };
    const endPoint = {
      x: curr.x + (toNext.x / distToNext) * radius,
      y: curr.y + (toNext.y / distToNext) * radius
    };
    
    // Validate calculated points
    if (isNaN(startPoint.x) || isNaN(startPoint.y) || isNaN(endPoint.x) || isNaN(endPoint.y)) {
      if (i === 0) {
        path = `M ${curr.x},${curr.y}`;
      } else {
        path += ` L ${curr.x},${curr.y}`;
      }
      continue;
    }
    
    if (i === 0) {
      // Move to start point of first corner
      path = `M ${startPoint.x},${startPoint.y}`;
    } else {
      // Line to start of this corner
      path += ` L ${startPoint.x},${startPoint.y}`;
    }
    
    // Quadratic bezier curve through the corner point
    path += ` Q ${curr.x},${curr.y} ${endPoint.x},${endPoint.y}`;
  }
  
  // Close the path with a line to the start
  path += ' Z';
  
  return path;
};

// Helper function to check if two line segments intersect
const segmentsIntersect = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean => {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false; // parallel
  
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

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
  autoMergeRooms?: boolean;
  setAutoMergeRooms?: (value: boolean) => void;
  defaultCornerRadius?: number;
  onMergeRooms?: (handler: () => void) => void;
  onMergeWalls?: (handler: () => void) => void;
  onCenterElementReady?: (centerFn: (elementId: string) => void) => void;
  onHideToolPreviewReady?: (hideFn: () => void) => void;
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
  initialViewport?: { x: number; y: number; zoom: number };
  // Modular rooms
  placingModularFloor?: {
    floorStyleId: string;
    tilesW: number;
    tilesH: number;
    imageUrl: string;
  } | null;
  setPlacingModularFloor?: (floor: {
    floorStyleId: string;
    tilesW: number;
    tilesH: number;
    imageUrl: string;
  } | null) => void;
  defaultWallStyleId?: string;
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
  autoMergeRooms = false,
  setAutoMergeRooms,
  defaultCornerRadius = 1,
  onMergeRooms,
  onMergeWalls,
  onCenterElementReady,
  onHideToolPreviewReady,
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
  onViewportChange,
  initialViewport,
  placingModularFloor,
  setPlacingModularFloor,
  defaultWallStyleId = 'worn-castle',
}: CanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Tile-based terrain system
  const TILE_SIZE = 2000; // Each tile is 2000×2000 px
  const [terrainTiles, setTerrainTiles] = useState<Map<string, TerrainTile>>(new Map());
  const tileCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const hasActivatedSceneRef = useRef(false); // Track if we've activated auto-created scene
  const isFillingShapeRef = useRef(false); // Track if we're currently filling a shape (prevents clearing tiles during activation)
  
  const [viewport, setViewport] = useState(initialViewport || { x: 0, y: 0, zoom: 1 });
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
  const [modularSelectionBox, setModularSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
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
  const [selectedVertex, setSelectedVertex] = useState<{ id: string; vertexIndex: number; holeIndex?: number } | null>(null);
  const [isPaintingBackground, setIsPaintingBackground] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [lastClickedElement, setLastClickedElement] = useState<string | null>(null);
  const [fitToViewLocked, setFitToViewLocked] = useState(false);
  const [zoomLimitError, setZoomLimitError] = useState(false);
  const [canvasInfiniteError, setCanvasInfiniteError] = useState(false);
  // Pending modular room drag - waiting for mouse movement to start actual drag
  const [pendingModularRoomDrag, setPendingModularRoomDrag] = useState<{
    roomId: string;
    startX: number;
    startY: number;
  } | null>(null);
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
  const [gridSize, setGridSize] = useState(20);
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

  // Interior wall drawing state (ALT + click on room edge)
  const [interiorWallStart, setInteriorWallStart] = useState<{ x: number; y: number; roomId: string; edgeIndex: number } | null>(null);
  const [interiorWallPreview, setInteriorWallPreview] = useState<{ x: number; y: number } | null>(null);
  const interiorWallPreviewRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredRoomEdge, setHoveredRoomEdge] = useState<{ roomId: string; edgeIndex: number; point: { x: number; y: number } } | null>(null);

  // Undo/Redo state
  const [history, setHistory] = useState<{ elements: MapElement[]; terrainTiles?: { [key: string]: TerrainTile } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyInitialized, setHistoryInitialized] = useState(false);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<MapElement[]>([]);

  // Modular Rooms state - now using pixels for free movement with magnetic snap
  const [modularRoomDragPreview, setModularRoomDragPreview] = useState<{
    roomId: string;
    originalPosition: { x: number; y: number };  // Pixels
    ghostPosition: { x: number; y: number };     // Pixels (snapped or free)
    cursorPosition: { x: number; y: number };    // Pixels (raw cursor)
    snappedToRoom: string | null;  // ID of room we snapped to
    sharedEdgeTiles: number;       // How many tiles shared (0 if free)
  } | null>(null);
  // Note: placingModularFloor is now passed as a prop from App.tsx

  // Rotate modular room by 90 degrees (swaps dimensions)
  const handleRotateModularRoom = (roomId: string, direction: 'left' | 'right') => {
    if (!scene || !activeSceneId) return;
    
    const room = scene.elements.find(el => el.id === roomId) as ModularRoomElement | undefined;
    if (!room) return;
    
    saveToHistory();
    
    // Calculate new rotation (0, 90, 180, 270)
    const currentRotation = room.rotation || 0;
    const delta = direction === 'right' ? 90 : -90;
    let newRotation = (currentRotation + delta) % 360;
    if (newRotation < 0) newRotation += 360;
    
    // Swap dimensions - 2x4 becomes 4x2
    const newTilesW = room.tilesH;
    const newTilesH = room.tilesW;
    
    // Adjust position to keep room centered (with tile alignment)
    const oldCenterX = room.x + (room.tilesW * MODULAR_TILE_PX) / 2;
    const oldCenterY = room.y + (room.tilesH * MODULAR_TILE_PX) / 2;
    let newX = oldCenterX - (newTilesW * MODULAR_TILE_PX) / 2;
    let newY = oldCenterY - (newTilesH * MODULAR_TILE_PX) / 2;
    
    // Snap to tile grid
    newX = Math.round(newX / MODULAR_TILE_PX) * MODULAR_TILE_PX;
    newY = Math.round(newY / MODULAR_TILE_PX) * MODULAR_TILE_PX;
    
    // Check for overlap with other rooms
    const otherRooms = getModularRooms(scene.elements).filter(r => r.id !== roomId);
    const newWidthPx = newTilesW * MODULAR_TILE_PX;
    const newHeightPx = newTilesH * MODULAR_TILE_PX;
    
    const hasOverlap = otherRooms.some(other => {
      const otherRect = {
        x: other.x,
        y: other.y,
        w: other.tilesW * MODULAR_TILE_PX,
        h: other.tilesH * MODULAR_TILE_PX,
      };
      return roomsOverlapPx({ x: newX, y: newY, w: newWidthPx, h: newHeightPx }, otherRect);
    });
    
    // If overlap, try to find a valid position by shifting the room
    if (hasOverlap) {
      // Try shifting in each direction by 1 tile at a time, up to the dimension difference
      const shiftAmount = Math.abs(newTilesW - newTilesH) * MODULAR_TILE_PX;
      const shifts = [
        { dx: shiftAmount, dy: 0 },    // Right
        { dx: -shiftAmount, dy: 0 },   // Left
        { dx: 0, dy: shiftAmount },    // Down
        { dx: 0, dy: -shiftAmount },   // Up
        { dx: shiftAmount / 2, dy: 0 },
        { dx: -shiftAmount / 2, dy: 0 },
        { dx: 0, dy: shiftAmount / 2 },
        { dx: 0, dy: -shiftAmount / 2 },
      ];
      
      let foundValid = false;
      for (const shift of shifts) {
        const testX = Math.round((newX + shift.dx) / MODULAR_TILE_PX) * MODULAR_TILE_PX;
        const testY = Math.round((newY + shift.dy) / MODULAR_TILE_PX) * MODULAR_TILE_PX;
        
        const stillOverlaps = otherRooms.some(other => {
          const otherRect = {
            x: other.x,
            y: other.y,
            w: other.tilesW * MODULAR_TILE_PX,
            h: other.tilesH * MODULAR_TILE_PX,
          };
          return roomsOverlapPx({ x: testX, y: testY, w: newWidthPx, h: newHeightPx }, otherRect);
        });
        
        if (!stillOverlaps) {
          newX = testX;
          newY = testY;
          foundValid = true;
          break;
        }
      }
      
      if (!foundValid) {
        // Still overlapping after all attempts - don't rotate
        console.warn('[handleRotateModularRoom] Cannot rotate - would overlap with other rooms');
        return;
      }
    }
    
    updateElement(roomId, {
      rotation: newRotation,
      tilesW: newTilesW,
      tilesH: newTilesH,
      x: newX,
      y: newY,
    });
  };

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

  // Clear selected vertex when element is deselected or changed
  useEffect(() => {
    if (selectedVertex && selectedVertex.id !== selectedElementId) {
      setSelectedVertex(null);
    }
  }, [selectedElementId, selectedVertex]);

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

  // Sync viewport with initialViewport from parent (e.g., when restored from saved settings)
  useEffect(() => {
    if (initialViewport && !hasInitializedViewport) {
      setViewport(initialViewport);
      setHasInitializedViewport(true);
    }
  }, [initialViewport, hasInitializedViewport]);

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

  // Initialize history when scene loads (save initial state)
  useEffect(() => {
    if (scene && !historyInitialized) {
      const tilesToSave = scene.terrainTiles ? JSON.parse(JSON.stringify(scene.terrainTiles)) : undefined;
      setHistory([{ 
        elements: JSON.parse(JSON.stringify(scene.elements)),
        terrainTiles: tilesToSave
      }]);
      setHistoryIndex(0);
      setHistoryInitialized(true);
    }
  }, [scene?.id, historyInitialized]);

  // Reset history initialization flag when scene changes
  useEffect(() => {
    setHistoryInitialized(false);
  }, [scene?.id]);

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

  // Expose hide tool preview function to parent (for use by side panels)
  useEffect(() => {
    if (onHideToolPreviewReady) {
      onHideToolPreviewReady(() => setCursorPosition(null));
    }
  }, [onHideToolPreviewReady]);

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

  // Recalculate modular room doors when room positions change or scene loads
  // This useEffect watches modular room positions and recalculates doors automatically
  useEffect(() => {
    if (!scene || !activeSceneId) return;
    
    const modularRooms = getModularRooms(scene.elements);
    if (modularRooms.length === 0) return;
    
    // Recalculate all doors based on current room positions
    const newDoors = recalculateAllDoors(modularRooms);
    const currentDoors = scene.modularRoomsState?.doors || [];
    
    // Always update doors on initial load (when currentDoors is empty but should have doors)
    // or when doors have actually changed
    const doorsAreMissing = currentDoors.length === 0 && newDoors.length > 0;
    
    // Check if doors have changed (compare by checking edge positions)
    const doorsChanged = doorsAreMissing || newDoors.length !== currentDoors.length ||
      newDoors.some((newDoor) => {
        const oldDoor = currentDoors.find(d => 
          (d.roomAId === newDoor.roomAId && d.roomBId === newDoor.roomBId) ||
          (d.roomAId === newDoor.roomBId && d.roomBId === newDoor.roomAId)
        );
        if (!oldDoor) return true; // New door pair
        // Check if edge position changed
        return oldDoor.edgePosition !== newDoor.edgePosition ||
               oldDoor.edgeRangeStart !== newDoor.edgeRangeStart ||
               oldDoor.edgeRangeEnd !== newDoor.edgeRangeEnd;
      });
    
    if (doorsChanged) {
      console.log('[MODULAR ROOMS] Doors recalculated:', newDoors.length, 'doors (missing:', doorsAreMissing, ')');
      const updatedState = {
        wallGroups: scene.modularRoomsState?.wallGroups || [],
        doors: newDoors,
      };
      updateScene(activeSceneId, { modularRoomsState: updatedState });
    }
  }, [
    // Re-run when scene changes or modular room positions change
    activeSceneId,
    scene?.id, // Also re-run when scene itself changes (e.g., after load from database)
    // Create a stable dependency by stringifying positions (now using x,y pixels)
    scene?.elements
      .filter((el): el is ModularRoomElement => el.type === 'modularRoom')
      .map(r => `${r.id}:${r.x},${r.y}`)
      .join('|'),
    // Also include current doors count to detect when doors are missing after reload
    scene?.modularRoomsState?.doors?.length ?? 0
  ]);

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
  // Check DOM directly for immediate response
  const isTextInputFocused = (): boolean => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    
    const tagName = activeEl.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      activeEl.hasAttribute('contenteditable') ||
      activeEl.getAttribute('contenteditable') === 'true' ||
      activeEl.getAttribute('role') === 'textbox' ||
      activeEl.classList.contains('ProseMirror')
    );
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
    if (!scene || !activeSceneId) return;
    
    const idsToDelete = selectedElementIds.length > 0 ? selectedElementIds : selectedElementId ? [selectedElementId] : [];
    if (idsToDelete.length === 0) return;
    
    saveToHistory();
    
    // Check for modular room group splits before deletion
    const modularRoomsToDelete = idsToDelete.filter(id => {
      const el = scene.elements.find(e => e.id === id);
      return el?.type === 'modularRoom';
    });
    
    // Start with elements after deletion
    let updatedElements = scene.elements.filter(e => !idsToDelete.includes(e.id));
    let updatedWallGroups = scene.modularRoomsState?.wallGroups || [];
    
    if (modularRoomsToDelete.length > 0) {
      const allRooms = getModularRooms(scene.elements);
      const wallGroups = scene.modularRoomsState?.wallGroups || [];
      
      // Collect all split updates
      const allRoomUpdates: { roomId: string; newWallGroupId: string }[] = [];
      const allNewWallGroups: WallGroup[] = [];
      const groupsToUpdate: WallGroup[] = []; // Groups that need roomCount updated
      const processedGroups = new Set<string>();
      
      for (const roomId of modularRoomsToDelete) {
        const room = allRooms.find(r => r.id === roomId);
        if (!room?.wallGroupId || processedGroups.has(room.wallGroupId)) continue;
        
        processedGroups.add(room.wallGroupId);
        
        const splitResult = checkGroupSplitAfterRemoval(allRooms, roomId);
        console.log('[handleDelete] Split result for room', roomId.slice(-8), ':', splitResult.needsSplit, 'components:', splitResult.components.length);
        
        if (splitResult.needsSplit) {
          const updates = generateSplitUpdates(
            splitResult.components,
            room.wallGroupId,
            wallGroups
          );
          console.log('[handleDelete] Split updates:', updates.roomUpdates.length, 'rooms,', updates.newWallGroups.length, 'new groups');
          allRoomUpdates.push(...updates.roomUpdates);
          allNewWallGroups.push(...updates.newWallGroups);
          if (updates.updatedOriginalGroup) {
            groupsToUpdate.push(updates.updatedOriginalGroup);
          }
        } else {
          // No split, just decrement roomCount for the group
          const group = wallGroups.find(g => g.id === room.wallGroupId);
          if (group) {
            groupsToUpdate.push({ ...group, roomCount: Math.max(0, (group.roomCount || 1) - 1) });
          }
        }
      }
      
      // Apply room updates to elements
      if (allRoomUpdates.length > 0) {
        console.log('[handleDelete] Applying', allRoomUpdates.length, 'room updates');
        updatedElements = updatedElements.map(el => {
          const update = allRoomUpdates.find(u => u.roomId === el.id);
          if (update) {
            console.log('[handleDelete] Updating room', el.id.slice(-8), '-> group:', update.newWallGroupId.slice(-8));
            return { ...el, wallGroupId: update.newWallGroupId } as MapElement;
          }
          return el;
        });
      }
      
      // Build updated wall groups: start with existing, apply updates, add new
      if (groupsToUpdate.length > 0 || allNewWallGroups.length > 0) {
        updatedWallGroups = wallGroups.map(g => {
          const updated = groupsToUpdate.find(u => u.id === g.id);
          return updated || g;
        });
        updatedWallGroups = [...updatedWallGroups, ...allNewWallGroups];
      }
    }
    
    // Recalculate doors after deletion
    const remainingRooms = getModularRooms(updatedElements);
    const newDoors = recalculateAllDoors(remainingRooms);
    
    // Do everything in ONE updateScene call to prevent overwrites
    updateScene(activeSceneId, {
      elements: updatedElements,
      modularRoomsState: {
        ...scene.modularRoomsState,
        wallGroups: updatedWallGroups,
        doors: newDoors,
      }
    });
    
    setSelectedElementId(null);
    setSelectedElementIds([]);
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
      cornerRadius: defaultCornerRadius,
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

    // Save to history BEFORE merging
    saveToHistory();

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

    // Save to history BEFORE merging
    saveToHistory();

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

        // Check if any selected element is locked
        const lockedElements = selectedIds
          .map(id => scene.elements.find(el => el.id === id))
          .filter(el => el && el.locked);
        
        if (lockedElements.length > 0) {
          // Show error message
          const elementName = lockedElements[0]!.type === 'token' 
            ? lockedElements[0]!.name 
            : lockedElements[0]!.type === 'room'
            ? (lockedElements[0] as any).name || 'Room'
            : 'Element';
          setLockedElementError(`"${elementName}" is locked. Unlock before moving.`);
          setTimeout(() => setLockedElementError(null), 3000);
          return;
        }

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
        
        // Check if a vertex is selected - delete vertex instead of element
        if (selectedVertex && scene) {
          const element = scene.elements.find(el => el.id === selectedVertex.id) as RoomElement | undefined;
          if (element && element.vertices) {
            saveToHistory();
            
            if (selectedVertex.holeIndex !== undefined) {
              // Delete vertex from hole
              const holes = element.holes ? [...element.holes] : [];
              if (holes[selectedVertex.holeIndex]) {
                const hole = [...holes[selectedVertex.holeIndex]];
                if (hole.length > 3) {
                  hole.splice(selectedVertex.vertexIndex, 1);
                  holes[selectedVertex.holeIndex] = hole;
                  updateElement(element.id, { holes });
                  setSelectedVertex(null);
                  setMergeNotification('Vertex deleted');
                  setTimeout(() => setMergeNotification(null), 1500);
                } else {
                  setMergeNotification('Cannot delete: minimum 3 vertices required');
                  setTimeout(() => setMergeNotification(null), 2000);
                }
              }
            } else {
              // Delete vertex from main polygon
              if (element.vertices.length > 3) {
                const newVertices = [...element.vertices];
                newVertices.splice(selectedVertex.vertexIndex, 1);
                updateElement(element.id, { vertices: newVertices });
                setSelectedVertex(null);
                setMergeNotification('Vertex deleted');
                setTimeout(() => setMergeNotification(null), 1500);
              } else {
                setMergeNotification('Cannot delete: minimum 3 vertices required');
                setTimeout(() => setMergeNotification(null), 2000);
              }
            }
            return;
          }
        }
        
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
    try {
      console.log('[WALL CUTTER RECT] Starting rectangle cut operation');
      if (!scene || !wallCutterToolStart || !wallCutterToolEnd) return;
      
      const minX = Math.min(wallCutterToolStart.x, wallCutterToolEnd.x);
      const maxX = Math.max(wallCutterToolStart.x, wallCutterToolEnd.x);
      const minY = Math.min(wallCutterToolStart.y, wallCutterToolEnd.y);
      const maxY = Math.max(wallCutterToolStart.y, wallCutterToolEnd.y);
      
      // Guard: Validate bounds are finite numbers
      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        console.warn('[WALL CUTTER RECT] Invalid bounds detected, aborting');
        return;
      }
      
      // Guard: Selection must have minimum size
      const selectionWidth = maxX - minX;
      const selectionHeight = maxY - minY;
      if (selectionWidth < 1 || selectionHeight < 1) {
        console.log('[WALL CUTTER RECT] Selection too small, aborting');
        return;
      }
      
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
        
        // Handle both single-segment walls and multi-segment polyline walls
        const hasSegments = wall.segments && wall.segments.length > 0;
        const allSegments = hasSegments ? wall.segments! : [wall.vertices];
        
        let wallCut = false;
        const newSegments: Point[][] = [];
        
        // Process each polyline segment
        allSegments.forEach((segmentVertices, segmentIdx) => {
          let currentSegment: Point[] = [];
          
          // Check each line segment within this polyline
          for (let i = 0; i < segmentVertices.length - 1; i++) {
            const p1 = segmentVertices[i];
            const p2 = segmentVertices[i + 1];
            
            const intersection = lineIntersectsRect(p1, p2);
            
            if (intersection && intersection.end - intersection.start > 0.01) {
              console.log('[WALL CUTTER RECT] Cutting wall:', wall.id, 'segment:', segmentIdx, 'line:', i, 'intersection:', intersection);
              wallCut = true;
              
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              
              // Add vertices before intersection to current segment
              if (currentSegment.length === 0) {
                currentSegment.push(...segmentVertices.slice(0, i + 1));
              }
              
              // Add intersection start point if we're entering the rectangle
              if (intersection.start > 0.01) {
                currentSegment.push({
                  x: p1.x + intersection.start * dx,
                  y: p1.y + intersection.start * dy
                });
              }
              
              // Save segment before cut if it has at least 2 points
              if (currentSegment.length >= 2) {
                newSegments.push([...currentSegment]);
              }
              
              // Start new segment after the cut
              currentSegment = [];
              if (intersection.end < 0.99) {
                currentSegment.push({
                  x: p1.x + intersection.end * dx,
                  y: p1.y + intersection.end * dy
                });
                // Add remaining vertices
                currentSegment.push(...segmentVertices.slice(i + 1));
              }
              
              break; // Only cut once per polyline segment
            } else {
              // No intersection - keep building current segment
              if (currentSegment.length === 0 && i === 0) {
                currentSegment.push(p1);
              }
              if (i === segmentVertices.length - 2) {
                // Last line segment - add both points if we haven't added them yet
                if (currentSegment.length === 0) {
                  currentSegment.push(p1, p2);
                } else {
                  currentSegment.push(p2);
                }
              }
            }
          }
          
          // Save remaining segment if any
          if (currentSegment.length >= 2) {
            newSegments.push([...currentSegment]);
          } else if (!wallCut && segmentVertices.length >= 2) {
            // No cut happened in this segment - keep it as is
            newSegments.push([...segmentVertices]);
          }
        });
        
        if (wallCut) {
          wallsToRemove.push(wall.id);
          
          // Create new wall elements from the remaining segments
          newSegments.forEach((vertices, idx) => {
            if (vertices.length >= 2) {
              const newWall: WallElement = {
                ...wall,
                id: `${wall.id}_split_${Date.now()}_${idx}`,
                vertices: vertices,
                segments: undefined // Single segment walls don't use segments array
              };
              wallsToAdd.push(newWall);
            }
          });
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
        // Guard: Validate all vertices are finite numbers
        const hasValidVertices = newVertices.length >= 3 && 
          newVertices.every(v => Number.isFinite(v.x) && Number.isFinite(v.y));
        
        // Guard: Validate wallOpenings have valid segment indices
        const hasValidOpenings = newWallOpenings.every(o => 
          Number.isFinite(o.segmentIndex) && o.segmentIndex >= 0 && o.segmentIndex < newVertices.length
        );
        
        if (modified && hasValidVertices && hasValidOpenings) {
          roomUpdates.push({
            id: room.id,
            updates: {
              vertices: newVertices,
              wallOpenings: newWallOpenings.filter(o => o.segmentIndex >= 0)
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
            
            // Only keep hole if it still has at least 3 valid vertices
            const hasValidHoleVertices = newHoleVertices.length >= 3 && 
              newHoleVertices.every(v => Number.isFinite(v.x) && Number.isFinite(v.y));
            
            if (hasValidHoleVertices) {
              updatedHoles.push(newHoleVertices);
              if (holeModified) holesModified = true;
            } else if (newHoleVertices.length < 3) {
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
    
    // Apply ALL changes atomically in one operation
    if (roomUpdates.length > 0 || wallsToRemove.length > 0 || wallsToAdd.length > 0) {
      console.log('[WALL CUTTER RECT] Applying atomic update - room updates:', roomUpdates.length, 'walls to remove:', wallsToRemove.length, 'walls to add:', wallsToAdd.length);
      
      // Build complete new elements array with all changes applied
      let newElements = scene.elements.map(el => {
        // Apply room updates
        const roomUpdate = roomUpdates.find(u => u.id === el.id);
        if (roomUpdate && el.type === 'room') {
          return { ...el, ...roomUpdate.updates } as RoomElement;
        }
        return el;
      });
      
      // Remove cut walls
      newElements = newElements.filter(el => !wallsToRemove.includes(el.id));
      
      // Add new wall segments
      newElements.push(...wallsToAdd);
      
      // Apply everything in one atomic update
      if (activeSceneId) {
        updateScene(activeSceneId, { elements: newElements });
      }
      
      console.log('[WALL CUTTER RECT] Atomic update complete - new element count:', newElements.length);
    }
    } catch (error) {
      // Catch any errors to prevent UI crash
      console.error('[WALL CUTTER RECT] Error during wall cut operation:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Clear selected vertex when clicking elsewhere (unless clicking on a vertex)
    // This will be set again if we click on a vertex
    const willClickVertex = hoveringVertex !== null;
    if (!willClickVertex && selectedVertex) {
      setSelectedVertex(null);
    }

    // Interior wall drawing - click on room edge when hovering
    if (hoveredRoomEdge && activeTool === 'room' && !e.ctrlKey) {
      e.preventDefault();
      console.log('[INTERIOR WALL] Starting at:', hoveredRoomEdge.point);
      setInteriorWallStart({
        x: hoveredRoomEdge.point.x,
        y: hoveredRoomEdge.point.y,
        roomId: hoveredRoomEdge.roomId,
        edgeIndex: hoveredRoomEdge.edgeIndex
      });
      setInteriorWallPreview(hoveredRoomEdge.point);
      return;
    }

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
        saveToHistory(); // Save before starting resize
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
          saveToHistory(); // Save before starting rotation
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
          // Use larger detection radius to prioritize existing vertices over edge detection
          const distToVertex = Math.sqrt(
            Math.pow(x - worldX, 2) + Math.pow(y - worldY, 2)
          );
          
          const vertexDetectionRadius = 15 / viewport.zoom; // Larger radius for easier vertex selection
          if (distToVertex < vertexDetectionRadius) {
            if (e.ctrlKey) {
              // CTRL + click on vertex: Move vertex
              saveToHistory(); // Save before moving vertex
              setMovingVertex({ id: element.id, vertexIndex: i });
              setSelectedVertex({ id: element.id, vertexIndex: i });
              return;
            } else {
              // Direct click on vertex: Select vertex (can be deleted with Delete key)
              // Also start scaling in case user drags
              setSelectedVertex({ id: element.id, vertexIndex: i });
              saveToHistory(); // Save before scaling
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
        
        // Check for CTRL + click on edge to add new vertex and start dragging it
        if (e.ctrlKey) {
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
              
              const vertexDetectionRadius = 15 / viewport.zoom;
              if (distToVertex < vertexDetectionRadius) {
                if (e.ctrlKey) {
                  // CTRL + click on hole vertex: Move vertex
                  saveToHistory(); // Save before moving hole vertex
                  setMovingVertex({ id: element.id, vertexIndex, holeIndex });
                  setSelectedVertex({ id: element.id, vertexIndex, holeIndex });
                  return;
                } else {
                  // Direct click on hole vertex: Select vertex (can be deleted with Delete key)
                  setSelectedVertex({ id: element.id, vertexIndex, holeIndex });
                  return;
                }
              }
            }
            
            // Check for CTRL + click on hole edge to add new vertex
            if (e.ctrlKey) {
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
            
            const vertexDetectionRadius = 15 / viewport.zoom;
            if (distToVertex < vertexDetectionRadius) {
              if (e.ctrlKey) {
                // CTRL + click on vertex: Move vertex
                saveToHistory(); // Save before moving wall vertex
                setMovingVertex({ id: element.id, vertexIndex: i, segmentBased: hasSegments });
                return;
              }
            }
          }
          
          // Check for CTRL + click on edge to add new vertex
          if (e.ctrlKey) {
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
        // Ctrl click: Toggle element in multi-selection
        if (e.ctrlKey) {
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
              } else if (el.type === 'modularRoom') {
                // For modular rooms, use pixel position directly
                elX = el.x;
                elY = el.y;
              } else if ('x' in el && 'y' in el) {
                elX = el.x;
                elY = el.y;
              } else {
                return; // Skip this element
              }
              dragOffsets.set(id, { x: x - elX, y: y - elY });
            }
          });
          saveToHistory(); // Save before starting multi-element drag
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
          } else if (clickedElement.type === 'modularRoom') {
            // For modular rooms: use drag-to-pick-up, click-to-drop
            // On pointer down, we just set up pending drag - actual drag starts on move
            const modRoom = clickedElement as ModularRoomElement;
            setPendingModularRoomDrag({
              roomId: modRoom.id,
              startX: x,
              startY: y,
            });
            return; // Don't continue to setDraggedElement
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
          
          saveToHistory(); // Save before starting drag
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
    } else if (effectiveTool === 'modularRoom' && placingModularFloor) {
      // Modular Room placement - free placement with magnetic snap to nearby rooms
      e.preventDefault();
      
      // Calculate room dimensions in pixels
      const roomWidthPx = placingModularFloor.tilesW * MODULAR_TILE_PX;
      const roomHeightPx = placingModularFloor.tilesH * MODULAR_TILE_PX;
      
      // Center the room under the cursor
      let roomX = x - roomWidthPx / 2;
      let roomY = y - roomHeightPx / 2;
      
      // Find existing modular rooms to check for magnetic snap
      const existingModularRooms = getModularRooms(scene.elements);
      
      // Track which room we snapped to (if any) - used for wall group inheritance
      let snappedToRoomId: string | null = null;
      
      // If there are other rooms, try magnetic snap
      if (existingModularRooms.length > 0) {
        // Create a temporary room object for snap calculation
        const tempRoom: ModularRoomElement = {
          id: 'temp',
          type: 'modularRoom',
          x: roomX,
          y: roomY,
          tilesW: placingModularFloor.tilesW,
          tilesH: placingModularFloor.tilesH,
          floorStyleId: placingModularFloor.floorStyleId,
          wallGroupId: 'temp',
        };
        
        const snapResult = findMagneticSnapPosition(tempRoom, roomX, roomY, existingModularRooms, 96);  // Same as preview
        roomX = snapResult.x;
        roomY = snapResult.y;
        snappedToRoomId = snapResult.snappedToRoom;
      }
      
      // Check if final position overlaps with any existing room
      const roomWidthPxFinal = placingModularFloor.tilesW * MODULAR_TILE_PX;
      const roomHeightPxFinal = placingModularFloor.tilesH * MODULAR_TILE_PX;
      const proposedRect = { x: roomX, y: roomY, w: roomWidthPxFinal, h: roomHeightPxFinal };
      
      const hasOverlap = existingModularRooms.some(other => {
        const otherRect = {
          x: other.x,
          y: other.y,
          w: other.tilesW * MODULAR_TILE_PX,
          h: other.tilesH * MODULAR_TILE_PX,
        };
        return roomsOverlapPx(proposedRect, otherRect);
      });
      
      if (hasOverlap) {
        // Show error message and don't place the room
        setMergeNotification('Modular rooms can only be placed in unoccupied space');
        setTimeout(() => setMergeNotification(null), 3000);
        return;
      }
      
      // Generate unique room ID
      const roomId = generateModularRoomId();
      
      // Determine wall group: inherit from snapped room or create new
      let wallGroupId: string;
      let needNewWallGroup = true;
      
      if (snappedToRoomId) {
        // Find the room we snapped to and inherit its wall group
        const snappedRoom = existingModularRooms.find(r => r.id === snappedToRoomId);
        if (snappedRoom && snappedRoom.wallGroupId) {
          wallGroupId = snappedRoom.wallGroupId;
          needNewWallGroup = false;
        } else {
          wallGroupId = generateWallGroupId();
        }
      } else {
        wallGroupId = generateWallGroupId();
      }
      
      // Create the modular room element (now using x/y in pixels)
      const newModularRoom: ModularRoomElement = {
        id: roomId,
        type: 'modularRoom',
        x: roomX,
        y: roomY,
        tilesW: placingModularFloor.tilesW,
        tilesH: placingModularFloor.tilesH,
        floorStyleId: placingModularFloor.floorStyleId,
        wallGroupId: wallGroupId,
        notes: '',
        zIndex: -100, // Below tokens
        visible: true,
        locked: false,
        widgets: [],
      };
      
      // Get current modular rooms state or create new
      const currentState = scene.modularRoomsState || { wallGroups: [], doors: [] };
      
      // Only create a new wall group if this room isn't joining an existing group
      let updatedWallGroups = currentState.wallGroups;
      if (needNewWallGroup) {
        // Create new group with roomCount: 1
        updatedWallGroups = [...currentState.wallGroups, { id: wallGroupId, wallStyleId: defaultWallStyleId, roomCount: 1 }];
      } else {
        // Increment roomCount for the existing group
        updatedWallGroups = currentState.wallGroups.map(g => 
          g.id === wallGroupId ? { ...g, roomCount: (g.roomCount || 0) + 1 } : g
        );
      }
      
      // Create automatic doors for adjacent rooms
      const newDoors = createDoorsForNewRoom(newModularRoom, existingModularRooms, currentState.doors);
      
      // Check if this new room connects multiple different groups (merge needed)
      const adjacentRooms = existingModularRooms.filter(other => areRoomsAdjacent(newModularRoom, other));
      const adjacentGroupIds = [...new Set(adjacentRooms.map(r => r.wallGroupId).filter(Boolean))] as string[];
      
      console.log('[MODULAR ROOM] Adjacent rooms:', adjacentRooms.map(r => r.id.slice(-8)));
      console.log('[MODULAR ROOM] Adjacent group IDs:', adjacentGroupIds.map(id => id.slice(-8)));
      
      // Prepare element updates for merging groups
      let updatedElements = [...scene.elements, newModularRoom];
      
      if (adjacentGroupIds.length > 1) {
        // Multiple groups need to be merged into the primary group (wallGroupId)
        const groupsToMerge = adjacentGroupIds.filter(id => id !== wallGroupId);
        console.log('[MODULAR ROOM] Merging groups:', groupsToMerge.map(id => id.slice(-8)), 'into', wallGroupId.slice(-8));
        
        // Count total rooms that will be in the merged group
        let totalRoomCount = 1; // The new room
        
        // Update all rooms in the groups being merged
        updatedElements = updatedElements.map(el => {
          if (el.type === 'modularRoom') {
            const room = el as ModularRoomElement;
            if (room.wallGroupId === wallGroupId) {
              totalRoomCount++;
              return el;
            }
            if (room.wallGroupId && groupsToMerge.includes(room.wallGroupId)) {
              totalRoomCount++;
              console.log('[MODULAR ROOM] Updating room', el.id.slice(-8), 'from group', room.wallGroupId.slice(-8), 'to', wallGroupId.slice(-8));
              return { ...el, wallGroupId } as MapElement;
            }
          }
          return el;
        });
        
        // Remove the merged groups from wallGroups and update the primary group's roomCount
        updatedWallGroups = updatedWallGroups
          .filter(g => !groupsToMerge.includes(g.id))
          .map(g => g.id === wallGroupId ? { ...g, roomCount: totalRoomCount } : g);
        
        console.log('[MODULAR ROOM] After merge - total room count:', totalRoomCount);
      }
      
      const updatedState = {
        wallGroups: updatedWallGroups,
        doors: [...currentState.doors, ...newDoors],
      };
      
      // Save to history before adding
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
      
      // Do everything in ONE updateScene call to prevent overwrites
      if (activeSceneId) {
        updateScene(activeSceneId, { 
          elements: updatedElements,
          modularRoomsState: updatedState 
        });
      }
      
      // Select the new room
      setSelectedElementId(roomId);
      setSelectedElementIds([]);
      
      // Clear placement mode - user must go back to panel to place another room
      if (setPlacingModularFloor) {
        setPlacingModularFloor(null);
      }
      setCursorPosition(null);
      
      console.log('[MODULAR ROOM] Placed floor:', newModularRoom);
      console.log('[MODULAR ROOM] Created wall group ID:', wallGroupId);
      if (newDoors.length > 0) {
        console.log('[MODULAR ROOM] Auto-created doors:', newDoors);
      }
      
      return; // Don't continue to other tool handling
    } else if (effectiveTool === 'modularRoom' && !placingModularFloor) {
      // Modular Room tool - click-to-pickup, click-to-drop behavior
      
      // If we're already carrying a room, this click drops it
      if (modularRoomDragPreview) {
        const { roomId, ghostPosition, originalPosition } = modularRoomDragPreview;
        
        const room = scene.elements.find(el => el.id === roomId) as ModularRoomElement | undefined;
        if (!room) {
          setModularRoomDragPreview(null);
          return;
        }
        
        // Only update if position actually changed
        if (ghostPosition.x !== originalPosition.x || ghostPosition.y !== originalPosition.y) {
          // Check if final position overlaps with any existing room (excluding the one being moved)
          const roomWidthPx = room.tilesW * MODULAR_TILE_PX;
          const roomHeightPx = room.tilesH * MODULAR_TILE_PX;
          const proposedRect = { x: ghostPosition.x, y: ghostPosition.y, w: roomWidthPx, h: roomHeightPx };
          
          const existingModularRooms = getModularRooms(scene.elements).filter(r => r.id !== roomId);
          const hasOverlap = existingModularRooms.some(other => {
            const otherRect = {
              x: other.x,
              y: other.y,
              w: other.tilesW * MODULAR_TILE_PX,
              h: other.tilesH * MODULAR_TILE_PX,
            };
            return roomsOverlapPx(proposedRect, otherRect);
          });
          
          if (hasOverlap) {
            // Show error message but STAY in placement mode - don't drop the room
            setMergeNotification('Modular rooms can only be placed in unoccupied space');
            setTimeout(() => setMergeNotification(null), 3000);
            // Keep modularRoomDragPreview active - user can try another position
            return;
          }
          
          // Create a temporary room at new position to check adjacencies
          const tempRoom = { ...room, x: ghostPosition.x, y: ghostPosition.y };
          const allRooms = getModularRooms(scene.elements);
          const allRoomsWithNewPosition = allRooms.map(r => r.id === roomId ? tempRoom : r);
          
          console.log('[Canvas modularRoom] Moving room', roomId.slice(-8), 'from', room.x, room.y, 'to', ghostPosition.x, ghostPosition.y);
          console.log('[Canvas modularRoom] allRooms for split check:', allRooms.map(r => ({
            id: r.id.slice(-8),
            groupId: r.wallGroupId?.slice(-8),
            x: Math.round(r.x),
            y: Math.round(r.y)
          })));
          
          // Find all groups this room would be adjacent to at NEW position
          const adjacentGroupIds = findAdjacentGroups(tempRoom, allRoomsWithNewPosition);
          
          let newWallGroupId: string | undefined = room.wallGroupId;
          let wallGroupsToUpdate = scene.modularRoomsState?.wallGroups || [];
          const roomUpdatesToApply: { roomId: string; newWallGroupId: string }[] = [];
          
          // STEP 1: Check if moving this room splits its original group
          // We need to check this using the ORIGINAL positions (not the new position)
          if (room.wallGroupId) {
            const splitResult = checkGroupSplitAfterRemoval(allRooms, roomId);
            if (splitResult.needsSplit) {
              const splitUpdates = generateSplitUpdates(
                splitResult.components,
                room.wallGroupId,
                wallGroupsToUpdate
              );
              
              // Apply split updates to rooms (except the moving room)
              for (const update of splitUpdates.roomUpdates) {
                if (update.roomId !== roomId) {
                  roomUpdatesToApply.push(update);
                }
              }
              
              // Add new groups and update original group's roomCount
              wallGroupsToUpdate = [
                ...wallGroupsToUpdate
                  .filter(g => g.id !== room.wallGroupId)
                  .concat(splitUpdates.updatedOriginalGroup ? [splitUpdates.updatedOriginalGroup] : []),
                ...splitUpdates.newWallGroups
              ];
              
              // The moving room no longer belongs to any group (it will find a new one below)
              newWallGroupId = undefined;
            } else {
              // No split, but room is leaving - decrement old group's roomCount
              wallGroupsToUpdate = wallGroupsToUpdate.map(g => {
                if (g.id === room.wallGroupId) {
                  return { ...g, roomCount: Math.max(0, (g.roomCount || 1) - 1) };
                }
                return g;
              });
              // Room is leaving this group
              newWallGroupId = undefined;
            }
          }
          
          // STEP 2: Check merge/join at new position
          if (adjacentGroupIds.length > 1) {
            // Multiple groups - need to merge
            const mergeResult = generateMergeUpdates(
              tempRoom,
              adjacentGroupIds,
              allRoomsWithNewPosition,
              wallGroupsToUpdate
            );
            
            if (mergeResult) {
              newWallGroupId = mergeResult.updatedDominantGroup.id;
              roomUpdatesToApply.push(...mergeResult.roomUpdates);
              // Remove merged groups and update dominant group
              wallGroupsToUpdate = wallGroupsToUpdate
                .filter(g => !mergeResult.groupsToRemove.includes(g.id))
                .map(g => g.id === mergeResult.updatedDominantGroup.id ? mergeResult.updatedDominantGroup : g);
            }
          } else if (adjacentGroupIds.length === 1) {
            // Single adjacent group - adopt it and increment roomCount
            // (decrement of old group already done in STEP 1)
            newWallGroupId = adjacentGroupIds[0];
            wallGroupsToUpdate = wallGroupsToUpdate.map(g => {
              if (g.id === adjacentGroupIds[0]) {
                return { ...g, roomCount: (g.roomCount || 0) + 1 };
              }
              return g;
            });
          } else if (adjacentGroupIds.length === 0) {
            // No adjacent groups - create a new group for this room
            // Preserve the wall style from the room's original group
            const originalGroup = (scene.modularRoomsState?.wallGroups || []).find(g => g.id === room.wallGroupId);
            const preservedWallStyle = originalGroup?.wallStyleId || 'worn-castle';
            
            const newGroupId = generateWallGroupId();
            const newGroup: WallGroup = {
              id: newGroupId,
              wallStyleId: preservedWallStyle,
              roomCount: 1,
            };
            newWallGroupId = newGroupId;
            wallGroupsToUpdate = [...wallGroupsToUpdate, newGroup];
          }
          
          // Build element updates map for all rooms that need wallGroupId changes
          console.log('[Canvas modularRoom] roomUpdatesToApply:', roomUpdatesToApply);
          const elementUpdatesMap = new Map<string, Partial<MapElement>>();
          
          // Add updates for rooms affected by split/merge
          for (const update of roomUpdatesToApply) {
            if (update.roomId !== roomId) {
              console.log('[Canvas modularRoom] Queueing room update:', update.roomId.slice(-8), '-> group:', update.newWallGroupId.slice(-8));
              elementUpdatesMap.set(update.roomId, { wallGroupId: update.newWallGroupId });
            }
          }
          
          // Add update for the moved room itself
          elementUpdatesMap.set(roomId, {
            x: ghostPosition.x,
            y: ghostPosition.y,
            ...(newWallGroupId !== room.wallGroupId ? { wallGroupId: newWallGroupId } : {}),
          });
          
          // Log final state
          console.log('[Canvas modularRoom STEP 3] wallGroupsToUpdate:', wallGroupsToUpdate);
          console.log('[Canvas modularRoom STEP 3] newWallGroupId:', newWallGroupId);
          console.log('[Canvas modularRoom STEP 3] elementUpdatesMap size:', elementUpdatesMap.size);
          
          // Apply all element updates to get updated elements array
          const updatedElements = scene.elements.map(el => {
            const updates = elementUpdatesMap.get(el.id);
            if (updates) {
              console.log('[Canvas modularRoom] Applying update to element:', el.id.slice(-8), updates);
              return { ...el, ...updates } as MapElement;
            }
            return el;
          });
          
          // Recalculate doors with updated rooms (including wallGroupId changes)
          const updatedRooms = getModularRooms(updatedElements);
          const newDoors = recalculateAllDoors(updatedRooms);
          
          // Update BOTH elements AND modularRoomsState in ONE call to prevent overwrites
          updateScene(activeSceneId!, {
            elements: updatedElements,
            modularRoomsState: {
              ...scene.modularRoomsState,
              wallGroups: wallGroupsToUpdate,
              doors: newDoors,
            }
          });
        }
        
        setModularRoomDragPreview(null);
        return;
      }
      
      // Not carrying a room - check if clicking on a modular room
      if (clickedElement && clickedElement.type === 'modularRoom') {
        const modRoom = clickedElement as ModularRoomElement;
        
        // Select the room and prepare for potential drag
        setSelectedElementId(modRoom.id);
        setSelectedElementIds([]);
        
        // Set pending drag - actual drag starts on mousemove
        setPendingModularRoomDrag({
          roomId: modRoom.id,
          startX: x,
          startY: y,
        });
        
        return;
      } else if (clickedElement) {
        // Clicked on a non-modular element - just select it
        setSelectedElementId(clickedElement.id);
        setSelectedElementIds([]);
      } else {
        // Click on empty space - start modular selection box
        setModularSelectionBox({ startX: x, startY: y, endX: x, endY: y });
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
      return;
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
          if (!isErasing) {
            saveToHistory(); // Save before starting erase
          }
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

  // Handle drag over for modular floor placement from panel
  const handleDragOver = (e: React.DragEvent) => {
    // Only process if we're placing a modular floor
    if (!placingModularFloor || activeTool !== 'modularRoom') return;
    
    e.preventDefault(); // Allow drop
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    setCursorPosition({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    // Check if mouse is over left or right panel (by screen coordinates)
    // This is needed because Canvas receives mouse events even when panels overlay it
    const screenX = e.clientX;
    const screenWidth = window.innerWidth;
    const leftPanelWidth = leftPanelOpen ? 450 : 0;
    const rightPanelWidth = viewMode === 'planning' ? 320 : 0;
    const isOverPanel = screenX < leftPanelWidth || screenX > screenWidth - rightPanelWidth;
    
    // Hide tool preview immediately if over a panel
    if (isOverPanel) {
      setCursorPosition(null);
      return; // Don't process any Canvas mouse logic when over panels
    }

    // Handle pending modular room drag - start actual drag when mouse moves
    if (pendingModularRoomDrag && scene) {
      const dx = x - pendingModularRoomDrag.startX;
      const dy = y - pendingModularRoomDrag.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only start drag if mouse moved enough (5 pixels threshold)
      if (distance > 5) {
        const modRoom = scene.elements.find(el => el.id === pendingModularRoomDrag.roomId) as ModularRoomElement | undefined;
        if (modRoom) {
          saveToHistory();
          
          // Remove doors for this room immediately when starting drag
          if (activeSceneId && scene.modularRoomsState) {
            const currentDoors = scene.modularRoomsState.doors || [];
            const doorsWithoutThisRoom = currentDoors.filter(
              d => d.roomAId !== modRoom.id && d.roomBId !== modRoom.id
            );
            if (doorsWithoutThisRoom.length !== currentDoors.length) {
              updateScene(activeSceneId, {
                modularRoomsState: {
                  ...scene.modularRoomsState,
                  doors: doorsWithoutThisRoom,
                }
              });
            }
          }
          
          // Start "carrying" the room - center it under cursor
          const roomWidthPx = modRoom.tilesW * MODULAR_TILE_PX;
          const roomHeightPx = modRoom.tilesH * MODULAR_TILE_PX;
          const centeredX = x - roomWidthPx / 2;
          const centeredY = y - roomHeightPx / 2;
          
          // Calculate snap position
          const allModularRooms = getModularRooms(scene.elements);
          const otherRooms = allModularRooms.filter(r => r.id !== modRoom.id);
          const snapResult = findMagneticSnapPosition(modRoom, centeredX, centeredY, otherRooms);
          
          setModularRoomDragPreview({
            roomId: modRoom.id,
            originalPosition: { x: modRoom.x, y: modRoom.y },
            ghostPosition: { x: snapResult.x, y: snapResult.y },
            cursorPosition: { x: centeredX, y: centeredY },
            snappedToRoom: snapResult.snappedToRoom,
            sharedEdgeTiles: snapResult.sharedEdgeTiles,
          });
        }
        setPendingModularRoomDrag(null);
      }
      return; // Don't process other mouse logic while pending drag
    }

    // Interior wall preview - update end point while drawing
    if (interiorWallStart) {
      console.log('[INTERIOR WALL] Preview at:', { x, y });
      interiorWallPreviewRef.current = { x, y };
      setInteriorWallPreview({ x, y });
      return; // Don't process other mouse move logic while drawing interior wall
    }

    // Check for room edge hover (interior wall feature)
    if (scene && activeTool === 'room' && !interiorWallStart) {
      console.log('[INTERIOR WALL] SHIFT pressed, checking edges. Tool:', activeTool, 'Elements:', scene.elements.length);
      const edgeHoverDistance = 8 / viewport.zoom; // Hover detection distance
      let foundEdge: { roomId: string; edgeIndex: number; point: { x: number; y: number } } | null = null;
      
      for (const el of scene.elements) {
        if (el.type !== 'room' || !el.vertices || el.vertices.length < 3) continue;
        const room = el as RoomElement;
        
        // Get vertices with rotation applied (world space)
        let vertices = room.vertices;
        if (room.rotation && room.rotation !== 0) {
          const xs = room.vertices.map(v => v.x);
          const ys = room.vertices.map(v => v.y);
          const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
          const radians = (room.rotation * Math.PI) / 180;
          const cos = Math.cos(radians);
          const sin = Math.sin(radians);
          vertices = room.vertices.map(v => ({
            x: centerX + (v.x - centerX) * cos - (v.y - centerY) * sin,
            y: centerY + (v.x - centerX) * sin + (v.y - centerY) * cos
          }));
        }
        console.log('[INTERIOR WALL] Checking room:', room.id, 'vertices:', vertices.length);
        
        // Check each edge
        for (let i = 0; i < vertices.length; i++) {
          const v1 = vertices[i];
          const v2 = vertices[(i + 1) % vertices.length];
          
          // Find closest point on edge to cursor
          const dx = v2.x - v1.x;
          const dy = v2.y - v1.y;
          const lengthSq = dx * dx + dy * dy;
          if (lengthSq === 0) continue;
          
          const t = Math.max(0, Math.min(1, ((x - v1.x) * dx + (y - v1.y) * dy) / lengthSq));
          const closestX = v1.x + t * dx;
          const closestY = v1.y + t * dy;
          const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
          
          if (distance < edgeHoverDistance) {
            foundEdge = { roomId: room.id, edgeIndex: i, point: { x: closestX, y: closestY } };
            break;
          }
        }
        if (foundEdge) break;
      }
      
      setHoveredRoomEdge(foundEdge);
    } else if (hoveredRoomEdge) {
      setHoveredRoomEdge(null);
    }

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
    } else if (activeTool === 'modularRoom' && placingModularFloor && scene && !isOverUI) {
      // Update cursor position for modular floor preview
      setCursorPosition({ x, y });
    } else if (modularRoomDragPreview && scene && !isOverUI) {
      // Update carried modular room position (works with any tool)
      const room = scene.elements.find(el => el.id === modularRoomDragPreview.roomId) as ModularRoomElement | undefined;
      if (room) {
        // Center room under cursor
        const roomWidthPx = room.tilesW * MODULAR_TILE_PX;
        const roomHeightPx = room.tilesH * MODULAR_TILE_PX;
        const centeredX = x - roomWidthPx / 2;
        const centeredY = y - roomHeightPx / 2;
        
        // Get other rooms for magnetic snap
        const allModularRooms = getModularRooms(scene.elements);
        const otherRooms = allModularRooms.filter(r => r.id !== room.id);
        const snapResult = findMagneticSnapPosition(room, centeredX, centeredY, otherRooms);
        
        setModularRoomDragPreview({
          ...modularRoomDragPreview,
          ghostPosition: { x: snapResult.x, y: snapResult.y },
          cursorPosition: { x: centeredX, y: centeredY },
          snappedToRoom: snapResult.snappedToRoom,
          sharedEdgeTiles: snapResult.sharedEdgeTiles,
        });
      }
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

    // Handle modular room selection box
    if (modularSelectionBox) {
      setModularSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
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
          } else if (element.type === 'modularRoom') {
            // Modular rooms use x/y in pixels - direct pixel movement
            const newPixelX = x - initialOffset.x;
            const newPixelY = y - initialOffset.y;
            updates.set(id, { x: newPixelX, y: newPixelY });
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
        // For polygons: the left-most (top-left if tied) vertex is locked to roomDrawStart
        // The polygon expands diagonally from that vertex as you drag
        
        let numSides = 5;
        if (baseShape === 'hexagon') numSides = 6;
        else if (baseShape === 'octagon') numSides = 8;
        
        // Calculate radius based on diagonal distance to mouse
        const dragDistanceX = Math.abs(x - roomDrawStart.x);
        const dragDistanceY = Math.abs(y - roomDrawStart.y);
        const radius = Math.max(dragDistanceX, dragDistanceY) / 2;
        
        // Determine expansion direction
        const expandRight = x >= roomDrawStart.x;
        const expandDown = y >= roomDrawStart.y;
        
        // Generate initial vertices around origin to find the left-top vertex
        const tempVertices: { x: number; y: number; angle: number }[] = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2; // Start from top
          tempVertices.push({
            x: Math.cos(angle),
            y: Math.sin(angle),
            angle
          });
        }
        
        // Find left-most vertex (smallest x), if tied pick top-most (smallest y)
        // Special case for octagon: use the vertex to the left of the top vertex
        let anchorIdx = 0;
        if (baseShape === 'octagon') {
          // For octagon: vertex 0 is top, vertex 7 is top-left (first to the left of top)
          anchorIdx = numSides - 1; // Top-left vertex
        } else {
          // For pentagon/hexagon: find left-most (top-most if tied)
          for (let i = 1; i < tempVertices.length; i++) {
            const curr = tempVertices[i];
            const best = tempVertices[anchorIdx];
            if (curr.x < best.x - 0.001 || (Math.abs(curr.x - best.x) < 0.001 && curr.y < best.y)) {
              anchorIdx = i;
            }
          }
        }
        
        // The anchor vertex offset from center (normalized)
        const anchorOffsetX = tempVertices[anchorIdx].x;
        const anchorOffsetY = tempVertices[anchorIdx].y;
        
        // Calculate center position so that the anchor vertex lands at roomDrawStart
        // when expanding right+down, or at the opposite corner when expanding other directions
        let centerX: number, centerY: number;
        
        if (expandRight && expandDown) {
          // Anchor is top-left corner, polygon expands to bottom-right
          centerX = roomDrawStart.x - anchorOffsetX * radius;
          centerY = roomDrawStart.y - anchorOffsetY * radius;
        } else if (!expandRight && expandDown) {
          // Anchor is top-right corner, polygon expands to bottom-left
          centerX = roomDrawStart.x + anchorOffsetX * radius;
          centerY = roomDrawStart.y - anchorOffsetY * radius;
        } else if (expandRight && !expandDown) {
          // Anchor is bottom-left corner, polygon expands to top-right
          centerX = roomDrawStart.x - anchorOffsetX * radius;
          centerY = roomDrawStart.y + anchorOffsetY * radius;
        } else {
          // Anchor is bottom-right corner, polygon expands to top-left
          centerX = roomDrawStart.x + anchorOffsetX * radius;
          centerY = roomDrawStart.y + anchorOffsetY * radius;
        }
        
        // Generate final vertices around the calculated center
        vertices = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2;
          vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        }
        
        console.log('[POLYGON]', {
          anchor: `(${roomDrawStart.x.toFixed(0)},${roomDrawStart.y.toFixed(0)})`,
          mouse: `(${x.toFixed(0)},${y.toFixed(0)})`,
          center: `(${centerX.toFixed(0)},${centerY.toFixed(0)})`,
          radius: radius.toFixed(0),
          expandRight,
          expandDown,
          anchorIdx
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
        } else if (element.type === 'modularRoom') {
          // Modular rooms now use modularRoomDragPreview for both pointer and modularRoom tools
          // This branch should not be reached
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
    // Handle pending modular room drag - if mouse released without moving, just select
    if (pendingModularRoomDrag) {
      // Mouse was released without moving enough to start drag - just select the room
      setSelectedElementId(pendingModularRoomDrag.roomId);
      setSelectedElementIds([]);
      setPendingModularRoomDrag(null);
      return;
    }
    
    // Finalize modular room drag (for pointer tool - modularRoom tool uses click-to-drop)
    if (modularRoomDragPreview && activeTool !== 'modularRoom' && scene) {
      const { roomId, ghostPosition, originalPosition } = modularRoomDragPreview;
      
      const room = scene.elements.find(el => el.id === roomId) as ModularRoomElement | undefined;
      if (!room) {
        setModularRoomDragPreview(null);
        return;
      }
      
      // Only update if position actually changed
      if (ghostPosition.x !== originalPosition.x || ghostPosition.y !== originalPosition.y) {
        // Check if final position overlaps with any existing room
        const roomWidthPx = room.tilesW * MODULAR_TILE_PX;
        const roomHeightPx = room.tilesH * MODULAR_TILE_PX;
        const proposedRect = { x: ghostPosition.x, y: ghostPosition.y, w: roomWidthPx, h: roomHeightPx };
        
        const existingModularRooms = getModularRooms(scene.elements).filter(r => r.id !== roomId);
        const hasOverlap = existingModularRooms.some(other => {
          const otherRect = {
            x: other.x,
            y: other.y,
            w: other.tilesW * MODULAR_TILE_PX,
            h: other.tilesH * MODULAR_TILE_PX,
          };
          return roomsOverlapPx(proposedRect, otherRect);
        });
        
        if (hasOverlap) {
          // Show error and revert
          setMergeNotification('Modular rooms can only be placed in unoccupied space');
          setTimeout(() => setMergeNotification(null), 3000);
        } else {
          // Create a temporary room at new position to check adjacencies
          const tempRoom = { ...room, x: ghostPosition.x, y: ghostPosition.y };
          const allRooms = getModularRooms(scene.elements);
          const allRoomsWithNewPosition = allRooms.map(r => r.id === roomId ? tempRoom : r);
          
          // Find all groups this room would be adjacent to at NEW position
          const adjacentGroupIds = findAdjacentGroups(tempRoom, allRoomsWithNewPosition);
          
          let newWallGroupId: string | undefined = room.wallGroupId;
          let wallGroupsToUpdate = scene.modularRoomsState?.wallGroups || [];
          const roomUpdatesToApply: { roomId: string; newWallGroupId: string }[] = [];
          
          // STEP 1: Check if moving this room splits its original group
          // We need to check this using the ORIGINAL positions (not the new position)
          if (room.wallGroupId) {
            const splitResult = checkGroupSplitAfterRemoval(allRooms, roomId);
            if (splitResult.needsSplit) {
              const splitUpdates = generateSplitUpdates(
                splitResult.components,
                room.wallGroupId,
                wallGroupsToUpdate
              );
              
              // Apply split updates to rooms (except the moving room)
              for (const update of splitUpdates.roomUpdates) {
                if (update.roomId !== roomId) {
                  roomUpdatesToApply.push(update);
                }
              }
              
              // Add new groups and update original group's roomCount
              wallGroupsToUpdate = [
                ...wallGroupsToUpdate
                  .filter(g => g.id !== room.wallGroupId)
                  .concat(splitUpdates.updatedOriginalGroup ? [splitUpdates.updatedOriginalGroup] : []),
                ...splitUpdates.newWallGroups
              ];
              
              // The moving room no longer belongs to any group (it will find a new one below)
              newWallGroupId = undefined;
            } else {
              // No split, but room is leaving - decrement old group's roomCount
              wallGroupsToUpdate = wallGroupsToUpdate.map(g => {
                if (g.id === room.wallGroupId) {
                  return { ...g, roomCount: Math.max(0, (g.roomCount || 1) - 1) };
                }
                return g;
              });
              // Room is leaving this group
              newWallGroupId = undefined;
            }
          }
          
          // STEP 2: Check merge/join at new position
          if (adjacentGroupIds.length > 1) {
            // Multiple groups - need to merge
            const mergeResult = generateMergeUpdates(
              tempRoom,
              adjacentGroupIds,
              allRoomsWithNewPosition,
              wallGroupsToUpdate
            );
            
            if (mergeResult) {
              newWallGroupId = mergeResult.updatedDominantGroup.id;
              roomUpdatesToApply.push(...mergeResult.roomUpdates);
              // Remove merged groups and update dominant group
              wallGroupsToUpdate = wallGroupsToUpdate
                .filter(g => !mergeResult.groupsToRemove.includes(g.id))
                .map(g => g.id === mergeResult.updatedDominantGroup.id ? mergeResult.updatedDominantGroup : g);
            }
          } else if (adjacentGroupIds.length === 1) {
            // Single adjacent group - adopt it and increment roomCount
            // (decrement of old group already done in STEP 1)
            newWallGroupId = adjacentGroupIds[0];
            wallGroupsToUpdate = wallGroupsToUpdate.map(g => {
              if (g.id === adjacentGroupIds[0]) {
                return { ...g, roomCount: (g.roomCount || 0) + 1 };
              }
              return g;
            });
          } else if (adjacentGroupIds.length === 0) {
            // No adjacent groups - create a new group for this room
            // Preserve the wall style from the room's original group
            const originalGroup = (scene.modularRoomsState?.wallGroups || []).find(g => g.id === room.wallGroupId);
            const preservedWallStyle = originalGroup?.wallStyleId || 'worn-castle';
            
            const newGroupId = generateWallGroupId();
            const newGroup: WallGroup = {
              id: newGroupId,
              wallStyleId: preservedWallStyle,
              roomCount: 1,
            };
            newWallGroupId = newGroupId;
            wallGroupsToUpdate = [...wallGroupsToUpdate, newGroup];
          }
          
          // Apply room updates for merged groups
          for (const update of roomUpdatesToApply) {
            if (update.roomId !== roomId) {
              updateElement(update.roomId, { wallGroupId: update.newWallGroupId });
            }
          }
          
          // Commit the move (and group change if applicable)
          updateElement(roomId, {
            x: ghostPosition.x,
            y: ghostPosition.y,
            ...(newWallGroupId !== room.wallGroupId ? { wallGroupId: newWallGroupId } : {}),
          });
          
          // Recalculate doors with new positions
          const updatedRoomsForDoors = allRooms.map(r => 
            r.id === roomId ? { ...r, x: ghostPosition.x, y: ghostPosition.y, wallGroupId: newWallGroupId || room.wallGroupId } : r
          );
          const newDoors = recalculateAllDoors(updatedRoomsForDoors);
          
          // Update both wallGroups and doors in one call
          updateScene(activeSceneId!, {
            modularRoomsState: {
              ...scene.modularRoomsState,
              wallGroups: wallGroupsToUpdate,
              doors: newDoors,
            }
          });
        }
      }
      
      setModularRoomDragPreview(null);
    }
    
    // Finalize interior wall drawing (ALT + drag from room edge)
    if (interiorWallStart && scene) {
      // Use ref for the most up-to-date preview position
      const previewPos = interiorWallPreviewRef.current || interiorWallPreview;
      console.log('[INTERIOR WALL] MouseUp - Start:', interiorWallStart, 'Preview:', previewPos);
      
      if (previewPos) {
        const room = scene.elements.find(el => el.id === interiorWallStart.roomId) as RoomElement | undefined;
        if (room && room.vertices) {
          const startPoint = { x: interiorWallStart.x, y: interiorWallStart.y };
          const endPoint = { x: previewPos.x, y: previewPos.y };
          const edgeIndex = interiorWallStart.edgeIndex;
        
          // Calculate distance to make sure it's worth creating
          const distance = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
          
          console.log('[INTERIOR WALL] Distance:', distance, 'from', startPoint, 'to', endPoint);
          
          if (distance > 10) {
            // Direct vertex insertion approach:
            // Insert 3 new vertices after the edge start vertex:
            // 1. The start point on the edge (slightly adjusted)
            // 2. The end point where mouse was released  
            // 3. The start point again (to close the wall spike)
            
            // Get room vertices (apply rotation if needed)
            let roomVertices = [...room.vertices];
            if (room.rotation && room.rotation !== 0) {
              const xs = room.vertices.map(v => v.x);
              const ys = room.vertices.map(v => v.y);
              const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
              const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
              const radians = (room.rotation * Math.PI) / 180;
              const cos = Math.cos(radians);
              const sin = Math.sin(radians);
              roomVertices = room.vertices.map(v => ({
                x: centerX + (v.x - centerX) * cos - (v.y - centerY) * sin,
                y: centerY + (v.x - centerX) * sin + (v.y - centerY) * cos
              }));
            }
            
            // Insert the wall spike vertices
            // The spike goes: edge -> startPoint -> endPoint -> startPoint -> continue edge
            const newVertices = [
              ...roomVertices.slice(0, edgeIndex + 1), // vertices up to and including edge start
              startPoint,  // First point of wall (on the edge)
              endPoint,    // Tip of the wall (where mouse released)
              startPoint,  // Back to the edge (creates the spike)
              ...roomVertices.slice(edgeIndex + 1)     // remaining vertices
            ];
            
            console.log('[INTERIOR WALL] New vertices:', newVertices);
            console.log('[INTERIOR WALL] Original count:', roomVertices.length, 'New count:', newVertices.length);
            
            // Save to history
            const updatedElements = scene.elements.map(el => 
              el.id === room.id 
                ? { 
                    ...room, 
                    vertices: newVertices, 
                    rotation: 0 // Reset rotation since vertices are now in world space
                  } 
                : el
            );
            
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
            
            if (activeSceneId) {
              updateScene(activeSceneId, { elements: updatedElements });
            }
            
            setMergeNotification('Interior wall added');
            setTimeout(() => setMergeNotification(null), 2000);
          }
        }
      }
      
      setInteriorWallStart(null);
      setInteriorWallPreview(null);
      interiorWallPreviewRef.current = null;
      setHoveredRoomEdge(null);
      return;
    }

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

    // Note: Modular room placement now uses click-to-pickup, click-to-drop in handleMouseDown
    // No mouseUp handling needed for modular rooms

    // Door Tool: DISABLED

    // Finalize wall cutter tool rectangle
    if (wallCutterToolStart && wallCutterToolEnd) {
      saveToHistory(); // Save BEFORE cutting
      applyWallCutterRectangle();
      setWallCutterToolStart(null);
      setWallCutterToolEnd(null);
      // Note: No saveToHistory after - the cut itself is the new state
    }

    // Wall Cutter freehand and Door Tool: DISABLED

    // Clear drag/resize/rotate states
    // Note: History was already saved when these operations started
    setDraggedElement(null);
    setResizingElement(null);
    setDraggedMultiple(null);
    setRotatingElement(null);
    setScalingElement(null);
    setMovingVertex(null);
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
      setIsErasing(false);
      // Note: History was saved when erasing started
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
          const room = element as RoomElement;
          
          // Get room bounding box (including wall thickness if applicable)
          const xs = room.vertices.map(v => v.x);
          const ys = room.vertices.map(v => v.y);
          const wallOffset = room.showWalls ? (room.wallThickness || 0) / 2 : 0;
          const roomMinX = Math.min(...xs) - wallOffset;
          const roomMaxX = Math.max(...xs) + wallOffset;
          const roomMinY = Math.min(...ys) - wallOffset;
          const roomMaxY = Math.max(...ys) + wallOffset;
          
          // First check: do bounding boxes overlap at all?
          const boxesOverlap = !(roomMaxX < minX || roomMinX > maxX || roomMaxY < minY || roomMinY > maxY);
          if (!boxesOverlap) return false;
          
          // Check if any corner of selection box is inside the room (but not in a hole)
          const selectionCorners = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY }
          ];
          const hasCornerInsideRoom = selectionCorners.some(corner => {
            const inOuter = pointInPolygon(corner, room.vertices!);
            const inHole = room.holes?.some(hole => pointInPolygon(corner, hole)) ?? false;
            return inOuter && !inHole;
          });
          if (hasCornerInsideRoom) return true;
          
          // Check if any vertex of the room is inside selection box
          const hasVertexInside = room.vertices.some(v => 
            v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY
          );
          if (hasVertexInside) return true;
          
          // Check edge intersections between selection box and room polygon
          const selectionEdges = [
            [selectionCorners[0], selectionCorners[1]],
            [selectionCorners[1], selectionCorners[2]],
            [selectionCorners[2], selectionCorners[3]],
            [selectionCorners[3], selectionCorners[0]]
          ];
          for (let i = 0; i < room.vertices.length; i++) {
            const v1 = room.vertices[i];
            const v2 = room.vertices[(i + 1) % room.vertices.length];
            for (const [s1, s2] of selectionEdges) {
              if (segmentsIntersect(v1, v2, s1, s2)) {
                return true;
              }
            }
          }
          
          return false;
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

    // Finalize modular room selection box - ONLY selects modular rooms
    if (modularSelectionBox && scene) {
      const minX = Math.min(modularSelectionBox.startX, modularSelectionBox.endX);
      const maxX = Math.max(modularSelectionBox.startX, modularSelectionBox.endX);
      const minY = Math.min(modularSelectionBox.startY, modularSelectionBox.endY);
      const maxY = Math.max(modularSelectionBox.startY, modularSelectionBox.endY);

      // Only select modular rooms - ignore all other element types
      const modularRooms = getModularRooms(scene.elements);
      const selected = modularRooms.filter(room => {
        // Get room bounding box in pixels
        const roomMinX = room.x;
        const roomMaxX = room.x + room.tilesW * MODULAR_TILE_PX;
        const roomMinY = room.y;
        const roomMaxY = room.y + room.tilesH * MODULAR_TILE_PX;
        
        // Check if bounding boxes overlap
        return !(roomMaxX < minX || roomMinX > maxX || roomMaxY < minY || roomMinY > maxY);
      }).map(r => r.id);

      if (selected.length > 0) {
        setSelectedElementIds(selected);
        setSelectedElementId(null);
      }
      setModularSelectionBox(null);
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
              
              // Save to history with the new state
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
            }
          }
        } else {
          // Normal room creation (with optional auto-merge)
          const finalRoom: RoomElement = { 
            ...tempRoom, 
            id: `room-${Date.now()}`, 
            floorTextureUrl: selectedFloorTexture || tempRoom.floorTextureUrl,
            tileSize, 
            showWalls, 
            wallTextureUrl: selectedWallTexture || '', 
            wallThickness,
            wallTileSize,
            cornerRadius: defaultCornerRadius
          };
          
          // Check if auto-merge is enabled and find overlapping rooms
          if (autoMergeRooms && scene) {
            const newVertices = finalRoom.vertices;
            
            // Helper function to get rotated vertices for a room
            const getRotatedVertices = (room: RoomElement): Point[] => {
              if (!room.rotation || room.rotation === 0) return room.vertices;
              
              const xs = room.vertices.map(v => v.x);
              const ys = room.vertices.map(v => v.y);
              const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
              const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
              const radians = (room.rotation * Math.PI) / 180;
              const cos = Math.cos(radians);
              const sin = Math.sin(radians);
              
              return room.vertices.map(v => ({
                x: centerX + (v.x - centerX) * cos - (v.y - centerY) * sin,
                y: centerY + (v.x - centerX) * sin + (v.y - centerY) * cos
              }));
            };
            
            // Find rooms that overlap with the new room (using rotated vertices)
            const overlappingRooms = scene.elements.filter(el => {
              if (el.type !== 'room' || !el.vertices) return false;
              
              const roomEl = el as RoomElement;
              
              // Get the actual rotated vertices of the existing room
              const existingVertices = getRotatedVertices(roomEl);
              
              // Check if ALL vertices of new room are inside a hole of existing room
              // If so, this is a new room INSIDE a hole, don't merge
              if (roomEl.holes && roomEl.holes.length > 0) {
                for (const hole of roomEl.holes) {
                  const allInHole = newVertices.every(v => pointInPolygon(v, hole));
                  if (allInHole) {
                    return false; // Don't merge - new room is inside this hole
                  }
                }
              }
              
              // Check if any vertex of new room is inside existing room (rotated)
              const hasVertexInside = newVertices.some(v => pointInPolygon(v, existingVertices));
              
              // Check if any vertex of existing room (rotated) is inside new room
              const hasExistingVertexInside = existingVertices.some(v => pointInPolygon(v, newVertices));
              
              // Check for edge intersections using rotated vertices
              let hasEdgeIntersection = false;
              for (let i = 0; i < newVertices.length && !hasEdgeIntersection; i++) {
                const a1 = newVertices[i];
                const a2 = newVertices[(i + 1) % newVertices.length];
                for (let j = 0; j < existingVertices.length; j++) {
                  const b1 = existingVertices[j];
                  const b2 = existingVertices[(j + 1) % existingVertices.length];
                  if (segmentsIntersect(a1, a2, b1, b2)) {
                    hasEdgeIntersection = true;
                    break;
                  }
                }
              }
              
              return hasVertexInside || hasExistingVertexInside || hasEdgeIntersection;
            }) as RoomElement[];
            
            if (overlappingRooms.length > 0) {
              // Use polygon-clipping to merge rooms
              try {
                const polygonClipping = await import('polygon-clipping');
                
                // SIMPLE APPROACH: Collect ALL vertices from all rooms before merge
                // Vertices in the overlap area will be lost, vertices outside will be preserved
                const allOriginalVertices: Point[] = [];
                for (const room of overlappingRooms) {
                  const rotatedVertices = getRotatedVertices(room);
                  allOriginalVertices.push(...rotatedVertices);
                }
                // Also include new room vertices
                allOriginalVertices.push(...newVertices);
                
                // Calculate the intersection (overlap) polygon between all rooms
                // We'll use this to determine which vertices to discard
                let overlapPoly: [number, number][][] | null = null;
                
                // Find intersection of new room with each existing room
                for (const room of overlappingRooms) {
                  const rotatedVertices = getRotatedVertices(room);
                  const roomPoly: [number, number][][] = [rotatedVertices.map(v => [v.x, v.y])];
                  const newPoly: [number, number][][] = [newVertices.map(v => [v.x, v.y])];
                  
                  const intersection = polygonClipping.default.intersection([newPoly], [roomPoly]);
                  if (intersection.length > 0 && intersection[0].length > 0) {
                    if (!overlapPoly) {
                      overlapPoly = intersection[0];
                    } else {
                      // Union the overlap areas
                      const unionResult = polygonClipping.default.union([overlapPoly], intersection[0]);
                      if (unionResult.length > 0 && unionResult[0].length > 0) {
                        overlapPoly = unionResult[0];
                      }
                    }
                  }
                }
                
                // Convert overlap polygon to Point array for point-in-polygon check
                const overlapPoints: Point[] = overlapPoly ? overlapPoly[0].map(([x, y]) => ({ x, y })) : [];
                
                // Helper: Check if a point lies on an edge of the polygon
                const isPointOnPolygonEdge = (point: Point, polygon: Point[], tolerance: number = 5): { edgeIndex: number; t: number } | null => {
                  for (let i = 0; i < polygon.length; i++) {
                    const p1 = polygon[i];
                    const p2 = polygon[(i + 1) % polygon.length];
                    
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const edgeLen = Math.sqrt(dx * dx + dy * dy);
                    if (edgeLen < 0.001) continue;
                    
                    const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (edgeLen * edgeLen);
                    
                    if (t >= -0.01 && t <= 1.01) {
                      const projX = p1.x + t * dx;
                      const projY = p1.y + t * dy;
                      const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
                      
                      if (dist < tolerance) {
                        return { edgeIndex: i, t: Math.max(0, Math.min(1, t)) };
                      }
                    }
                  }
                  return null;
                };
                
                // Start with the new room polygon
                let mergedPoly: [number, number][][] = [newVertices.map(v => [v.x, v.y])];
                
                // Union with each overlapping room (using rotated vertices)
                for (const room of overlappingRooms) {
                  if (!room.vertices) continue;
                  
                  const rotatedVertices = getRotatedVertices(room);
                  const roomPoly: [number, number][][] = [rotatedVertices.map(v => [v.x, v.y])];
                  
                  // Also rotate holes if present
                  if (room.holes && room.holes.length > 0) {
                    const rotatedHoles = room.holes.map(hole => {
                      if (!room.rotation || room.rotation === 0) return hole;
                      
                      const xs = room.vertices.map(v => v.x);
                      const ys = room.vertices.map(v => v.y);
                      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
                      const radians = (room.rotation * Math.PI) / 180;
                      const cos = Math.cos(radians);
                      const sin = Math.sin(radians);
                      
                      return hole.map(v => ({
                        x: centerX + (v.x - centerX) * cos - (v.y - centerY) * sin,
                        y: centerY + (v.x - centerX) * sin + (v.y - centerY) * cos
                      }));
                    });
                    roomPoly.push(...rotatedHoles.map(hole => hole.map(v => [v.x, v.y] as [number, number])));
                  }
                  
                  const result = polygonClipping.default.union([mergedPoly], [roomPoly]);
                  
                  if (result.length > 0 && result[0].length > 0) {
                    mergedPoly = result[0];
                  }
                }
                
                // Create merged room with properties from the first overlapping room (or new room)
                const baseRoom = overlappingRooms[0] || finalRoom;
                let outerRing = mergedPoly[0].map(([x, y]) => ({ x, y }));
                const holes = mergedPoly.slice(1).map(ring => 
                  ring.map(([x, y]) => ({ x, y }))
                );
                
                // RE-INSERT PRESERVED VERTICES:
                // For each original vertex that was NOT in the overlap area,
                // check if it should be re-inserted into the merged polygon
                const verticesToInsert: { edgeIndex: number; t: number; point: Point }[] = [];
                
                for (const vertex of allOriginalVertices) {
                  // Skip if vertex is inside the overlap area (it got consumed by the merge)
                  if (overlapPoints.length >= 3 && pointInPolygon(vertex, overlapPoints)) {
                    continue;
                  }
                  
                  // Check if vertex already exists in merged polygon (within tolerance)
                  const alreadyExists = outerRing.some(v => 
                    Math.sqrt((v.x - vertex.x) ** 2 + (v.y - vertex.y) ** 2) < 3
                  );
                  if (alreadyExists) continue;
                  
                  // Check if vertex lies on an edge of the merged polygon
                  const edgeInfo = isPointOnPolygonEdge(vertex, outerRing, 10);
                  if (edgeInfo) {
                    verticesToInsert.push({
                      edgeIndex: edgeInfo.edgeIndex,
                      t: edgeInfo.t,
                      point: vertex
                    });
                  }
                }
                
                // Sort vertices by edge index and t (reverse order so we insert from end to start)
                verticesToInsert.sort((a, b) => {
                  if (a.edgeIndex !== b.edgeIndex) return b.edgeIndex - a.edgeIndex;
                  return b.t - a.t;
                });
                
                // Insert vertices into the outerRing
                for (const v of verticesToInsert) {
                  const insertIndex = v.edgeIndex + 1;
                  outerRing = [
                    ...outerRing.slice(0, insertIndex),
                    v.point,
                    ...outerRing.slice(insertIndex)
                  ];
                }
                
                const mergedRoom: RoomElement = {
                  ...baseRoom,
                  id: overlappingRooms[0]?.id || finalRoom.id,
                  vertices: outerRing,
                  holes: holes.length > 0 ? holes : undefined,
                  rotation: 0, // Reset rotation - merged vertices are already in final position
                  // Preserve texture properties from the base room, or use new room settings
                  floorTextureUrl: baseRoom.floorTextureUrl || finalRoom.floorTextureUrl,
                  tileSize: baseRoom.tileSize || finalRoom.tileSize,
                  showWalls: baseRoom.showWalls !== undefined ? baseRoom.showWalls : finalRoom.showWalls,
                  wallTextureUrl: baseRoom.wallTextureUrl || finalRoom.wallTextureUrl,
                  wallThickness: baseRoom.wallThickness || finalRoom.wallThickness,
                  wallTileSize: baseRoom.wallTileSize || finalRoom.wallTileSize,
                  cornerRadius: baseRoom.cornerRadius ?? finalRoom.cornerRadius ?? 8,
                };
                
                // Update scene: remove old overlapping rooms and add merged room
                const roomIdsToRemove = new Set(overlappingRooms.map(r => r.id));
                const updatedElements = scene.elements.filter(el => !roomIdsToRemove.has(el.id));
                updatedElements.push(mergedRoom);
                
                // Save to history with the new merged state
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
                
                if (activeSceneId) {
                  updateScene(activeSceneId, { elements: updatedElements });
                }
                
                setSelectedElementId(mergedRoom.id);
                setSelectedElementIds([]);
                setMergeNotification(`Merged ${overlappingRooms.length + 1} rooms`);
                setTimeout(() => setMergeNotification(null), 2000);
                
                setRoomDrawStart(null);
                setTempRoom(null);
                return;
              } catch (error) {
                console.error('Auto-merge failed:', error);
                // Fall through to normal room creation
              }
            }
          }
          
          // Normal room creation (no merge or merge failed)
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
        if (room.vertices) {
          // First check if point is inside the room polygon
          const isInsideOuter = pointInPolygon({ x, y }, room.vertices);
          
          // Check if point is inside any hole (should not select if in hole)
          const isInsideHole = room.holes?.some(hole => pointInPolygon({ x, y }, hole)) ?? false;
          
          if (isInsideOuter && !isInsideHole) {
            return element;
          }
          
          // Also check if clicking on the wall area (outside polygon but within wall thickness)
          if (room.showWalls && room.wallThickness > 0) {
            // Check distance to any edge of the room
            const threshold = room.wallThickness / 2 + 2;
            for (let j = 0; j < room.vertices.length; j++) {
              const v1 = room.vertices[j];
              const v2 = room.vertices[(j + 1) % room.vertices.length];
              
              // Calculate distance from point to line segment
              const dx = v2.x - v1.x;
              const dy = v2.y - v1.y;
              const lengthSquared = dx * dx + dy * dy;
              
              if (lengthSquared === 0) continue;
              
              const t = Math.max(0, Math.min(1, ((x - v1.x) * dx + (y - v1.y) * dy) / lengthSquared));
              const projX = v1.x + t * dx;
              const projY = v1.y + t * dy;
              
              const distX = x - projX;
              const distY = y - projY;
              const distance = Math.sqrt(distX * distX + distY * distY);
              
              if (distance <= threshold) {
                return element;
              }
            }
          }
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
      } else if (element.type === 'modularRoom') {
        // Handle modular room elements - simple rectangle hit test
        const modRoom = element as ModularRoomElement;
        const rect = getRoomPixelRect(modRoom);
        
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
          return element;
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
    if (activeTool === 'modularRoom' && placingModularFloor && scene) return 'cursor-none'; // Hide cursor for modular floor placement
    if (activeTool === 'modularRoom' && modularRoomDragPreview) return 'cursor-grabbing'; // Grabbing hand when carrying a room
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
        onDragOver={handleDragOver}
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
                  
                  {/* Modular Room Floors */}
                  <ModularRoomRenderer
                    modularRooms={getModularRooms(scene.elements)}
                    wallGroups={scene.modularRoomsState?.wallGroups || []}
                    doors={scene.modularRoomsState?.doors || []}
                    selectedRoomId={selectedElementId}
                    selectedRoomIds={selectedElementIds}
                    renderLayer="floor"
                    gridSize={gridSize}
                    dragPreview={modularRoomDragPreview}
                    placingFloor={placingModularFloor}
                  />
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
                        selectedVertex={selectedVertex}
                      />
                    ))}
                  
                  {/* Modular Room Walls, Pillars, and Doors */}
                  <ModularRoomRenderer
                    modularRooms={getModularRooms(scene.elements)}
                    wallGroups={scene.modularRoomsState?.wallGroups || []}
                    doors={scene.modularRoomsState?.doors || []}
                    selectedRoomId={selectedElementId}
                    selectedRoomIds={selectedElementIds}
                    renderLayer="walls"
                    gridSize={gridSize}
                    dragPreview={modularRoomDragPreview}
                    placingFloor={placingModularFloor}
                  />
                  
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
              
              {/* Modular Room Floors */}
              <ModularRoomRenderer
                modularRooms={getModularRooms(scene.elements)}
                wallGroups={scene.modularRoomsState?.wallGroups || []}
                doors={scene.modularRoomsState?.doors || []}
                selectedRoomId={selectedElementId}
                selectedRoomIds={selectedElementIds}
                renderLayer="floor"
                gridSize={gridSize}
                dragPreview={modularRoomDragPreview}
                placingFloor={placingModularFloor}
              />
            </div>
            
            {/* Layer 4: GRID - Fixed size grid overlay (WORLD SPACE - 50k x 50k like canvas mode) */}
            {showGrid && (() => {
              const gridWorldSize = 50000; // Same as canvas mode
              const gridOffset = 25000; // Center the grid so map is in middle
              
              return (
                <svg
                  style={{
                    position: 'absolute',
                    left: -gridOffset + mapDimensions.padding,
                    top: -gridOffset + mapDimensions.padding,
                    width: gridWorldSize,
                    height: gridWorldSize,
                    pointerEvents: 'none',
                    opacity: 0.3,
                    zIndex: Z_GRID
                  }}
                >
                  <defs>
                    <pattern
                      id="map-grid-pattern-inline"
                      x={gridOffset}
                      y={gridOffset}
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
                    width={gridWorldSize}
                    height={gridWorldSize}
                    fill="url(#map-grid-pattern-inline)"
                  />
                </svg>
              );
            })()}

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
                    selectedVertex={selectedVertex}
                  />
                ))}
              
              {/* Modular Room Walls, Pillars, and Doors */}
              <ModularRoomRenderer
                modularRooms={getModularRooms(scene.elements)}
                wallGroups={scene.modularRoomsState?.wallGroups || []}
                doors={scene.modularRoomsState?.doors || []}
                selectedRoomId={selectedElementId}
                selectedRoomIds={selectedElementIds}
                renderLayer="walls"
                gridSize={gridSize}
                dragPreview={modularRoomDragPreview}
                placingFloor={placingModularFloor}
              />
              
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
              
              // Use rounded corners for temp room preview
              const polygonPath = createRoundedPolygonPath(relativeVertices, 8);
              
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

        {/* Interior wall drawing - hovered edge highlight and preview line */}
        {scene && hoveredRoomEdge && !interiorWallStart && (() => {
          const room = scene.elements.find(el => el.id === hoveredRoomEdge.roomId) as RoomElement | undefined;
          if (!room || !room.vertices) return null;
          
          const v1 = room.vertices[hoveredRoomEdge.edgeIndex];
          const v2 = room.vertices[(hoveredRoomEdge.edgeIndex + 1) % room.vertices.length];
          
          return (
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              {/* Highlighted edge */}
              <line
                x1={viewport.x + v1.x * viewport.zoom}
                y1={viewport.y + v1.y * viewport.zoom}
                x2={viewport.x + v2.x * viewport.zoom}
                y2={viewport.y + v2.y * viewport.zoom}
                stroke="#f59e0b"
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.8}
              />
              {/* Hover point indicator */}
              <circle
                cx={viewport.x + hoveredRoomEdge.point.x * viewport.zoom}
                cy={viewport.y + hoveredRoomEdge.point.y * viewport.zoom}
                r={8}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </svg>
          );
        })()}

        {/* Interior wall preview line while drawing */}
        {interiorWallStart && interiorWallPreview && (
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            {/* Preview line from start to current mouse position */}
            <line
              x1={viewport.x + interiorWallStart.x * viewport.zoom}
              y1={viewport.y + interiorWallStart.y * viewport.zoom}
              x2={viewport.x + interiorWallPreview.x * viewport.zoom}
              y2={viewport.y + interiorWallPreview.y * viewport.zoom}
              stroke="#f59e0b"
              strokeWidth={3}
              strokeDasharray="8,4"
              opacity={0.9}
            />
            {/* Start point */}
            <circle
              cx={viewport.x + interiorWallStart.x * viewport.zoom}
              cy={viewport.y + interiorWallStart.y * viewport.zoom}
              r={8}
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth={2}
            />
            {/* End point */}
            <circle
              cx={viewport.x + interiorWallPreview.x * viewport.zoom}
              cy={viewport.y + interiorWallPreview.y * viewport.zoom}
              r={6}
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth={2}
              opacity={0.7}
            />
          </svg>
        )}

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

        {/* Modular room selection box - only selects modular rooms */}
        {scene && modularSelectionBox && (
              <div
                style={{
                  position: 'absolute',
                  left: viewport.x + Math.min(modularSelectionBox.startX, modularSelectionBox.endX) * viewport.zoom,
                  top: viewport.y + Math.min(modularSelectionBox.startY, modularSelectionBox.endY) * viewport.zoom,
                  width: Math.abs(modularSelectionBox.endX - modularSelectionBox.startX) * viewport.zoom,
                  height: Math.abs(modularSelectionBox.endY - modularSelectionBox.startY) * viewport.zoom,
                  border: '2px dashed #a78bfa',
                  backgroundColor: 'rgba(167, 139, 250, 0.1)',
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

        {/* Modular Floor cursor preview */}
        {scene && activeTool === 'modularRoom' && placingModularFloor && cursorPosition && (
          (() => {
            // Use magnetic snap - free placement unless near existing rooms
            const roomWidthPx = placingModularFloor.tilesW * MODULAR_TILE_PX;
            const roomHeightPx = placingModularFloor.tilesH * MODULAR_TILE_PX;
            
            // Center room under cursor (in canvas coordinates)
            const centeredX = cursorPosition.x - roomWidthPx / 2;
            const centeredY = cursorPosition.y - roomHeightPx / 2;
            
            // Create temporary room for snap calculation
            const tempRoom: ModularRoomElement = {
              id: 'preview-temp',
              type: 'modularRoom',
              tilesW: placingModularFloor.tilesW,
              tilesH: placingModularFloor.tilesH,
              x: centeredX,
              y: centeredY,
              floorStyleId: placingModularFloor.floorStyleId || 'stone-floor',
              wallGroupId: 'default',
            };
            
            // Apply magnetic snap (only snaps when close to existing rooms)
            // Use same parameters as actual placement for consistency
            const existingRooms = getModularRooms(scene.elements);
            const snappedPos = findMagneticSnapPosition(
              tempRoom,
              centeredX,
              centeredY,
              existingRooms,
              96  // Same magnetDistancePx as placement
            );
            
            // Convert canvas coordinates to screen coordinates
            // Same formula as token preview: viewport.x + canvasX * viewport.zoom
            const screenX = viewport.x + snappedPos.x * viewport.zoom;
            const screenY = viewport.y + snappedPos.y * viewport.zoom;
            const screenWidth = roomWidthPx * viewport.zoom;
            const screenHeight = roomHeightPx * viewport.zoom;
            
            // Wall preview settings - use selected default wall style
            const wallStyleId = defaultWallStyleId;
            const wallHeight = 32; // Wall thickness in pixels
            const pillarSize = 64; // Pillar size
            const wall1xUrl = getWallSpriteUrl(wallStyleId, 1);
            const wall2xUrl = getWallSpriteUrl(wallStyleId, 2);
            const pillarUrl = getPillarSpriteUrl(wallStyleId);
            
            // Calculate how many wall segments we need
            const tilesW = placingModularFloor.tilesW;
            const tilesH = placingModularFloor.tilesH;
            
            return (
              <div
                style={{
                  position: 'absolute',
                  left: screenX,
                  top: screenY,
                  width: screenWidth,
                  height: screenHeight,
                  pointerEvents: 'none',
                  opacity: 0.7,
                  zIndex: 40,
                }}
              >
                {/* Floor */}
                <img 
                  src={placingModularFloor.imageUrl} 
                  alt={`${tilesW}x${tilesH}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  draggable={false}
                />
                
                {/* Top wall */}
                <div style={{
                  position: 'absolute',
                  left: pillarSize * viewport.zoom / 2,
                  top: -wallHeight * viewport.zoom / 2,
                  width: (roomWidthPx - pillarSize) * viewport.zoom,
                  height: wallHeight * viewport.zoom,
                  backgroundImage: `url(${tilesW > 2 ? wall2xUrl : wall1xUrl})`,
                  backgroundSize: `${MODULAR_TILE_PX * (tilesW > 2 ? 2 : 1) * viewport.zoom}px ${wallHeight * viewport.zoom}px`,
                  backgroundRepeat: 'repeat-x',
                }} />
                
                {/* Bottom wall */}
                <div style={{
                  position: 'absolute',
                  left: pillarSize * viewport.zoom / 2,
                  bottom: -wallHeight * viewport.zoom / 2,
                  width: (roomWidthPx - pillarSize) * viewport.zoom,
                  height: wallHeight * viewport.zoom,
                  backgroundImage: `url(${tilesW > 2 ? wall2xUrl : wall1xUrl})`,
                  backgroundSize: `${MODULAR_TILE_PX * (tilesW > 2 ? 2 : 1) * viewport.zoom}px ${wallHeight * viewport.zoom}px`,
                  backgroundRepeat: 'repeat-x',
                  transform: 'scaleY(-1)',
                }} />
                
                {/* Left wall - rotated horizontal sprite */}
                <div style={{
                  position: 'absolute',
                  // After 90deg rotation around (0,0), element extends LEFT by height and DOWN by width
                  // So we position origin at x=0 to center the wall thickness on the left edge
                  left: 0,
                  top: (pillarSize / 2) * viewport.zoom,
                  width: (roomHeightPx - pillarSize) * viewport.zoom,
                  height: wallHeight * viewport.zoom,
                  backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
                  backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1) * viewport.zoom}px ${wallHeight * viewport.zoom}px`,
                  backgroundRepeat: 'repeat-x',
                  transform: 'rotate(90deg) translateY(-100%)',
                  transformOrigin: '0 0',
                }} />
                
                {/* Right wall - rotated horizontal sprite */}
                <div style={{
                  position: 'absolute',
                  left: roomWidthPx * viewport.zoom,
                  top: (pillarSize / 2) * viewport.zoom,
                  width: (roomHeightPx - pillarSize) * viewport.zoom,
                  height: wallHeight * viewport.zoom,
                  backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
                  backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1) * viewport.zoom}px ${wallHeight * viewport.zoom}px`,
                  backgroundRepeat: 'repeat-x',
                  transform: 'rotate(90deg)',
                  transformOrigin: '0 0',
                }} />
                
                {/* Corner pillars - centered on tile corners */}
                {/* Top-left */}
                <img src={pillarUrl} style={{
                  position: 'absolute',
                  left: (-pillarSize / 2) * viewport.zoom,
                  top: (-pillarSize / 2) * viewport.zoom,
                  width: pillarSize * viewport.zoom,
                  height: pillarSize * viewport.zoom,
                }} draggable={false} />
                {/* Top-right */}
                <img src={pillarUrl} style={{
                  position: 'absolute',
                  left: (roomWidthPx - pillarSize / 2) * viewport.zoom,
                  top: (-pillarSize / 2) * viewport.zoom,
                  width: pillarSize * viewport.zoom,
                  height: pillarSize * viewport.zoom,
                }} draggable={false} />
                {/* Bottom-left */}
                <img src={pillarUrl} style={{
                  position: 'absolute',
                  left: (-pillarSize / 2) * viewport.zoom,
                  top: (roomHeightPx - pillarSize / 2) * viewport.zoom,
                  width: pillarSize * viewport.zoom,
                  height: pillarSize * viewport.zoom,
                }} draggable={false} />
                {/* Bottom-right */}
                <img src={pillarUrl} style={{
                  position: 'absolute',
                  left: (roomWidthPx - pillarSize / 2) * viewport.zoom,
                  top: (roomHeightPx - pillarSize / 2) * viewport.zoom,
                  width: pillarSize * viewport.zoom,
                  height: pillarSize * viewport.zoom,
                }} draggable={false} />
                
                {/* Dashed border indicator */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '2px dashed #8b5cf6',
                  borderRadius: 4,
                  pointerEvents: 'none',
                }} />
              </div>
            );
          })()
        )}
      </div>

      {/* Modular Room Context Menu - Rendered in screen-space (fixed size) */}
      {scene && selectedElementId && !modularRoomDragPreview && (() => {
        const selectedRoom = getModularRooms(scene.elements).find(r => r.id === selectedElementId);
        if (!selectedRoom) return null;
        
        // Calculate screen coordinates from world coordinates
        const roomRect = getRoomPixelRect(selectedRoom);
        const worldX = roomRect.x + roomRect.w / 2;
        const worldY = roomRect.y;
        
        // Convert world to screen: screenPos = viewport.x + worldPos * zoom
        const screenX = viewport.x + worldX * viewport.zoom;
        const screenY = viewport.y + worldY * viewport.zoom;
        
        return (
          <ModularRoomContextMenu
            screenX={screenX}
            screenY={screenY}
            onRotateLeft={() => handleRotateModularRoom(selectedRoom.id, 'left')}
            onRotateRight={() => handleRotateModularRoom(selectedRoom.id, 'right')}
          />
        );
      })()}

      {/* Debug Panel - Top Right (left of right panel) */}
      {(() => {
        const modularRooms = scene ? getModularRooms(scene.elements) : [];
        const selectedRoom = modularRooms.find(r => r.id === selectedElementId);
        const wallGroups = scene?.modularRoomsState?.wallGroups || [];
        const selectedGroup = selectedRoom ? wallGroups.find(g => g.id === selectedRoom.wallGroupId) : null;
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 16,
              right: 340, // Left of right panel (320px wide + some margin)
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              borderRadius: 8,
              border: '1px solid rgba(136, 255, 136, 0.3)',
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#88ff88',
              zIndex: 1000,
              minWidth: 200,
            }}
          >
            <div style={{ marginBottom: 4, fontWeight: 'bold', color: '#aaffaa' }}>🔧 Debug Info</div>
            <div>Room ID: {selectedRoom?.id?.slice(-12) || 'none'}</div>
            <div>Group ID: {selectedRoom?.wallGroupId?.slice(-12) || 'none'}</div>
            <div>Group exists: {selectedGroup ? 'yes' : 'no'}</div>
            <div>Wall style: {selectedGroup?.wallStyleId || 'n/a'}</div>
            <div>Room count: {selectedGroup?.roomCount ?? 'n/a'}</div>
            <div style={{ marginTop: 4, fontSize: 9, color: '#666' }}>
              Total rooms: {modularRooms.length} | Groups: {wallGroups.length}
            </div>
          </div>
        );
      })()}

      {/* Mode Toggle Button - Top Center */}
      <button
        onClick={onToggleViewMode}
        onMouseEnter={() => setCursorPosition(null)}
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
        autoMergeRooms={autoMergeRooms}
        setAutoMergeRooms={setAutoMergeRooms}
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
  selectedVertex?: { id: string; vertexIndex: number; holeIndex?: number } | null;
}

const MapElementComponent = ({ element, isSelected, viewport, showTokenBadges, renderLayer = 'full', selectedVertex = null }: MapElementComponentProps) => {
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
    
    // Recreate polygon path with relative vertices and rounded corners
    // Use room's cornerRadius setting (default 8px if undefined)
    const cornerRadius = roomElement.cornerRadius ?? 8;
    const outerPath = createRoundedPolygonPath(relativeVertices, cornerRadius);
    
    let relativePolygonPath = outerPath;
    
    // Add holes as additional subpaths (they will be subtracted due to evenodd fill-rule)
    if (roomElement.holes && roomElement.holes.length > 0) {
      const holePaths = roomElement.holes.map(hole => {
        const relativeHole = hole.map(v => ({
          x: v.x - minX,
          y: v.y - minY
        }));
        return createRoundedPolygonPath(relativeHole, cornerRadius);
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
              
              {/* Walls - use stroked path for rounded corners, with mask for openings */}
              {(() => {
                const hasOpenings = roomElement.wallOpenings && roomElement.wallOpenings.length > 0;
                const strokeColor = element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)");
                const maskId = `wall-mask-${element.id}`;
                
                if (!hasOpenings) {
                  // No openings - simple stroked path with rounded corners
                  return (
                    <path
                      d={outerPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={element.wallThickness}
                      strokeLinejoin={cornerRadius > 0 ? "round" : "miter"}
                      strokeLinecap={cornerRadius > 0 ? "round" : "butt"}
                    />
                  );
                }
                
                // Has openings - use mask to cut out the opening areas
                return (
                  <>
                    <defs>
                      <mask id={maskId}>
                        {/* White = visible, Black = hidden */}
                        <rect x="-1000" y="-1000" width={width + 2000} height={height + 2000} fill="white" />
                        {/* Cut out openings */}
                        {roomElement.wallOpenings?.map((opening, idx) => {
                          const v1 = relativeVertices[opening.segmentIndex];
                          const v2 = relativeVertices[(opening.segmentIndex + 1) % relativeVertices.length];
                          const dx = v2.x - v1.x;
                          const dy = v2.y - v1.y;
                          
                          // Calculate the opening rectangle
                          const startX = v1.x + dx * opening.startRatio;
                          const startY = v1.y + dy * opening.startRatio;
                          const endX = v1.x + dx * opening.endRatio;
                          const endY = v1.y + dy * opening.endRatio;
                          
                          // Create a rectangle perpendicular to the wall segment
                          const length = Math.sqrt(dx * dx + dy * dy);
                          const perpX = -dy / length;
                          const perpY = dx / length;
                          const halfThickness = (element.wallThickness / 2) + 2; // +2 for safety margin
                          
                          // Four corners of the opening mask rectangle
                          const corners = [
                            { x: startX + perpX * halfThickness, y: startY + perpY * halfThickness },
                            { x: endX + perpX * halfThickness, y: endY + perpY * halfThickness },
                            { x: endX - perpX * halfThickness, y: endY - perpY * halfThickness },
                            { x: startX - perpX * halfThickness, y: startY - perpY * halfThickness }
                          ];
                          
                          return (
                            <polygon
                              key={`opening-mask-${idx}`}
                              points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                              fill="black"
                            />
                          );
                        })}
                      </mask>
                    </defs>
                    <path
                      d={outerPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={element.wallThickness}
                      strokeLinejoin={cornerRadius > 0 ? "round" : "miter"}
                      strokeLinecap={cornerRadius > 0 ? "round" : "butt"}
                      mask={`url(#${maskId})`}
                    />
                  </>
                );
              })()}
              
              {/* Hole walls - render wall texture around each hole with rounded corners */}
              {roomElement.holes?.map((hole, holeIdx) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                
                const holePath = createRoundedPolygonPath(relativeHole, cornerRadius);
                const hasHoleOpenings = roomElement.holeWallOpenings?.some(o => o.holeIndex === holeIdx);
                const strokeColor = element.wallTextureUrl === 'transparent' ? 'none' : (element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)");
                const holeMaskId = `hole-wall-mask-${element.id}-${holeIdx}`;
                
                if (!hasHoleOpenings) {
                  // No openings - simple stroked path with rounded corners
                  return (
                    <path
                      key={`hole-wall-${holeIdx}`}
                      d={holePath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={element.wallThickness}
                      strokeLinejoin={cornerRadius > 0 ? "round" : "miter"}
                      strokeLinecap={cornerRadius > 0 ? "round" : "butt"}
                    />
                  );
                }
                
                // Has openings - use mask
                const holeOpenings = roomElement.holeWallOpenings?.filter(o => o.holeIndex === holeIdx) || [];
                
                return (
                  <g key={`hole-wall-${holeIdx}`}>
                    <defs>
                      <mask id={holeMaskId}>
                        <rect x="-1000" y="-1000" width={width + 2000} height={height + 2000} fill="white" />
                        {holeOpenings.map((opening, idx) => {
                          const v1 = relativeHole[opening.segmentIndex];
                          const v2 = relativeHole[(opening.segmentIndex + 1) % relativeHole.length];
                          const dx = v2.x - v1.x;
                          const dy = v2.y - v1.y;
                          
                          const startX = v1.x + dx * opening.startRatio;
                          const startY = v1.y + dy * opening.startRatio;
                          const endX = v1.x + dx * opening.endRatio;
                          const endY = v1.y + dy * opening.endRatio;
                          
                          const length = Math.sqrt(dx * dx + dy * dy);
                          const perpX = -dy / length;
                          const perpY = dx / length;
                          const halfThickness = (element.wallThickness / 2) + 2;
                          
                          const corners = [
                            { x: startX + perpX * halfThickness, y: startY + perpY * halfThickness },
                            { x: endX + perpX * halfThickness, y: endY + perpY * halfThickness },
                            { x: endX - perpX * halfThickness, y: endY - perpY * halfThickness },
                            { x: startX - perpX * halfThickness, y: startY - perpY * halfThickness }
                          ];
                          
                          return (
                            <polygon
                              key={`hole-opening-mask-${idx}`}
                              points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                              fill="black"
                            />
                          );
                        })}
                      </mask>
                    </defs>
                    <path
                      d={holePath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={element.wallThickness}
                      strokeLinejoin={cornerRadius > 0 ? "round" : "miter"}
                      strokeLinecap={cornerRadius > 0 ? "round" : "butt"}
                      mask={`url(#${holeMaskId})`}
                    />
                  </g>
                );
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
                    stroke="rgba(34, 197, 94, 0.5)"
                    strokeWidth={1.5}
                    strokeDasharray="6,4"
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
                  stroke="rgba(34, 197, 94, 0.5)"
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                />
              )}
              {/* Vertex handles for polygon */}
              {relativeVertices.map((v, i) => {
                const isSelectedVertex = selectedVertex?.id === roomElement.id && 
                                         selectedVertex?.vertexIndex === i && 
                                         selectedVertex?.holeIndex === undefined;
                return (
                  <circle
                    key={`handle-${i}`}
                    cx={v.x}
                    cy={v.y}
                    r={(isSelectedVertex ? 6 : 4) / viewport.zoom}
                    fill={isSelectedVertex ? "#fbbf24" : "white"}
                    stroke={isSelectedVertex ? "#f59e0b" : "rgba(34, 197, 94, 0.7)"}
                    strokeWidth={isSelectedVertex ? 2 : 1}
                    style={{ pointerEvents: 'auto' }}
                  />
                );
              })}
              
              {/* Vertex handles for holes */}
              {roomElement.holes && roomElement.holes.map((hole, holeIndex) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                return relativeHole.map((v, vertexIndex) => {
                  const isSelectedVertex = selectedVertex?.id === roomElement.id && 
                                           selectedVertex?.vertexIndex === vertexIndex && 
                                           selectedVertex?.holeIndex === holeIndex;
                  return (
                    <circle
                      key={`hole-${holeIndex}-handle-${vertexIndex}`}
                      cx={v.x}
                      cy={v.y}
                      r={(isSelectedVertex ? 6 : 4) / viewport.zoom}
                      fill={isSelectedVertex ? "#fbbf24" : "white"}
                      stroke={isSelectedVertex ? "#f59e0b" : "#ef4444"}
                      strokeWidth={isSelectedVertex ? 2 : 1}
                      style={{ pointerEvents: 'auto' }}
                    />
                  );
                });
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
              {relativeVertices.map((v, i) => {
                const isSelectedVertex = selectedVertex?.id === roomElement.id && 
                                         selectedVertex?.vertexIndex === i && 
                                         selectedVertex?.holeIndex === undefined;
                return (
                  <circle
                    key={`handle-${i}`}
                    cx={v.x}
                    cy={v.y}
                    r={(isSelectedVertex ? 6 : 4) / viewport.zoom}
                    fill={isSelectedVertex ? "#fbbf24" : "white"}
                    stroke={isSelectedVertex ? "#f59e0b" : "#22c55e"}
                    strokeWidth={isSelectedVertex ? 2 : 1}
                    style={{ pointerEvents: 'auto' }}
                  />
                );
              })}
              
              {/* Vertex handles for holes */}
              {roomElement.holes && roomElement.holes.map((hole, holeIndex) => {
                const relativeHole = hole.map(v => ({
                  x: v.x - minX,
                  y: v.y - minY
                }));
                return relativeHole.map((v, vertexIndex) => {
                  const isSelectedVertex = selectedVertex?.id === roomElement.id && 
                                           selectedVertex?.vertexIndex === vertexIndex && 
                                           selectedVertex?.holeIndex === holeIndex;
                  return (
                    <circle
                      key={`hole-${holeIndex}-handle-${vertexIndex}`}
                      cx={v.x}
                      cy={v.y}
                      r={(isSelectedVertex ? 6 : 4) / viewport.zoom}
                      fill={isSelectedVertex ? "#fbbf24" : "white"}
                      stroke={isSelectedVertex ? "#f59e0b" : "#ef4444"}
                      strokeWidth={isSelectedVertex ? 2 : 1}
                      style={{ pointerEvents: 'auto' }}
                    />
                  );
                });
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
