import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WallPickerSubmenuProps {
  textures: { name: string; download_url: string }[];
  onSelectTexture: (url: string) => void;
  activeTextureUrl?: string | null;
  onMouseLeave?: () => void;
}

const TEXTURES_PER_PAGE = 6;

const WallPickerSubmenu = ({ 
  textures, 
  onSelectTexture, 
  activeTextureUrl,
  onMouseLeave
}: WallPickerSubmenuProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(textures.length / TEXTURES_PER_PAGE);
  const startIndex = currentPage * TEXTURES_PER_PAGE;
  const endIndex = Math.min(startIndex + TEXTURES_PER_PAGE, textures.length);
  const visibleTextures = textures.slice(startIndex, endIndex);
  
  // Update page when activeTextureUrl changes to show the selected texture
  useEffect(() => {
    if (activeTextureUrl && textures.length > 0) {
      const textureIndex = textures.findIndex(t => t.download_url === activeTextureUrl);
      if (textureIndex !== -1) {
        const newPage = Math.floor(textureIndex / TEXTURES_PER_PAGE);
        if (newPage !== currentPage) {
          setCurrentPage(newPage);
        }
      }
    }
  }, [activeTextureUrl, textures]);

  const handlePrevPage = () => {
    setCurrentPage(currentPage === 0 ? totalPages - 1 : currentPage - 1);
  };

  const handleNextPage = () => {
    setCurrentPage((currentPage + 1) % totalPages);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      // Scroll down = next page (forward)
      handleNextPage();
    } else {
      // Scroll up = previous page (backward)
      handlePrevPage();
    }
  };

  if (textures.length === 0) {
    return (
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg p-3 shadow-xl z-[100]"
        onMouseLeave={onMouseLeave}
      >
        <p className="text-xs text-gray-400">No wall textures available</p>
      </div>
    );
  }

  // Find active texture for badge
  const activeTexture = textures.find(t => t.download_url === activeTextureUrl);

  return (
    <div>
      {/* Texture name badge */}
      {activeTexture && (
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
          {activeTexture.name}
        </div>
      )}
      
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl z-[100] p-2"
        onMouseLeave={onMouseLeave}
        onWheel={handleWheel}
      >
        {/* Texture Grid - Fixed 2x3 layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 40px)',
          gridTemplateRows: 'repeat(2, 40px)',
          gap: '4px',
          marginBottom: '8px'
        }}>
          {/* Render visible textures */}
          {visibleTextures.map((texture) => (
            <button
              key={texture.download_url}
              onClick={() => onSelectTexture(texture.download_url)}
              onMouseEnter={(e) => {
                if (activeTextureUrl !== texture.download_url) {
                  e.currentTarget.style.borderColor = '#22c55e';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTextureUrl !== texture.download_url) {
                  e.currentTarget.style.borderColor = '#374151';
                }
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                border: activeTextureUrl === texture.download_url ? '2px solid #f97316' : '2px solid #374151',
                backgroundColor: '#1f2937',
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                padding: 0
              }}
              title={texture.name}
            >
              <img 
                src={texture.download_url} 
                alt={texture.name}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  imageRendering: 'pixelated'
                }}
              />
            </button>
          ))}
          
          {/* Add empty placeholder slots to maintain 2x3 grid */}
          {Array.from({ length: 6 - visibleTextures.length }).map((_, i) => (
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
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '4px',
            borderTop: '1px solid #374151'
          }}>
            <button
              onClick={handlePrevPage}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{
              fontSize: '11px',
              color: '#9ca3af',
              fontWeight: '500'
            }}>
              {currentPage + 1}/{totalPages}
            </span>
            
            <button
              onClick={handleNextPage}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WallPickerSubmenu;
