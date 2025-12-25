import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark, Footprints, Info } from 'lucide-react';
import { TokenTemplate, IconType, ColorType } from '../../../types';

interface TokenPickerSubmenuProps {
  tokens: TokenTemplate[];
  onSelectToken: (token: TokenTemplate) => void;
  activeTokenId?: string;
  onMouseLeave?: () => void;
}

const TOKENS_PER_PAGE = 6;

const TokenPickerSubmenu = ({ 
  tokens, 
  onSelectToken, 
  activeTokenId,
  onMouseLeave
}: TokenPickerSubmenuProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(tokens.length / TOKENS_PER_PAGE);
  const startIndex = currentPage * TOKENS_PER_PAGE;
  const endIndex = Math.min(startIndex + TOKENS_PER_PAGE, tokens.length);
  const visibleTokens = tokens.slice(startIndex, endIndex);
  
  // Update page when activeTokenId changes to show the selected token
  useEffect(() => {
    if (activeTokenId && tokens.length > 0) {
      const tokenIndex = tokens.findIndex(t => t.id === activeTokenId);
      if (tokenIndex !== -1) {
        const newPage = Math.floor(tokenIndex / TOKENS_PER_PAGE);
        if (newPage !== currentPage) {
          setCurrentPage(newPage);
        }
      }
    }
  }, [activeTokenId, tokens]);

  const handlePrevPage = () => {
    setCurrentPage(currentPage === 0 ? totalPages - 1 : currentPage - 1);
  };

  const handleNextPage = () => {
    setCurrentPage((currentPage + 1) % totalPages);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (tokens.length === 0) return;
    
    const currentIndex = activeTokenId 
      ? tokens.findIndex((t: TokenTemplate) => t.id === activeTokenId)
      : -1;
    
    let newIndex;
    if (e.deltaY < 0) {
      // Scroll up - previous token
      newIndex = currentIndex <= 0 ? tokens.length - 1 : currentIndex - 1;
    } else {
      // Scroll down - next token
      newIndex = (currentIndex + 1) % tokens.length;
    }
    
    onSelectToken(tokens[newIndex]);
  };

  if (tokens.length === 0) {
    return (
      <div 
        className="absolute left-full top-0 ml-2 bg-dm-panel border border-dm-border rounded-lg p-3 shadow-xl z-50"
        onMouseLeave={onMouseLeave}
      >
        <p className="text-xs text-gray-400">No tokens available</p>
      </div>
    );
  }

  // Find active token for badge
  const activeToken = tokens.find(t => t.id === activeTokenId);

  return (
    <div>
      {/* Token name badge */}
      {activeToken && (
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
          {activeToken.name}
        </div>
      )}
      
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl z-[100] p-2"
        onMouseLeave={onMouseLeave}
        onWheel={handleWheel}
      >
      {/* Token Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 40px)',
        gridTemplateRows: 'repeat(2, 40px)',
        gap: '4px',
        marginBottom: '8px'
      }}>
        {/* Render visible tokens */}
        {visibleTokens.map((token) => (
          <button
            key={token.id}
            onClick={() => onSelectToken(token)}
            onMouseEnter={(e) => {
              if (activeTokenId !== token.id) {
                e.currentTarget.style.borderColor = '#22c55e';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTokenId !== token.id) {
                e.currentTarget.style.borderColor = '#374151';
              }
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '4px',
              border: activeTokenId === token.id ? '2px solid #f97316' : '2px solid #374151',
              backgroundColor: '#1f2937',
              cursor: 'pointer',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={token.name}
          >
            {token.isShape || token.isPOI ? (
              // Shape or POI token with Lucide icon
              <div 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: token.color ? getColorHex(token.color) : '#9ca3af'
                }}
              >
                {token.icon && renderIcon(token.icon, token.color)}
              </div>
            ) : token.imageUrl ? (
              // Image token
              <img 
                src={token.imageUrl} 
                alt={token.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                draggable={false}
              />
            ) : (
              // Fallback
              <div style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: '#1f2937', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#6b7280', 
                fontSize: '12px' 
              }}>
                ?
              </div>
            )}
            </button>
          ))}
          
          {/* Add empty placeholder slots to maintain 2x3 grid */}
          {Array.from({ length: 6 - visibleTokens.length }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                border: '2px solid transparent',
                backgroundColor: 'transparent'
              }}
            />
          ))}
        </div>      {/* Navigation controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '8px' 
      }}>
        <button
          onClick={handlePrevPage}
          style={{
            padding: '6px',
            borderRadius: '4px',
            backgroundColor: '#1f2937',
            color: '#9ca3af',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          className="hover:bg-dm-border"
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </button>

        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {currentPage + 1}/{totalPages}
        </div>

        <button
          onClick={handleNextPage}
          style={{
            padding: '6px',
            borderRadius: '4px',
            backgroundColor: '#1f2937',
            color: '#9ca3af',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          className="hover:bg-dm-border"
          title="Next Page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      </div>
    </div>
  );
};

// Helper functions
function getLucideIcon(icon: IconType) {
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
    landmark: Landmark,
    footprint: Footprints,
    info: Info
  };
  return icons[icon];
}

function renderIcon(icon: IconType, color?: ColorType) {
  const IconComponent = getLucideIcon(icon);
  if (!IconComponent) return null;
  
  const colorHex = color ? getColorHex(color) : '#9ca3af';
  return <IconComponent size={20} style={{ color: colorHex }} strokeWidth={2} />;
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    yellow: '#eab308',
    green: '#22c55e',
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
    teal: '#14b8a6'
  };
  return colors[color] || '#ef4444';
}

export default TokenPickerSubmenu;
