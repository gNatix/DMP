import { MousePointer2, Stamp, Undo, Redo, Copy, Trash2, ArrowUp, ArrowDown, Hand, ZoomIn, ZoomOut, Maximize2, Lock, Tag } from 'lucide-react';
import { ToolType } from '../types';

interface FloatingToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLayerUp: () => void;
  onLayerDown: () => void;
  onFitToView: () => void;
  fitToViewLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  showTokenBadges: boolean;
  selectedTokenHasBadge: boolean;
  onToggleBadges: () => void;
}

const FloatingToolbar = ({
  activeTool,
  setActiveTool,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onLayerUp,
  onLayerDown,
  onFitToView,
  fitToViewLocked,
  canUndo,
  canRedo,
  hasSelection,
  showTokenBadges,
  selectedTokenHasBadge,
  onToggleBadges
}: FloatingToolbarProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl px-3 py-2 flex items-center gap-1">
        {/* Pointer Tools Group */}
        <button
          onClick={() => setActiveTool('pointer')}
          className={`p-2.5 rounded transition-colors ${
            activeTool === 'pointer'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title="Pointer Tool (V)"
        >
          <MousePointer2 size={18} />
        </button>

        <button
          onClick={() => setActiveTool('token')}
          className={`p-2.5 rounded transition-colors ${
            activeTool === 'token'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title="Token Tool (B)"
        >
          <Stamp size={18} />
        </button>

        <button
          onClick={() => setActiveTool('pan')}
          className={`p-2.5 rounded transition-colors ${
            activeTool === 'pan'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title="Pan Tool (N)"
        >
          <Hand size={18} />
        </button>

        <button
          onClick={() => setActiveTool('zoom-out')}
          className={`p-2.5 rounded transition-colors ${
            activeTool === 'zoom-out'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title="Zoom Out Tool (X)"
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={() => setActiveTool('zoom-in')}
          className={`p-2.5 rounded transition-colors ${
            activeTool === 'zoom-in'
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title="Zoom In Tool (Z)"
        >
          <ZoomIn size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={18} />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Edit Actions Group */}
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Duplicate (Ctrl+D)"
        >
          <Copy size={18} />
        </button>

        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete (Delete)"
        >
          <Trash2 size={18} />
        </button>

        <button
          onClick={onLayerUp}
          disabled={!hasSelection}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Layer Up (Ctrl+↑)"
        >
          <ArrowUp size={18} />
        </button>

        <button
          onClick={onLayerDown}
          disabled={!hasSelection}
          className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Layer Down (Ctrl+↓)"
        >
          <ArrowDown size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Token Badges Toggle */}
        <button
          onClick={onToggleBadges}
          className={`p-2.5 rounded transition-colors ${
            showTokenBadges
              ? 'bg-dm-highlight text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          } ${
            selectedTokenHasBadge && hasSelection
              ? 'border-2 border-yellow-500'
              : ''
          }`}
          title={hasSelection ? "Toggle Badge for Selected Token(s)" : "Toggle All Token Badges"}
        >
          <Tag size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Fit to View */}
        <button
          onClick={onFitToView}
          className={`p-2.5 rounded transition-colors relative ${
            fitToViewLocked
              ? 'bg-dm-dark border-2 border-red-500 text-gray-300 hover:text-white'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
          }`}
          title={fitToViewLocked ? "Unlock Fit to View (F)" : "Lock Fit to View (F)"}
        >
          <Maximize2 size={18} />
          {fitToViewLocked && (
            <Lock size={10} className="absolute top-0.5 right-0.5 text-white opacity-60" />
          )}
        </button>
      </div>
    </div>
  );
};

export default FloatingToolbar;
