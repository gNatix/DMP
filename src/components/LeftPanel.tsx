import { useState } from 'react';
import { MapElement, Widget, TextWidget, StatBlockWidget, EventRollTableWidget, MonsterCardWidget, WidgetType } from '../types';
import { ChevronRight, ChevronLeft, MapPin, Plus, GripVertical, Trash2 } from 'lucide-react';
import TextWidgetComponent from './TextWidgetComponent';
import StatBlockWidgetComponent from './StatBlockWidget';
import EncounterTableWidgetComponent from './EncounterTableWidget';
import MonsterCardWidgetComponent from './MonsterCardWidget';
import AddWidgetPopup from './AddWidgetPopup';

interface LeftPanelProps {
  selectedElement: MapElement | null;
  selectedElements: MapElement[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  centerViewportOnElement?: (elementId: string) => void;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

const LeftPanel = ({
  selectedElement,
  selectedElements,
  updateElement,
  deleteElement,
  deleteElements,
  centerViewportOnElement,
  isOpen: externalIsOpen,
  setIsOpen: setExternalIsOpen
}: LeftPanelProps) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [showAddWidgetPopup, setShowAddWidgetPopup] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below');
  const [dragPreviewPos, setDragPreviewPos] = useState({ x: 0, y: 0 });
  
  // Use external control if provided, otherwise use internal state
  const isExpanded = externalIsOpen !== undefined ? externalIsOpen : internalIsExpanded;
  const setIsExpanded = (open: boolean) => {
    if (setExternalIsOpen) {
      setExternalIsOpen(open);
    } else {
      setInternalIsExpanded(open);
    }
  };

  // Determine what to show
  const hasMultiSelection = selectedElements.length > 1;
  const hasSingleSelection = selectedElement !== null;
  const hasSelection = hasMultiSelection || hasSingleSelection;

  // Generate unique widget ID
  const generateWidgetId = () => `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add widget handler
  const handleAddWidget = (widgetType: WidgetType) => {
    if (!selectedElement) return;

    const widgets = selectedElement.widgets || [];
    const newOrder = Math.max(0, ...widgets.map(w => w.order)) + 1;

    let newWidget: Widget;
    if (widgetType === 'text') {
      newWidget = {
        id: generateWidgetId(),
        type: 'text',
        order: newOrder,
        content: ''
      } as TextWidget;
    } else if (widgetType === 'statblock') {
      newWidget = {
        id: generateWidgetId(),
        type: 'statblock',
        order: newOrder,
        stats: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      } as StatBlockWidget;
    } else if (widgetType === 'encountertable') {
      newWidget = {
        id: generateWidgetId(),
        type: 'encountertable',
        order: newOrder,
        diceType: 'd6',
        events: ['', '', '', '', '', '']
      } as EventRollTableWidget;
    } else if (widgetType === 'monstercard') {
      newWidget = {
        id: generateWidgetId(),
        type: 'monstercard',
        order: newOrder,
        name: 'Monster',
        size: 'Medium',
        monsterType: 'Beast',
        alignment: 'Neutral',
        ac: 10,
        hp: 10,
        speed: 30,
        initiative: '+0',
        abilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        },
        skills: '',
        languages: '',
        challenge: '1/4',
        special: ''
      } as MonsterCardWidget;
    } else {
      return;
    }

    updateElement(selectedElement.id, {
      widgets: [...widgets, newWidget]
    });
  };

  // Update widget handler
  const handleUpdateWidget = (widgetId: string, updates: Partial<Widget>) => {
    if (!selectedElement) return;

    const widgets = selectedElement.widgets || [];
    updateElement(selectedElement.id, {
      widgets: widgets.map(w => w.id === widgetId ? { ...w, ...updates } as Widget : w)
    });
  };

  // Delete widget handler
  const handleDeleteWidget = (widgetId: string) => {
    if (!selectedElement) return;

    const widgets = selectedElement.widgets || [];
    updateElement(selectedElement.id, {
      widgets: widgets.filter(w => w.id !== widgetId)
    });
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidgetId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create invisible drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
    
    // Track mouse position during drag
    setDragPreviewPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
    setDropPosition('below');
  };

  const handleDragOver = (e: React.DragEvent, widgetId?: string, allWidgets?: Widget[]) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Update preview position
    setDragPreviewPos({ x: e.clientX, y: e.clientY });
    
    // Update drop target and position
    if (widgetId && widgetId !== draggedWidgetId && allWidgets) {
      setDragOverWidgetId(widgetId);
      
      // Determine drop position based on relative order
      const draggedWidget = allWidgets.find(w => w.id === draggedWidgetId);
      const targetWidget = allWidgets.find(w => w.id === widgetId);
      
      if (draggedWidget && targetWidget) {
        // If dragged widget comes from below (higher order), drop above target
        // If dragged widget comes from above (lower order), drop below target
        setDropPosition(draggedWidget.order > targetWidget.order ? 'above' : 'below');
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    if (!selectedElement || !draggedWidgetId || draggedWidgetId === targetWidgetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDropPosition('below');
      return;
    }

    const widgets = selectedElement.widgets || [];
    const draggedWidget = widgets.find(w => w.id === draggedWidgetId);
    const targetWidget = widgets.find(w => w.id === targetWidgetId);

    if (!draggedWidget || !targetWidget) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDropPosition('below');
      return;
    }

    // Calculate new order based on drop position
    const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);
    const targetIndex = sortedWidgets.findIndex(w => w.id === targetWidgetId);
    const draggedIndex = sortedWidgets.findIndex(w => w.id === draggedWidgetId);
    
    // Determine new position index
    let newIndex: number;
    if (dropPosition === 'above') {
      newIndex = targetIndex;
    } else {
      newIndex = targetIndex + 1;
    }
    
    // Adjust if dragged from before the drop point
    if (draggedIndex < newIndex) {
      newIndex--;
    }
    
    // Don't do anything if dropping in same position
    if (draggedIndex === newIndex) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDropPosition('below');
      return;
    }
    
    // Remove dragged widget and reinsert at new position
    const reorderedWidgets = sortedWidgets.filter(w => w.id !== draggedWidgetId);
    reorderedWidgets.splice(newIndex, 0, draggedWidget);
    
    // Reassign order values
    const newWidgets = reorderedWidgets.map((w, idx) => ({
      ...w,
      order: idx
    }));

    updateElement(selectedElement.id, {
      widgets: newWidgets
    });

    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
    setDropPosition('below');
  };

  // Render widget
  const renderWidget = (widget: Widget, _index: number, _totalWidgets: number, allWidgets: Widget[]) => {
    const isDragging = draggedWidgetId === widget.id;
    const isDropTarget = dragOverWidgetId === widget.id;

    return (
      <div
        key={widget.id}
        onDragOver={(e) => handleDragOver(e, widget.id, allWidgets)}
        onDrop={(e) => handleDrop(e, widget.id)}
        onDragLeave={() => setDragOverWidgetId(null)}
        className={`relative group transition-all ${isDragging ? 'opacity-30' : ''}`}
      >
        {/* Drop indicator line - shows where widget will be inserted */}
        {isDropTarget && (
          <div className={`absolute ${dropPosition === 'above' ? '-top-1' : '-bottom-1'} left-0 right-0 h-0.5 bg-blue-400 z-20`} />
        )}
        
        {/* Drag handle */}
        <div 
          draggable
          onDragStart={(e) => handleDragStart(e, widget.id)}
          onDragEnd={handleDragEnd}
          className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10"
        >
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>

        <div className="pl-5">
          {widget.type === 'text' && (
            <TextWidgetComponent
              widget={widget as TextWidget}
              onChange={(updates) => handleUpdateWidget(widget.id, updates)}
              onDelete={() => handleDeleteWidget(widget.id)}
            />
          )}
          {widget.type === 'statblock' && (
            <StatBlockWidgetComponent
              widget={widget as StatBlockWidget}
              onChange={(updates) => handleUpdateWidget(widget.id, updates)}
              onDelete={() => handleDeleteWidget(widget.id)}
            />
          )}
          {widget.type === 'encountertable' && (
            <EncounterTableWidgetComponent
              widget={widget as EventRollTableWidget}
              onUpdate={(updates) => handleUpdateWidget(widget.id, updates)}
              onDelete={() => handleDeleteWidget(widget.id)}
            />
          )}
          {widget.type === 'monstercard' && (
            <MonsterCardWidgetComponent
              widget={widget as MonsterCardWidget}
              onUpdate={(updates) => handleUpdateWidget(widget.id, updates)}
              onDelete={() => handleDeleteWidget(widget.id)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Collapsed state - just a button in top-left corner */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed top-4 left-4 z-50 bg-dm-panel border border-dm-border rounded-lg p-2 hover:bg-dm-hover transition-colors"
          title="Open Properties"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      )}

      {/* Expanded state - full panel */}
      {isExpanded && (
        <div className="fixed top-0 left-0 h-screen w-[450px] bg-dm-panel border-r border-dm-border flex flex-col overflow-hidden z-40 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dm-border">
            <h2 className="text-lg font-semibold text-gray-200">Properties</h2>
            <div className="flex items-center gap-2">
              {hasSingleSelection && selectedElement && (
                <>
                  {centerViewportOnElement && (
                    <button
                      onClick={() => centerViewportOnElement(selectedElement.id)}
                      className="p-1 hover:bg-dm-hover rounded transition-colors"
                      title="Go to element"
                    >
                      <MapPin className="w-5 h-5 text-blue-400 hover:text-blue-300" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteElement(selectedElement.id)}
                    className="p-1 hover:bg-dm-hover rounded transition-colors"
                    title="Delete element"
                  >
                    <Trash2 className="w-5 h-5 text-red-400 hover:text-red-300" />
                  </button>
                </>
              )}
              {hasMultiSelection && (
                <button
                  onClick={() => deleteElements(selectedElements.map(e => e.id))}
                  className="p-1 hover:bg-dm-hover rounded transition-colors"
                  title={`Delete ${selectedElements.length} elements`}
                >
                  <Trash2 className="w-5 h-5 text-red-400 hover:text-red-300" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-dm-hover rounded transition-colors"
                title="Collapse"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!hasSelection && (
              <div className="text-gray-500 text-sm text-center mt-8">
                Select an element to view its properties
              </div>
            )}

            {hasMultiSelection && (
              <div className="space-y-4">
                <div className="text-sm text-gray-400">
                  {selectedElements.length} elements selected
                </div>
              </div>
            )}

            {hasSingleSelection && selectedElement && (
              <div className="space-y-4">
                {/* Name input only */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wide flex-shrink-0">Name:</label>
                  <input
                    type="text"
                    value={
                      selectedElement.type === 'token' 
                        ? selectedElement.name || '' 
                        : selectedElement.type === 'room'
                        ? selectedElement.name || ''
                        : (selectedElement.type === 'annotation' && 'label' in selectedElement) 
                        ? selectedElement.label || '' 
                        : ''
                    }
                    onChange={(e) => {
                      if (selectedElement.type === 'token') {
                        updateElement(selectedElement.id, { name: e.target.value });
                      } else if (selectedElement.type === 'room') {
                        updateElement(selectedElement.id, { name: e.target.value });
                      } else if (selectedElement.type === 'annotation') {
                        updateElement(selectedElement.id, { label: e.target.value });
                      }
                    }}
                    placeholder={
                      selectedElement.type === 'token' 
                        ? 'Token name...' 
                        : selectedElement.type === 'room'
                        ? 'Room name...'
                        : 'Location name...'
                    }
                    className="flex-1 px-3 py-2 bg-dm-dark border border-dm-border rounded text-sm focus:outline-none focus:border-gray-600"
                  />
                </div>

                {/* Widgets Section */}
                <div className="pt-4 border-t border-dm-border">
                  <div className="flex items-center justify-end mb-3">
                    <button
                      onClick={() => setShowAddWidgetPopup(true)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      title="Add widget"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const widgets = (selectedElement.widgets || []).sort((a, b) => a.order - b.order);
                      return widgets.map((widget, index) => renderWidget(widget, index, widgets.length, widgets));
                    })()}
                    
                    {(!selectedElement.widgets || selectedElement.widgets.length === 0) && (
                      <div className="text-center py-8 text-sm text-gray-500">
                        No widgets added yet.<br />
                        <span className="text-xs">Click + to get started.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Widget Popup */}
      {showAddWidgetPopup && (
        <AddWidgetPopup
          onAdd={handleAddWidget}
          onClose={() => setShowAddWidgetPopup(false)}
        />
      )}

      {/* Floating drag preview */}
      {draggedWidgetId && (() => {
        const draggedWidget = hasSingleSelection && selectedElement?.widgets?.find(w => w.id === draggedWidgetId);
        if (!draggedWidget) return null;

        return (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: `${dragPreviewPos.x + 10}px`,
              top: `${dragPreviewPos.y + 10}px`,
              opacity: 0.9
            }}
          >
            <div className="bg-dm-panel border-2 border-blue-400 rounded-lg shadow-2xl max-w-[400px]">
              {draggedWidget.type === 'text' && (
                <div className="p-4">
                  <div className="text-gray-300 text-sm font-medium flex items-center gap-2">
                    <GripVertical className="w-4 h-4" />
                    Text Widget
                  </div>
                </div>
              )}
              {draggedWidget.type === 'statblock' && (
                <div className="p-4">
                  <div className="text-gray-300 text-sm font-medium flex items-center gap-2">
                    <GripVertical className="w-4 h-4" />
                    D&D Stats Widget
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default LeftPanel;
