import { Dices, Trash2 } from 'lucide-react';
import { EventRollTableWidget as EventRollTableWidgetType } from '../types';

interface EncounterTableWidgetProps {
  widget: EventRollTableWidgetType;
  onUpdate: (updates: Partial<EventRollTableWidgetType>) => void;
  onDelete: () => void;
}

const EncounterTableWidget = ({ widget, onUpdate, onDelete }: EncounterTableWidgetProps) => {
  const diceOptions: Array<'d4' | 'd6' | 'd8' | 'd10' | 'd12'> = ['d4', 'd6', 'd8', 'd10', 'd12'];
  
  const getDiceSize = (diceType: string): number => {
    return parseInt(diceType.substring(1));
  };

  const handleDiceTypeChange = (newDiceType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12') => {
    const newSize = getDiceSize(newDiceType);
    const currentSize = widget.events.length;
    
    let newEvents = [...widget.events];
    if (newSize > currentSize) {
      // Add empty strings for new entries
      newEvents = [...newEvents, ...Array(newSize - currentSize).fill('')];
    } else if (newSize < currentSize) {
      // Truncate array
      newEvents = newEvents.slice(0, newSize);
    }
    
    onUpdate({ diceType: newDiceType, events: newEvents });
  };

  const handleEventChange = (index: number, value: string) => {
    const newEvents = [...widget.events];
    newEvents[index] = value;
    onUpdate({ events: newEvents });
  };

  return (
    <div className="bg-dm-dark rounded-lg p-4 border border-dm-border">
      {/* Header with inline dice dropdown */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <Dices size={16} className="text-green-400" />
          <span className="text-sm font-semibold text-gray-200">Event Table:</span>
          <select
            value={widget.diceType}
            onChange={(e) => handleDiceTypeChange(e.target.value as 'd4' | 'd6' | 'd8' | 'd10' | 'd12')}
            className="bg-dm-panel border border-dm-border rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-green-500 uppercase font-semibold"
          >
            {diceOptions.map((dice) => (
              <option key={dice} value={dice}>
                {dice}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-500/20 rounded transition-colors"
          title="Delete widget"
        >
          <Trash2 size={14} className="text-red-400" />
        </button>
      </div>

      {/* Event Table */}
      <div className="border border-gray-600 rounded overflow-hidden">
        <div className="bg-gray-700 px-3 py-1.5 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Roll</span>
            <span className="text-xs text-gray-400">Event</span>
          </div>
        </div>
        <div>
          {widget.events.map((event, index) => (
            <div 
              key={index} 
              className={`flex gap-0 items-stretch border-b border-gray-700 last:border-b-0 ${
                index % 2 === 0 ? 'bg-gray-800/40' : 'bg-gray-900/40'
              }`}
            >
              <div className="w-10 text-center text-xs text-gray-400 font-bold py-2 border-r border-gray-700 flex-shrink-0 flex items-start justify-center">
                <span className="pt-0.5">{index + 1}</span>
              </div>
              <textarea
                value={event}
                onChange={(e) => handleEventChange(index, e.target.value)}
                className="flex-1 bg-transparent px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:bg-gray-700/30 resize-none overflow-hidden min-h-[28px]"
                placeholder={`Event for roll ${index + 1}`}
                rows={1}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EncounterTableWidget;
