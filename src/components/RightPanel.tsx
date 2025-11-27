import { useState, useEffect } from 'react';
import { Scene, MapElement, TokenTemplate, ToolType, Collection, CollectionAppearance } from '../types';
import PropertiesTab from './PropertiesTab';
import ScenesTab from './ScenesTab';
import TokensTab from './TokensTab';

interface RightPanelProps {
  scenes: Scene[];
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  activeScene: Scene | null;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  addScene: (name: string, backgroundMapUrl: string, backgroundMapName: string, collectionId?: string) => void;
  updateSceneName: (sceneId: string, newName: string) => void;
  deleteScene: (sceneId: string) => void;
  collections: Collection[];
  addCollection: (name: string) => string;
  updateCollectionName: (collectionId: string, newName: string) => void;
  updateCollectionAppearance: (collectionId: string, appearance?: CollectionAppearance) => void;
  deleteCollection: (collectionId: string) => void;
  selectedElement: MapElement | null;
  selectedElements: MapElement[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  tokenTemplates: TokenTemplate[];
  addTokenTemplate: (name: string, imageUrl: string) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveTokenTemplate: (template: TokenTemplate | null) => void;
}

type TabType = 'properties' | 'scenes' | 'tokens';

const RightPanel = ({
  scenes,
  activeSceneId,
  setActiveSceneId,
  activeScene,
  updateScene,
  addScene,
  updateSceneName,
  deleteScene,
  collections,
  addCollection,
  updateCollectionName,
  updateCollectionAppearance,
  deleteCollection,
  selectedElement,
  selectedElements,
  updateElement,
  deleteElement,
  deleteElements,
  tokenTemplates,
  addTokenTemplate,
  setActiveTool,
  setActiveTokenTemplate
}: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('properties');

  // Auto-switch to properties when element is selected
  useEffect(() => {
    if (selectedElement || selectedElements.length > 0) {
      setActiveTab('properties');
    }
  }, [selectedElement, selectedElements]);

  return (
    <div className="w-80 bg-dm-panel border-l border-dm-border flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-dm-border">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'properties'
              ? 'bg-dm-dark text-dm-highlight border-b-2 border-dm-highlight'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Properties
        </button>
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
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'properties' && (
          <PropertiesTab
            activeMap={activeScene}
            updateMap={activeScene ? (_, updates) => updateScene(activeScene.id, updates) : () => {}}
            selectedElement={selectedElement}
            selectedElements={selectedElements}
            updateElement={updateElement}
            deleteElement={deleteElement}
            deleteElements={deleteElements}
          />
        )}
        {activeTab === 'scenes' && (
          <ScenesTab
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
            updateElement={updateElement}
            deleteElement={deleteElement}
          />
        )}
        {activeTab === 'tokens' && (
          <TokensTab
            tokenTemplates={tokenTemplates}
            addTokenTemplate={addTokenTemplate}
            setActiveTool={setActiveTool}
            setActiveTokenTemplate={setActiveTokenTemplate}
          />
        )}
      </div>
    </div>
  );
};

export default RightPanel;
