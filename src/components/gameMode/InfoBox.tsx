import { useState, useEffect } from 'react';
import { MapElement, Widget, TextWidget, StatBlockWidget, EventRollTableWidget, MonsterCardWidget, DialogueWidget, ViewMode } from '../../types';
import { X, Lock, Unlock, Pin, PinOff, GripVertical } from 'lucide-react';
import TextWidgetComponent from '../leftPanel/widgets/TextWidgetComponent';
import StatBlockWidgetComponent from '../leftPanel/widgets/StatBlockWidget';
import EncounterTableWidgetComponent from '../leftPanel/widgets/EncounterTableWidget';
import MonsterCardWidgetComponent from '../leftPanel/widgets/MonsterCardWidget';
import DialogueWidgetComponent from '../leftPanel/widgets/DialogueWidget';

interface InfoBoxProps {
  element: MapElement;
  position: { x: number; y: number }; // Screen position (left of element)
  onClose: () => void;
  isLocked: boolean;
  onToggleLock: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  updateElement: (elementId: string, updates: Partial<MapElement>) => void;
  onShowError?: (message: string) => void;
  viewMode: ViewMode;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

const InfoBox = ({ element, position, onClose, isLocked, onToggleLock, isPinned, onTogglePin, updateElement, onShowError, viewMode, onPositionChange }: InfoBoxProps) => {
  const [localPosition, setLocalPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get border color based on element type and color
  const getBorderColor = () => {
    if (element.type === 'token' && element.color) {
      const colorMap: Record<string, string> = {
        red: '#ef4444',
        blue: '#3b82f6',
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
        teal: '#14b8a6',
        green: '#22c55e'
      };
      return colorMap[element.color] || '#3b82f6';
    }
    return '#3b82f6'; // Default blue
  };

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
      target.closest('.widget-content') || // If widgets have this class
      target.isContentEditable
    ) {
      return; // Don't start drag on interactive elements
    }

    e.preventDefault(); // Prevent text selection during drag
    setIsDragging(true);
    setDragStart({
      x: e.clientX - localPosition.x,
      y: e.clientY - localPosition.y
    });
  };

