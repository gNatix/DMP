import { useState, useEffect, useRef } from 'react';
import { Scene, MapElement, ToolType, TokenTemplate, ColorType, IconType, Collection, CollectionAppearance, RoomSubTool } from './types';
import Canvas from './components/Canvas';
import { DEFAULT_COLLECTION_NAME, DEFAULT_CANVAS_NAME } from './constants';
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

  // Load tokens from webhotel on startup
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const configResponse = await fetch('/config.json');
        const config = await configResponse.json();
        
        const categories = ['monsters', 'npcs', 'items', 'objects', 'other', 'environment'];
        const allTokens: TokenTemplate[] = [];
        
        for (const category of categories) {
          try {
            const response = await fetch(`${config.webhotelApiUrl}?path=tokens/${category}`);
            if (!response.ok) continue;
            
            const files = await response.json();
            
            const imageTokens = files
              .filter((file: any) => 
                file.type === 'file' && 
                /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
              )
              .map((file: any) => ({
                id: `token-${category}-${file.name.replace(/\.[^/.]+$/, '')}`,
                name: file.name.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
                imageUrl: file.download_url,
                category: category as 'monsters' | 'npcs' | 'items' | 'objects' | 'other' | 'environment'
              }));
            
            allTokens.push(...imageTokens);
          } catch (err) {
            console.log(`No files in tokens/${category}`);
          }
        }
        
        // Add shape and POI tokens
        const shapeTokens: TokenTemplate[] = [
          { id: 'shape-circle', name: 'Circle', isShape: true, icon: 'circle', category: 'shapes' },
          { id: 'shape-square', name: 'Square', isShape: true, icon: 'square', category: 'shapes' },
          { id: 'shape-triangle', name: 'Triangle', isShape: true, icon: 'triangle', category: 'shapes' },
          { id: 'shape-star', name: 'Star', isShape: true, icon: 'star', category: 'shapes' },
          { id: 'shape-diamond', name: 'Diamond', isShape: true, icon: 'diamond', category: 'shapes' },
          { id: 'shape-heart', name: 'Heart', isShape: true, icon: 'heart', category: 'shapes' },
        ];

        const poiTokens: TokenTemplate[] = [
          { id: 'poi-quest', name: 'Quest Marker', isPOI: true, icon: 'quest', category: 'poi' },
          { id: 'poi-clue', name: 'Clue Marker', isPOI: true, icon: 'clue', category: 'poi' },
          { id: 'poi-hidden', name: 'Hidden Spot', isPOI: true, icon: 'hidden', category: 'poi' },
          { id: 'poi-door', name: 'Secret Door', isPOI: true, icon: 'door', category: 'poi' },
          { id: 'poi-landmark', name: 'Landmark', isPOI: true, icon: 'landmark', category: 'poi' },
          { id: 'poi-footprint', name: 'Tracks/Footprints', isPOI: true, icon: 'footprint', category: 'poi' },
          { id: 'poi-info', name: 'Information', isPOI: true, icon: 'info', category: 'poi' },
          { id: 'poi-skull', name: 'Skull/Death', isPOI: true, icon: 'skull', category: 'poi' },
        ];
        
        setTokenTemplates([...allTokens, ...shapeTokens, ...poiTokens]);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      }
    };

    loadTokens();
  }, []);

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

  // Center element handler ref
  const centerElementHandlerRef = useRef<((elementId: string) => void) | null>(null);
  const setCenterElementHandler = (handler: (elementId: string) => void) => {
    centerElementHandlerRef.current = handler;
  };

  const handleCenterElement = (elementId: string) => {
    if (centerElementHandlerRef.current) {
      centerElementHandlerRef.current(elementId);
    }
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
        category: 'monsters',
        color: 'red',
        isShape: false,
        isPOI: false
      });
    }
  }, [activeTokenTemplate]);

  // Create default hidden canvas on startup
  useEffect(() => {
    if (scenes.length === 0 && collections.length === 0) {
      const defaultCollectionId = `collection-${Date.now()}`;
      const defaultCollection: Collection = {
        id: defaultCollectionId,
        name: DEFAULT_COLLECTION_NAME,
        isAutoCreated: true
      };
      
      const defaultCanvas: Scene = {
        id: `scene-${Date.now()}`,
        name: DEFAULT_CANVAS_NAME,
        backgroundMapUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="3200" height="2400"%3E%3Crect width="3200" height="2400" fill="transparent"/%3E%3C/svg%3E',
        backgroundMapName: DEFAULT_CANVAS_NAME,
        elements: [],
        width: 3200,
        height: 2400,
        collectionId: defaultCollectionId,
        isAutoCreated: true
      };
      
      setCollections([defaultCollection]);
      setScenes([defaultCanvas]);
      setActiveSceneId(defaultCanvas.id);
    }
  }, []);

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
    
    // Check if we're adding to an auto-created canvas with no elements yet
    const currentScene = scenes.find(s => s.id === activeSceneId);
    if (currentScene?.isAutoCreated && currentScene.elements.length === 0) {
      // This is the first element being added to the auto-created canvas
      // Create a new scene to replace it
      const newSceneId = `scene-${Date.now()}`;
      const newSceneName = element.type === 'room' ? 'New Map' : 'New Scene';
      
      const newScene: Scene = {
        id: newSceneId,
        name: newSceneName,
        backgroundMapUrl: currentScene.backgroundMapUrl,
        backgroundMapName: newSceneName,
        elements: [],
        width: currentScene.width,
        height: currentScene.height,
        collectionId: currentScene.collectionId,
        isAutoCreated: false
      };
      
      // Replace the auto-created scene with the new one
      setScenes(prev => prev.map(s => s.id === activeSceneId ? newScene : s));
      setActiveSceneId(newSceneId);
      
      // Add the element to the new scene (will be picked up by the update below)
      const elementWithZIndex = {
        ...element,
        zIndex: element.type === 'room' ? -100 : (element.zIndex ?? 0)
      };
      
      // Update the new scene with the element
      setTimeout(() => {
        updateScene(newSceneId, {
          elements: [elementWithZIndex]
        });
        setSelectedElementId(element.id);
      }, 0);
      
      return;
    }
    
    // Normal flow: add element to existing scene
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
    
    // If adding to an auto-created collection, make it visible
    if (collectionId) {
      setCollections(prev => {
        const targetCollection = prev.find(c => c.id === collectionId);
        if (targetCollection?.isAutoCreated) {
          return prev.map(c => 
            c.id === collectionId ? { ...c, isAutoCreated: false } : c
          );
        }
        return prev;
      });
    }
  };

  // Add new canvas scene (without background map)
  const addCanvasScene = (collectionId?: string): string | undefined => {
    // Find existing canvas scenes to generate unique name
    const canvasScenes = scenes.filter(s => s.name.match(/^Canvas( \(\d+\))?$/));
    let canvasNumber = 1;
    
    if (canvasScenes.length > 0) {
      const numbers = canvasScenes
        .map(s => {
          const match = s.name.match(/Canvas \((\d+)\)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      
      if (numbers.length > 0) {
        canvasNumber = Math.max(...numbers) + 1;
      }
    }
    
    const canvasName = canvasNumber === 1 ? 'Canvas (1)' : `Canvas (${canvasNumber})`;
    
    // Create empty canvas with transparent background
    const canvasUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="3200" height="2400"%3E%3Crect width="3200" height="2400" fill="transparent"/%3E%3C/svg%3E';
    
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name: canvasName,
      backgroundMapUrl: canvasUrl,
      backgroundMapName: canvasName,
      elements: [],
      width: 3200,
      height: 2400,
      collectionId,
      isAutoCreated: false
    };
    setScenes(prev => [...prev, newScene]);
    setActiveSceneId(newScene.id);
    
    // If adding to an auto-created collection, make it visible
    if (collectionId) {
      setCollections(prev => {
        const targetCollection = prev.find(c => c.id === collectionId);
        if (targetCollection?.isAutoCreated) {
          return prev.map(c => 
            c.id === collectionId ? { ...c, isAutoCreated: false } : c
          );
        }
        return prev;
      });
    }
    
    return newScene.id;
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
      name,
      isAutoCreated: false
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
        onDoubleClickElement={() => setLeftPanelOpen(true)}
        recentTokens={recentTokens}
        tokenTemplates={tokenTemplates}
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
        onCenterElementReady={setCenterElementHandler}
      />

      {/* Right Panel */}
      <RightPanel
        scenes={scenes}
        activeSceneId={activeSceneId}
        setActiveSceneId={setActiveSceneId}
        addScene={addScene}
        addCanvasScene={addCanvasScene}
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
        activeTokenTemplate={activeTokenTemplate}
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
        onCenterElement={handleCenterElement}
      />
    </div>
  );
}

export default App;
