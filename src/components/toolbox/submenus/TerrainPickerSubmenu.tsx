import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TerrainPickerSubmenuProps {
  brushes: { name: string; download_url: string }[];
  onSelectBrush: (url: string) => void;
  activeBrushUrl?: string | null;
  onMouseLeave?: () => void;
}

const BRUSHES_PER_PAGE = 6;

const TerrainPickerSubmenu = ({ 
  brushes, 
  onSelectBrush, 
  activeBrushUrl,
  onMouseLeave
}: TerrainPickerSubmenuProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(brushes.length / BRUSHES_PER_PAGE);
  const startIndex = currentPage * BRUSHES_PER_PAGE;
  const endIndex = Math.min(startIndex + BRUSHES_PER_PAGE, brushes.length);
  const visibleBrushes = brushes.slice(startIndex, endIndex);
  
  // Update page when activeBrushUrl changes to show the selected brush
  useEffect(() => {
    if (activeBrushUrl && brushes.length > 0) {
      const brushIndex = brushes.findIndex(b => b.download_url === activeBrushUrl);
      if (brushIndex !== -1) {
        const newPage = Math.floor(brushIndex / BRUSHES_PER_PAGE);
        if (newPage !== currentPage) {
          setCurrentPage(newPage);
        }
      }
    }
  }, [activeBrushUrl, brushes]);

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

  if (brushes.length === 0) {
    return (
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg p-3 shadow-xl z-[100]"
        onMouseLeave={onMouseLeave}
      >
        <p className="text-xs text-gray-400">No environment brushes available</p>
      </div>
    );
  }

  // Find active brush for badge
  const activeBrush = brushes.find(b => b.download_url === activeBrushUrl);

  return (
    <div>
      {/* Brush name badge */}
      {activeBrush && (
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
          {activeBrush.name}
        </div>
      )}
      
      <div 
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl z-[100] p-2"
        onMouseLeave={onMouseLeave}
        onWheel={handleWheel}
      >
        {/* Brush Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 40px)',
          gridTemplateRows: 'repeat(2, 40px)',
          gap: '4px',
          marginBottom: '8px'
        }}>
          {/* Render visible brushes */}
          {visibleBrushes.map((brush) => (
            <button
              key={brush.download_url}
              onClick={() => onSelectBrush(brush.download_url)}
              onMouseEnter={(e) => {
                if (activeBrushUrl !== brush.download_url) {
                  e.currentTarget.style.borderColor = '#22c55e';
                }
              }}
              onMouseLeave={(e) => {
                if (activeBrushUrl !== brush.download_url) {
                  e.currentTarget.style.borderColor = '#374151';
                }
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                border: activeBrushUrl === brush.download_url ? '2px solid #f97316' : '2px solid #374151',
                backgroundColor: '#1f2937',
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={brush.name}
            >
              <img
                src={brush.download_url}
                alt={brush.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
          
          {/* Add empty placeholder slots to maintain 2x3 grid */}
          {Array.from({ length: 6 - visibleBrushes.length }).map((_, i) => (
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

        {/* Navigation controls */}
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

export default TerrainPickerSubmenu;