  const handleDrag = (e: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      setLocalPosition(newPosition);
      if (onPositionChange) {
        onPositionChange(newPosition);
      }
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Set up drag listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging]);

  // Get element name
  const getElementName = (): string => {
    if (element.type === 'token' || element.type === 'room' || element.type === 'wall') {
      return element.name || 'Unnamed';
    }
    if (element.type === 'annotation') {
      return element.label || element.notes || 'Annotation';
    }
    return 'Element';
  };

  // Get widgets sorted by order
  const widgets = (element.widgets || []).sort((a, b) => a.order - b.order);

  // Update widget handler (read-only when locked)
  const handleUpdateWidget = (widgetId: string, updates: Partial<Widget>) => {
    if (isLocked) {
      if (onShowError) {
        onShowError('InfoBox is locked. Unlock to edit widgets and move element.');
      }
      return;
    }
    
    const updatedWidgets = (element.widgets || []).map(w => 
      w.id === widgetId ? { ...w, ...updates } as Widget : w
    );
    
    updateElement(element.id, { widgets: updatedWidgets });
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (isLocked) {
      if (onShowError) {
        onShowError('InfoBox is locked. Unlock to edit widgets and move element.');
      }
      return;
    }
    
    const updatedWidgets = (element.widgets || []).filter(w => w.id !== widgetId);
    updateElement(element.id, { widgets: updatedWidgets });
  };

  // Toggle lock: Controls both widget editing AND element position
  const handleToggleLockClick = () => {
    // Call parent handler which updates element's locked state
    onToggleLock();
  };

  // Handle interaction with locked content
  const handleLockedContentClick = (e: React.MouseEvent) => {
    if (isLocked) {
      // Prevent all interactions with widget content when locked
      // except for the lock/pin/close buttons in the header
      const target = e.target as HTMLElement;
      
      // Allow clicks on lock, pin, close buttons (they're in the header, not content)
      if (target.closest('.info-box-header')) {
        return;
      }
      
      // Prevent all other clicks on the content area
      e.preventDefault();
      e.stopPropagation();
      if (onShowError) {
        onShowError('Unlock InfoBox to make changes.');
      }
    }
  };

  const handleLockedContentFocus = (e: React.FocusEvent) => {
    if (isLocked) {
      const target = e.target as HTMLElement;
      target.blur(); // Remove focus immediately
      if (onShowError) {
        onShowError('Unlock InfoBox to make changes.');
      }
    }
  };

  // Render widget
  const renderWidget = (widget: Widget) => {
    // If locked, pass no-op handlers. If unlocked, pass real handlers
    const widgetHandlers = isLocked ? {
      onChange: () => {},
      onUpdate: () => {},
      onDelete: () => {}
    } : {
      onChange: (updates: any) => handleUpdateWidget(widget.id, updates),
      onUpdate: (updates: any) => handleUpdateWidget(widget.id, updates),
      onDelete: () => handleDeleteWidget(widget.id)
    };

    return (
      <div 
        key={widget.id} 
        className="mb-3"
      >
        {widget.type === 'text' && (
          <TextWidgetComponent
            widget={widget as TextWidget}
            onChange={widgetHandlers.onChange}
            onDelete={widgetHandlers.onDelete}
            viewMode={viewMode}
          />
        )}
        {widget.type === 'statblock' && (
          <StatBlockWidgetComponent
            widget={widget as StatBlockWidget}
            onChange={widgetHandlers.onChange}
            onDelete={widgetHandlers.onDelete}
            viewMode={viewMode}
          />
        )}
        {widget.type === 'encountertable' && (
          <EncounterTableWidgetComponent
            widget={widget as EventRollTableWidget}
            onUpdate={widgetHandlers.onUpdate}
            onDelete={widgetHandlers.onDelete}
            viewMode={viewMode}
          />
        )}
        {widget.type === 'monstercard' && (
          <MonsterCardWidgetComponent
            widget={widget as MonsterCardWidget}
            onUpdate={widgetHandlers.onUpdate}
            onDelete={widgetHandlers.onDelete}
            viewMode={viewMode}
          />
        )}
        {widget.type === 'dialogue' && (
          <DialogueWidgetComponent
            widget={widget as DialogueWidget}
            onUpdate={widgetHandlers.onUpdate}
            onDelete={widgetHandlers.onDelete}
            viewMode={viewMode}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed bg-dm-panel border-2 rounded-lg shadow-2xl z-40 w-96 max-h-[95vh] flex flex-col"
      style={{ 
        left: `${localPosition.x}px`, 
        top: `${localPosition.y}px`, 
        cursor: isDragging ? 'grabbing' : 'grab',
        borderColor: getBorderColor(),
        userSelect: 'none'
      }}
      onMouseDown={handleDragStart}
    >
      {/* Header with drag handle */}
      <div className="info-box-header flex items-center justify-between p-3 border-b border-dm-border bg-dm-dark rounded-t-lg">
        {/* Drag handle (visual indicator only - whole box is draggable) */}
        <div
          className="p-1 rounded transition-colors mr-2 pointer-events-none"
          title="Drag anywhere to move"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-200 flex-1">{getElementName()}</h3>
        <div className="flex items-center gap-1">
          {/* Lock/Unlock - Controls both widget editing AND element position */}
          <button
            onClick={handleToggleLockClick}
            className={`p-1 hover:bg-dm-hover rounded transition-colors ${
              isLocked ? 'text-red-400' : 'text-green-400'
            }`}
            title={isLocked ? 'Unlock to edit widgets and move element' : 'Lock to prevent editing and movement'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          
          {/* Pin/Unpin button */}
          <button
            onClick={onTogglePin}
            className={`p-1 hover:bg-dm-hover rounded transition-colors ${
              isPinned ? 'text-blue-400' : 'text-gray-400'
            }`}
            title={isPinned ? 'Unpin (close when selecting other elements)' : 'Pin (keep open)'}
          >
            {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-dm-hover rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        onClick={handleLockedContentClick}
        {...(isLocked ? { onFocusCapture: handleLockedContentFocus } : {})}
      >
        {widgets.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No information available for this element.
          </div>
        ) : (
          <div className="space-y-3">
            {widgets.map(widget => renderWidget(widget))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoBox;
