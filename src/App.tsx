import { useState, useEffect, useRef } from 'react';
import { Scene, MapElement, ToolType, TokenTemplate, ColorType, IconType, Collection, CollectionAppearance, RoomSubTool, TerrainShapeMode, ViewMode } from './types';
import Canvas from './components/Canvas';
import { DEFAULT_COLLECTION_NAME, DEFAULT_CANVAS_NAME } from './constants';
import RightPanel from './components/rightPanel/RightPanel';
import LeftPanel from './components/leftPanel/LeftPanel';
import PlaylistPanel from './components/gameMode/PlaylistPanel';
import InfoBox from './components/gameMode/InfoBox';
import InfoBoxConnector from './components/gameMode/InfoBoxConnector';
import LoginDialog from './components/LoginDialog';
import { useAuth } from './auth/AuthContext';
import { saveSceneToSupabase, loadScenesFromSupabase, deleteSceneFromSupabase } from './services/sceneService';
import { saveUserSettings, loadUserSettings } from './services/userSettingsService';

// Generate UUID v4
const generateUUID = (): string => {
  return crypto.randomUUID();
};

function App() {
  // Auth state - simple user object
  const { user, loading: authLoading } = useAuth();
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('planning');
  
  // Game mode state
  const [openInfoBoxes, setOpenInfoBoxes] = useState<Set<string>>(new Set());
  const [pinnedInfoBoxes, setPinnedInfoBoxes] = useState<Set<string>>(new Set());
  const [gameModeError, setGameModeError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [infoBoxPositions, setInfoBoxPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  
  // Scene state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [hasLoadedFromCloud, setHasLoadedFromCloud] = useState(false);
  
  // Collection state
  const [collections, setCollections] = useState<Collection[]>([]);

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [activeColor, setActiveColor] = useState<ColorType>('red');
  const [activeIcon] = useState<IconType>('circle');

  // Token library
  const [tokenTemplates, setTokenTemplates] = useState<TokenTemplate[]>([]);
  const [activeTokenTemplate, setActiveTokenTemplate] = useState<TokenTemplate | null>(null);

  // Load tokens from webhotel on startup (with recursive subfolder support)
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const configResponse = await fetch('/config.json');
        const config = await configResponse.json();
        
        const categories = ['monsters', 'npcs', 'items', 'objects', 'other', 'environment'];
        const allTokens: TokenTemplate[] = [];
        
        // Recursive function to fetch tokens from a path (including subfolders)
        const fetchTokensRecursive = async (path: string, category: string): Promise<TokenTemplate[]> => {
          const tokens: TokenTemplate[] = [];
          
          try {
            const response = await fetch(`${config.webhotelApiUrl}?path=${path}`);
            if (!response.ok) return tokens;
            
            const data = await response.json();
            
            // Handle both old (array) and new ({folders, files}) format
            const files = data.files || data;
            const folders = data.folders || [];
            
            // Process files in this directory
            if (Array.isArray(files)) {
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
              tokens.push(...imageTokens);
            }
            
            // Recursively fetch from subfolders
            for (const folder of folders) {
              const subTokens = await fetchTokensRecursive(folder.path, category);
              tokens.push(...subTokens);
            }
          } catch (err) {
            console.log(`No files in ${path}`);
          }
          
          return tokens;
        };
        
        // Fetch tokens from all categories (with recursive subfolder support)
        for (const category of categories) {
          const categoryTokens = await fetchTokensRecursive(`tokens/${category}`, category);
          allTokens.push(...categoryTokens);
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
  const [tileSize, setTileSize] = useState<number>(30);
  const [showWalls, setShowWalls] = useState<boolean>(true);
  const [selectedWallTexture, setSelectedWallTexture] = useState<string | null>(null);
  const [wallThickness, setWallThickness] = useState<number>(12);
  const [wallTileSize, setWallTileSize] = useState<number>(30);
  const [roomSubTool, setRoomSubTool] = useState<RoomSubTool>('rectangle');
  const [autoMergeRooms, setAutoMergeRooms] = useState<boolean>(true); // Default: auto-merge enabled
  const [defaultCornerRadius, setDefaultCornerRadius] = useState<number>(1); // Default: rounded corners ON (1 = on, 0 = off)

  // Wall Cutter tool state
  const [wallCutterToolBrushSize, setWallCutterToolBrushSize] = useState<number>(30);

  // Background painter state
  const [backgroundBrushSize, setBackgroundBrushSize] = useState<number>(100);
  const [terrainBrushes, setTerrainBrushes] = useState<{ name: string; download_url: string }[]>([]);
  const [selectedTerrainBrush, setSelectedTerrainBrush] = useState<string | null>(null);
  const [wallTextures, setWallTextures] = useState<{ name: string; download_url: string }[]>([]);
  const [rightPanelActiveTab, setRightPanelActiveTab] = useState<'scenes' | 'tokens' | 'draw' | 'modules' | 'xlab' | 'settings'>('scenes');

  // X-Lab experimental features
  const [xlabShapeMode, setXlabShapeMode] = useState<TerrainShapeMode>(null);

  // Reset cloud load state when user logs out
  useEffect(() => {
    if (!user && hasLoadedFromCloud) {
      setHasLoadedFromCloud(false);
      setScenes([]);
      setActiveSceneId(null);
      setCollections([]);
    }
  }, [user, hasLoadedFromCloud]);

  // Load scenes AND user settings from Supabase when user is available
  useEffect(() => {
    // Skip if still loading auth or already loaded from cloud
    if (authLoading || hasLoadedFromCloud) return;
    
    // If no user, we're done (not logged in)
    if (!user) return;

    const loadUserData = async () => {
      console.log('[APP] Loading user data from cloud for user:', user.id);
      
      // Load scenes and settings in parallel
      const [scenesResult, settingsResult] = await Promise.all([
        loadScenesFromSupabase(user.id),
        loadUserSettings(user.id),
      ]);
      
      // Mark as loaded from cloud (even on error, don't retry)
      setHasLoadedFromCloud(true);

      // Handle scenes
      if (scenesResult.error) {
        console.error('[APP] Failed to load cloud scenes:', scenesResult.error);
      } else if (scenesResult.scenes && scenesResult.scenes.length > 0) {
        console.log('[APP] Loaded', scenesResult.scenes.length, 'scenes from cloud');
        setScenes(scenesResult.scenes);
      }

      // Handle settings (collections, active scene, etc.)
      if (settingsResult.error) {
        console.error('[APP] Failed to load user settings:', settingsResult.error);
      } else if (settingsResult.settings) {
        console.log('[APP] Loaded user settings from cloud');
        
        // Restore collections
        if (settingsResult.settings.collections.length > 0) {
          setCollections(settingsResult.settings.collections);
        }
        
        // NOTE: We do NOT restore viewport from cloud settings.
        // Each scene should center itself when opened based on its map dimensions.
        // Restoring a global viewport causes issues when switching between scenes.
        
        // Restore active scene (if it exists in loaded scenes)
        if (settingsResult.settings.activeSceneId) {
          const sceneExists = scenesResult.scenes?.some(s => s.id === settingsResult.settings!.activeSceneId);
          if (sceneExists) {
            setActiveSceneId(settingsResult.settings.activeSceneId);
          } else if (scenesResult.scenes && scenesResult.scenes[0]) {
            setActiveSceneId(scenesResult.scenes[0].id);
          }
        } else if (scenesResult.scenes && scenesResult.scenes[0]) {
          setActiveSceneId(scenesResult.scenes[0].id);
        }
      } else {
        // No settings saved yet - set first scene as active
        if (scenesResult.scenes && scenesResult.scenes[0]) {
          setActiveSceneId(scenesResult.scenes[0].id);
        }
      }
    };

    loadUserData();
  }, [user, authLoading, hasLoadedFromCloud]);

  // Auto-save active scene to Supabase when it changes
  useEffect(() => {
    // Only save if logged in and we've already loaded from cloud
    if (!user || !activeSceneId || !hasLoadedFromCloud) {
      if (user && activeSceneId && !hasLoadedFromCloud) {
        console.warn('[AUTO-SAVE BLOCKED] hasLoadedFromCloud is false!');
      }
      return;
    }

    const activeScene = scenes.find(s => s.id === activeSceneId);
    if (!activeScene) return;

    // Debounce auto-save (wait 1 second after last change)
    const timeoutId = setTimeout(async () => {
      console.log('[AUTO-SAVE] Saving scene to Supabase:', activeScene.name);
      await saveSceneToSupabase(activeScene, user.id, user.handle, user.authProvider);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [scenes, activeSceneId, user, hasLoadedFromCloud]);

  // Auto-save user settings (collections, activeSceneId, viewport) when they change
  useEffect(() => {
    // Only save if logged in and we've already loaded from cloud
    if (!user || !hasLoadedFromCloud) return;

    // Debounce auto-save (wait 500ms after last change)
    const timeoutId = setTimeout(async () => {
      await saveUserSettings(user.id, {
        collections,
        activeSceneId,
        // NOTE: We don't save viewport - each scene centers itself when opened
      }, user.handle, user.authProvider);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [collections, activeSceneId, user, hasLoadedFromCloud]);

  // Load terrain brushes on mount
  useEffect(() => {
    const loadTerrainBrushes = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=terrain-brushes');
        const data = await response.json();
        // Handle new format {folders, files} or old array format
        const files = data.files || data;
        setTerrainBrushes(files);
        // Auto-select first brush
        if (files.length > 0) {
          setSelectedTerrainBrush(files[0].download_url);
        }
      } catch (error) {
        console.error('Failed to load terrain brushes:', error);
      }
    };
    loadTerrainBrushes();
  }, []);

  // Load wall textures on mount
  useEffect(() => {
    const loadWallTextures = async () => {
      try {
        const response = await fetch('https://dmp.natixlabs.com/list-files.php?path=room-elements/walls');
        const data = await response.json();
        // Handle new format {folders, files} or old array format
        const files = data.files || data;
        setWallTextures(files);
        // Auto-select first texture
        if (files.length > 0 && !selectedWallTexture) {
          setSelectedWallTexture(files[0].download_url);
        }
      } catch (error) {
        console.error('Failed to load wall textures:', error);
      }
    };
    loadWallTextures();
  }, []);

  // Merge rooms handler ref
  const mergeRoomsHandlerRef = useRef<(() => void) | null>(null);
  const setMergeRoomsHandler = (handler: () => void) => {
    mergeRoomsHandlerRef.current = handler;
  };

  // Merge walls handler ref
  const mergeWallsHandlerRef = useRef<(() => void) | null>(null);
  const setMergeWallsHandler = (handler: () => void) => {
    mergeWallsHandlerRef.current = handler;
  };

  // Center element handler ref
  const centerElementHandlerRef = useRef<((elementId: string) => void) | null>(null);
  const setCenterElementHandler = (handler: (elementId: string) => void) => {
    centerElementHandlerRef.current = handler;
  };

  // Hide tool preview handler ref (for side panels to hide token/brush cursors)
  const hideToolPreviewHandlerRef = useRef<(() => void) | null>(null);
  const setHideToolPreviewHandler = (handler: () => void) => {
    hideToolPreviewHandlerRef.current = handler;
  };

  const handleHideToolPreview = () => {
    if (hideToolPreviewHandlerRef.current) {
      hideToolPreviewHandlerRef.current();
    }
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
      
      // Use same canvas2-mode setup as +Canvas button
      const defaultCanvas: Scene = {
        id: generateUUID(),
        name: DEFAULT_CANVAS_NAME,
        backgroundMapUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250000%22 height=%2250000%22%3E%3Crect width=%2250000%22 height=%2250000%22 fill=%22transparent%22/%3E%3C/svg%3E',
        backgroundMapName: DEFAULT_CANVAS_NAME,
        elements: [],
        width: 50000,
        height: 50000,
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

  // Get modular room wall groups from active scene
  const wallGroups = activeScene?.modularRoomsState?.wallGroups || [];

  // Update a wall group's properties (e.g., wallStyleId)
  const updateWallGroup = (groupId: string, updates: Partial<{ wallStyleId: string }>) => {
    if (!activeSceneId || !activeScene) return;
    
    const currentState = activeScene.modularRoomsState || { wallGroups: [], doors: [] };
    const updatedGroups = currentState.wallGroups.map(g => 
      g.id === groupId ? { ...g, ...updates } : g
    );
    
    updateScene(activeSceneId, {
      modularRoomsState: {
        ...currentState,
        wallGroups: updatedGroups,
      }
    });
  };

  // State for dragging modular floor from panel
  const [placingModularFloor, setPlacingModularFloor] = useState<{
    floorStyleId: string;
    tilesW: number;
    tilesH: number;
    imageUrl: string;
  } | null>(null);

  // Default wall style for new modular rooms
  const [defaultWallStyleId, setDefaultWallStyleId] = useState<string>('worn-castle');

  // Handle starting drag of modular floor from panel
  const handleStartDragModularFloor = (floorStyleId: string, tilesW: number, tilesH: number, imageUrl: string) => {
    setPlacingModularFloor({ floorStyleId, tilesW, tilesH, imageUrl });
    setActiveTool('modularRoom');
  };

  // Update scene
  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
    // Check if we're adding terrain stamps to an auto-created canvas
    const currentScene = scenes.find(s => s.id === sceneId);
    if (currentScene?.isAutoCreated && 
        updates.terrainStamps && 
        updates.terrainStamps.length > 0 && 
        (!currentScene.terrainStamps || currentScene.terrainStamps.length === 0)) {
      
      console.log('[APP] First terrain paint on auto-created canvas - converting to real scene');
      
      // Create a new real scene to replace the auto-created one
      const newSceneId = generateUUID();
      const newSceneName = 'New Map';
      
      const newScene: Scene = {
        id: newSceneId,
        name: newSceneName,
        backgroundMapUrl: currentScene.backgroundMapUrl,
        backgroundMapName: newSceneName,
        elements: currentScene.elements || [],
        terrainStamps: updates.terrainStamps,
        width: currentScene.width,
        height: currentScene.height,
        collectionId: currentScene.collectionId,
        isAutoCreated: false
      };
      
      // Replace the auto-created scene with the new one
      setScenes(prev => prev.map(s => s.id === sceneId ? newScene : s));
      setActiveSceneId(newSceneId);
      
      return;
    }
    
    // Normal flow: update existing scene
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
  };

  // Add element to active scene
  const addElement = (element: MapElement) => {
    console.log('[APP] addElement called with:', element.id, element.type);
    if (element.type === 'wall') {
      const vertices = (element as any).vertices;
      console.log('[APP] Adding wall with vertices:', JSON.stringify(vertices, null, 2));
      
      // Check for duplicate vertices
      if (vertices && vertices.length === 2) {
        const [v1, v2] = vertices;
        if (v1.x === v2.x && v1.y === v2.y) {
          console.error('[APP] ERROR: Wall has identical start and end vertices!', vertices);
        }
        const distance = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
        console.log('[APP] Wall length:', distance);
      }
    }
    if (!activeSceneId) return;
    
    // Check if we're adding to an auto-created canvas with no elements yet
    const currentScene = scenes.find(s => s.id === activeSceneId);
    if (currentScene?.isAutoCreated && currentScene.elements.length === 0) {
      // This is the first element being added to the auto-created canvas
      // Create a new scene to replace it
      const newSceneId = generateUUID();
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

  // Activate auto-created scene (called when first terrain brush is painted)
  const activateAutoCreatedScene = () => {
    if (!activeSceneId) return;
    
    const currentScene = scenes.find(s => s.id === activeSceneId);
    if (currentScene?.isAutoCreated && currentScene.elements.length === 0) {
      // This is the first action on the auto-created canvas
      // Create a new scene to replace it
      const newSceneId = generateUUID();
      const newSceneName = 'New Map';
      
      const newScene: Scene = {
        id: newSceneId,
        name: newSceneName,
        backgroundMapUrl: currentScene.backgroundMapUrl,
        backgroundMapName: newSceneName,
        elements: [],
        terrainTiles: currentScene.terrainTiles, // Preserve any terrain tiles
        width: currentScene.width,
        height: currentScene.height,
        collectionId: currentScene.collectionId,
        isAutoCreated: false
      };
      
      // Replace the auto-created scene with the new one
      setScenes(prev => prev.map(s => s.id === activeSceneId ? newScene : s));
      setActiveSceneId(newSceneId);
      
      // Make the collection visible if it was auto-created
      if (currentScene.collectionId) {
        setCollections(prev => {
          const targetCollection = prev.find(c => c.id === currentScene.collectionId);
          if (targetCollection?.isAutoCreated) {
            return prev.map(c => 
              c.id === currentScene.collectionId ? { ...c, isAutoCreated: false } : c
            );
          }
          return prev;
        });
      }
    }
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
    console.log('[APP] deleteElements called with:', elementIds);
    if (!activeSceneId || !activeScene) return;
    console.log('[APP] Current elements count:', activeScene.elements.length);
    console.log('[APP] Current element IDs:', activeScene.elements.map(e => e.id));
    console.log('[APP] Current walls with vertices:', activeScene.elements
      .filter(e => e.type === 'wall')
      .map(e => ({ id: e.id, vertices: (e as any).vertices }))
    );
    const newElements = activeScene.elements.filter(e => !elementIds.includes(e.id));
    console.log('[APP] After filter, elements count:', newElements.length);
    console.log('[APP] After filter, element IDs:', newElements.map(e => e.id));
    console.log('[APP] After filter, walls with vertices:', newElements
      .filter(e => e.type === 'wall')
      .map(e => ({ id: e.id, vertices: (e as any).vertices }))
    );
    updateScene(activeSceneId, {
      elements: newElements
    });
    console.log('[APP] deleteElements completed');
    setSelectedElementId(null);
    setSelectedElementIds([]);
  };

  // Add new scene
  const addScene = (name: string, backgroundMapUrl: string, backgroundMapName: string, collectionId?: string) => {
    // Check if this is a transparent canvas (SVG with transparent fill)
    const isTransparentCanvas = backgroundMapUrl.includes('fill="transparent"');
    
    const newScene: Scene = {
      id: generateUUID(),
      name,
      backgroundMapUrl,
      backgroundMapName,
      elements: [],
      width: isTransparentCanvas ? 50000 : 0,
      height: isTransparentCanvas ? 50000 : 0,
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
    
    // Create canvas2-mode scene with transparent SVG
    const canvasUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250000%22 height=%2250000%22%3E%3Crect width=%2250000%22 height=%2250000%22 fill=%22transparent%22/%3E%3C/svg%3E';
    
    const newScene: Scene = {
      id: generateUUID(),
      name: canvasName,
      backgroundMapUrl: canvasUrl,
      backgroundMapName: canvasName,
      elements: [],
      width: 50000,
      height: 50000,
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
  const deleteScene = async (sceneId: string) => {
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (activeSceneId === sceneId) {
      setActiveSceneId(null);
    }
    
    // Delete from Supabase if user is logged in
    if (user) {
      await deleteSceneFromSupabase(sceneId, user.id);
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

  // Delete collection and all scenes within it
  const deleteCollection = (collectionId: string) => {
    // Get all scene IDs in this collection
    const scenesInCollection = scenes.filter(s => s.collectionId === collectionId);
    const sceneIdsToDelete = scenesInCollection.map(s => s.id);
    
    // If active scene is in this collection, switch to another scene
    if (activeSceneId && sceneIdsToDelete.includes(activeSceneId)) {
      const remainingScenes = scenes.filter(s => !sceneIdsToDelete.includes(s.id));
      setActiveSceneId(remainingScenes.length > 0 ? remainingScenes[0].id : null);
    }
    
    // Delete all scenes in the collection
    setScenes(prev => prev.filter(s => s.collectionId !== collectionId));
    
    // Delete the collection itself
    setCollections(prev => prev.filter(c => c.id !== collectionId));
  };

  // Move scene to different collection
  const moveSceneToCollection = (sceneId: string, targetCollectionId: string | undefined) => {
    setScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, collectionId: targetCollectionId } : s
    ));
    
    // If moving to an auto-created collection, make it visible
    if (targetCollectionId) {
      setCollections(prev => {
        const targetCollection = prev.find(c => c.id === targetCollectionId);
        if (targetCollection?.isAutoCreated) {
          return prev.map(c => 
            c.id === targetCollectionId ? { ...c, isAutoCreated: false } : c
          );
        }
        return prev;
      });
    }
  };

  // Duplicate scene
  const duplicateScene = (sceneId: string) => {
    const sceneToDuplicate = scenes.find(s => s.id === sceneId);
    if (!sceneToDuplicate) return;

    const newScene: Scene = {
      ...sceneToDuplicate,
      id: generateUUID(),
      name: `${sceneToDuplicate.name} (Copy)`,
      // Deep copy elements array to avoid reference issues
      elements: sceneToDuplicate.elements.map(el => ({ ...el, id: `${el.type}-${Date.now()}-${Math.random()}` }))
    };
    
    setScenes(prev => [...prev, newScene]);
    setActiveSceneId(newScene.id);
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

  // Game Mode Handlers
  const handleGameModeSceneSelect = (sceneId: string) => {
    setActiveSceneId(sceneId);
  };

  const handleGameModeElementSelect = (elementId: string) => {
    // Set selected element
    setSelectedElementId(elementId);
    setSelectedElementIds([]);
    
    // Lock token by default in game mode if not already locked
    const element = activeScene?.elements.find(el => el.id === elementId);
    if (element && element.type === 'token' && element.locked === undefined) {
      updateElement(elementId, { locked: true });
    }
    
    // Center viewport on element (only from playlist)
    if (centerElementHandlerRef.current) {
      centerElementHandlerRef.current(elementId);
    }
    
    // Close all unpinned InfoBoxes
    setOpenInfoBoxes(prev => {
      const next = new Set<string>();
      // Keep pinned boxes open
      prev.forEach(id => {
        if (pinnedInfoBoxes.has(id)) {
          next.add(id);
        }
      });
      // Always open the selected element's InfoBox
      next.add(elementId);
      return next;
    });
  };

  const handleCanvasElementSelect = (elementId: string) => {
    // Set selected element (no viewport centering)
    setSelectedElementId(elementId);
    setSelectedElementIds([]);
    
    // Lock token by default in game mode if not already locked
    if (viewMode === 'game') {
      const element = activeScene?.elements.find(el => el.id === elementId);
      if (element && element.type === 'token' && element.locked === undefined) {
        updateElement(elementId, { locked: true });
      }
    }
    
    // Close all unpinned InfoBoxes
    setOpenInfoBoxes(prev => {
      const next = new Set<string>();
      // Keep pinned boxes open
      prev.forEach(id => {
        if (pinnedInfoBoxes.has(id)) {
          next.add(id);
        }
      });
      // Always open the selected element's InfoBox
      next.add(elementId);
      return next;
    });
  };

  const handleToggleInfoBox = (elementId: string) => {
    setOpenInfoBoxes(prev => {
      const next = new Set(prev);
      if (next.has(elementId)) {
        next.delete(elementId);
      } else {
        next.add(elementId);
      }
      return next;
    });
  };

  const handleCloseInfoBox = (elementId: string) => {
    setOpenInfoBoxes(prev => {
      const next = new Set(prev);
      next.delete(elementId);
      return next;
    });
    // If closing selected element's box, deselect it
    if (selectedElementId === elementId && !pinnedInfoBoxes.has(elementId)) {
      setSelectedElementId(null);
    }
  };

  const handleToggleLockInfoBox = (elementId: string) => {
    // Toggle the element's locked property
    const element = activeScene?.elements.find(el => el.id === elementId);
    if (element) {
      updateElement(elementId, { locked: !element.locked });
    }
  };

  const handleTogglePinInfoBox = (elementId: string) => {
    setPinnedInfoBoxes(prev => {
      const next = new Set(prev);
      if (next.has(elementId)) {
        next.delete(elementId);
      } else {
        next.add(elementId);
      }
      return next;
    });
  };

  const handleShowGameModeError = (message: string) => {
    setGameModeError(message);
    setTimeout(() => setGameModeError(null), 3000);
  };

  // Get screen position for InfoBox (left of element)
  const getInfoBoxPosition = (_element: MapElement): { x: number; y: number } => {
    // This is a placeholder - we'll need viewport info from Canvas
    // For now, position it at a fixed offset
    return { x: 100, y: 100 };
  };

  // Convert world coordinates to screen coordinates
  const worldToScreen = (worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * viewport.zoom + viewport.x,
      y: worldY * viewport.zoom + viewport.y
    };
  };

  return (
    <div className="flex h-screen w-screen bg-dm-dark text-gray-200">
      {/* Login Dialog - Show when not logged in */}
      {!authLoading && !user && <LoginDialog />}

      {/* Left Panel - Properties (Planning Mode Only) */}
      {viewMode === 'planning' && (
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
          onMouseEnter={handleHideToolPreview}
        />
      )}

      {/* Center Canvas */}
      <Canvas
        scene={activeScene}
        viewMode={viewMode}
        onToggleViewMode={() => {
          const newMode = viewMode === 'planning' ? 'game' : 'planning';
          setViewMode(newMode);
          // Always switch to pointer tool when entering game mode
          if (newMode === 'game') {
            setActiveTool('pointer');
          }
        }}
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
        activateAutoCreatedScene={activateAutoCreatedScene}
        setActiveTool={setActiveTool}
        activeSceneId={activeSceneId}
        leftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
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
        autoMergeRooms={autoMergeRooms}
        setAutoMergeRooms={setAutoMergeRooms}
        defaultCornerRadius={defaultCornerRadius}
        onMergeRooms={setMergeRoomsHandler}
        onMergeWalls={setMergeWallsHandler}
        onCenterElementReady={setCenterElementHandler}
        onHideToolPreviewReady={setHideToolPreviewHandler}
        selectedBackgroundTexture={selectedTerrainBrush}
        backgroundBrushSize={backgroundBrushSize}
        terrainBrushes={terrainBrushes}
        selectedTerrainBrush={selectedTerrainBrush}
        onSelectTerrainBrush={setSelectedTerrainBrush}
        wallTextures={wallTextures}
        onSelectWallTexture={setSelectedWallTexture}
        onSwitchToDrawTab={() => setRightPanelActiveTab('draw')}
        onSwitchToTokensTab={() => setRightPanelActiveTab('tokens')}
        onSwitchToModulesTab={() => setRightPanelActiveTab('modules')}
        wallCutterToolBrushSize={wallCutterToolBrushSize}
        setWallCutterToolBrushSize={setWallCutterToolBrushSize}
        xlabShapeMode={xlabShapeMode}
        setXlabShapeMode={setXlabShapeMode}
        onElementSelected={viewMode === 'game' ? handleCanvasElementSelect : undefined}
        onViewportChange={setViewport}
        initialViewport={viewport}
        placingModularFloor={placingModularFloor}
        setPlacingModularFloor={setPlacingModularFloor}
        defaultWallStyleId={defaultWallStyleId}
      />

      {/* Right Panel (Planning Mode Only) */}
      {viewMode === 'planning' && (
        <RightPanel
          scenes={scenes}
          activeSceneId={activeSceneId}
          setActiveSceneId={setActiveSceneId}
          addScene={addScene}
          addCanvasScene={addCanvasScene}
          updateSceneName={updateSceneName}
          deleteScene={deleteScene}
          moveSceneToCollection={moveSceneToCollection}
          duplicateScene={duplicateScene}
          collections={collections}
          addCollection={addCollection}
          updateCollectionName={updateCollectionName}
          updateCollectionAppearance={updateCollectionAppearance}
          deleteCollection={deleteCollection}
          selectedElement={selectedElement}
          updateElement={updateElement}
          deleteElement={deleteElement}
            allElements={activeScene?.elements || []}
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
            wallTextures={wallTextures}
            wallThickness={wallThickness}
            onWallThicknessChange={setWallThickness}
            wallTileSize={wallTileSize}
            onWallTileSizeChange={setWallTileSize}
            roomSubTool={roomSubTool}
            setRoomSubTool={setRoomSubTool}
            autoMergeRooms={autoMergeRooms}
            setAutoMergeRooms={setAutoMergeRooms}
            defaultCornerRadius={defaultCornerRadius}
            setDefaultCornerRadius={setDefaultCornerRadius}
            onMergeRooms={mergeRoomsHandlerRef.current || undefined}
            onMergeWalls={mergeWallsHandlerRef.current || undefined}
            onCenterElement={handleCenterElement}
            selectedTerrainBrush={selectedTerrainBrush}
            onSelectTerrainBrush={setSelectedTerrainBrush}
            backgroundBrushSize={backgroundBrushSize}
            onBackgroundBrushSizeChange={setBackgroundBrushSize}
            activeTab={rightPanelActiveTab}
            onActiveTabChange={setRightPanelActiveTab}
            xlabShapeMode={xlabShapeMode}
            onXlabShapeModeChange={setXlabShapeMode}
            onMouseEnter={handleHideToolPreview}
            wallGroups={wallGroups}
            updateWallGroup={updateWallGroup}
            onStartDragModularFloor={handleStartDragModularFloor}
            defaultWallStyleId={defaultWallStyleId}
            onDefaultWallStyleChange={setDefaultWallStyleId}
            selectedElementIds={selectedElementIds}
          />
      )}

      {/* Game Mode Components */}
      {viewMode === 'game' && (
        <>
          {/* Playlist Panel */}
          <PlaylistPanel
            scenes={scenes}
            collections={collections}
            activeSceneId={activeSceneId}
            onSceneSelect={handleGameModeSceneSelect}
            onElementSelect={handleGameModeElementSelect}
            onToggleInfoBox={handleToggleInfoBox}
            openInfoBoxes={openInfoBoxes}
            selectedElementId={selectedElementId}
            onCenterElement={handleCenterElement}
          />

          {/* Info Boxes for open playlist elements */}
          {activeScene && Array.from(openInfoBoxes).map(elementId => {
            const element = activeScene.elements.find(el => el.id === elementId);
            if (!element || !element.playlistObject) return null;
            
            const infoBoxPos = infoBoxPositions.get(elementId) || getInfoBoxPosition(element);
            
            return (
              <div key={elementId}>
                <InfoBox
                  element={element}
                  position={infoBoxPos}
                  onClose={() => handleCloseInfoBox(elementId)}
                  isLocked={element.locked || false}
                  onToggleLock={() => handleToggleLockInfoBox(elementId)}
                  isPinned={pinnedInfoBoxes.has(elementId)}
                  onTogglePin={() => handleTogglePinInfoBox(elementId)}
                  updateElement={updateElement}
                  onShowError={handleShowGameModeError}
                  viewMode={viewMode}
                  onPositionChange={(newPos) => {
                    setInfoBoxPositions(prev => new Map(prev).set(elementId, newPos));
                  }}
                />
                {/* Connector line between element and InfoBox */}
                {element.type === 'token' && 'x' in element && 'y' in element && 'size' in element && (
                  <InfoBoxConnector
                    element={element}
                    infoBoxPosition={infoBoxPos}
                    elementScreenPosition={worldToScreen(element.x, element.y)}
                    elementSize={element.size}
                    viewport={viewport}
                  />
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Game Mode Error Message */}
      {viewMode === 'game' && gameModeError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-900/80 border border-red-700/50 rounded-lg shadow-lg px-5 py-3">
            <p className="text-red-200 text-sm text-center">
              {gameModeError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
