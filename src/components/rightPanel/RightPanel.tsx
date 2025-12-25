import { useState, useEffect } from 'react';
import { Settings, Boxes, Map, Users, Paintbrush } from 'lucide-react';
import { Scene, MapElement, TokenTemplate, ToolType, Collection, CollectionAppearance, TerrainShapeMode, ModularRoomElement, WallGroup } from '../../types';
import ScenesTab from './ScenesTab';
import TokensTab from './TokensTab';
import EnvironmentTab from './EnvironmentTab';
import XLabPanel from './XLabPanel';
import SettingsTab from './SettingsTab';
import ModulesTab from './ModulesTab';

interface RightPanelProps {
  scenes: Scene[];
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  addScene: (name: string, backgroundMapUrl: string, backgroundMapName: string, collectionId?: string) => void;
  addCanvasScene: (collectionId?: string) => string | undefined;
  updateSceneName: (sceneId: string, newName: string) => void;
  deleteScene: (sceneId: string) => void;
  moveSceneToCollection: (sceneId: string, targetCollectionId: string | undefined) => void;
  duplicateScene: (sceneId: string) => void;
  collections: Collection[];
  addCollection: (name: string) => string;
  updateCollectionName: (collectionId: string, newName: string) => void;
  updateCollectionAppearance: (collectionId: string, appearance?: CollectionAppearance) => void;
  deleteCollection: (collectionId: string) => void;
  selectedElement: MapElement | null;
  selectedElementIds?: string[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  deleteElement: (id: string) => void;
  allElements?: MapElement[]; // All elements in active scene
  tokenTemplates: TokenTemplate[];
  addTokenTemplate: (name: string, imageUrl: string) => void;
  setActiveTool: (tool: ToolType) => void;
  activeTokenTemplate: TokenTemplate | null;
  setActiveTokenTemplate: (template: TokenTemplate | null) => void;
  onRecentTokensChange?: (tokens: TokenTemplate[]) => void;
  activeTool: ToolType;
  onCenterElement?: (elementId: string) => void;
  // Environment tab props
  selectedTerrainBrush: string | null;
  onSelectTerrainBrush: (url: string) => void;
  backgroundBrushSize: number;
  onBackgroundBrushSizeChange: (size: number) => void;
  backgroundBrushOpacity: number;
  onBackgroundBrushOpacityChange: (opacity: number) => void;
  xlabShapeMode: TerrainShapeMode;
  onXlabShapeModeChange: (mode: TerrainShapeMode) => void;
  activeTab?: 'scenes' | 'tokens' | 'draw' | 'modules' | 'xlab' | 'settings';
  onActiveTabChange?: (tab: 'scenes' | 'tokens' | 'draw' | 'modules' | 'xlab' | 'settings') => void;
  onMouseEnter?: () => void;
  // Modular rooms props
  wallGroups?: WallGroup[];
  updateWallGroup?: (groupId: string, updates: Partial<WallGroup>) => void;
  onStartDragModularFloor?: (floorStyleId: string, tilesW: number, tilesH: number, imageUrl: string) => void;
  defaultWallStyleId?: string;
  onDefaultWallStyleChange?: (styleId: string) => void;
  // Toolbar customization
  hiddenToolbarButtons?: Set<string>;
  onHiddenToolbarButtonsChange?: (buttons: Set<string>) => void;
  customKeybinds?: Record<string, string>;
  onCustomKeybindsChange?: (keybinds: Record<string, string>) => void;
  // Token drag-and-drop
  onStartDragToken?: (template: TokenTemplate | null) => void;
}

type TabType = 'scenes' | 'tokens' | 'draw' | 'modules' | 'xlab' | 'settings';

const RightPanel = ({
  scenes,
  activeSceneId,
  setActiveSceneId,
  addScene,
  addCanvasScene,
  updateSceneName,
  deleteScene,
  moveSceneToCollection,
  duplicateScene,
  collections,
  addCollection,
  updateCollectionName,
  updateCollectionAppearance,
  deleteCollection,
  selectedElement,
  selectedElementIds = [],
  updateElement,
  deleteElement,
  allElements = [],
  tokenTemplates,
  addTokenTemplate,
  setActiveTool,
  activeTokenTemplate,
  setActiveTokenTemplate,
  onRecentTokensChange,
  activeTool,
  onCenterElement,
  selectedTerrainBrush,
  onSelectTerrainBrush,
  backgroundBrushSize,
  onBackgroundBrushSizeChange,
  backgroundBrushOpacity,
  onBackgroundBrushOpacityChange,
  xlabShapeMode,
  onXlabShapeModeChange,
  activeTab: externalActiveTab,
  onActiveTabChange,
  onMouseEnter,
  wallGroups = [],
  updateWallGroup = () => {},
  onStartDragModularFloor = () => {},
  defaultWallStyleId = 'worn-castle',
  onDefaultWallStyleChange = () => {},
  hiddenToolbarButtons = new Set(),
  onHiddenToolbarButtonsChange = () => {},
  customKeybinds = {},
  onCustomKeybindsChange = () => {},
  onStartDragToken,
}: RightPanelProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('scenes');
  
  // Use external tab if provided, otherwise use internal
  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = onActiveTabChange || setInternalActiveTab;

  // Get selected modular room if any (single selection)
  const selectedModularRoom = selectedElement?.type === 'modularRoom' ? selectedElement as ModularRoomElement : null;

  // Get all selected modular rooms (for multi-selection)
  const selectedModularRooms = (allElements || []).filter(
    el => el.type === 'modularRoom' && selectedElementIds.includes(el.id)
  ) as ModularRoomElement[];

  // Auto-switch tabs based on active tool
  useEffect(() => {
    if (activeTool === 'token') {
      setActiveTab('tokens');
    } else if (activeTool === 'background') {
      setActiveTab('draw');
    } else if (activeTool === 'xlab') {
      setActiveTab('xlab');
    } else if (activeTool === 'modularRoom') {
      setActiveTab('modules');
    }
  }, [activeTool, setActiveTab]);

  return (
    <div 
      onMouseEnter={onMouseEnter}
      className="w-80 bg-dm-panel border-l border-dm-border flex flex-col"
    >
      {/* Tabs */}
      <div className="flex border-b border-dm-border">
        <button
          onClick={() => setActiveTab('scenes')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
            activeTab === 'scenes'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Maps - Manage your battle maps and scenes"
        >
          <Map className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
            activeTab === 'tokens'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Tokens - Characters, monsters and objects"
        >
          <Users className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
            activeTab === 'modules'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Modules - Modular room floor and wall styles"
        >
          <Boxes className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('draw')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
            activeTab === 'draw'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Draw - Terrain brushes, walls and room builder"
        >
          <Paintbrush className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
            activeTab === 'settings'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Settings - Grid, display and preferences"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'scenes' && (
          <ScenesTab
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
            deleteElement={deleteElement}
            onCenterElement={onCenterElement}
          />
        )}
        {activeTab === 'tokens' && (
          <TokensTab
            tokenTemplates={tokenTemplates}
            addTokenTemplate={addTokenTemplate}
            setActiveTool={setActiveTool}
            activeTokenTemplate={activeTokenTemplate}
            setActiveTokenTemplate={setActiveTokenTemplate}
            onRecentTokensChange={onRecentTokensChange}
            onStartDragToken={onStartDragToken}
          />
        )}
        {activeTab === 'draw' && (
          <EnvironmentTab
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            selectedTerrainBrush={selectedTerrainBrush}
            onSelectTerrainBrush={onSelectTerrainBrush}
            brushSize={backgroundBrushSize}
            onBrushSizeChange={onBackgroundBrushSizeChange}
            brushOpacity={backgroundBrushOpacity}
            onBrushOpacityChange={onBackgroundBrushOpacityChange}
            shapeMode={xlabShapeMode}
            onShapeModeChange={onXlabShapeModeChange}
          />
        )}
        {activeTab === 'modules' && (
          <ModulesTab
            selectedModularRoom={selectedModularRoom}
            selectedModularRooms={selectedModularRooms}
            wallGroups={wallGroups}
            updateElement={updateElement}
            updateWallGroup={updateWallGroup}
            onStartDragFloor={onStartDragModularFloor}
            defaultWallStyleId={defaultWallStyleId}
            onDefaultWallStyleChange={onDefaultWallStyleChange}
          />
        )}
        {activeTab === 'xlab' && (
          <XLabPanel 
            xlabShapeMode={xlabShapeMode}
            onXlabShapeModeChange={onXlabShapeModeChange}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab 
            hiddenToolbarButtons={hiddenToolbarButtons}
            onHiddenToolbarButtonsChange={onHiddenToolbarButtonsChange}
            customKeybinds={customKeybinds}
            onCustomKeybindsChange={onCustomKeybindsChange}
          />
        )}
      </div>
    </div>
  );
};

export default RightPanel;
