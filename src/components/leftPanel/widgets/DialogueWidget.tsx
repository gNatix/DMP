import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { DialogueWidget as DialogueWidgetType, DialogueEntry, ViewMode } from '../../../types';

interface DialogueWidgetProps {
  widget: DialogueWidgetType;
  onUpdate: (updates: Partial<DialogueWidgetType>) => void;
  onDelete: () => void;
  viewMode?: ViewMode;
}

const DialogueWidget = ({ widget, onUpdate, onDelete, viewMode }: DialogueWidgetProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const entries = widget.entries || [];

  const handleAddEntry = () => {
    const newEntry: DialogueEntry = {
      id: generateId(),
      speaker: '',
      text: '',
      isCollapsed: false
    };
    onUpdate({ entries: [...entries, newEntry] });
  };

  const handleUpdateEntry = (entryId: string, updates: Partial<DialogueEntry>) => {
    const newEntries = entries.map(entry =>
      entry.id === entryId ? { ...entry, ...updates } : entry
    );
    onUpdate({ entries: newEntries });
  };

  const handleDeleteEntry = (entryId: string) => {
    onUpdate({ entries: entries.filter(entry => entry.id !== entryId) });
  };

  const handleToggleCollapse = (entryId: string) => {
    // Toggle the clicked row independently
    const newEntries = entries.map(entry =>
      entry.id === entryId 
        ? { ...entry, isCollapsed: !entry.isCollapsed }
        : entry
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
    <div className="bg-neutral-800/90 border-2 border-neutral-700 rounded-lg p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <MessageSquare size={16} className="text-green-400 flex-shrink-0" />
          <input
            type="text"
            value={widget.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Table name..."
            className="bg-transparent text-sm font-semibold text-gray-200 focus:outline-none focus:bg-gray-700/30 rounded px-1 flex-1 placeholder:text-gray-500"
          />
        </div>
        {viewMode !== 'game' && (
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="Delete widget"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Dialogue Table */}
      <div className="border border-gray-600 rounded overflow-hidden">
        {/* Table Rows */}
        <div>
          {entries.map((entry, index) => (
            <div 
              key={entry.id} 
              className={`border-b border-gray-700 last:border-b-0 ${
                index % 2 === 0 ? 'bg-gray-800/40' : 'bg-gray-900/40'
              } ${!entry.isCollapsed ? 'ring-1 ring-green-500/30' : ''}`}
            >
              {/* Row Header */}
              <div className="flex items-center gap-0">
                {/* Row Number */}
                <div className="w-8 text-center text-xs text-gray-400 font-bold py-2 border-r border-gray-700 flex-shrink-0">
                  {index + 1}
                </div>
                
                {/* Collapse Toggle */}
                <button
                  onClick={() => handleToggleCollapse(entry.id)}
                  className="p-1.5 hover:bg-gray-600 transition-colors flex-shrink-0"
                  title={entry.isCollapsed ? "Expand" : "Collapse"}
                >
                  {entry.isCollapsed ? (
                    <ChevronRight size={12} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={12} className="text-gray-400" />
                  )}
                </button>

                {/* Dialogue Title */}
                <input
                  type="text"
                  value={entry.speaker}
                  onChange={(e) => handleUpdateEntry(entry.id, { speaker: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => {
                    // Only expand if collapsed (don't toggle)
                    if (entry.isCollapsed) {
                      const newEntries = entries.map(e =>
                        e.id === entry.id ? { ...e, isCollapsed: false } : e
                      );
                      onUpdate({ entries: newEntries });
                    }
                  }}
                  placeholder="Dialogue title..."
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm font-semibold text-gray-200 focus:outline-none focus:bg-gray-700/30 cursor-text placeholder:text-gray-500"
                />

                {/* Copy Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyEntry(entry);
                  }}
                  className={`px-2 py-1 text-xs font-semibold rounded-sm transition-colors mx-1 ${
                    copiedId === entry.id 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-600/80 hover:bg-green-500 text-white'
                  }`}
                >
                  {copiedId === entry.id ? 'Copied!' : 'Copy'}
                </button>

                {/* Delete Button */}
                {viewMode !== 'game' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(entry.id);
                    }}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors flex-shrink-0 border-l border-gray-700"
                    title="Delete entry"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Dialogue Text - Collapsible */}
              {!entry.isCollapsed && (
                <div className="border-t border-gray-700/50" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={entry.text}
                    onChange={(e) => handleUpdateEntry(entry.id, { text: e.target.value })}
                    placeholder="Enter dialogue text..."
                    className="w-full bg-transparent px-3 py-2 text-xs text-gray-200 focus:outline-none focus:bg-gray-700/30 resize-none min-h-[50px] cursor-text"
                    rows={2}
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.max(50, target.scrollHeight) + 'px';
                    }}
                  />
                </div>
              )}

              {/* Collapsed Preview */}
              {entry.isCollapsed && entry.text && (
                <div className="px-3 py-1 text-xs text-gray-500 italic truncate border-t border-gray-700/50">
                  {entry.text.substring(0, 60)}{entry.text.length > 60 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Row Button */}
        {viewMode !== 'game' && (
          <button
            onClick={handleAddEntry}
            className="w-full py-2 bg-gray-800/60 hover:bg-green-500/10 border-t border-gray-600 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-green-400"
          >
            <Plus size={12} />
            <span className="text-xs font-semibold">Add Row</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {entries.length === 0 && viewMode === 'game' && (
        <div className="text-center py-4 text-gray-500 text-xs italic">
          No dialogue entries
        </div>
      )}
    </div>
  );
};

export default DialogueWidget;
