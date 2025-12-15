import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { DialogueWidget as DialogueWidgetType, DialogueEntry, ViewMode } from '../../../types';

interface DialogueWidgetProps {
  widget: DialogueWidgetType;
  onUpdate: (updates: Partial<DialogueWidgetType>) => void;
  onDelete: () => void;
  viewMode?: ViewMode;
}

const DialogueWidget = ({ widget, onUpdate, onDelete, viewMode }: DialogueWidgetProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateEntryId = () => `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleAddEntry = () => {
    const newEntry: DialogueEntry = {
      id: generateEntryId(),
      speaker: '',
      text: '',
      isCollapsed: false
    };
    onUpdate({ entries: [...widget.entries, newEntry] });
  };

  const handleUpdateEntry = (entryId: string, updates: Partial<DialogueEntry>) => {
    const newEntries = widget.entries.map(entry =>
      entry.id === entryId ? { ...entry, ...updates } : entry
    );
    onUpdate({ entries: newEntries });
  };

  const handleDeleteEntry = (entryId: string) => {
    onUpdate({ entries: widget.entries.filter(entry => entry.id !== entryId) });
  };

  const handleToggleCollapse = (entryId: string) => {
    const newEntries = widget.entries.map(entry =>
      entry.id === entryId ? { ...entry, isCollapsed: !entry.isCollapsed } : entry
    );
    onUpdate({ entries: newEntries });
  };

  const handleCopyEntry = async (entry: DialogueEntry) => {
    const text = entry.speaker ? `${entry.speaker}: ${entry.text}` : entry.text;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-neutral-800/90 border-2 border-neutral-700 rounded-lg p-4 relative group shadow-lg">
      {/* Delete button - matching MonsterCard style */}
      {viewMode !== 'game' && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all z-10 p-1 hover:bg-red-900/20 rounded"
          title="Remove widget"
        >
          <Trash2 size={16} />
        </button>
      )}

      {/* Dialogue Entries */}
      <div className="space-y-2">
        {widget.entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-dm-dark border border-gray-600 rounded overflow-hidden"
          >
            {/* Entry Header Row */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-600">
              {/* Collapse Toggle */}
              <button
                onClick={() => handleToggleCollapse(entry.id)}
                className="p-0.5 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                title={entry.isCollapsed ? "Expand" : "Collapse"}
              >
                {entry.isCollapsed ? (
                  <ChevronRight size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>
              
              {/* Speaker Name - styled like MonsterCard inputs */}
              <input
                type="text"
                value={entry.speaker}
                onChange={(e) => handleUpdateEntry(entry.id, { speaker: e.target.value })}
                placeholder="Speaker name..."
                className="flex-1 bg-transparent text-sm font-bold text-amber-400 focus:outline-none cursor-text placeholder:text-gray-600"
              />
              
              {/* Copy Button - Text style */}
              <button
                onClick={() => handleCopyEntry(entry)}
                className={`px-2 py-0.5 text-xs font-semibold rounded transition-colors flex-shrink-0 ${
                  copiedId === entry.id 
                    ? 'bg-green-600 text-white' 
                    : 'bg-amber-600/80 hover:bg-amber-500 text-white'
                }`}
              >
                {copiedId === entry.id ? 'Copied!' : 'Copy'}
              </button>
              
              {/* Delete Button */}
              {viewMode !== 'game' && (
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                  title="Delete entry"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Entry Content - Collapsible */}
            {!entry.isCollapsed && (
              <div className="p-2">
                <textarea
                  value={entry.text}
                  onChange={(e) => handleUpdateEntry(entry.id, { text: e.target.value })}
                  placeholder="Enter dialogue text..."
                  className="w-full bg-neutral-900/50 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500 resize-none min-h-[60px] cursor-text"
                  rows={3}
                />
              </div>
            )}

            {/* Collapsed Preview */}
            {entry.isCollapsed && entry.text && (
              <div className="px-3 py-1.5 text-xs text-gray-400 italic truncate">
                "{entry.text.substring(0, 80)}{entry.text.length > 80 ? '...' : ''}"
              </div>
            )}
          </div>
        ))}

        {/* Add Entry Button */}
        {viewMode !== 'game' && (
          <button
            onClick={handleAddEntry}
            className="w-full py-2 border-2 border-dashed border-gray-600 rounded hover:border-amber-500 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-amber-400"
          >
            <Plus size={14} />
            <span className="text-xs font-semibold">Add Dialogue Entry</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {widget.entries.length === 0 && viewMode === 'game' && (
        <div className="text-center py-4 text-gray-500 text-xs italic">
          No dialogue entries
        </div>
      )}
    </div>
  );
};

export default DialogueWidget;
