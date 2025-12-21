import { useState, useEffect, useRef } from 'react';
import { TokenTemplate, ToolType, IconType, ColorType } from '../../types';
import { Grid3x3, List, Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark as LandmarkIcon, Footprints, Info } from 'lucide-react';

interface TokensTabProps {
  tokenTemplates: TokenTemplate[];
  addTokenTemplate: (name: string, imageUrl: string) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveTokenTemplate: (template: TokenTemplate | null) => void;
  onRecentTokensChange?: (tokens: TokenTemplate[]) => void;
  activeTokenTemplate?: TokenTemplate | null;
  onStartDragToken?: (template: TokenTemplate | null) => void;
}

type TokenCategory = 'monsters' | 'npcs' | 'items' | 'objects' | 'other' | 'shapes' | 'poi' | 'environment';
type ViewMode = 'grid' | 'list';

// Module-level cache for tokens
let cachedDriveTokens: TokenTemplate[] | null = null;
let driveTokensPromise: Promise<TokenTemplate[]> | null = null;

// Predefined POI tokens
const POI_TOKENS: TokenTemplate[] = [
  { id: 'poi-quest', name: 'Quest Marker', isPOI: true, icon: 'quest', category: 'poi' },
  { id: 'poi-clue', name: 'Clue Marker', isPOI: true, icon: 'clue', category: 'poi' },
  { id: 'poi-hidden', name: 'Hidden Spot', isPOI: true, icon: 'hidden', category: 'poi' },
  { id: 'poi-door', name: 'Secret Door', isPOI: true, icon: 'door', category: 'poi' },
  { id: 'poi-landmark', name: 'Landmark', isPOI: true, icon: 'landmark', category: 'poi' },
  { id: 'poi-footprint', name: 'Tracks/Footprints', isPOI: true, icon: 'footprint', category: 'poi' },
  { id: 'poi-info', name: 'Information', isPOI: true, icon: 'info', category: 'poi' },
  { id: 'poi-skull', name: 'Skull/Death', isPOI: true, icon: 'skull', category: 'poi' },
];

// Predefined shape tokens
const SHAPE_TOKENS: TokenTemplate[] = [
  { id: 'shape-circle', name: 'Circle', isShape: true, icon: 'circle', category: 'shapes' },
  { id: 'shape-square', name: 'Square', isShape: true, icon: 'square', category: 'shapes' },
  { id: 'shape-triangle', name: 'Triangle', isShape: true, icon: 'triangle', category: 'shapes' },
  { id: 'shape-star', name: 'Star', isShape: true, icon: 'star', category: 'shapes' },
  { id: 'shape-diamond', name: 'Diamond', isShape: true, icon: 'diamond', category: 'shapes' },
  { id: 'shape-heart', name: 'Heart', isShape: true, icon: 'heart', category: 'shapes' },
];

const LIBRARY_TOKENS: TokenTemplate[] = [...SHAPE_TOKENS, ...POI_TOKENS];

/**
 * Load tokens from webhotel (shared between preload and component)
 */
const loadTokensFromWebhotel = async (): Promise<TokenTemplate[]> => {
  try {
    const configResponse = await fetch('/config.json');
    const config = await configResponse.json();
    
    const categories: TokenCategory[] = ['monsters', 'npcs', 'items', 'objects', 'other', 'environment'];
    const allTokens: TokenTemplate[] = [];
    
    // Recursive function to fetch tokens from a path (including subfolders)
    const fetchTokensRecursive = async (path: string, category: TokenCategory): Promise<TokenTemplate[]> => {
      const tokens: TokenTemplate[] = [];
      
      try {
        const response = await fetch(`${config.webhotelApiUrl}?path=${path}`);
        if (!response.ok) return tokens;
        
        const data = await response.json();
        
        // Handle new format with folders and files
        const files = data.files || data;
        const folders = data.folders || [];
        
        // Process files in this directory
        if (Array.isArray(files)) {
          const imageTokens = files
            .filter((file: any) => 
              file.type === 'file' && 
              /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
            )
            .map((file: any, index: number) => {
              const fileName = file.name.replace(/\.[^/.]+$/, '');
              const pathForId = file.path 
                ? file.path.replace(/\.[^/.]+$/, '').replace(/[/\\]/g, '-') 
                : `${path.replace(/[/\\]/g, '-')}-${fileName}`;
              return {
                id: `token-${pathForId}-${index}`,
                name: fileName.replace(/-/g, ' '),
                imageUrl: file.download_url,
                category: category
              };
            });
          tokens.push(...imageTokens);
        }
        
        // Recursively fetch from subfolders
        for (const folder of folders) {
          const subTokens = await fetchTokensRecursive(folder.path, category);
          tokens.push(...subTokens);
        }
      } catch (err) {
        console.log(`No files in ${path}`);
      }
      
      return tokens;
    };
    
    // Fetch tokens from all categories (with recursive subfolder support)
    for (const category of categories) {
      const categoryTokens = await fetchTokensRecursive(`tokens/${category}`, category);
      allTokens.push(...categoryTokens);
    }
    
    return allTokens;
  } catch (error) {
    console.error('Failed to load tokens from webhotel:', error);
    return [];
  }
};

