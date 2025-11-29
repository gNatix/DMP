import { useRef, useState, useEffect } from 'react';
import { Scene, MapElement, AnnotationElement, TokenElement, RoomElement, ToolType, IconType, ColorType, TokenTemplate, RoomSubTool } from '../types';
import { Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark, Footprints, Info } from 'lucide-react';
import FloatingToolbar from './FloatingToolbar';
import polygonClipping from 'polygon-clipping';

interface CanvasProps {
  scene: Scene | null;
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
  setActiveTool: (tool: ToolType) => void;
  activeSceneId: string | null;
  leftPanelOpen: boolean;
  showTokenBadges: boolean;
  setShowTokenBadges: (show: boolean) => void;
  onDoubleClickElement?: (elementId: string) => void;
  recentTokens: TokenTemplate[];
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
}

const Canvas = ({
  scene,
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
  setActiveTool,
  activeSceneId,
  leftPanelOpen,
  showTokenBadges,
  setShowTokenBadges,
  onDoubleClickElement,
  recentTokens,
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
  onMergeRooms
}: CanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
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
  const [scalingElement, setScalingElement] = useState<{ id: string; cornerIndex: number; startX: number; startY: number; initialVertices: { x: number; y: number }[] } | null>(null);
  const [movingVertex, setMovingVertex] = useState<{ id: string; vertexIndex: number } | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [lastClickedElement, setLastClickedElement] = useState<string | null>(null);
  const [fitToViewLocked, setFitToViewLocked] = useState(false);
  const [zoomLimitError, setZoomLimitError] = useState(false);
  const [shouldRotateMap, setShouldRotateMap] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [mergeNotification, setMergeNotification] = useState<string | null>(null);
  const [lockedElementError, setLockedElementError] = useState<string | null>(null);
  const [mergeWidgetConflict, setMergeWidgetConflict] = useState<{
    rooms: RoomElement[];
    mergedVertices: { x: number; y: number }[];
  } | null>(null);

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
    // Initialize history with current scene state
    if (scene) {
      setHistory([{ elements: JSON.parse(JSON.stringify(scene.elements)) }]);
      setHistoryIndex(0);
    }
  }, [scene?.id]);

  // Expose merge handler to parent (only pass the function reference, don't call it)
  useEffect(() => {
    if (onMergeRooms) {
      onMergeRooms(handleMergeRooms);
    }
  }, [onMergeRooms]);

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

  // Helper to check if text input is focused
  const isTextInputFocused = (): boolean => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    const tagName = activeEl.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      activeEl.hasAttribute('contenteditable')
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

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<MapElement[]>([]);

  // Undo/Redo state
  const [history, setHistory] = useState<{ elements: MapElement[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save state to history
  const saveToHistory = () => {
    if (!scene) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ elements: JSON.parse(JSON.stringify(scene.elements)) });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0 && scene && activeSceneId) {
      const prevState = history[historyIndex - 1];
      updateScene(activeSceneId, { elements: JSON.parse(JSON.stringify(prevState.elements)) });
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1 && scene && activeSceneId) {
      const nextState = history[historyIndex + 1];
      updateScene(activeSceneId, { elements: JSON.parse(JSON.stringify(nextState.elements)) });
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Apply fit to view - zoom map to fill container width exactly (100% width only)
  const applyFitToView = () => {
    if (!containerRef.current || !mapDimensions.width || !mapDimensions.height) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Account for left panel width when it's open (450px fixed width)
    const availableWidth = leftPanelOpen ? containerRect.width - 450 : containerRect.width;
    
    // When rotated, the visual width is the height and visual height is the width
    const visualWidth = shouldRotateMap ? mapDimensions.height : mapDimensions.width;
    const visualHeight = shouldRotateMap ? mapDimensions.width : mapDimensions.height;
    
    // Only fit to width - calculate zoom so map fills 100% of available width
    const newZoom = availableWidth / visualWidth;
    
    // The map container includes padding, so we need to account for that
    const totalWidth = (visualWidth + mapDimensions.padding * 2) * newZoom;
    const totalHeight = (visualHeight + mapDimensions.padding * 2) * newZoom;
    
    // Center horizontally in available space, and vertically
    const xOffset = leftPanelOpen ? 450 : 0;
    setViewport({
      x: xOffset + (availableWidth - totalWidth) / 2,
      y: (containerRect.height - totalHeight) / 2,
      zoom: newZoom
    });
  };

  // Toggle fit to view lock
  const handleFitToView = () => {
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
          return {
            ...el,
            id: `${el.type}-${Date.now()}-${Math.random()}`,
            vertices: el.vertices.map(v => ({ x: v.x + offset, y: v.y + offset }))
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
    const mergePolygons = (rooms: RoomElement[]): { x: number; y: number }[] => {
      if (rooms.length === 0) return [];
      if (rooms.length === 1) return rooms[0].vertices || [];
      
      // Convert room vertices to polygon-clipping format
      const polygons = rooms.map(room => {
        if (!room.vertices || room.vertices.length < 3) return null;
        const coords = room.vertices.map(v => [v.x, v.y] as [number, number]);
        coords.push(coords[0]); // Close the ring
        return [coords];
      }).filter(p => p !== null);

      if (polygons.length === 0) return rooms[0]?.vertices || [];

      try {
        // Perform union of all polygons
        let result: any = polygons[0];
        for (let i = 1; i < polygons.length; i++) {
          result = polygonClipping.union(result, polygons[i] as any);
        }

        if (result.length === 0 || result[0].length === 0) {
          return rooms[0].vertices || [];
        }

        // Take the first polygon's outer ring
        const outerRing = result[0][0] as [number, number][];
        const vertices = outerRing.slice(0, -1).map(coord => ({ x: coord[0], y: coord[1] }));
        
        return vertices;
      } catch (error) {
        console.error('Polygon union error:', error);
        return rooms[0].vertices || [];
      }
    };

    // Group rooms by overlap
    const groups = findOverlappingGroups(selectedRooms);
    
    console.log('Selected rooms:', selectedRooms.length);
    console.log('Groups found:', groups.map(g => g.length));
    
    // Check for widget conflicts in any group that will be merged
    for (const group of groups) {
      if (group.length > 1) {
        const roomsWithWidgets = group.filter(room => room.widgets && room.widgets.length > 0);
        if (roomsWithWidgets.length > 1) {
          // Multiple rooms have widgets - show conflict dialog and stop
          const mergedVertices = mergePolygons(group);
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
        const mergedVertices = mergePolygons(group);
        
        // Determine which widgets to use (we already checked for conflicts above)
        const roomsWithWidgets = group.filter(room => room.widgets && room.widgets.length > 0);
        let widgetsToUse = roomsWithWidgets.length === 1 ? roomsWithWidgets[0].widgets : [];
        
        const firstRoom = group[0];
        const mergedRoom: RoomElement = {
          ...firstRoom,
          id: `room-${Date.now()}-${Math.random()}`,
          vertices: mergedVertices,
          wallOpenings: [],
          widgets: widgetsToUse
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

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip ALL shortcuts and preventDefault if text input is focused
      if (isTextInputFocused()) return;

      // Track Ctrl key
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }

      // Always track Space
      if (e.key === ' ') {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Mode switching
      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('pointer');
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        setActiveTool('token');
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        setActiveTool('pan');
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        if (!e.ctrlKey) { // Only if not Ctrl+Z (undo)
          setActiveTool('zoom-in');
          return;
        }
      }
      if (e.key === 'x' || e.key === 'X') {
        setActiveTool('zoom-out');
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        setActiveTool('marker');
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        setActiveTool('room');
        return;
      }

      // Deselect all or return to pointer tool
      if (e.key === 'Escape') {
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
            updates.set(id, { vertices: newVertices });
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
              return {
                ...el,
                id: `${el.type}-${Date.now()}-${Math.random()}`,
                vertices: el.vertices.map((v: { x: number; y: number }) => ({ x: v.x + offset, y: v.y + offset }))
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
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, selectedElementIds, deleteElements, scene, activeSceneId, activeTool, clipboard, history, historyIndex, viewport]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
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
            if (e.ctrlKey) {
              // CTRL + click on vertex: Move vertex
              setMovingVertex({ id: element.id, vertexIndex: i });
              return;
            } else {
              // Direct click on vertex: Scale from opposite corner
              setScalingElement({
                id: element.id,
                cornerIndex: i,
                startX: x,
                startY: y,
                initialVertices: [...element.vertices]
              });
              return;
            }
          }
          
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

    // Zoom tool - click to zoom in/out at mouse position
    if (activeTool === 'zoom-in') {
      handleZoomIn();
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
            const elementName = clickedElement.type === 'token' 
              ? clickedElement.name 
              : clickedElement.type === 'room'
              ? clickedElement.name || 'Room'
              : 'Annotation';
            setLockedElementError(`The ${clickedElement.type} "${elementName}" is locked. Unlock before moving.`);
            setTimeout(() => setLockedElementError(null), 3000);
            return;
          }
          
          // Regular click: Select single and start dragging
          setSelectedElementId(clickedElement.id);
          setSelectedElementIds([]);
          
          let offsetX, offsetY;
          if (clickedElement.type === 'room' && clickedElement.vertices) {
            const xs = clickedElement.vertices.map(v => v.x);
            const ys = clickedElement.vertices.map(v => v.y);
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            offsetX = x - centerX;
            offsetY = y - centerY;
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
        color: activeTokenTemplate.color
      };
      setTempElement(tempToken);
    } else if (effectiveTool === 'room') {
      if (roomSubTool !== 'erase') {
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
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

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
      } else {
        setIsHoveringRotateHandle(false);
        setHoveringVertex(null);
      }
    } else {
      setIsHoveringRotateHandle(false);
      setHoveringVertex(null);
    }

    // Track mouse position for zoom
    setLastMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Update cursor position for token preview - only if scene exists
    if (activeTool === 'token' && activeTokenTemplate && scene) {
      setCursorPosition({ x, y });
    } else {
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
            
            updates.set(id, { vertices: newVertices });
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
      
      // Only update size for elements that have a size property (not rooms)
      if (tempElement.type !== 'room') {
        setTempElement({ ...tempElement, size });
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
        const { cornerIndex, initialVertices } = scalingElement;
        
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
        
        updateElement(element.id, { vertices: newVertices });
      }
      return;
    }

    // Handle moving single vertex
    if (movingVertex && scene) {
      const element = scene.elements.find(el => el.id === movingVertex.id);
      if (element && element.type === 'room' && element.vertices) {
        const newVertices = [...element.vertices];
        newVertices[movingVertex.vertexIndex] = { x, y };
        updateElement(element.id, { vertices: newVertices });
      }
      return;
    }

    // Handle room drawing - update vertices based on shape
    if (roomDrawStart && tempRoom) {
      const minX = Math.min(x, roomDrawStart.x);
      const maxX = Math.max(x, roomDrawStart.x);
      const minY = Math.min(y, roomDrawStart.y);
      const maxY = Math.max(y, roomDrawStart.y);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = maxX - minX;
      const height = maxY - minY;
      const radius = Math.min(width, height) / 2;
      
      let vertices: { x: number; y: number; }[];
      
      if (roomSubTool === 'rectangle') {
        // Rectangle: 4 vertices
        vertices = [
          { x: minX, y: minY }, // Top-left
          { x: maxX, y: minY }, // Top-right
          { x: maxX, y: maxY }, // Bottom-right
          { x: minX, y: maxY }  // Bottom-left
        ];
      } else if (roomSubTool === 'pentagon') {
        // Pentagon: 5 vertices, regular polygon
        const numSides = 5;
        vertices = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2; // Start from top
          vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        }
      } else if (roomSubTool === 'hexagon') {
        // Hexagon: 6 vertices, regular polygon
        const numSides = 6;
        vertices = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2; // Start from top
          vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        }
      } else if (roomSubTool === 'octagon') {
        // Octagon: 8 vertices, regular polygon
        const numSides = 8;
        vertices = [];
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI / numSides) - Math.PI / 2; // Start from top
          vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        }
      } else {
        // Fallback to rectangle
        vertices = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY }
        ];
      }
      
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
          
          updateElement(draggedElement.id, { vertices: newVertices });
        } else if ('x' in element && 'y' in element) {
          updateElement(draggedElement.id, {
            x: x - draggedElement.offsetX,
            y: y - draggedElement.offsetY
          });
        }
      }
    }
  };

  const handleMouseUp = () => {
    // Save to history if we were dragging or resizing
    if (draggedElement || resizingElement || draggedMultiple || rotatingElement || scalingElement || movingVertex) {
      saveToHistory();
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
      saveToHistory();
      const finalElement = { ...tempElement, id: `${tempElement.type}-${Date.now()}` };
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
        console.log('[MOUSE UP] Size OK, creating final room');
        saveToHistory();
        const finalRoom = { ...tempRoom, id: `room-${Date.now()}`, tileSize, showWalls, wallTextureUrl: selectedWallTexture || '', wallThickness };
        addElement(finalRoom);
        setSelectedElementId(finalRoom.id);
        setSelectedElementIds([]);
      } else {
        console.log('[MOUSE UP] Room too small, not creating');
      }
      setRoomDrawStart(null);
      setTempRoom(null);
      return;
    }

    setIsCreating(false);
    setCreateStart(null);
    setTempElement(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !mapDimensions.width) return;
    
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
    
    setViewport(prev => {
      // Calculate minimum zoom (100% width fit)
      const availableWidth = leftPanelOpen ? rect.width - 450 : rect.width;
      const visualWidth = shouldRotateMap ? mapDimensions.height : mapDimensions.width;
      const minZoomForFit = availableWidth / visualWidth;
      
      // When locked, don't allow zooming out beyond 100% width fit
      const minZoom = fitToViewLocked ? minZoomForFit : 0.1;
      const desiredZoom = prev.zoom * delta;
      const newZoom = Math.max(minZoom, Math.min(5, desiredZoom));
      
      // Show error if we hit the limit while locked and trying to zoom out
      if (fitToViewLocked && e.deltaY > 0 && desiredZoom < minZoomForFit) {
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const findElementAtPosition = (x: number, y: number, elements: MapElement[]): MapElement | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      
      // Handle room elements (polygon-based) - for selection only
      if (element.type === 'room') {
        const room = element as RoomElement;
        if (room.vertices && pointInPolygon({ x, y }, room.vertices)) {
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
    if (movingVertex) return 'cursor-vertex-edit';
    
    // Hovering over vertex with Ctrl = vertex edit cursor (crosshair with target)
    if (hoveringVertex && isCtrlPressed) return 'cursor-vertex-edit';
    
    // Hovering over vertex without Ctrl = scale cursor (direction based on position)
    if (hoveringVertex && !isCtrlPressed) {
      return hoveringVertex.cursorDirection === 'nesw-resize' ? 'cursor-nesw-resize' : 'cursor-nwse-resize';
    }
    
    // Hovering over rotation handle = rotate cursor
    if (isHoveringRotateHandle) return 'cursor-rotate';
    
    if (isPanning || isSpacePressed || activeTool === 'pan') return 'cursor-grab';
    if (activeTool === 'marker') return 'cursor-copy';
    if (activeTool === 'token' && scene) return 'cursor-none'; // Hide default cursor for token mode only when scene exists
    if (activeTool === 'room') {
      // Show cell cursor (precision cursor) when in erase mode, otherwise crosshair for drawing
      return roomSubTool === 'erase' ? 'cursor-cell' : 'cursor-crosshair';
    }
    if (activeTool === 'zoom-in') return 'cursor-zoom-in';
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
        {scene && (
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
            {/* Background Map Image */}
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
                height: mapDimensions.height
              }}
            />

            {/* Elements */}
            {[...scene.elements]
              .sort((a, b) => ((a as any).zIndex || 0) - ((b as any).zIndex || 0))
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
              />
            )}

            {/* Temp room preview during drawing */}
            {(() => {
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
              
              return (
                <svg
                  style={{
                    position: 'absolute',
                    left: minX,
                    top: minY,
                    width,
                    height,
                    opacity: 0.7,
                    pointerEvents: 'none',
                    overflow: 'visible'
                  }}
                >
                  <defs>
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
                    {tempRoom.showWalls && tempRoom.wallTextureUrl && (
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
                    fill="url(#temp-floor-pattern)"
                    stroke="none"
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
                  
                  {/* Preview border */}
                  <path
                    d={polygonPath}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                </svg>
              );
            })()}

            {/* Selection box */}
            {selectionBox && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(selectionBox.startX, selectionBox.endX),
                  top: Math.min(selectionBox.startY, selectionBox.endY),
                  width: Math.abs(selectionBox.endX - selectionBox.startX),
                  height: Math.abs(selectionBox.endY - selectionBox.startY),
                  border: '2px dashed #22c55e',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Merge Rooms Button - appears when 2+ overlapping rooms are selected */}
            {(() => {
              if (!scene) return null;
              
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
                    left: maxX + 20,
                    top: centerY - 20,
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

            {/* Token cursor preview */}
            {activeTool === 'token' && activeTokenTemplate && cursorPosition && (
              <div
                style={{
                  position: 'absolute',
                  left: cursorPosition.x - 30,
                  top: cursorPosition.y - 30,
                  width: 60,
                  height: 60,
                  pointerEvents: 'none',
                  opacity: 0.7
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
        )}

        {!scene && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Create a scene to get started
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      {scene && (
        <FloatingToolbar
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
            selectedElementId
              ? (scene.elements.find(e => e.id === selectedElementId) as any)?.showBadge || false
              : selectedElementIds.length === 1
                ? (scene.elements.find(e => e.id === selectedElementIds[0]) as any)?.showBadge || false
                : false
          }
          onToggleBadges={() => {
            if (selectedElementId || selectedElementIds.length > 0) {
              const idsToUpdate = selectedElementIds.length > 0 ? selectedElementIds : [selectedElementId!];
              const updates = new Map<string, Partial<MapElement>>();
              idsToUpdate.forEach(id => {
                const element = scene.elements.find(e => e.id === id);
                if (element && element.type === 'token') {
                  updates.set(id, { showBadge: !element.showBadge });
                }
              });
              updateElements(updates);
            } else {
              setShowTokenBadges(!showTokenBadges);
            }
          }}
          recentTokens={recentTokens}
          onSelectToken={onSelectToken}
          selectedColor={selectedColor}
          onColorChange={onColorChange}
          roomSubTool={roomSubTool}
          setRoomSubTool={setRoomSubTool}
          selectedElementLocked={
            selectedElementId
              ? (scene.elements.find(e => e.id === selectedElementId) as any)?.locked || false
              : selectedElementIds.length === 1
                ? (scene.elements.find(e => e.id === selectedElementIds[0]) as any)?.locked || false
                : false
          }
          onToggleLock={() => {
            const idsToUpdate = selectedElementIds.length > 0 ? selectedElementIds : [selectedElementId!];
            const updates = new Map<string, Partial<MapElement>>();
            idsToUpdate.forEach(id => {
              const element = scene.elements.find(e => e.id === id);
              if (element) {
                updates.set(id, { locked: !element.locked });
              }
            });
            updateElements(updates);
          }}
        />
      )}

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
    </div>
  );
};

interface MapElementComponentProps {
  element: MapElement;
  isSelected: boolean;
  viewport: { x: number; y: number; zoom: number };
  showTokenBadges: boolean;
}

const MapElementComponent = ({ element, isSelected, viewport, showTokenBadges }: MapElementComponentProps) => {
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
                ? `${element.size * 0.02}px solid #22c55e` 
                : borderColor 
                  ? `${borderWidth}px solid ${borderColor}`
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
    const relativeVertices = element.vertices.map(v => ({
      x: v.x - minX,
      y: v.y - minY
    }));
    
    // Recreate polygon path with relative vertices
    const relativePolygonPath = relativeVertices.map((v, i) => 
      `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`
    ).join(' ') + ' Z';
    
    const roomElement = element as RoomElement;
    
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
          {hasWalls && element.wallTextureUrl && (
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
          fill={`url(#${floorPatternId})`}
          stroke="none"
        />
        
        {/* Walls - as stroke on the polygon edge */}
        {hasWalls && (
          <path
            d={relativePolygonPath}
            fill="none"
            stroke={element.wallTextureUrl ? `url(#${wallPatternId})` : "rgba(100, 100, 100, 0.8)"}
            strokeWidth={element.wallThickness}
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <>
            <path
              d={relativePolygonPath}
              fill="none"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
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

  return null;
};

export default Canvas;
