import { MousePointer2, Stamp, Undo, Redo, Copy, Trash2, ArrowUp, ArrowDown, Hand, ZoomIn, ZoomOut, Maximize2, Lock, Tag, Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark as LandmarkIcon, Footprints, Info, Paintbrush, Home, Grid3x3 } from 'lucide-react';
import { ToolType, TokenTemplate, IconType, ColorType, RoomSubTool } from '../types';
import { useState, useRef, useEffect } from 'react';
import TokenPickerSubmenu from './TokenPickerSubmenu';

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
  tokenTemplates: TokenTemplate[];
  activeTokenTemplate: TokenTemplate | null;
  onSelectToken: (token: TokenTemplate) => void;
  selectedColor: ColorType;
  onColorChange: (color: ColorType) => void;
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  selectedElementLocked: boolean;
  onToggleLock: () => void;
  showGrid: boolean;
  gridSize: number;
  onToggleGrid: () => void;
  onGridSizeChange: (size: number) => void;
  forceShowTokenSubmenu?: boolean;
  onHideTokenPreview?: () => void;
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
  tokenTemplates,
  activeTokenTemplate,
  onSelectToken,
  selectedColor,
  onColorChange,
  roomSubTool,
  setRoomSubTool,
  selectedElementLocked,
  onToggleLock,
  showGrid,
  gridSize,
  onToggleGrid,
  onGridSizeChange,
  forceShowTokenSubmenu = false,
  onHideTokenPreview
}: FloatingToolbarProps) => {
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showTokenSubmenu, setShowTokenSubmenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showRoomSubToolPicker, setShowRoomSubToolPicker] = useState(false);
  const [showGridControls, setShowGridControls] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Helper to close all submenus
  const closeAllMenus = () => {
    setShowTokenPicker(false);
    setShowTokenSubmenu(false);
    setShowColorPicker(false);
    setShowRoomSubToolPicker(false);
    setShowGridControls(false);
  };
  const tokenButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const gridButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const roomSubToolPickerRef = useRef<HTMLDivElement>(null);
  const gridControlsRef = useRef<HTMLDivElement>(null);
  
  // Timeout refs for delayed close
  const tokenMenuTimeoutRef = useRef<number | null>(null);
  const roomMenuTimeoutRef = useRef<number | null>(null);
  const gridMenuTimeoutRef = useRef<number | null>(null);
  const colorMenuTimeoutRef = useRef<number | null>(null);
  const colorCycleTimeoutRef = useRef<number | null>(null);

  // Show color picker briefly when cycling colors with C key
  useEffect(() => {
    // Track if color picker is already manually open
    if (!showColorPicker) {
      // Show color picker when color changes (from keyboard)
      if (colorCycleTimeoutRef.current) clearTimeout(colorCycleTimeoutRef.current);
      setShowColorPicker(true);
      
      // Auto-hide after 1.5 seconds
      colorCycleTimeoutRef.current = window.setTimeout(() => {
        setShowColorPicker(false);
      }, 1500);
    }
    
    return () => {
      if (colorCycleTimeoutRef.current) clearTimeout(colorCycleTimeoutRef.current);
    };
  }, [selectedColor]);

  // Close picker when clicking outside (only for token and color pickers)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        (showTokenPicker && pickerRef.current && tokenButtonRef.current && !pickerRef.current.contains(e.target as Node) && !tokenButtonRef.current.contains(e.target as Node)) ||
        (showColorPicker && colorPickerRef.current && colorButtonRef.current && !colorPickerRef.current.contains(e.target as Node) && !colorButtonRef.current.contains(e.target as Node)) ||
        (showRoomSubToolPicker && roomSubToolPickerRef.current && roomButtonRef.current && !roomSubToolPickerRef.current.contains(e.target as Node) && !roomButtonRef.current.contains(e.target as Node)) ||
        (showGridControls && gridControlsRef.current && gridButtonRef.current && !gridControlsRef.current.contains(e.target as Node) && !gridButtonRef.current.contains(e.target as Node))
      ) {
        closeAllMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTokenPicker, showColorPicker, showRoomSubToolPicker, showGridControls]);

  // Remove right-click logic for token picker
  // Token picker hover handlers
  const handleTokenMenuEnter = () => {
    // Clear all timeouts
    if (tokenMenuTimeoutRef.current) clearTimeout(tokenMenuTimeoutRef.current);
    if (roomMenuTimeoutRef.current) clearTimeout(roomMenuTimeoutRef.current);
    if (gridMenuTimeoutRef.current) clearTimeout(gridMenuTimeoutRef.current);
    if (colorMenuTimeoutRef.current) clearTimeout(colorMenuTimeoutRef.current);
    
    // Close all other menus immediately
    setShowRoomSubToolPicker(false);
    setShowGridControls(false);
    setShowColorPicker(false);
    setShowTokenPicker(false);
    
    // Open this menu
    setShowTokenSubmenu(true);
  };
  const handleTokenMenuLeave = () => {
    tokenMenuTimeoutRef.current = window.setTimeout(() => {
      setShowTokenSubmenu(false);
    }, 200);
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

  // Scroll handlers for submenus
  const handleGridScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    const newSize = Math.max(20, Math.min(200, gridSize + delta));
    onGridSizeChange(newSize);
  };

  const handleRoomScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const tools: RoomSubTool[] = [
      'rectangle', 'pentagon', 'hexagon', 'octagon', 'custom',
      'subtract-rectangle', 'subtract-pentagon', 'subtract-hexagon', 'subtract-octagon', 'subtract-custom'
    ];
    const currentIndex = tools.indexOf(roomSubTool);
    const delta = e.deltaY > 0 ? -1 : 1; // Reversed: scroll down = previous, scroll up = next
    const newIndex = (currentIndex + delta + tools.length) % tools.length;
    setRoomSubTool(tools[newIndex]);
  };

  const handleColorScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const colors: ColorType[] = ['red', 'blue', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray', 'black', 'white', 'cyan', 'magenta', 'lime', 'indigo', 'teal', 'green'];
    const currentIndex = colors.indexOf(selectedColor);
    const delta = e.deltaY > 0 ? 1 : -1;
    const newIndex = (currentIndex + delta + colors.length) % colors.length;
    onColorChange(colors[newIndex]);
  };

  const handleTokenScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    if (tokenTemplates.length === 0) return;
    
    const currentIndex = activeTokenTemplate 
      ? tokenTemplates.findIndex((t: TokenTemplate) => t.id === activeTokenTemplate.id)
      : -1;
    
    let newIndex;
    if (e.deltaY < 0) {
      // Scroll up - previous token
      newIndex = currentIndex <= 0 ? tokenTemplates.length - 1 : currentIndex - 1;
    } else {
      // Scroll down - next token
      newIndex = (currentIndex + 1) % tokenTemplates.length;
    }
    
    onSelectToken(tokenTemplates[newIndex]);
  };

  // Mouse enter/leave handlers with delay for submenus
  const handleRoomMenuEnter = () => {
    // Clear all timeouts
    if (tokenMenuTimeoutRef.current) clearTimeout(tokenMenuTimeoutRef.current);
    if (roomMenuTimeoutRef.current) clearTimeout(roomMenuTimeoutRef.current);
    if (gridMenuTimeoutRef.current) clearTimeout(gridMenuTimeoutRef.current);
    if (colorMenuTimeoutRef.current) clearTimeout(colorMenuTimeoutRef.current);
    
    // Close all other menus immediately
    setShowTokenSubmenu(false);
    setShowGridControls(false);
    setShowColorPicker(false);
    setShowTokenPicker(false);
    
    // Open this menu
    setShowRoomSubToolPicker(true);
  };

  const handleRoomMenuLeave = () => {
    roomMenuTimeoutRef.current = setTimeout(() => {
      setShowRoomSubToolPicker(false);
    }, 200);
  };

  const handleGridMenuEnter = () => {
    // Clear all timeouts
    if (tokenMenuTimeoutRef.current) clearTimeout(tokenMenuTimeoutRef.current);
    if (roomMenuTimeoutRef.current) clearTimeout(roomMenuTimeoutRef.current);
    if (gridMenuTimeoutRef.current) clearTimeout(gridMenuTimeoutRef.current);
    if (colorMenuTimeoutRef.current) clearTimeout(colorMenuTimeoutRef.current);
    
    // Close all other menus immediately
    setShowTokenSubmenu(false);
    setShowRoomSubToolPicker(false);
    setShowColorPicker(false);
    setShowTokenPicker(false);
    
    // Open this menu
    setShowGridControls(true);
  };

  const handleGridMenuLeave = () => {
    gridMenuTimeoutRef.current = setTimeout(() => {
      setShowGridControls(false);
    }, 200);
  };

  const handleColorMenuEnter = () => {
    // Clear all timeouts
    if (tokenMenuTimeoutRef.current) clearTimeout(tokenMenuTimeoutRef.current);
    if (roomMenuTimeoutRef.current) clearTimeout(roomMenuTimeoutRef.current);
    if (gridMenuTimeoutRef.current) clearTimeout(gridMenuTimeoutRef.current);
    if (colorMenuTimeoutRef.current) clearTimeout(colorMenuTimeoutRef.current);
    
    // Close all other menus immediately
    setShowTokenSubmenu(false);
    setShowRoomSubToolPicker(false);
    setShowGridControls(false);
    setShowTokenPicker(false);
    
    // Open this menu
    setShowColorPicker(true);
  };

  const handleColorMenuLeave = () => {
    colorMenuTimeoutRef.current = setTimeout(() => {
      setShowColorPicker(false);
    }, 200);
  };

  // Auto-open room sub-tool picker when room tool is active and reset to rectangle mode
  useEffect(() => {
    if (activeTool === 'room') {
      // Close all other menus
      setShowTokenSubmenu(false);
      setShowTokenPicker(false);
      setShowColorPicker(false);
      setShowGridControls(false);
      
      setShowRoomSubToolPicker(true);
      // Reset to rectangle mode when activating room tool
      setRoomSubTool('rectangle');
    } else {
      setShowRoomSubToolPicker(false);
    }
    
    // Close all submenus when switching to tools without submenus
    if (activeTool === 'pointer' || activeTool === 'pan' || activeTool === 'zoom-in' || activeTool === 'zoom-out' || activeTool === 'marker') {
      setShowTokenSubmenu(false);
      setShowTokenPicker(false);
      setShowColorPicker(false);
      setShowGridControls(false);
      setShowRoomSubToolPicker(false);
    }
  }, [activeTool, setRoomSubTool]);

  // Keyboard handler for B key to open token picker and cycle tokens
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Alt key
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
      
      // Check if we're in a text input
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
        return; // Don't interfere with text input
      }
      
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        
        // Close all other menus when activating token tool
        setShowRoomSubToolPicker(false);
        setShowColorPicker(false);
        setShowGridControls(false);
        setShowTokenPicker(false);
        
        // If token tool is active and submenu is open, cycle through tokens
        if (activeTool === 'token' && showTokenSubmenu && tokenTemplates.length > 0) {
          const currentIndex = activeTokenTemplate 
            ? tokenTemplates.findIndex((t: TokenTemplate) => t.id === activeTokenTemplate.id)
            : -1;
          const nextIndex = (currentIndex + 1) % tokenTemplates.length;
          onSelectToken(tokenTemplates[nextIndex]);
        } 
        // If token tool is not active, activate it and show submenu
        else if (activeTool !== 'token') {
          setActiveTool('token');
          setShowTokenSubmenu(true);
        }
        // If token tool is active but submenu is closed, open submenu
        else if (activeTool === 'token' && !showTokenSubmenu) {
          setShowTokenSubmenu(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, showTokenSubmenu, tokenTemplates, activeTokenTemplate, onSelectToken, setActiveTool]);

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
    <div 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 floating-toolbar"
      onMouseEnter={() => onHideTokenPreview?.()}
    >
      <div className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl px-3 pt-2 pb-1 flex flex-col gap-0.5">
        {/* Main toolbar buttons row */}
        <div className="flex items-center gap-1">
        {/* Pointer Tools Group */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={() => setActiveTool('pointer')}
            onMouseEnter={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'none';
            }}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'pointer'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="V"
          >
            <MousePointer2 size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">V</span>
          <div 
            className="badge-tooltip"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Select (V)
          </div>
        </div>

        {/* Token Tool */}
        <div className="relative flex flex-col items-center">
          <button
            ref={tokenButtonRef}
            onClick={() => setActiveTool('token')}
            onMouseEnter={handleTokenMenuEnter}
            onMouseLeave={handleTokenMenuLeave}
            onWheel={handleTokenScroll}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'token'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="Token Tool (B)"
          >
            <Stamp size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">B</span>

          {/* Token Submenu with all tokens and pagination */}
          {(showTokenSubmenu || forceShowTokenSubmenu) && tokenTemplates.length > 0 && (
            <div
              onMouseEnter={handleTokenMenuEnter}
              onMouseLeave={handleTokenMenuLeave}
              onWheel={handleTokenScroll}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2"
            >
              <TokenPickerSubmenu
                tokens={tokenTemplates}
                onSelectToken={handleTokenSelect}
                activeTokenId={activeTokenTemplate?.id}
              />
            </div>
          )}

          {/* Token Picker Menu (legacy - keep for B key shortcut) */}
          {showTokenPicker && recentTokens.length > 0 && (
            <div
              ref={pickerRef}
              className="absolute bottom-full mb-2 left-0 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
              style={{
                maxWidth: '280px',
                minWidth: '200px'
              }}
              onMouseEnter={handleTokenMenuEnter}
              onMouseLeave={handleTokenMenuLeave}
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

        <div className="relative flex flex-col items-center">
          <button
            ref={roomButtonRef}
            onClick={() => setActiveTool('room')}
            onMouseEnter={handleRoomMenuEnter}
            onMouseLeave={handleRoomMenuLeave}
            onWheel={handleRoomScroll}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'room'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="Room Tool (R)"
          >
            <Home size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">R</span>

          {/* Room Sub-Tool Picker */}
          {showRoomSubToolPicker && (
            <div 
              className="absolute bottom-full mb-3"
              style={{ left: '-96px' }}
            >
              {/* Room tool badge */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: '#9ca3af',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                }}
              >
                {roomSubTool?.startsWith('subtract-') ? 'Subtract ' : 'Add '}
                {roomSubTool?.replace('subtract-', '').charAt(0).toUpperCase() + roomSubTool?.replace('subtract-', '').slice(1)} (R)
              </div>
              
              <div
                ref={roomSubToolPickerRef}
                className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
                onMouseEnter={handleRoomMenuEnter}
                onMouseLeave={handleRoomMenuLeave}
                onWheel={handleRoomScroll}
              >
              <div className="flex gap-1">
                {/* Add/Subtract Mode Toggle - First cell split horizontally */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      const baseShape = roomSubTool?.replace('subtract-', '') as 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'custom' | 'erase' || 'rectangle';
                      if (baseShape !== 'erase') {
                        setRoomSubTool(baseShape);
                        setActiveTool('room');
                      }
                    }}
                    className={`w-10 h-5 rounded border-2 transition-all flex items-center justify-center ${
                      !roomSubTool?.startsWith('subtract-')
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
                    }`}
                    title="Add Room"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M12 4v16m8-8H4" strokeLinecap="round"/>
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => {
                      const baseShape = roomSubTool?.replace('subtract-', '') as 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'custom' | 'erase' || 'rectangle';
                      if (baseShape !== 'erase') {
                        setRoomSubTool(`subtract-${baseShape}` as RoomSubTool);
                        setActiveTool('room');
                      }
                    }}
                    className={`w-10 h-5 rounded border-2 transition-all flex items-center justify-center ${
                      roomSubTool?.startsWith('subtract-')
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
                    }`}
                    title="Subtract"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M20 12H4" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Rectangle */}
                <button
                  onClick={() => {
                    const isSubtract = roomSubTool?.startsWith('subtract-');
                    setRoomSubTool(isSubtract ? 'subtract-rectangle' : 'rectangle');
                    setActiveTool('room');
                  }}
                  className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    roomSubTool?.replace('subtract-', '') === 'rectangle'
                      ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Rectangle"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="6" width="16" height="12" strokeWidth="2"/>
                  </svg>
                </button>

                {/* Pentagon */}
                <button
                  onClick={() => {
                    const isSubtract = roomSubTool?.startsWith('subtract-');
                    setRoomSubTool(isSubtract ? 'subtract-pentagon' : 'pentagon');
                    setActiveTool('room');
                  }}
                  className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    roomSubTool?.replace('subtract-', '') === 'pentagon'
                      ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Pentagon"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3 L21 9 L18 19 L6 19 L3 9 Z" strokeWidth="2"/>
                  </svg>
                </button>

                {/* Hexagon */}
                <button
                  onClick={() => {
                    const isSubtract = roomSubTool?.startsWith('subtract-');
                    setRoomSubTool(isSubtract ? 'subtract-hexagon' : 'hexagon');
                    setActiveTool('room');
                  }}
                  className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    roomSubTool?.replace('subtract-', '') === 'hexagon'
                      ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Hexagon"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" strokeWidth="2"/>
                  </svg>
                </button>

                {/* Octagon */}
                <button
                  onClick={() => {
                    const isSubtract = roomSubTool?.startsWith('subtract-');
                    setRoomSubTool(isSubtract ? 'subtract-octagon' : 'octagon');
                    setActiveTool('room');
                  }}
                  className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    roomSubTool?.replace('subtract-', '') === 'octagon'
                      ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Octagon"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" strokeWidth="2"/>
                  </svg>
                </button>

                {/* Custom */}
                <button
                  onClick={() => {
                    const isSubtract = roomSubTool?.startsWith('subtract-');
                    setRoomSubTool(isSubtract ? 'subtract-custom' : 'custom');
                    setActiveTool('room');
                  }}
                  className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    roomSubTool?.replace('subtract-', '') === 'custom'
                      ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                      : 'border-dm-border hover:border-dm-highlight'
                  }`}
                  title="Custom Polygon"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18 L12 8 L20 12" strokeWidth="2"/>
                    <circle cx="6" cy="18" r="1.5" fill="currentColor"/>
                    <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="20" cy="12" r="1.5" fill="currentColor"/>
                  </svg>
                </button>
              </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex flex-col items-center">
          <button
            onClick={() => setActiveTool('pan')}
            onMouseEnter={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'none';
            }}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'pan'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="D"
          >
            <Hand size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">D</span>
          <div 
            className="badge-tooltip"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Drag Canvas (D)
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <button
            onClick={() => setActiveTool('zoom-in')}
            onMouseEnter={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.badge-tooltip') as HTMLElement;
              if (badge) badge.style.display = 'none';
            }}
            className={`p-2.5 rounded transition-colors ${
              activeTool === 'zoom-in' || activeTool === 'zoom-out'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            }`}
            title="Z"
          >
            {isAltPressed && (activeTool === 'zoom-in' || activeTool === 'zoom-out') ? (
              <ZoomOut size={18} />
            ) : (
              <ZoomIn size={18} />
            )}
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Z</span>
          <div 
            className="badge-tooltip" 
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Zoom (Z) - Alt+Click to Zoom Out
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Undo/Redo */}
        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.undo-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.undo-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
          >
            <Undo size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ctrl+Z</span>
          <div 
            className="undo-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Undo (Ctrl+Z)
          </div>
        </div>

        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.redo-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.redo-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
          >
            <Redo size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ctrl+Y</span>
          <div 
            className="redo-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Redo (Ctrl+Y)
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Edit Actions Group */}
        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.duplicate-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.duplicate-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onDuplicate}
            disabled={!hasSelection}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
          >
            <Copy size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ctrl+D</span>
          <div 
            className="duplicate-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Duplicate (Ctrl+D)
          </div>
        </div>

        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.delete-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.delete-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onDelete}
            disabled={!hasSelection}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark disabled:hover:text-red-400"
          >
            <Trash2 size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Del</span>
          <div 
            className="delete-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Delete (Del)
          </div>
        </div>

        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.layerup-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.layerup-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onLayerUp}
            disabled={!hasSelection}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
          >
            <ArrowUp size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ctrl+↑</span>
          <div 
            className="layerup-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Layer Up (Ctrl+↑)
          </div>
        </div>

        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.layerdown-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.layerdown-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onLayerDown}
            disabled={!hasSelection}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-dm-dark"
          >
            <ArrowDown size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">Ctrl+↓</span>
          <div 
            className="layerdown-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Layer Down (Ctrl+↓)
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Token Badges Toggle */}
        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.badge-toggle-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.badge-toggle-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
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
          >
            <Tag size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">N</span>
          <div 
            className="badge-toggle-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Toggle Badges (N)
          </div>
        </div>

        {/* Lock Toggle */}
        <div 
          className="relative flex flex-col items-center"
          onMouseEnter={(e) => {
            const badge = e.currentTarget.querySelector('.lock-badge') as HTMLElement;
            if (badge) badge.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const badge = e.currentTarget.querySelector('.lock-badge') as HTMLElement;
            if (badge) badge.style.display = 'none';
          }}
        >
          <button
            onClick={onToggleLock}
            disabled={!hasSelection}
            className={`p-2.5 rounded transition-colors ${
              !hasSelection
                ? 'opacity-50 cursor-not-allowed bg-dm-dark text-gray-500'
                : selectedElementLocked
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            } border-2 border-transparent box-content`}
          >
            <Lock size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">L</span>
          <div 
            className="lock-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Lock Selection (L)
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Grid Toggle with Submenu */}
        <div className="relative flex flex-col items-center">
          <button
            ref={gridButtonRef}
            onClick={onToggleGrid}
            onMouseEnter={handleGridMenuEnter}
            onMouseLeave={handleGridMenuLeave}
            onWheel={handleGridScroll}
            className={`p-2.5 rounded transition-colors ${
              showGrid
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
            } border-2 border-transparent box-content`}
            title="Toggle Grid"
          >
            <Grid3x3 size={18} />
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">G</span>

          {/* Grid Controls Submenu */}
          {showGridControls && (
            <div
              ref={gridControlsRef}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-3 z-[100] min-w-[200px]"
              onMouseEnter={handleGridMenuEnter}
              onMouseLeave={handleGridMenuLeave}
              onWheel={handleGridScroll}
            >
              {/* Grid Badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: '#9ca3af',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                }}
              >
                Scroll to Resize Grid (G)
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Grid Size</span>
                  <span className="text-xs text-gray-300">{gridSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={gridSize}
                  onChange={(e) => onGridSizeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-dm-dark rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((gridSize - 20) / 180) * 100}%, #1f2937 ${((gridSize - 20) / 180) * 100}%, #1f2937 100%)`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Color Picker */}
        <div className="relative flex flex-col items-center">
          <button
            ref={colorButtonRef}
            onClick={handleColorClick}
            onMouseEnter={(e) => {
              handleColorMenuEnter();
              const badge = e.currentTarget.parentElement?.querySelector('.color-picker-badge') as HTMLElement;
              if (badge) badge.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              handleColorMenuLeave();
              const badge = e.currentTarget.parentElement?.querySelector('.color-picker-badge') as HTMLElement;
              if (badge) badge.style.display = 'none';
            }}
            onWheel={handleColorScroll}
            className="p-2.5 rounded transition-colors bg-dm-dark hover:bg-dm-border border-2 border-transparent box-content"
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
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">C</span>

          {/* Color Picker Menu */}
          {showColorPicker && (
            <div
              ref={colorPickerRef}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
              onMouseEnter={handleColorMenuEnter}
              onMouseLeave={handleColorMenuLeave}
              onWheel={handleColorScroll}
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
          
          {/* Color Picker Badge */}
          <div 
            className="color-picker-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Color Picker (C)
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-dm-border mx-1"></div>

        {/* Fit to View */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={onFitToView}
            onMouseEnter={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.fit-to-view-badge') as HTMLElement;
              if (badge) badge.style.display = 'block';
            }}
            onMouseLeave={(e) => {
              const badge = e.currentTarget.parentElement?.querySelector('.fit-to-view-badge') as HTMLElement;
              if (badge) badge.style.display = 'none';
            }}
            className={`p-2.5 rounded transition-colors relative ${
              fitToViewLocked
                ? 'bg-dm-dark border-2 border-red-500 text-gray-300 hover:text-white box-content'
                : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white border-2 border-transparent box-content'
            }`}
          >
            <Maximize2 size={18} />
            {fitToViewLocked && (
              <Lock size={10} className="absolute top-0.5 right-0.5 text-white opacity-60" />
            )}
          </button>
          <span className="text-[9px] text-gray-500 font-medium mt-0.5">F</span>
          <div 
            className="fit-to-view-badge"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '20px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#9ca3af',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            Fit to View (F)
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingToolbar;
