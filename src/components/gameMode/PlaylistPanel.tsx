import { useState, useEffect, useRef } from 'react';
import { Scene, MapElement, Collection } from '../../types';
import { ChevronDown, ChevronRight, ChevronUp, MapIcon, GripVertical, Tag, MapPin } from 'lucide-react';

interface PlaylistPanelProps {
  scenes: Scene[];
  collections: Collection[];
  activeSceneId: string | null;
  onSceneSelect: (sceneId: string) => void;
  onElementSelect: (elementId: string) => void;
  onToggleInfoBox: (elementId: string) => void;
  openInfoBoxes: Set<string>;
  selectedElementId: string | null;
  onCenterElement: (elementId: string) => void;
}

const PlaylistPanel = ({
  scenes,
  collections,
  activeSceneId,
  onSceneSelect,
  onElementSelect,
  onToggleInfoBox,
  openInfoBoxes,
  selectedElementId,
  onCenterElement
}: PlaylistPanelProps) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  // Default position: top-right corner with margin
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Track current index in playlist for arrow key navigation
  const currentPlaylistIndexRef = useRef(0);
  const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get active scene
  const activeScene = scenes.find(s => s.id === activeSceneId);

  // Get playlist elements (only elements with playlistObject: true)
  const playlistElements = activeScene?.elements.filter(el => el.playlistObject) || [];
  
  // Sync ref with actual selected element and scroll into view
  useEffect(() => {
    if (selectedElementId && playlistElements.length > 0) {
      const index = playlistElements.findIndex(el => el.id === selectedElementId);
      if (index !== -1) {
        currentPlaylistIndexRef.current = index;
        
        // Scroll to selected element
        const elementDiv = elementRefs.current.get(selectedElementId);
        if (elementDiv) {
          elementDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [selectedElementId, playlistElements]);

  // Toggle collection expansion
  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    
    // Allow drag unless clicking on:
    // - buttons, inputs, textareas, contenteditable
    // - elements with these roles/classes
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[contenteditable="true"]') ||
      target.closest('a') ||
      target.isContentEditable
    ) {
      return; // Don't start drag on interactive elements
    }

    e.preventDefault(); // Prevent text selection during drag
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle drag
  const handleDrag = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Attach drag listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging]);

  // Arrow key navigation for playlist items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if there are playlist elements
      if (playlistElements.length === 0) return;

      // Numpad - for previous, Numpad + for next
      if (e.key === 'Add' || e.key === 'Subtract' || e.key === '+' || e.key === '-') {
        e.preventDefault();
        
        if (e.key === 'Add' || e.key === '+') {
          cycleElement('down'); // Next
        } else {
          cycleElement('up'); // Previous
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playlistElements, onElementSelect]);

  // Get element display name
  const getElementName = (element: MapElement): string => {
    if (element.type === 'token' || element.type === 'room' || element.type === 'wall') {
      return element.name || 'Unnamed';
    }
    if (element.type === 'annotation') {
      return element.label || element.notes || 'Annotation';
    }
    return 'Element';
  };
  
  // Cycle to next/previous element
  const cycleElement = (direction: 'up' | 'down') => {
    if (playlistElements.length === 0) return;
    
    let newIndex: number;
    if (direction === 'down') {
      newIndex = currentPlaylistIndexRef.current + 1;
      if (newIndex >= playlistElements.length) newIndex = 0;
    } else {
      newIndex = currentPlaylistIndexRef.current - 1;
      if (newIndex < 0) newIndex = playlistElements.length - 1;
    }
    
    currentPlaylistIndexRef.current = newIndex;
    onElementSelect(playlistElements[newIndex].id);
  };

  // Group scenes by collection
  const scenesByCollection = collections.map(collection => ({
    collection,
    scenes: scenes.filter(s => s.collectionId === collection.id)
  }));

  // Uncategorized scenes
  const uncategorizedScenes = scenes.filter(s => !s.collectionId);

  return (
    <div
      className="fixed bg-dm-panel border border-dm-border rounded-lg shadow-2xl z-50 w-80 max-h-[80vh] flex flex-col"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleDragStart}
    >
      {/* Header with drag handle */}
      <div className="flex items-center gap-2 p-3 border-b border-dm-border bg-dm-dark rounded-t-lg">
        <GripVertical className="w-4 h-4 text-gray-500 pointer-events-none" />
        <h2 className="text-lg font-semibold text-gray-200 flex-1">Game Playlist</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Scene Selection */}
        <div className="mb-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Select Map</h3>
          
          {/* Collections with scenes */}
          {scenesByCollection.map(({ collection, scenes: collectionScenes }) => {
            if (collectionScenes.length === 0) return null;
            const isExpanded = expandedCollections.has(collection.id);
            
            return (
              <div key={collection.id} className="mb-2">
                <button
                  onClick={() => toggleCollection(collection.id)}
                  className="flex items-center gap-2 w-full p-2 hover:bg-dm-hover rounded transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-sm text-gray-300">{collection.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">({collectionScenes.length})</span>
                </button>
                
                {isExpanded && (
                  <div className="ml-6 space-y-1 mt-1">
                    {collectionScenes.map(scene => (
                      <button
                        key={scene.id}
                        onClick={() => onSceneSelect(scene.id)}
                        className={`flex items-center gap-2 w-full p-2 rounded transition-colors text-left ${
                          scene.id === activeSceneId
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-dm-hover text-gray-300'
                        }`}
                      >
                        <MapIcon className="w-4 h-4" />
                        <span className="text-sm truncate">{scene.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized scenes */}
          {uncategorizedScenes.length > 0 && (
            <div className="space-y-1">
              {uncategorizedScenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => onSceneSelect(scene.id)}
                  className={`flex items-center gap-2 w-full p-2 rounded transition-colors text-left ${
                    scene.id === activeSceneId
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-dm-hover text-gray-300'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  <span className="text-sm truncate">{scene.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Playlist Elements */}
        {activeScene && playlistElements.length > 0 && (
          <div className="border-t border-dm-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs text-gray-400 uppercase tracking-wide">Interactive Elements</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => cycleElement('up')}
                  className="p-1 hover:bg-dm-hover rounded transition-colors"
                  title="Previous element (Numpad -)"
                >
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => cycleElement('down')}
                  className="p-1 hover:bg-dm-hover rounded transition-colors"
                  title="Next element (Numpad +)"
                >
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {playlistElements.map(element => {
                const isOpen = openInfoBoxes.has(element.id);
                const isSelected = selectedElementId === element.id;
                return (
                  <div 
                    key={element.id}
                    ref={(el) => {
                      if (el) {
                        elementRefs.current.set(element.id, el);
                      } else {
                        elementRefs.current.delete(element.id);
                      }
                    }}
                    className={`flex items-center gap-1 p-1 rounded transition-colors ${
                      isSelected ? 'bg-blue-600/30 border border-blue-500' : ''
                    }`}
                  >
                    {/* Element name button */}
                    <button
                      onClick={() => onElementSelect(element.id)}
                      className={`flex-1 px-2 py-1.5 rounded transition-colors text-left text-sm ${
                        isSelected 
                          ? 'text-white font-medium' 
                          : 'text-gray-300 hover:bg-dm-hover'
                      }`}
                    >
                      {getElementName(element)}
                    </button>
                    
                    {/* GPS/Center button */}
                    <button
                      onClick={() => onCenterElement(element.id)}
                      className="p-1.5 hover:bg-dm-hover rounded transition-colors"
                      title="Center on element"
                    >
                      <MapPin className="w-4 h-4 text-green-400" />
                    </button>
                    
                    {/* Label/Tag button (placeholder for future label functionality) */}
                    <button
                      onClick={() => {/* TODO: Add label editing */}}
                      className="p-1.5 hover:bg-dm-hover rounded transition-colors"
                      title="Edit label"
                    >
                      <Tag className="w-4 h-4 text-yellow-400" />
                    </button>
                    
                    {/* Open/Close InfoBox toggle */}
                    <button
                      onClick={() => onToggleInfoBox(element.id)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isOpen
                          ? 'bg-blue-600 text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-hover'
                      }`}
                    >
                      {isOpen ? 'Close' : 'Open'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!activeScene && (
          <div className="text-center py-8 text-sm text-gray-500">
            Select a map to view interactive elements
          </div>
        )}

        {activeScene && playlistElements.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500 border-t border-dm-border pt-3">
            No interactive elements in this map.<br />
            Add elements in Planning Mode with "Display in game mode playlist" enabled.
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistPanel;
