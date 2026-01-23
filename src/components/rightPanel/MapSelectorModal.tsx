import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface StockMap {
  id: string;
  name: string;
  imageUrl: string;
  category: 'dungeons' | 'indoors' | 'outdoors' | 'taverns' | 'ntx' | 'other';
  width: number;
  height: number;
}

interface MapSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMap: (mapUrl: string, mapName: string) => void;
}

const MapSelectorModal = ({ isOpen, onClose, onSelectMap }: MapSelectorModalProps) => {
  const [stockMaps, setStockMaps] = useState<StockMap[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [imageRotations, setImageRotations] = useState<Map<string, boolean>>(new Map());

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if a text input is focused - if so, don't close modal
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
          return; // Let global handler blur the input first
        }
        
        // Second ESC press - close modal
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Load maps from webhotel
  useEffect(() => {
    const loadMapsFromWebhotel = async () => {
      try {
        const configResponse = await fetch('/config.json');
        const config = await configResponse.json();
        
        const categories = ['dungeons', 'indoors', 'outdoors', 'taverns', 'ntx', 'other'];
        const allMaps: StockMap[] = [];
        
        for (const category of categories) {
          try {
            const response = await fetch(`${config.webhotelApiUrl}?path=maps/${category}`);
            if (!response.ok) continue;
            
            const data = await response.json();
            // Handle new format {folders, files} or old array format
            const files = data.files || data;
            
            const imageMaps = files
              .filter((file: any) => 
                file.type === 'file' && 
                /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
              )
              .map((file: any) => ({
                id: `stock-${category}-${file.name.replace(/\.[^/.]+$/, '')}`,
                name: file.name.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
                imageUrl: file.download_url,
                category: category,
                width: 0,
                height: 0
              }));
            
            allMaps.push(...imageMaps);
          } catch (err) {
            console.log(`No files in maps/${category}`);
          }
        }
        
        setStockMaps(allMaps);
      } catch (error) {
        console.error('Failed to load maps from webhotel:', error);
      }
    };

    if (isOpen) {
      loadMapsFromWebhotel();
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && stockMaps.length > 0) {
      const categoryCounts = {
        dungeons: dungeonMaps.length,
        indoors: indoorMaps.length,
        outdoors: outdoorMaps.length,
        taverns: tavernMaps.length,
        ntx: ntxMaps.length,
        other: otherMaps.length
      };
      
      const smallestCategory = (Object.entries(categoryCounts) as [string, number][])
        .filter(([_, count]) => count > 0)
        .sort((a, b) => a[1] - b[1])[0]?.[0] || 'dungeons';
      
      setSelectedCategory(smallestCategory);
    }
  }, [isOpen, stockMaps]);

  if (!isOpen) return null;

  // Filter maps based on selected category
  const filteredMaps = selectedCategory === 'all' 
    ? stockMaps 
    : stockMaps.filter(m => m.category === selectedCategory);

  const dungeonMaps = stockMaps.filter(m => m.category === 'dungeons');
  const indoorMaps = stockMaps.filter(m => m.category === 'indoors');
  const outdoorMaps = stockMaps.filter(m => m.category === 'outdoors');
  const tavernMaps = stockMaps.filter(m => m.category === 'taverns');
  const ntxMaps = stockMaps.filter(m => m.category === 'ntx');
  const otherMaps = stockMaps.filter(m => m.category === 'other');

  const handleMapClick = (map: StockMap) => {
    onSelectMap(map.imageUrl, map.name);
  };

  const renderMapGrid = (maps: StockMap[]) => (
    <div className="grid grid-cols-3 gap-3 p-3">
      {maps.map((map) => {
        const shouldRotate = imageRotations.get(map.id) || false;
        
        return (
          <div
            key={map.id}
            className="cursor-pointer group relative"
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-dm-border border-2 border-transparent group-hover:border-dm-highlight transition-all relative">
              <img 
                src={map.imageUrl} 
                alt={map.name}
                className={`w-full h-full object-cover ${shouldRotate ? 'rotate-90' : ''}`}
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  // Rotate if width > height (landscape)
                  if (img.naturalWidth > img.naturalHeight) {
                    setImageRotations(prev => new Map(prev).set(map.id, true));
                  }
                }}
              />
              {/* Hover overlay with button */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => handleMapClick(map)}
                  className="px-4 py-2 bg-dm-highlight text-white rounded-lg hover:bg-dm-highlight/80 transition-colors font-medium text-sm"
                >
                  Add this map
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-1.5 text-center truncate">{map.name}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-popup="true">
      <div className="bg-dm-panel rounded-xl border border-dm-border w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dm-border flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-100">Select Background Map</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dm-dark/50 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 p-4 border-b border-dm-border flex-wrap flex-shrink-0">
          <button
            onClick={() => setSelectedCategory('dungeons')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'dungeons'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            Dungeons ({dungeonMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('indoors')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'indoors'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            Indoors ({indoorMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('outdoors')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'outdoors'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            Outdoors ({outdoorMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('taverns')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'taverns'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            Taverns ({tavernMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('ntx')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'ntx'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            NTX ({ntxMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('other')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'other'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            Other ({otherMaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === 'all'
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark/50 text-gray-300 hover:bg-dm-dark'
            }`}
          >
            All
          </button>
        </div>

        {/* Maps Grid */}
        <div className="flex-1 overflow-y-auto">
          {renderMapGrid(filteredMaps)}
        </div>
      </div>
    </div>
  );
};

export default MapSelectorModal;
