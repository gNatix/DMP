import { useState, useEffect } from 'react';
import { Scene, MapElement, TokenTemplate, ToolType, Collection, CollectionAppearance, RoomSubTool } from '../types';
import ScenesTab from './ScenesTab';
import TokensTab from './TokensTab';
import RoomBuilderPanel from './RoomBuilderPanel';

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
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  deleteElement: (id: string) => void;
  tokenTemplates: TokenTemplate[];
  addTokenTemplate: (name: string, imageUrl: string) => void;
  setActiveTool: (tool: ToolType) => void;
  activeTokenTemplate: TokenTemplate | null;
  setActiveTokenTemplate: (template: TokenTemplate | null) => void;
  onRecentTokensChange?: (tokens: TokenTemplate[]) => void;
  activeTool: ToolType;
  selectedFloorTexture: string | null;
  onSelectFloorTexture: (url: string) => void;
  tileSize: number;
  onTileSizeChange: (size: number) => void;
  showWalls: boolean;
  onShowWallsChange: (show: boolean) => void;
  selectedWallTexture: string | null;
  onSelectWallTexture: (url: string) => void;
  wallThickness: number;
  onWallThicknessChange: (thickness: number) => void;
  wallTileSize: number;
  onWallTileSizeChange: (size: number) => void;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  onMergeRooms?: () => void;
  onCenterElement?: (elementId: string) => void;
}

type TabType = 'scenes' | 'tokens' | 'draw';

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
  updateElement,
  deleteElement,
  tokenTemplates,
  addTokenTemplate,
  setActiveTool,
  activeTokenTemplate,
  setActiveTokenTemplate,
  onRecentTokensChange,
  activeTool,
  selectedFloorTexture,
  onSelectFloorTexture,
  tileSize,
  onTileSizeChange,
  showWalls,
  onShowWallsChange,
  selectedWallTexture,
  onSelectWallTexture,
  wallThickness,
  onWallThicknessChange,
  wallTileSize,
  onWallTileSizeChange,
  roomSubTool,
  setRoomSubTool,
  onMergeRooms,
  onCenterElement
}: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('scenes');

  // Auto-switch to draw tab when room tool is active
  useEffect(() => {
    if (activeTool === 'room') {
      setActiveTab('draw');
    } else if (activeTool === 'token') {
      setActiveTab('tokens');
    }
  }, [activeTool]);

  return (
    <div className="w-80 bg-dm-panel border-l border-dm-border flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-dm-border">
        <button
          onClick={() => setActiveTab('scenes')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'scenes'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Maps
        </button>
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tokens'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('draw')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'draw'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Draw
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
          />
        )}
        {activeTab === 'draw' && (
          <RoomBuilderPanel
            selectedFloorTexture={selectedFloorTexture}
            onSelectFloorTexture={onSelectFloorTexture}
            tileSize={tileSize}
            onTileSizeChange={onTileSizeChange}
            showWalls={showWalls}
            onShowWallsChange={onShowWallsChange}
            selectedWallTexture={selectedWallTexture}
            onSelectWallTexture={onSelectWallTexture}
            wallThickness={wallThickness}
            onWallThicknessChange={onWallThicknessChange}
            wallTileSize={wallTileSize}
            onWallTileSizeChange={onWallTileSizeChange}
            selectedRoom={selectedElement?.type === 'room' ? selectedElement : null}
            updateElement={updateElement}
            setActiveTool={setActiveTool}
            roomSubTool={roomSubTool}
            setRoomSubTool={setRoomSubTool}
            onMergeRooms={onMergeRooms}
          />
        )}
      </div>
    </div>
  );
};

export default RightPanel;
