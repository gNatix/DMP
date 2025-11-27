import { useRef, useState, useEffect } from 'react';
import { DungeonMap } from '../types';
import { Upload, ChevronDown, ChevronRight } from 'lucide-react';

interface UploadsTabProps {
  maps: DungeonMap[];
  activeMapId: string | null;
  setActiveMapId: (id: string | null) => void;
  addMap: (name: string, imageUrl: string) => void;
}

type MapFilterType = 'all' | 'stock' | 'uploads';
type StockCategory = 'dungeons' | 'indoors' | 'outdoors' | 'taverns' | 'other';

// Stock maps (loaded from JSON file)
interface StockMap {
  id: string;
  name: string;
  imageUrl: string;
  category: StockCategory;
  width?: number;
  height?: number;
}

const STOCK_MAPS: StockMap[] = [];

const UploadsTab = ({
  maps,
  activeMapId,
  setActiveMapId,
  addMap
}: UploadsTabProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFilters, setSelectedFilters] = useState<MapFilterType[]>(['all']);
  const [selectedStockFilters, setSelectedStockFilters] = useState<StockCategory[]>([]);
  const [driveMaps, setDriveMaps] = useState<StockMap[]>([]);
  
  // Collapse states
  const [uploadsExpanded, setUploadsExpanded] = useState(false);
  const [stockExpanded, setStockExpanded] = useState(false);
  const [dungeonsExpanded, setDungeonsExpanded] = useState(false);
  const [indoorsExpanded, setIndoorsExpanded] = useState(false);
  const [outdoorsExpanded, setOutdoorsExpanded] = useState(false);
  const [tavernsExpanded, setTavernsExpanded] = useState(false);
  const [otherExpanded, setOtherExpanded] = useState(false);

  // Load maps by scanning webhotel
  useEffect(() => {
    const loadMapsFromWebhotel = async () => {
      try {
        // Load config
        const configResponse = await fetch('/config.json');
        const config = await configResponse.json();
        
        // Fetch all category folders
        const categories: StockCategory[] = ['dungeons', 'indoors', 'outdoors', 'taverns', 'other'];
        const allMaps: StockMap[] = [];
        
        for (const category of categories) {
          try {
            const response = await fetch(`${config.webhotelApiUrl}?path=maps/${category}`);
            if (!response.ok) continue;
            
            const files = await response.json();
            
            // Filter for image files (already done by PHP, but double check)
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
        
        setDriveMaps(allMaps);
      } catch (error) {
        console.error('Failed to load maps from webhotel:', error);
      }
    };

    loadMapsFromWebhotel();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    const mapName = file.name.replace(/\.[^/.]+$/, '');

    addMap(mapName, imageUrl);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFilterToggle = (filter: MapFilterType) => {
    if (filter === 'all') {
      setSelectedFilters(['all']);
    } else {
      const newFilters = selectedFilters.includes('all') 
        ? [filter]
        : selectedFilters.includes(filter)
          ? selectedFilters.filter(f => f !== filter)
          : [...selectedFilters.filter(f => f !== 'all'), filter];
      
      setSelectedFilters(newFilters.length === 0 ? ['all'] : newFilters);
    }
  };

  const handleStockFilterToggle = (filter: StockCategory) => {
    const newFilters = selectedStockFilters.includes(filter)
      ? selectedStockFilters.filter(f => f !== filter)
      : [...selectedStockFilters, filter];
    
    setSelectedStockFilters(newFilters);
  };

  const shouldShowCategory = (category: MapFilterType) => {
    return selectedFilters.includes('all') || selectedFilters.includes(category);
  };

  const shouldShowStockCategory = (category: StockCategory) => {
    return selectedStockFilters.length === 0 || selectedStockFilters.includes(category);
  };

  const handleMapClick = (imageUrl: string, name: string) => {
    // Check if map already exists
    const existingMap = maps.find(m => m.imageUrl === imageUrl);
    if (existingMap) {
      setActiveMapId(existingMap.id);
    } else {
      // Add as new map
      addMap(name, imageUrl);
    }
  };

  const renderMapList = (mapList: (DungeonMap | StockMap)[]) => (
    <div className="space-y-2 p-2">
      {mapList.map((map) => {
        const isDungeonMap = 'elements' in map;
        const isActive = isDungeonMap && activeMapId === map.id;
        const imageUrl = map.imageUrl;
        const name = map.name;
        const dimensions = !isDungeonMap && 'width' in map && map.width && map.height 
          ? `${map.width} × ${map.height}` 
          : null;
        
        return (
          <div
            key={map.id}
            onClick={() => isDungeonMap ? setActiveMapId(map.id) : handleMapClick(imageUrl, name)}
            className={`p-2 rounded-lg cursor-pointer transition-all border-2 ${
              isActive
                ? 'bg-dm-dark border-dm-highlight'
                : 'bg-dm-dark/50 border-transparent hover:border-dm-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-dm-border flex-shrink-0 overflow-hidden">
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-200 text-sm truncate">{name}</h4>
                {dimensions && (
                  <p className="text-xs text-gray-400 mt-0.5">{dimensions}</p>
                )}
                {isDungeonMap && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {map.elements.length} element{map.elements.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Combine stock maps
  const allStockMaps = [...driveMaps, ...STOCK_MAPS];
  const dungeonMaps = allStockMaps.filter(m => m.category === 'dungeons');
  const indoorMaps = allStockMaps.filter(m => m.category === 'indoors');
  const outdoorMaps = allStockMaps.filter(m => m.category === 'outdoors');
  const tavernMaps = allStockMaps.filter(m => m.category === 'taverns');
  const otherMaps = allStockMaps.filter(m => m.category === 'other');

  return (
    <div className="flex flex-col h-full">
      {/* Filter Badges */}
      <div className="p-4 border-b border-dm-border">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleFilterToggle('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedFilters.includes('all')
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterToggle('stock')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedFilters.includes('stock')
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
            }`}
          >
            Stock Maps
          </button>
          <button
            onClick={() => handleFilterToggle('uploads')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedFilters.includes('uploads')
                ? 'bg-dm-highlight text-white'
                : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
            }`}
          >
            Uploads
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* User Uploads Section */}
        {shouldShowCategory('uploads') && (
          <div className="border-b border-dm-border">
            <button
              onClick={() => setUploadsExpanded(!uploadsExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-dm-dark/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {uploadsExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="font-medium">User Uploads</span>
                <span className="text-xs text-gray-400">({maps.length})</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1 bg-dm-highlight hover:bg-green-600 text-white rounded text-sm flex items-center gap-1"
              >
                <Upload size={14} />
                Upload
              </button>
            </button>

            {uploadsExpanded && (
              <>{maps.length > 0 ? renderMapList(maps) : (
                <p className="text-center py-4 text-gray-500 text-sm">No uploaded maps</p>
              )}</>
            )}
          </div>
        )}

        {/* Stock Maps Section */}
        {shouldShowCategory('stock') && (
          <div className="border-b border-dm-border">
            <button
              onClick={() => setStockExpanded(!stockExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-dm-dark/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {stockExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="font-medium">Stock Maps</span>
                <span className="text-xs text-gray-400">({allStockMaps.length})</span>
              </div>
            </button>

            {stockExpanded && (
              <div className="pl-2">
                {/* Subcategory Badges */}
                <div className="p-2 border-b border-dm-border/50">
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleStockFilterToggle('dungeons')}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        selectedStockFilters.includes('dungeons')
                          ? 'bg-dm-highlight text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
                      }`}
                    >
                      Dungeons
                    </button>
                    <button
                      onClick={() => handleStockFilterToggle('indoors')}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        selectedStockFilters.includes('indoors')
                          ? 'bg-dm-highlight text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
                      }`}
                    >
                      Indoors
                    </button>
                    <button
                      onClick={() => handleStockFilterToggle('outdoors')}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        selectedStockFilters.includes('outdoors')
                          ? 'bg-dm-highlight text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
                      }`}
                    >
                      Outdoors
                    </button>
                    <button
                      onClick={() => handleStockFilterToggle('taverns')}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        selectedStockFilters.includes('taverns')
                          ? 'bg-dm-highlight text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
                      }`}
                    >
                      Taverns
                    </button>
                    <button
                      onClick={() => handleStockFilterToggle('other')}
                      className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                        selectedStockFilters.includes('other')
                          ? 'bg-dm-highlight text-white'
                          : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
                      }`}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {/* Dungeons Subcategory */}
                {shouldShowStockCategory('dungeons') && (
                  <div className="border-b border-dm-border/50">
                    <button
                      onClick={() => setDungeonsExpanded(!dungeonsExpanded)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-dm-dark/20 transition-colors"
                    >
                      {dungeonsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm">Dungeon Maps</span>
                      <span className="text-xs text-gray-400">({dungeonMaps.length})</span>
                    </button>
                    {dungeonsExpanded && dungeonMaps.length > 0 && renderMapList(dungeonMaps)}
                  </div>
                )}

                {/* Indoors Subcategory */}
                {shouldShowStockCategory('indoors') && (
                  <div className="border-b border-dm-border/50">
                    <button
                      onClick={() => setIndoorsExpanded(!indoorsExpanded)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-dm-dark/20 transition-colors"
                    >
                      {indoorsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm">Indoor Maps</span>
                      <span className="text-xs text-gray-400">({indoorMaps.length})</span>
                    </button>
                    {indoorsExpanded && indoorMaps.length > 0 && renderMapList(indoorMaps)}
                  </div>
                )}

                {/* Outdoors Subcategory */}
                {shouldShowStockCategory('outdoors') && (
                  <div className="border-b border-dm-border/50">
                    <button
                      onClick={() => setOutdoorsExpanded(!outdoorsExpanded)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-dm-dark/20 transition-colors"
                    >
                      {outdoorsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm">Outdoor Maps</span>
                      <span className="text-xs text-gray-400">({outdoorMaps.length})</span>
                    </button>
                    {outdoorsExpanded && outdoorMaps.length > 0 && renderMapList(outdoorMaps)}
                  </div>
                )}

                {/* Taverns Subcategory */}
                {shouldShowStockCategory('taverns') && (
                  <div className="border-b border-dm-border/50">
                    <button
                      onClick={() => setTavernsExpanded(!tavernsExpanded)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-dm-dark/20 transition-colors"
                    >
                      {tavernsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm">Tavern Maps</span>
                      <span className="text-xs text-gray-400">({tavernMaps.length})</span>
                    </button>
                    {tavernsExpanded && tavernMaps.length > 0 && renderMapList(tavernMaps)}
                  </div>
                )}

                {/* Other Subcategory */}
                {shouldShowStockCategory('other') && (
                  <div>
                    <button
                      onClick={() => setOtherExpanded(!otherExpanded)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-dm-dark/20 transition-colors"
                    >
                      {otherExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm">Other Maps</span>
                      <span className="text-xs text-gray-400">({otherMaps.length})</span>
                    </button>
                    {otherExpanded && otherMaps.length > 0 && renderMapList(otherMaps)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default UploadsTab;
