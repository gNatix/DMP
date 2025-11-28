import { useRef, useState, useEffect } from 'react';
import { Scene, MapElement, AnnotationElement, TokenElement, RoomElement, ToolType, IconType, ColorType, TokenTemplate, RoomSubTool } from '../types';
import { Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark, Footprints, Info } from 'lucide-react';
import FloatingToolbar from './FloatingToolbar';

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
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
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
  roomSubTool,
  setRoomSubTool
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
  const [lastClickedElement, setLastClickedElement] = useState<string | null>(null);
  const [fitToViewLocked, setFitToViewLocked] = useState(false);
  const [zoomLimitError, setZoomLimitError] = useState(false);
  const [shouldRotateMap, setShouldRotateMap] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

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

    setViewport(prev => ({
      ...prev,
      x: centerX - element.x * prev.zoom,
      y: centerY - element.y * prev.zoom
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
        if (el.type === 'room') {
          return sum + Math.max(el.width, el.height);
        }
        return sum + el.size;
      }, 0);
      const avgSize = totalSize / toDuplicate.length;
      const offset = avgSize * 0.7; // 70% of average size ensures no overlap

      const duplicates = toDuplicate.map(el => {
        return {
          ...el,
          id: `${el.type}-${Date.now()}-${Math.random()}`,
          x: el.x + offset,
          y: el.y + offset
        };
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

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip ALL shortcuts and preventDefault if text input is focused
      if (isTextInputFocused()) return;

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
            if (el.type === 'room') {
              return sum + Math.max(el.width, el.height);
            }
            return sum + el.size;
          }, 0);
          const avgSize = totalSize / clipboard.length;
          const offset = avgSize * 0.7;

          const newElements = clipboard.map(el => ({
            ...el,
            id: `${el.type}-${Date.now()}-${Math.random()}`,
            x: el.x + offset,
            y: el.y + offset
          }));

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
          // Start dragging multiple elements - DON'T change selection
          const dragOffsets = new Map<string, {x: number, y: number}>();
          selectedElementIds.forEach(id => {
            const el = scene.elements.find(e => e.id === id);
            if (el) {
              dragOffsets.set(id, { x: x - el.x, y: y - el.y });
            }
          });
          setDraggedMultiple({ offsetX: x, offsetY: y, initialOffsets: dragOffsets });
        } else {
          // Regular click: Select single and start dragging
          setSelectedElementId(clickedElement.id);
          setSelectedElementIds([]);
          setDraggedElement({
            id: clickedElement.id,
            offsetX: x - clickedElement.x,
            offsetY: y - clickedElement.y
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
      if (roomSubTool === 'rectangle') {
        // Start creating floor tile area with drag-to-draw rectangle (as polygon)
        if (!selectedFloorTexture) {
          // Cannot draw floor without texture selected
          return;
        }
        setRoomDrawStart({ x, y });
        const tempRoomElement: RoomElement = {
          id: 'temp',
          type: 'room',
          vertices: [
            { x, y },
            { x, y },
            { x, y },
            { x, y }
          ],
          wallOpenings: [],
          floorTextureUrl: selectedFloorTexture,
          tileSize: tileSize,
          showWalls: showWalls,
          wallTextureUrl: selectedWallTexture || '',
          wallThickness: wallThickness,
          name: 'Floor',
          notes: '',
          zIndex: -100,
          visible: true,
          widgets: []
        };
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
        const initialOffset = draggedMultiple.initialOffsets?.get(id);
        if (initialOffset) {
          updates.set(id, {
            x: x - initialOffset.x,
            y: y - initialOffset.y
          });
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
        if (element.type === 'room') {
          // Handle room resizing (rectangular)
          const room = element as RoomElement;
          const handle = resizingElement.handle;
          
          let newX = room.x;
          let newY = room.y;
          let newWidth = room.width;
          let newHeight = room.height;

          if (handle === 'nw') {
            newWidth = room.x + room.width - x;
            newHeight = room.y + room.height - y;
            newX = x;
            newY = y;
          } else if (handle === 'ne') {
            newWidth = x - room.x;
            newHeight = room.y + room.height - y;
            newY = y;
          } else if (handle === 'sw') {
            newWidth = room.x + room.width - x;
            newHeight = y - room.y;
            newX = x;
          } else if (handle === 'se') {
            newWidth = x - room.x;
            newHeight = y - room.y;
          }

          // Enforce minimum size
          if (newWidth < 20) newWidth = 20;
          if (newHeight < 20) newHeight = 20;

          updateElement(resizingElement.id, { x: newX, y: newY, width: newWidth, height: newHeight });
        } else {
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

    // Handle room drawing - update rectangle vertices
    if (roomDrawStart && tempRoom) {
      const minX = Math.min(x, roomDrawStart.x);
      const maxX = Math.max(x, roomDrawStart.x);
      const minY = Math.min(y, roomDrawStart.y);
      const maxY = Math.max(y, roomDrawStart.y);
      
      // Update 4 vertices to form rectangle
      setTempRoom({ 
        ...tempRoom, 
        vertices: [
          { x: minX, y: minY }, // Top-left
          { x: maxX, y: minY }, // Top-right
          { x: maxX, y: maxY }, // Bottom-right
          { x: minX, y: maxY }  // Bottom-left
        ]
      });
      return;
    }

    // Handle dragging
    if (draggedElement && scene) {
      updateElement(draggedElement.id, {
        x: x - draggedElement.offsetX,
        y: y - draggedElement.offsetY
      });
    }
  };

  const handleMouseUp = () => {
    // Save to history if we were dragging or resizing
    if (draggedElement || resizingElement || draggedMultiple) {
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

    // Finalize selection box
    if (selectionBox && scene) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const selected = scene.elements.filter(element => 
        element.x >= minX && element.x <= maxX &&
        element.y >= minY && element.y <= maxY
      ).map(e => e.id);

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
      // Calculate room dimensions from vertices
      const xs = tempRoom.vertices.map(v => v.x);
      const ys = tempRoom.vertices.map(v => v.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      
      // Only create room if it has some size (at least 20x20)
      if (width >= 20 && height >= 20) {
        saveToHistory();
        const finalRoom = { ...tempRoom, id: `room-${Date.now()}`, tileSize, showWalls, wallTextureUrl: selectedWallTexture || '', wallThickness };
        addElement(finalRoom);
        setSelectedElementId(finalRoom.id);
        setSelectedElementIds([]);
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
      
      // Handle room elements (rectangular)
      if (element.type === 'room') {
        const room = element as RoomElement;
        if (x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height) {
          return element;
        }
      } else {
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

    // Handle room elements (corner resize handles)
    if (element.type === 'room') {
      const room = element as RoomElement;
      const handles = [
        { name: 'nw', x: room.x, y: room.y },
        { name: 'ne', x: room.x + room.width, y: room.y },
        { name: 'sw', x: room.x, y: room.y + room.height },
        { name: 'se', x: room.x + room.width, y: room.y + room.height }
      ];

      for (const handle of handles) {
        const distance = Math.sqrt((x - handle.x) ** 2 + (y - handle.y) ** 2);
        if (distance <= handleSize) {
          return handle.name;
        }
      }
      return null;
    }

    // Handle circular elements (annotations and tokens)
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
            {tempRoom && tempRoom.id === 'temp' && tempRoom.width > 0 && tempRoom.height > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: tempRoom.x,
                  top: tempRoom.y,
                  width: tempRoom.width,
                  height: tempRoom.height,
                  opacity: 0.7,
                  pointerEvents: 'none'
                }}
              >
                {/* Floor */}
                <div
                  style={{
                    position: 'absolute',
                    inset: tempRoom.showWalls && tempRoom.wallTextureUrl ? `${tempRoom.wallThickness}px` : 0,
                    backgroundImage: `url("${tempRoom.floorTextureUrl}")`,
                    backgroundSize: `${tempRoom.tileSize}px ${tempRoom.tileSize}px`,
                    backgroundRepeat: 'repeat',
                    backgroundColor: '#1a1a1a'
                  }}
                />
                
                {/* Walls */}
                {tempRoom.showWalls && tempRoom.wallTextureUrl && (
                  <>
                    {/* Top wall */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: tempRoom.wallThickness,
                        backgroundImage: `url("${tempRoom.wallTextureUrl}")`,
                        backgroundSize: `${tempRoom.wallThickness}px ${tempRoom.wallThickness}px`,
                        backgroundRepeat: 'repeat'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: tempRoom.wallThickness,
                        backgroundImage: `url("${tempRoom.wallTextureUrl}")`,
                        backgroundSize: `${tempRoom.wallThickness}px ${tempRoom.wallThickness}px`,
                        backgroundRepeat: 'repeat'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: tempRoom.wallThickness,
                        backgroundImage: `url("${tempRoom.wallTextureUrl}")`,
                        backgroundSize: `${tempRoom.wallThickness}px ${tempRoom.wallThickness}px`,
                        backgroundRepeat: 'repeat'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: tempRoom.wallThickness,
                        backgroundImage: `url("${tempRoom.wallTextureUrl}")`,
                        backgroundSize: `${tempRoom.wallThickness}px ${tempRoom.wallThickness}px`,
                        backgroundRepeat: 'repeat'
                      }}
                    />
                  </>
                )}
                
                {/* Preview border */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -2,
                    border: '2px dashed #22c55e'
                  }}
                />
              </div>
            )}

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
    const hasWalls = element.showWalls && element.wallTextureUrl;
    
    return (
      <div
        style={{
          position: 'absolute',
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          pointerEvents: 'none'
        }}
      >
        {/* Floor - fills entire room area */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${element.floorTextureUrl}")`,
            backgroundSize: `${element.tileSize}px ${element.tileSize}px`,
            backgroundRepeat: 'repeat',
            backgroundColor: '#1a1a1a'
          }}
        />
        
        {/* Walls using borders */}
        {hasWalls && (
          <>
            {/* Top wall - render segments with gaps */}
            {(() => {
              const gaps = (element.wallGaps || []).filter(g => g.wall === 'top');
              if (gaps.length === 0) {
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: element.width,
                      height: element.wallThickness,
                      backgroundImage: `url("${element.wallTextureUrl}")`,
                      backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                      backgroundRepeat: 'repeat'
                    }}
                  />
                );
              }
              
              // Sort gaps and create segments
              const sortedGaps = [...gaps].sort((a, b) => a.start - b.start);
              const segments: { start: number; end: number }[] = [];
              let currentPos = 0;
              
              sortedGaps.forEach(gap => {
                if (currentPos < gap.start) {
                  segments.push({ start: currentPos, end: gap.start });
                }
                currentPos = Math.max(currentPos, gap.end);
              });
              
              if (currentPos < element.width) {
                segments.push({ start: currentPos, end: element.width });
              }
              
              return segments.map((seg, i) => (
                <div
                  key={`top-${i}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: seg.start,
                    width: seg.end - seg.start,
                    height: element.wallThickness,
                    backgroundImage: `url("${element.wallTextureUrl}")`,
                    backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                    backgroundRepeat: 'repeat'
                  }}
                />
              ));
            })()}
            
            {/* Right wall - render segments with gaps */}
            {(() => {
              const gaps = (element.wallGaps || []).filter(g => g.wall === 'right');
              if (gaps.length === 0) {
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: element.wallThickness,
                      height: element.height,
                      backgroundImage: `url("${element.wallTextureUrl}")`,
                      backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                      backgroundRepeat: 'repeat'
                    }}
                  />
                );
              }
              
              const sortedGaps = [...gaps].sort((a, b) => a.start - b.start);
              const segments: { start: number; end: number }[] = [];
              let currentPos = 0;
              
              sortedGaps.forEach(gap => {
                if (currentPos < gap.start) {
                  segments.push({ start: currentPos, end: gap.start });
                }
                currentPos = Math.max(currentPos, gap.end);
              });
              
              if (currentPos < element.height) {
                segments.push({ start: currentPos, end: element.height });
              }
              
              return segments.map((seg, i) => (
                <div
                  key={`right-${i}`}
                  style={{
                    position: 'absolute',
                    top: seg.start,
                    right: 0,
                    width: element.wallThickness,
                    height: seg.end - seg.start,
                    backgroundImage: `url("${element.wallTextureUrl}")`,
                    backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                    backgroundRepeat: 'repeat'
                  }}
                />
              ));
            })()}
            
            {/* Bottom wall - render segments with gaps */}
            {(() => {
              const gaps = (element.wallGaps || []).filter(g => g.wall === 'bottom');
              if (gaps.length === 0) {
                return (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: element.width,
                      height: element.wallThickness,
                      backgroundImage: `url("${element.wallTextureUrl}")`,
                      backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                      backgroundRepeat: 'repeat'
                    }}
                  />
                );
              }
              
              const sortedGaps = [...gaps].sort((a, b) => a.start - b.start);
              const segments: { start: number; end: number }[] = [];
              let currentPos = 0;
              
              sortedGaps.forEach(gap => {
                if (currentPos < gap.start) {
                  segments.push({ start: currentPos, end: gap.start });
                }
                currentPos = Math.max(currentPos, gap.end);
              });
              
              if (currentPos < element.width) {
                segments.push({ start: currentPos, end: element.width });
              }
              
              return segments.map((seg, i) => (
                <div
                  key={`bottom-${i}`}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: seg.start,
                    width: seg.end - seg.start,
                    height: element.wallThickness,
                    backgroundImage: `url("${element.wallTextureUrl}")`,
                    backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                    backgroundRepeat: 'repeat'
                  }}
                />
              ));
            })()}
            
            {/* Left wall - render segments with gaps */}
            {(() => {
              const gaps = (element.wallGaps || []).filter(g => g.wall === 'left');
              if (gaps.length === 0) {
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: element.wallThickness,
                      height: element.height,
                      backgroundImage: `url("${element.wallTextureUrl}")`,
                      backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                      backgroundRepeat: 'repeat'
                    }}
                  />
                );
              }
              
              const sortedGaps = [...gaps].sort((a, b) => a.start - b.start);
              const segments: { start: number; end: number }[] = [];
              let currentPos = 0;
              
              sortedGaps.forEach(gap => {
                if (currentPos < gap.start) {
                  segments.push({ start: currentPos, end: gap.start });
                }
                currentPos = Math.max(currentPos, gap.end);
              });
              
              if (currentPos < element.height) {
                segments.push({ start: currentPos, end: element.height });
              }
              
              return segments.map((seg, i) => (
                <div
                  key={`left-${i}`}
                  style={{
                    position: 'absolute',
                    top: seg.start,
                    left: 0,
                    width: element.wallThickness,
                    height: seg.end - seg.start,
                    backgroundImage: `url("${element.wallTextureUrl}")`,
                    backgroundSize: `${element.wallThickness}px ${element.wallThickness}px`,
                    backgroundRepeat: 'repeat'
                  }}
                />
              ));
            })()}
          </>
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: -2,
                border: '2px solid #22c55e',
                pointerEvents: 'none'
              }}
            />
            {/* Resize Handles for rooms - at corners */}
            <div style={{ position: 'absolute', left: -4 / viewport.zoom, top: -4 / viewport.zoom, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: -4 / viewport.zoom, top: -4 / viewport.zoom, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', left: -4 / viewport.zoom, bottom: -4 / viewport.zoom, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', right: -4 / viewport.zoom, bottom: -4 / viewport.zoom, width: 8 / viewport.zoom, height: 8 / viewport.zoom, backgroundColor: 'white', border: '1px solid #22c55e', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
          </>
        )}
      </div>
    );
  }

  return null;
};

export default Canvas;
