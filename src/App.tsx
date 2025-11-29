import { useState, useEffect, useRef } from 'react';
import { Scene, MapElement, ToolType, TokenTemplate, ColorType, IconType, Collection, CollectionAppearance, RoomSubTool } from './types';
import Canvas from './components/Canvas';
import RightPanel from './components/RightPanel';
import LeftPanel from './components/LeftPanel';

function App() {
  // Scene state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  
  // Collection state
  const [collections, setCollections] = useState<Collection[]>([]);

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [activeColor, setActiveColor] = useState<ColorType>('red');
  const [activeIcon] = useState<IconType>('circle');

  // Token library
  const [tokenTemplates, setTokenTemplates] = useState<TokenTemplate[]>([]);
  const [activeTokenTemplate, setActiveTokenTemplate] = useState<TokenTemplate | null>(null);

  // Selection
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  // Left panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);

  // Badge state
  const [showTokenBadges, setShowTokenBadges] = useState(false);

  // Recent tokens state for quick picker
  const [recentTokens, setRecentTokens] = useState<TokenTemplate[]>([]);

  // Room builder state
  const [selectedFloorTexture, setSelectedFloorTexture] = useState<string | null>(null);
  const [tileSize, setTileSize] = useState<number>(50);
  const [showWalls, setShowWalls] = useState<boolean>(true);
  const [selectedWallTexture, setSelectedWallTexture] = useState<string | null>(null);
  const [wallThickness, setWallThickness] = useState<number>(8);
  const [wallTileSize, setWallTileSize] = useState<number>(50);
  const [roomSubTool, setRoomSubTool] = useState<RoomSubTool>('rectangle');

  // Merge rooms handler ref
  const mergeRoomsHandlerRef = useRef<(() => void) | null>(null);
  const setMergeRoomsHandler = (handler: () => void) => {
    mergeRoomsHandlerRef.current = handler;
  };

  // Global ESC handler to blur text inputs (first ESC press)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
          activeEl.blur();
          e.preventDefault();
          e.stopPropagation();
        }
        // If no text field is focused, let the event bubble to close dialogs/popups
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);

  // Set default token (Orc from monsters)
  useEffect(() => {
    if (!activeTokenTemplate) {
      setActiveTokenTemplate({
        id: 'orc-default',
        name: 'Orc',
        imageUrl: 'https://dmp.natixlabs.com/tokens/monsters/Orc.png',
        color: 'red',
        isShape: false,
        isPOI: false
      });
    }
  }, [activeTokenTemplate]);

  // Get active scene
  const activeScene = scenes.find(s => s.id === activeSceneId) || null;

  // Get selected element(s)
  const selectedElement = activeScene?.elements.find(e => e.id === selectedElementId) || null;
  const selectedElements = activeScene?.elements.filter(e => selectedElementIds.includes(e.id)) || [];

  // Update scene
  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
  };

  // Add element to active scene
  const addElement = (element: MapElement) => {
    if (!activeSceneId) return;
    // Ensure rooms are always behind tokens by assigning appropriate zIndex
    const elementWithZIndex = {
      ...element,
      zIndex: element.type === 'room' ? -100 : (element.zIndex ?? 0)
    };
    updateScene(activeSceneId, {
      elements: [...(activeScene?.elements || []), elementWithZIndex]
    });
    setSelectedElementId(element.id);
  };

  // Update element in active scene
  const updateElement = (elementId: string, updates: Partial<MapElement>) => {
    if (!activeSceneId || !activeScene) return;
    updateScene(activeSceneId, {
      elements: activeScene.elements.map(e => 
        e.id === elementId ? { ...e, ...updates } as MapElement : e
      )
    });
  };

  // Update multiple elements at once (for batch operations)
  const updateElements = (updates: Map<string, Partial<MapElement>>) => {
    if (!activeSceneId || !activeScene) return;
    updateScene(activeSceneId, {
      elements: activeScene.elements.map(e => {
        const elementUpdates = updates.get(e.id);
        return elementUpdates ? { ...e, ...elementUpdates } as MapElement : e;
      })
    });
  };

  // Delete element
  const deleteElement = (elementId: string) => {
    if (!activeSceneId || !activeScene) return;
    updateScene(activeSceneId, {
      elements: activeScene.elements.filter(e => e.id !== elementId)
    });
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
    setSelectedElementIds(prev => prev.filter(id => id !== elementId));
  };

  // Delete multiple elements
  const deleteElements = (elementIds: string[]) => {
    if (!activeSceneId || !activeScene) return;
    updateScene(activeSceneId, {
      elements: activeScene.elements.filter(e => !elementIds.includes(e.id))
    });
    setSelectedElementId(null);
    setSelectedElementIds([]);
  };

  // Add new scene
  const addScene = (name: string, backgroundMapUrl: string, backgroundMapName: string, collectionId?: string) => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name,
      backgroundMapUrl,
      backgroundMapName,
      elements: [],
      width: 0,
      height: 0,
      collectionId
    };
    setScenes(prev => [...prev, newScene]);
    setActiveSceneId(newScene.id);
  };

  // Update scene name
  const updateSceneName = (sceneId: string, newName: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, name: newName } : s));
  };

  // Delete scene
  const deleteScene = (sceneId: string) => {
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (activeSceneId === sceneId) {
      setActiveSceneId(null);
    }
  };

  // Add collection
  const addCollection = (name: string) => {
    const newCollection: Collection = {
      id: `collection-${Date.now()}`,
      name
    };
    setCollections(prev => [...prev, newCollection]);
    return newCollection.id;
  };

  // Update collection name
  const updateCollectionName = (collectionId: string, newName: string) => {
    setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, name: newName } : c));
  };

  // Update collection appearance
  const updateCollectionAppearance = (collectionId: string, appearance?: CollectionAppearance) => {
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        if (appearance === undefined) {
          // Remove appearance property
          const { appearance: _, ...rest } = c;
          return rest;
        }
        return { ...c, appearance };
      }
      return c;
    }));
  };

  // Delete collection
  const deleteCollection = (collectionId: string) => {
    setCollections(prev => prev.filter(c => c.id !== collectionId));
    // Remove collectionId from all scenes in that collection
    setScenes(prev => prev.map(s => s.collectionId === collectionId ? { ...s, collectionId: undefined } : s));
  };

  // Add token template
  const addTokenTemplate = (name: string, imageUrl: string) => {
    const newTemplate: TokenTemplate = {
      id: `token-${Date.now()}`,
      name,
      imageUrl
    };
    setTokenTemplates(prev => [...prev, newTemplate]);
  };

  // Handle token selection from quick picker
  const handleSelectTokenFromPicker = (token: TokenTemplate) => {
    setActiveTokenTemplate(token);
    setActiveTool('token');
  };

  return (
    <div className="flex h-screen w-screen bg-dm-dark text-gray-200">
      {/* Left Panel - Properties */}
      <LeftPanel
        selectedElement={selectedElement}
        selectedElements={selectedElements}
        updateElement={updateElement}
        deleteElement={deleteElement}
        deleteElements={deleteElements}
        isOpen={leftPanelOpen}
        setIsOpen={setLeftPanelOpen}
        centerViewportOnElement={(_id) => {
          // This will be passed to Canvas, but for now we can leave it as a placeholder
          // The actual implementation needs to be in Canvas
        }}
      />

      {/* Center Canvas */}
      <Canvas
        scene={activeScene}
        activeTool={activeTool}
        activeColor={activeColor}
        activeIcon={activeIcon}
        activeTokenTemplate={activeTokenTemplate}
        selectedElementId={selectedElementId}
        setSelectedElementId={setSelectedElementId}
        selectedElementIds={selectedElementIds}
        setSelectedElementIds={setSelectedElementIds}
        addElement={addElement}
        updateElement={updateElement}
        updateElements={updateElements}
        deleteElements={deleteElements}
        updateScene={updateScene}
        setActiveTool={setActiveTool}
        activeSceneId={activeSceneId}
        leftPanelOpen={leftPanelOpen}
        showTokenBadges={showTokenBadges}
        setShowTokenBadges={setShowTokenBadges}
        onDoubleClickElement={(_elementId: string) => {
          setLeftPanelOpen(true);
          setLeftPanelOpen(true);
        }}
        recentTokens={recentTokens}
        onSelectToken={handleSelectTokenFromPicker}
        selectedColor={activeColor}
        onColorChange={setActiveColor}
        selectedFloorTexture={selectedFloorTexture}
        tileSize={tileSize}
        showWalls={showWalls}
        selectedWallTexture={selectedWallTexture}
        wallThickness={wallThickness}
        wallTileSize={wallTileSize}
        roomSubTool={roomSubTool}
        setRoomSubTool={setRoomSubTool}
        onMergeRooms={setMergeRoomsHandler}
      />

      {/* Right Panel */}
      <RightPanel
        scenes={scenes}
        activeSceneId={activeSceneId}
        setActiveSceneId={setActiveSceneId}
        addScene={addScene}
        updateSceneName={updateSceneName}
        deleteScene={deleteScene}
        collections={collections}
        addCollection={addCollection}
        updateCollectionName={updateCollectionName}
        updateCollectionAppearance={updateCollectionAppearance}
        deleteCollection={deleteCollection}
        selectedElement={selectedElement}
        updateElement={updateElement}
        deleteElement={deleteElement}
        tokenTemplates={tokenTemplates}
        addTokenTemplate={addTokenTemplate}
        setActiveTool={setActiveTool}
        setActiveTokenTemplate={setActiveTokenTemplate}
        onRecentTokensChange={setRecentTokens}
        activeTool={activeTool}
        selectedFloorTexture={selectedFloorTexture}
        onSelectFloorTexture={setSelectedFloorTexture}
        tileSize={tileSize}
        onTileSizeChange={setTileSize}
        showWalls={showWalls}
        onShowWallsChange={setShowWalls}
        selectedWallTexture={selectedWallTexture}
        onSelectWallTexture={setSelectedWallTexture}
        wallThickness={wallThickness}
        onWallThicknessChange={setWallThickness}
        wallTileSize={wallTileSize}
        onWallTileSizeChange={setWallTileSize}
        roomSubTool={roomSubTool}
        setRoomSubTool={setRoomSubTool}
        onMergeRooms={mergeRoomsHandlerRef.current || undefined}
      />
    </div>
  );
}

export default App;