/**
 * Preload tokens during loading screen.
 * This starts the fetch early so data is ready when user opens Tokens tab.
 */
export const preloadTokens = (): void => {
  if (!cachedDriveTokens && !driveTokensPromise) {
    driveTokensPromise = loadTokensFromWebhotel().then(tokens => {
      cachedDriveTokens = tokens;
      return tokens;
    });
  }
};

const TokensTab = ({
  tokenTemplates: _tokenTemplates,
  addTokenTemplate: _addTokenTemplate,
  setActiveTool,
  setActiveTokenTemplate,
  onRecentTokensChange,
  activeTokenTemplate,
  onStartDragToken
}: TokensTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedColor] = useState<ColorType>('red');
  const [driveTokens, setDriveTokens] = useState<TokenTemplate[]>(cachedDriveTokens || []);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<TokenTemplate | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Load tokens from webhotel (with caching)
  useEffect(() => {
    // If already cached, use cached data
    if (cachedDriveTokens) {
      setDriveTokens(cachedDriveTokens);
      return;
    }

    // If already loading, wait for the existing promise
    if (driveTokensPromise) {
      driveTokensPromise.then(tokens => {
        setDriveTokens(tokens);
      });
      return;
    }

    // Otherwise, start loading
    driveTokensPromise = loadTokensFromWebhotel().then(tokens => {
      cachedDriveTokens = tokens;
      setDriveTokens(tokens);
      return tokens;
    });
  }, []);

  // Update active token template when color changes
  useEffect(() => {
    if (currentTemplate) {
      const updatedTemplate = {
        ...currentTemplate,
        color: selectedColor
      };
      setCurrentTemplate(updatedTemplate);
      setActiveTokenTemplate(updatedTemplate);
    }
  }, [selectedColor]);

  // Open category when activeTokenTemplate changes
  useEffect(() => {
    if (activeTokenTemplate) {
      // Use category if set, otherwise fallback to isShape/isPOI flags
      let category: TokenCategory = 'other';
      if (activeTokenTemplate.category) {
        category = activeTokenTemplate.category as TokenCategory;
      } else if (activeTokenTemplate.isShape) {
        category = 'shapes';
      } else if (activeTokenTemplate.isPOI) {
        category = 'poi';
      }
      
      setSelectedCategory(category);
      setSelectedTokenId(activeTokenTemplate.id);
      setCurrentTemplate(activeTokenTemplate);
    }
  }, [activeTokenTemplate]);

  const handleTokenClick = (template: TokenTemplate) => {
    const coloredTemplate = template.isShape 
      ? { ...template, color: selectedColor }
      : { ...template, color: selectedColor };
    
    setSelectedTokenId(template.id);
    setCurrentTemplate(coloredTemplate);
    setActiveTokenTemplate(coloredTemplate);
    setActiveTool('token');
    
    // Get category of clicked token
    const category = template.category || (template.isShape ? 'shapes' : template.isPOI ? 'poi' : 'other');
    
    // Get all tokens from the same category (up to 16)
    const allLibraryTokens = [...driveTokens, ...LIBRARY_TOKENS];
    const categoryTokens = allLibraryTokens
      .filter(t => {
        const tokenCategory = t.category || (t.isShape ? 'shapes' : t.isPOI ? 'poi' : 'other');
        return tokenCategory === category;
      })
      .slice(0, 16)
      .map(t => ({ ...t, color: selectedColor })); // ALL tokens get color
    
    // Notify parent component with tokens from this category
    if (onRecentTokensChange) {
      onRecentTokensChange(categoryTokens);
    }
  };

  const handleCategoryClick = (category: TokenCategory) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  // Drag handlers for drag-and-drop to canvas
  const handleTokenMouseDown = (e: React.MouseEvent, _template: TokenTemplate) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handleTokenMouseUp = (_e: React.MouseEvent, template: TokenTemplate) => {
    // Only trigger click if we didn't drag
    if (!isDraggingRef.current) {
      handleTokenClick(template);
    }
    dragStartRef.current = null;
    isDraggingRef.current = false;
  };

  const handleDragStart = (e: React.DragEvent, template: TokenTemplate) => {
    isDraggingRef.current = true;
    
    const coloredTemplate = { ...template, color: selectedColor };
    
    // Set drag data
    e.dataTransfer.setData('application/json', JSON.stringify(coloredTemplate));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image (token preview)
    const dragPreview = document.createElement('div');
    dragPreview.style.width = '64px';
    dragPreview.style.height = '64px';
    dragPreview.style.borderRadius = '50%';
    dragPreview.style.border = `3px solid ${colorMap[selectedColor]}`;
    dragPreview.style.backgroundColor = '#1a1a2e';
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-1000px';
    dragPreview.style.display = 'flex';
    dragPreview.style.alignItems = 'center';
    dragPreview.style.justifyContent = 'center';
    dragPreview.style.overflow = 'hidden';
    
    if (template.imageUrl) {
      const img = document.createElement('img');
      img.src = template.imageUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      dragPreview.appendChild(img);
    } else {
      // For shape/POI tokens, just use a colored circle
      dragPreview.style.backgroundColor = colorMap[selectedColor];
    }
    
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 32, 32);
    
    // Remove the preview element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 0);
    
    // Notify parent that we're starting a drag
    if (onStartDragToken) {
      onStartDragToken(coloredTemplate);
    }
  };

  const handleDragEnd = (_e: React.DragEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    // Clear the dragging state in parent (token was either dropped or cancelled)
    if (onStartDragToken) {
      onStartDragToken(null);
    }
  };

  const colorMap: Record<ColorType, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
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
    teal: '#14b8a6'
  };

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

  const renderIconToken = (template: TokenTemplate, color: string) => {
    const IconComponent = template.icon ? getLucideIcon(template.icon) : Circle;
    
    return (
      <div className="w-full h-full flex items-center justify-center">
        <IconComponent 
          size="100%" 
          style={{ color: colorMap[color as ColorType] }}
          fill={template.isShape ? colorMap[color as ColorType] : 'none'}
          strokeWidth={template.isPOI ? 2 : 1.5}
        />
      </div>
    );
  };

  const allLibraryTokens = [...driveTokens, ...LIBRARY_TOKENS];
  const monsterTokens = allLibraryTokens.filter(t => t.category === 'monsters');
  const npcTokens = allLibraryTokens.filter(t => t.category === 'npcs');
  const itemTokens = allLibraryTokens.filter(t => t.category === 'items');
  const objectTokens = allLibraryTokens.filter(t => t.category === 'objects');
  const otherTokens = allLibraryTokens.filter(t => t.category === 'other' || (!t.category && !t.isShape && !t.isPOI));
  const shapeTokens = LIBRARY_TOKENS.filter(t => t.isShape);
  const poiTokens = LIBRARY_TOKENS.filter(t => t.isPOI);
  const environmentTokens = allLibraryTokens.filter(t => t.category === 'environment');

  const getTokensForCategory = (category: TokenCategory): TokenTemplate[] => {
    switch (category) {
      case 'monsters': return monsterTokens;
      case 'npcs': return npcTokens;
      case 'items': return itemTokens;
      case 'objects': return objectTokens;
      case 'other': return otherTokens;
      case 'shapes': return shapeTokens;
      case 'poi': return poiTokens;
      case 'environment': return environmentTokens;
    }
  };

  const categoryLabels: Record<TokenCategory, string> = {
    monsters: 'Monsters',
    npcs: 'NPCs',
    items: 'Items',
    objects: 'Objects',
    other: 'Other',
    shapes: 'Shapes',
    poi: 'POI',
    environment: 'Environment'
  };

  return (
    <div className="flex flex-col h-full">
      {/* Choose Token Type */}
      <div className="p-4 border-b border-dm-border">
        <h4 className="text-sm font-medium mb-2">Choose Token Type</h4>
        <div className="flex flex-wrap gap-2">
          {(['shapes', 'poi', 'monsters', 'npcs', 'items', 'objects', 'environment', 'other'] as TokenCategory[]).map(category => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-dm-highlight text-white'
                  : 'bg-dm-dark text-gray-400 hover:bg-dm-border'
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      </div>

      {/* View Mode Toggle - Only show when a category is selected */}
      {selectedCategory && (
        <div className="p-4 border-b border-dm-border flex items-center justify-between">
          <h4 className="text-sm font-medium">{categoryLabels[selectedCategory]}</h4>
          <div className="flex gap-1 bg-dm-dark rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-dm-highlight text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Grid View"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-dm-highlight text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedCategory ? (
          // Show selected category tokens
          viewMode === 'grid' ? (
            <div className="grid grid-cols-5 gap-2 p-2">
              {getTokensForCategory(selectedCategory).map(template => (
                <div
                  key={template.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, template)}
                  onDragEnd={handleDragEnd}
                  onMouseDown={(e) => handleTokenMouseDown(e, template)}
                  onMouseUp={(e) => handleTokenMouseUp(e, template)}
                  className={`aspect-square rounded-lg cursor-pointer transition-all bg-dm-dark group relative border-2 ${
                    selectedTokenId === template.id
                      ? 'border-dm-highlight'
                      : 'border-transparent hover:border-gray-500'
                  }`}
                  title={template.name}
                >
                  <div className="w-full h-full p-1.5">
                    {template.isPOI || template.isShape ? (
                      renderIconToken(template, selectedColor)
                    ) : template.imageUrl ? (
                      <div className="w-full h-full rounded-full overflow-hidden" style={{ border: `2px solid ${colorMap[selectedColor]}` }}>
                        <img
                          src={template.imageUrl}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-dm-border rounded-lg flex items-center justify-center text-gray-500 text-xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] p-1 text-center truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                    {template.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {getTokensForCategory(selectedCategory).map(template => (
                <div
                  key={template.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, template)}
                  onDragEnd={handleDragEnd}
                  onMouseDown={(e) => handleTokenMouseDown(e, template)}
                  onMouseUp={(e) => handleTokenMouseUp(e, template)}
                  className={`p-2 rounded-lg cursor-pointer transition-all bg-dm-dark/50 flex items-center gap-3 border-2 ${
                    selectedTokenId === template.id
                      ? 'border-dm-highlight'
                      : 'border-transparent hover:border-gray-500'
                  }`}
                >
                  <div className="w-12 h-12 flex-shrink-0">
                    {template.isPOI || template.isShape ? (
                      <div className="w-full h-full p-1">
                        {renderIconToken(template, selectedColor)}
                      </div>
                    ) : template.imageUrl ? (
                      <div className="w-full h-full rounded-full overflow-hidden" style={{ border: `2px solid ${colorMap[selectedColor]}` }}>
                        <img src={template.imageUrl} alt={template.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-dm-border rounded-lg flex items-center justify-center text-gray-500 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-200 text-sm truncate">{template.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Show prompt to select a category
          <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8 text-center">
            Select a token type above to browse tokens
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-dm-border bg-dm-dark/50">
        <p className="text-xs text-gray-400">
          <strong className="text-gray-300">Click</strong> to select stamp mode (place multiple)
        </p>
        <p className="text-xs text-gray-400 mt-1">
          <strong className="text-gray-300">Drag to canvas</strong> to place a single token
        </p>
      </div>
    </div>
  );
};

export default TokensTab;
