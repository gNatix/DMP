import { MousePointer2, Stamp, Undo, Redo, Copy, Trash2, ArrowUp, ArrowDown, Hand, ZoomIn, ZoomOut, Maximize2, Lock, Tag, Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark as LandmarkIcon, Footprints, Info, Paintbrush } from 'lucide-react';
import { ToolType, TokenTemplate, IconType, ColorType } from '../types';
import { useState, useRef, useEffect } from 'react';

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
  recentTokens: TokenTemplate[];
  onSelectToken: (token: TokenTemplate) => void;
  selectedColor: ColorType;
  onColorChange: (color: ColorType) => void;
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
  onToggleBadges,
  recentTokens,
  onSelectToken,
  selectedColor,
  onColorChange
}: FloatingToolbarProps) => {
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const tokenButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showTokenPicker &&
        pickerRef.current &&
        tokenButtonRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !tokenButtonRef.current.contains(e.target as Node)
      ) {
        setShowTokenPicker(false);
      }
      
      if (
        showColorPicker &&
        colorPickerRef.current &&
        colorButtonRef.current &&
        !colorPickerRef.current.contains(e.target as Node) &&
        !colorButtonRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTokenPicker, showColorPicker]);

  const handleTokenRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (recentTokens.length > 0) {
      setShowTokenPicker(!showTokenPicker);
    }
  };

  const handleColorClick = () => {
    setShowColorPicker(!showColorPicker);
  };

  const handleColorSelect = (color: ColorType) => {
    onColorChange(color);
    setShowColorPicker(false);
    // Apply color to selected element(s) immediately
    if (hasSelection) {
      // Trigger color application through parent
      const event = new CustomEvent('applyColorToSelection', { detail: { color } });
      window.dispatchEvent(event);
    }
  };

  const handleTokenSelect = (token: TokenTemplate) => {
    onSelectToken(token);
    setShowTokenPicker(false);
  };

  // Keyboard handler for B key to open token picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') {
        // Check if we're in a text input
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
          return; // Don't interfere with text input
        }
        
        // If token tool is active and we have recent tokens, toggle picker
        if (activeTool === 'token' && recentTokens.length > 0) {
          e.preventDefault();
          setShowTokenPicker(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, recentTokens.length]);

  // Helper functions for rendering tokens
  const getLucideIcon = (icon: IconType) => {
    const icons = {
      circle: Circle,
      square: Square,
      triangle: Triangle,
      star: Star,
      diamond: Diamond,
      heart: Heart,
      skull: Skull,
      quest: MapPin,
      clue: Search,
      hidden: Eye,
      door: DoorOpen,
      landmark: LandmarkIcon,
      footprint: Footprints,
      info: Info
    };
    return icons[icon];
  };

  const colorMap: Record<ColorType, string> = {
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
    green: '#22c55e' // Not shown in picker
  };

  const renderTokenIcon = (token: TokenTemplate) => {
    if (token.imageUrl) {
      return (
        <img
          src={token.imageUrl}
          alt={token.name}
          className="w-full h-full object-cover rounded"
        />
      );
    }

    // Render shape or POI token with icon and color
    if (token.icon) {
      const IconComponent = getLucideIcon(token.icon);
      const color = token.color ? colorMap[token.color] : colorMap.red;
      
      if (token.isPOI) {
        // POI - just the icon with color
        return (
          <div className="w-full h-full flex items-center justify-center p-1">
            <IconComponent 
              size={28}
              style={{ color }}
              strokeWidth={2}
            />
          </div>
        );
      } else if (token.isShape) {
        // Shape - filled icon with color
        return (
          <div className="w-full h-full flex items-center justify-center p-1">
            <IconComponent 
              size={28}
              style={{ color }}
              fill={color}
              strokeWidth={1.5}
            />
          </div>
        );
      }
    }

    // Fallback
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 group-hover:text-white">
        <Stamp size={20} />
      </div>
    );
  };

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

        <div className="relative">
          <button
            ref={tokenButtonRef}
            onClick={() => setActiveTool('token')}
            onContextMenu={handleTokenRightClick}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'token'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="Token Tool (B) - Right click for quick access"
          >
            <Stamp size={18} />
          </button>

          {/* Token Picker Menu */}
          {showTokenPicker && recentTokens.length > 0 && (
            <div
              ref={pickerRef}
              className="absolute bottom-full mb-2 left-0 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
              style={{
                maxWidth: '280px',
                minWidth: '200px'
              }}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {recentTokens.slice(0, 16).map((token) => (
                  <button
                    key={token.id}
                    onClick={() => handleTokenSelect(token)}
                    className="aspect-square rounded bg-dm-dark hover:bg-dm-highlight transition-colors overflow-hidden group relative border-2 border-transparent hover:border-yellow-500 box-content"
                    title={token.name}
                  >
                    {renderTokenIcon(token)}
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {token.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
              ? 'border-2 border-yellow-500 box-content'
              : 'border-2 border-transparent box-content'
          }`}
          title={hasSelection ? "Toggle Badge for Selected Token(s)" : "Toggle All Token Badges"}
        >
          <Tag size={18} />
        </button>

        {/* Color Picker */}
        <div className="relative">
          <button
            ref={colorButtonRef}
            onClick={handleColorClick}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border border-2 border-transparent box-content"
            title="Vælg farve"
          >
            <Paintbrush 
              size={18} 
              style={{ 
                color: colorMap[selectedColor],
                stroke: colorMap[selectedColor],
                fill: 'none'
              }} 
            />
          </button>

          {/* Color Picker Menu */}
          {showColorPicker && (
            <div
              ref={colorPickerRef}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px'
              }}>
                {(Object.keys(colorMap) as ColorType[])
                  .filter(color => color !== 'green') // Exclude green from picker
                  .map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    style={{
                      backgroundColor: colorMap[color],
                      width: '28px',
                      height: '28px',
                      border: color === 'white' || color === 'black' ? '1px solid #4b5563' : '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      outline: selectedColor === color ? '2px solid #facc15' : 'none',
                      outlineOffset: '2px'
                    }}
                    className="hover:scale-110 transition-transform"
                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Fit to View */}
        <button
          onClick={onFitToView}
          className={`p-2.5 rounded transition-colors relative ${
            fitToViewLocked
              ? 'bg-dm-dark border-2 border-red-500 text-gray-300 hover:text-white box-content'
              : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white border-2 border-transparent box-content'
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
