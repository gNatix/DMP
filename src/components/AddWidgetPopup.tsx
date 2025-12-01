import { useState, useEffect } from 'react';
import { Type, Dices, Table, Skull } from 'lucide-react';
import { WidgetType } from '../types';

interface AddWidgetPopupProps {
  onAdd: (widgetType: WidgetType) => void;
  onClose: () => void;
}

const AddWidgetPopup = ({ onAdd, onClose }: AddWidgetPopupProps) => {
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if a text input is focused - if so, don't close popup
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
          return; // Let global handler blur the input first
        }
        
        // Second ESC press - close popup
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const widgets = [
    {
      type: 'text' as WidgetType,
      name: 'Text Editor',
      description: 'Rich text with formatting',
      icon: Type,
      color: 'blue'
    },
    {
      type: 'statblock' as WidgetType,
      name: 'D&D Stats',
      description: 'Character ability scores',
      icon: Dices,
      color: 'purple'
    },
    {
      type: 'encountertable' as WidgetType,
      name: 'Event Table D4-12',
      description: 'Random event table with dice',
      icon: Table,
      color: 'green'
    },
    {
      type: 'monstercard' as WidgetType,
      name: 'Monster Card',
      description: 'D&D monster stat block',
      icon: Skull,
      color: 'amber'
    }
  ];

  const handleAdd = () => {
    if (selectedType) {
      onAdd(selectedType);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose} data-popup="true">
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl w-[400px] max-h-[600px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-dm-border">
          <h2 className="text-lg font-semibold text-gray-200">Add Widget</h2>
          <p className="text-xs text-gray-500 mt-1">Choose a widget type to add to your properties</p>
        </div>

        {/* Widget Options */}
        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {widgets.map((widget) => {
            const Icon = widget.icon;
            const isSelected = selectedType === widget.type;
            const colorClasses = {
              blue: 'border-blue-500 bg-blue-500/10',
              purple: 'border-purple-500 bg-purple-500/10',
              green: 'border-green-500 bg-green-500/10',
              amber: 'border-amber-500 bg-amber-500/10'
            };
            const selectedClass = isSelected ? colorClasses[widget.color as keyof typeof colorClasses] : 'border-dm-border';

            return (
              <button
                key={widget.type}
                onClick={() => setSelectedType(widget.type)}
                className={`w-full p-4 border rounded-lg text-left transition-all hover:border-gray-600 ${selectedClass}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded ${isSelected ? 'bg-' + widget.color + '-500/20' : 'bg-dm-dark'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-' + widget.color + '-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-200">{widget.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{widget.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dm-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedType}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              selectedType
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Add Widget
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddWidgetPopup;
