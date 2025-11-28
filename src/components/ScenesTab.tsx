import { useState, useEffect } from 'react';
import { Scene, Collection, CollectionAppearance, MapElement } from '../types';
import { Plus, ChevronDown, ChevronRight, Trash2, Palette, Eye, EyeOff, Edit2 } from 'lucide-react';
import MapSelectorModal from './MapSelectorModal';

interface ScenesTabProps {
  scenes: Scene[];
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  addScene: (name: string, backgroundMapUrl: string, backgroundMapName: string, collectionId?: string) => void;
  updateSceneName: (sceneId: string, newName: string) => void;
  deleteScene: (id: string) => void;
  collections: Collection[];
  addCollection: (name: string) => string;
  updateCollectionName: (collectionId: string, newName: string) => void;
  updateCollectionAppearance: (collectionId: string, appearance?: CollectionAppearance) => void;
  deleteCollection: (collectionId: string) => void;
  updateElement: (elementId: string, updates: Partial<MapElement>) => void;
  deleteElement: (elementId: string) => void;
}

const ScenesTab = ({
  scenes,
  activeSceneId,
  setActiveSceneId,
  addScene,
  updateSceneName,
  deleteScene,
  collections,
  addCollection,
  updateCollectionName,
  updateCollectionAppearance,
  deleteCollection,
  updateElement,
  deleteElement
}: ScenesTabProps) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [isMapSelectorOpen, setIsMapSelectorOpen] = useState(false);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMapUrl, setSelectedMapUrl] = useState('');
  const [selectedMapName, setSelectedMapName] = useState('');
  const [newSceneName, setNewSceneName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingSceneName, setEditingSceneName] = useState('');
  
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  
  const [gradientPickerCollectionId, setGradientPickerCollectionId] = useState<string | null>(null);

  // Predefined gradients
  const GRADIENTS = [
    'linear-gradient(90deg, #1a1a2e 0%, #667eea 50%, #1a1a2e 100%)',
    'linear-gradient(90deg, #2d1b3d 0%, #f093fb 50%, #2d1b3d 100%)',
    'linear-gradient(90deg, #1a2332 0%, #4facfe 50%, #1a2332 100%)',
    'linear-gradient(90deg, #1a2e26 0%, #43e97b 50%, #1a2e26 100%)',
    'linear-gradient(90deg, #2e1a24 0%, #fa709a 50%, #2e1a24 100%)',
    'linear-gradient(90deg, #1a2e32 0%, #30cfd0 50%, #1a2e32 100%)',
    'linear-gradient(90deg, #2a2e32 0%, #a8edea 50%, #2a2e32 100%)',
    'linear-gradient(90deg, #2e1e1a 0%, #ff9a56 50%, #2e1e1a 100%)',
    'linear-gradient(90deg, #2e2620 0%, #ffecd2 50%, #2e2620 100%)',
    'linear-gradient(90deg, #2e1a24 0%, #ff6e7f 50%, #2e1a24 100%)',
    'linear-gradient(90deg, #2a2332 0%, #e0c3fc 50%, #2a2332 100%)',
    'linear-gradient(90deg, #2e2410 0%, #f8b500 50%, #2e2410 100%)',
  ];

  // ESC key handler for dialogs
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if a text input is focused - if so, don't close dialog
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
          return; // Let global handler blur the input first
        }
        
        // Second ESC press (no input focused) - close dialogs
        if (gradientPickerCollectionId) {
          setGradientPickerCollectionId(null);
        } else if (showAddDialog) {
          handleCancelAdd();
        } else if (isMapSelectorOpen) {
          setIsMapSelectorOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [gradientPickerCollectionId, showAddDialog, isMapSelectorOpen]);

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const handleNewMapClick = () => {
    setIsMapSelectorOpen(true);
  };

  const handleMapSelected = (mapUrl: string, mapName: string) => {
    setSelectedMapUrl(mapUrl);
    setSelectedMapName(mapName);
    setIsMapSelectorOpen(false);
    setShowAddDialog(true);
    
    // Set default map name from filename
    setNewSceneName(mapName);
    
    // Set default collection
    if (collections.length === 0) {
      setSelectedCollectionId('__new__');
      setNewCollectionName('My First Collection');
    } else {
      setSelectedCollectionId(collections[0].id);
      // Generate "New Collection (X)" based on existing collections
      const newCollectionPattern = /^New Collection( \((\d+)\))?$/;
      const existingNumbers = collections
        .map(c => {
          const match = c.name.match(newCollectionPattern);
          if (!match) return 0;
          return match[2] ? parseInt(match[2]) : 1;
        })
        .filter(n => n > 0);
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      setNewCollectionName(nextNumber === 1 ? 'New Collection' : `New Collection (${nextNumber})`);
    }
  };

  const handleAddScene = () => {
    if (!newSceneName.trim()) return;
    
    let finalCollectionId = selectedCollectionId;
    
    // If creating new collection, create it first
    if (selectedCollectionId === '__new__') {
      if (!newCollectionName.trim()) return;
      finalCollectionId = addCollection(newCollectionName.trim());
    }
    
    if (!finalCollectionId) return;
    
    addScene(newSceneName.trim(), selectedMapUrl, selectedMapName, finalCollectionId);
    setShowAddDialog(false);
    setNewSceneName('');
    setSelectedCollectionId('');
    setNewCollectionName('');
  };

  const handleCancelAdd = () => {
    setShowAddDialog(false);
    setNewSceneName('');
    setSelectedCollectionId('');
    setIsMapSelectorOpen(true);
  };

  const handleToggleGradientPicker = (collectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGradientPickerCollectionId(gradientPickerCollectionId === collectionId ? null : collectionId);
  };

  const handleSelectGradient = (collectionId: string, gradient: string) => {
    updateCollectionAppearance(collectionId, { gradient });
    setGradientPickerCollectionId(null);
  };

  const handleClearAppearance = (collectionId: string) => {
    updateCollectionAppearance(collectionId, undefined);
    setGradientPickerCollectionId(null);
  };

  const handleStartEditScene = (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSceneId(scene.id);
    setEditingSceneName(scene.name);
  };

  const handleSaveSceneName = () => {
    if (editingSceneId && editingSceneName.trim()) {
      updateSceneName(editingSceneId, editingSceneName.trim());
    }
    setEditingSceneId(null);
    setEditingSceneName('');
  };

  const handleStartEditCollection = (collection: Collection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  };

  const handleSaveCollectionName = () => {
    if (editingCollectionId && editingCollectionName.trim()) {
      updateCollectionName(editingCollectionId, editingCollectionName.trim());
    }
    setEditingCollectionId(null);
    setEditingCollectionName('');
  };

  const renderScene = (scene: Scene) => {
    const isActive = activeSceneId === scene.id;
    const isEditing = editingSceneId === scene.id;
    const isExpanded = expandedScenes.has(scene.id);
    const tokens = scene.elements.filter(e => e.type === 'token');
    
    const toggleSceneExpanded = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpanded = new Set(expandedScenes);
      if (isExpanded) {
        newExpanded.delete(scene.id);
      } else {
        newExpanded.add(scene.id);
      }
      setExpandedScenes(newExpanded);
    };
    
    return (
      <div key={scene.id} className="mb-2">
        <div
          onClick={() => !isEditing && setActiveSceneId(scene.id)}
          className={`p-2 rounded-lg cursor-pointer transition-all border-2 ${
            isActive
              ? 'bg-dm-dark border-dm-highlight'
              : 'bg-dm-dark/50 border-transparent hover:border-dm-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSceneExpanded}
              className="flex-shrink-0 p-1 hover:bg-dm-panel rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-400" />
              )}
            </button>
            <div className="w-12 h-12 rounded bg-dm-border flex-shrink-0 overflow-hidden">
              <img src={scene.backgroundMapUrl} alt={scene.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editingSceneName}
                  onChange={(e) => setEditingSceneName(e.target.value)}
                  onBlur={handleSaveSceneName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSceneName();
                    if (e.key === 'Escape') {
                      setEditingSceneId(null);
                      setEditingSceneName('');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 bg-dm-panel border border-dm-highlight rounded text-sm text-gray-200"
                  autoFocus
                />
              ) : (
                <>
                  <h4 
                    className="font-medium text-gray-200 text-sm truncate cursor-text"
                    onDoubleClick={(e) => handleStartEditScene(scene, e)}
                  >
                    {scene.name}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">{scene.backgroundMapName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tokens.length} tokens</p>
                </>
              )}
            </div>
            <div className="flex gap-1">
              {!isEditing && (
                <button
                  onClick={(e) => handleStartEditScene(scene, e)}
                  className="p-1 hover:bg-dm-panel rounded transition-colors"
                  title="Edit name"
                >
                  <Edit2 size={14} className="text-gray-400 hover:text-gray-300" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete scene "${scene.name}"?`)) {
                    deleteScene(scene.id);
                  }
                }}
                className="p-1 hover:bg-dm-panel rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={14} className="text-red-400 hover:text-red-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Token List */}
        {isExpanded && tokens.length > 0 && (
          <div className="ml-8 mt-1 space-y-1">
            {tokens.map(token => (
              <div
                key={token.id}
                className="flex items-center gap-2 p-1.5 rounded bg-dm-dark/30 hover:bg-dm-dark/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Token preview */}
                <div className="w-6 h-6 rounded bg-dm-border flex-shrink-0 overflow-hidden">
                  {token.imageUrl && (
                    <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Token name */}
                <span className="flex-1 text-xs text-gray-300 truncate">{token.name || 'Unnamed'}</span>

                {/* Actions */}
                <div className="flex gap-0.5">
                  <button
                    onClick={() => updateElement(token.id, { visible: !(token.visible ?? true) })}
                    className="p-1 hover:bg-dm-panel rounded transition-colors"
                    title={token.visible === false ? 'Show' : 'Hide'}
                  >
                    {token.visible === false ? (
                      <EyeOff size={12} className="text-gray-500" />
                    ) : (
                      <Eye size={12} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete token "${token.name || 'Unnamed'}"?`)) {
                        deleteElement(token.id);
                      }
                    }}
                    className="p-1 hover:bg-dm-panel rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} className="text-red-400 hover:text-red-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCollectionSection = (collection: Collection) => {
    const isExpanded = expandedCollections.has(collection.id);
    const collectionScenes = scenes.filter(s => s.collectionId === collection.id);
    const isEditing = editingCollectionId === collection.id;

    // Build background style
    let backgroundStyle: React.CSSProperties = {};
    let hasBackground = false;
    
    if (collection.appearance?.gradient) {
      backgroundStyle.background = collection.appearance.gradient;
      hasBackground = true;
    }

    return (
      <div key={collection.id} className="border-b border-dm-border/50">
        <div 
          className="flex items-center gap-2 p-3 hover:bg-dm-dark/20 transition-colors relative"
          style={backgroundStyle}
        >
          {/* Semi-transparent overlay for readability */}
          {hasBackground && (
            <div className="absolute inset-0 bg-black/40"></div>
          )}
          
          <button
            onClick={() => toggleCollection(collection.id)}
            className="flex-1 flex items-center gap-2 text-sm relative z-10"
          >
            {isExpanded ? (
              <ChevronDown 
                size={16} 
                className="text-gray-100"
                style={{ 
                  filter: hasBackground ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.7))' : 'none'
                }}
              />
            ) : (
              <ChevronRight 
                size={16} 
                className="text-gray-100"
                style={{ 
                  filter: hasBackground ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.7))' : 'none'
                }}
              />
            )}
            {isEditing ? (
              <input
                type="text"
                value={editingCollectionName}
                onChange={(e) => setEditingCollectionName(e.target.value)}
                onBlur={handleSaveCollectionName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCollectionName();
                  if (e.key === 'Escape') {
                    setEditingCollectionId(null);
                    setEditingCollectionName('');
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-1 bg-dm-panel border border-dm-highlight rounded text-sm text-gray-200"
                autoFocus
              />
            ) : (
              <span 
                className="text-white font-medium cursor-text"
                onDoubleClick={(e) => handleStartEditCollection(collection, e)}
                style={{ 
                  textShadow: hasBackground ? '0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)' : 'none'
                }}
              >
                {collection.name}
              </span>
            )}
            <span 
              className="text-xs text-gray-300"
              style={{ 
                textShadow: hasBackground ? '0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)' : 'none'
              }}
            >
              ({collectionScenes.length})
            </span>
          </button>
          <div className="relative">
            <button
              onClick={(e) => handleToggleGradientPicker(collection.id, e)}
              className="p-1 hover:bg-dm-panel rounded transition-colors relative z-10"
              title="Change appearance"
            >
              <Palette 
                size={14} 
                className="text-gray-100 hover:text-white"
                style={{ 
                  filter: hasBackground ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.7))' : 'none'
                }}
              />
            </button>
            
            {/* Gradient Picker Popup */}
            {gradientPickerCollectionId === collection.id && (
              <>
                {/* Backdrop to close on click */}
                <div 
                  className="fixed inset-0 z-20"
                  onClick={() => setGradientPickerCollectionId(null)}
                  data-popup="true"
                />
                
                {/* Gradient Picker */}
                <div className="absolute right-0 top-full mt-1 bg-dm-panel border border-dm-border rounded-lg shadow-xl p-2 z-30 w-48">
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {GRADIENTS.map((gradient, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectGradient(collection.id, gradient);
                        }}
                        className="h-8 rounded border-2 border-dm-border hover:border-dm-highlight transition-colors"
                        style={{ background: gradient }}
                        title={`Gradient ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearAppearance(collection.id);
                    }}
                    className="w-full py-1 px-2 text-xs bg-dm-dark text-gray-300 rounded hover:bg-dm-dark/80 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>
          {!isEditing && (
            <button
              onClick={(e) => handleStartEditCollection(collection, e)}
              className="p-1 hover:bg-dm-panel rounded transition-colors relative z-10"
              title="Edit name"
            >
              <Edit2 
                size={14} 
                className="text-gray-100 hover:text-white"
                style={{ 
                  filter: hasBackground ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.7))' : 'none'
                }}
              />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete collection "${collection.name}"? Scenes will not be deleted.`)) {
                deleteCollection(collection.id);
              }
            }}
            className="p-1 hover:bg-dm-panel rounded transition-colors relative z-10"
            title="Delete"
          >
            <Trash2 
              size={14} 
              className="text-red-300 hover:text-red-200"
              style={{ 
                filter: hasBackground ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.7))' : 'none'
              }}
            />
          </button>
        </div>
        {isExpanded && (
          <div className="space-y-2 p-2 pb-3">
            {collectionScenes.map(renderScene)}
          </div>
        )}
      </div>
    );
  };

  const uncategorizedScenes = scenes.filter(s => !s.collectionId);

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Create New Map */}
      <div className="p-4 border-b border-dm-border">
        <button
          onClick={handleNewMapClick}
          className="w-full py-3 px-4 bg-dm-highlight text-white rounded-lg hover:bg-dm-highlight/80 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus size={20} />
          New Map
        </button>
      </div>

      {/* Collections and Scenes List */}
      <div className="flex-1 overflow-y-auto">
        {collections.map(renderCollectionSection)}
        
        {uncategorizedScenes.length > 0 && (
          <div className="border-b border-dm-border/50">
            <div className="p-3 text-sm text-gray-400">
              <span>Uncategorized</span>
              <span className="text-xs ml-2">({uncategorizedScenes.length})</span>
            </div>
            <div className="space-y-2 p-2 pb-3">
              {uncategorizedScenes.map(renderScene)}
            </div>
          </div>
        )}

        {scenes.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            No maps yet. Click "New Map" to create one.
          </div>
        )}
      </div>

      {/* Map Selector Modal */}
      <MapSelectorModal
        isOpen={isMapSelectorOpen}
        onClose={() => setIsMapSelectorOpen(false)}
        onSelectMap={handleMapSelected}
      />

      {/* Add Map Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50" data-popup="true">
          {/* Background map image with blur */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${selectedMapUrl})` }}
          />
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          {/* Dialog content */}
          <div className="relative w-full max-w-2xl mx-4 flex gap-4">
            {/* Map preview */}
            <div className="w-64 flex-shrink-0 rounded-xl overflow-hidden border-2 border-dm-border shadow-2xl">
              <img 
                src={selectedMapUrl} 
                alt={selectedMapName}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Form */}
            <div className="flex-1 bg-dm-panel/95 backdrop-blur rounded-xl border border-dm-border shadow-2xl">
              <div className="p-4 border-b border-dm-border">
                <h3 className="text-lg font-bold text-gray-100">Add Map to Collection</h3>
                <p className="text-sm text-gray-400 mt-1">{selectedMapName}</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Map Name</label>
                  <input
                    type="text"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                    placeholder="Enter map name..."
                    className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="createNewCollection"
                      checked={selectedCollectionId === '__new__'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollectionId('__new__');
                        } else {
                          setSelectedCollectionId(collections.length > 0 ? collections[0].id : '');
                        }
                      }}
                      className="w-4 h-4 rounded border-dm-border bg-dm-dark text-dm-highlight focus:ring-dm-highlight focus:ring-2"
                    />
                    <label htmlFor="createNewCollection" className="text-sm text-gray-300 cursor-pointer">
                      Create new collection
                    </label>
                  </div>
                  
                  {selectedCollectionId === '__new__' ? (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Collection Name</label>
                      <input
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="Collection name..."
                        className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Collection</label>
                      <select
                        value={selectedCollectionId}
                        onChange={(e) => setSelectedCollectionId(e.target.value)}
                        className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded-lg text-gray-100 focus:outline-none focus:border-dm-highlight"
                        disabled={collections.length === 0}
                      >
                        {collections.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Add custom names or keep generic names, the choice is yours
                  </p>
                </div>
              </div>
              <div className="p-4 border-t border-dm-border flex gap-2">
                <button
                  onClick={handleAddScene}
                  disabled={
                    !newSceneName.trim() || 
                    (selectedCollectionId === '__new__' && !newCollectionName.trim()) ||
                    (!selectedCollectionId || selectedCollectionId === '')
                  }
                  className="flex-1 py-2 px-4 bg-dm-highlight text-white rounded-lg hover:bg-dm-highlight/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Add
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="flex-1 py-2 px-4 bg-dm-dark text-gray-300 rounded-lg hover:bg-dm-dark/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenesTab;
