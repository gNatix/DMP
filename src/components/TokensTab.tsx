import { useState, useRef, useEffect } from 'react';
import { TokenTemplate, ToolType, IconType, ColorType } from '../types';
import { Grid3x3, List, Circle, Square, Triangle, Star, Diamond, Heart, Skull, MapPin, Search, Eye, DoorOpen, Landmark as LandmarkIcon, Footprints, Info } from 'lucide-react';

interface TokensTabProps {
  tokenTemplates: TokenTemplate[];
  addTokenTemplate: (name: string, imageUrl: string) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveTokenTemplate: (template: TokenTemplate | null) => void;
}

type TokenCategory = 'monsters' | 'npcs' | 'items' | 'objects' | 'other' | 'shapes' | 'poi' | 'environment';
type ViewMode = 'grid' | 'list';

// Predefined POI tokens
const POI_TOKENS: TokenTemplate[] = [
  { id: 'poi-quest', name: 'Quest Marker', isPOI: true, icon: 'quest', category: 'poi' },
  { id: 'poi-clue', name: 'Clue Marker', isPOI: true, icon: 'clue', category: 'poi' },
  { id: 'poi-hidden', name: 'Hidden Spot', isPOI: true, icon: 'hidden', category: 'poi' },
  { id: 'poi-door', name: 'Secret Door', isPOI: true, icon: 'door', category: 'poi' },
  { id: 'poi-landmark', name: 'Landmark', isPOI: true, icon: 'landmark', category: 'poi' },
  { id: 'poi-footprint', name: 'Tracks/Footprints', isPOI: true, icon: 'footprint', category: 'poi' },
  { id: 'poi-info', name: 'Information', isPOI: true, icon: 'info', category: 'poi' },
];

// Predefined shape tokens
const SHAPE_TOKENS: TokenTemplate[] = [
  { id: 'shape-circle', name: 'Circle', isShape: true, icon: 'circle' },
  { id: 'shape-square', name: 'Square', isShape: true, icon: 'square' },
  { id: 'shape-triangle', name: 'Triangle', isShape: true, icon: 'triangle' },
  { id: 'shape-star', name: 'Star', isShape: true, icon: 'star' },
  { id: 'shape-diamond', name: 'Diamond', isShape: true, icon: 'diamond' },
  { id: 'shape-heart', name: 'Heart', isShape: true, icon: 'heart' },
  { id: 'shape-skull', name: 'Skull', isShape: true, icon: 'skull' },
];

const LIBRARY_TOKENS: TokenTemplate[] = [...SHAPE_TOKENS, ...POI_TOKENS];
const COLORS: ColorType[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const TokensTab = ({
  tokenTemplates: _tokenTemplates,
  addTokenTemplate: _addTokenTemplate,
  setActiveTool,
  setActiveTokenTemplate
}: TokensTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedColor, setSelectedColor] = useState<ColorType>('red');
  const [driveTokens, setDriveTokens] = useState<TokenTemplate[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<TokenTemplate | null>(null);

  // Load tokens from webhotel
  useEffect(() => {
    const loadTokensFromWebhotel = async () => {
      try {
        const configResponse = await fetch('/config.json');
        const config = await configResponse.json();
        
        const categories: TokenCategory[] = ['monsters', 'npcs', 'items', 'objects', 'other', 'environment'];
        const allTokens: TokenTemplate[] = [];
        
        for (const category of categories) {
          try {
            const response = await fetch(`${config.webhotelApiUrl}?path=tokens/${category}`);
            if (!response.ok) continue;
            
            const files = await response.json();
            
            const imageTokens = files
              .filter((file: any) => 
                file.type === 'file' && 
                /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
              )
              .map((file: any) => ({
                id: `token-${category}-${file.name.replace(/\.[^/.]+$/, '')}`,
                name: file.name.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
                imageUrl: file.download_url,
                category: category
              }));
            
            allTokens.push(...imageTokens);
          } catch (err) {
            console.log(`No files in tokens/${category}`);
          }
        }
        
        setDriveTokens(allTokens);
      } catch (error) {
        console.error('Failed to load tokens from webhotel:', error);
      }
    };

    loadTokensFromWebhotel();
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

  const handleTokenClick = (template: TokenTemplate) => {
    const coloredTemplate = template.isShape 
      ? { ...template, color: selectedColor }
      : { ...template, color: selectedColor };
    
    setSelectedTokenId(template.id);
    setCurrentTemplate(coloredTemplate);
    setActiveTokenTemplate(coloredTemplate);
    setActiveTool('token');
  };

  const handleCategoryClick = (category: TokenCategory) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  const colorMap: Record<ColorType, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316'
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
      {/* Color Selector */}
      <div className="p-4 border-b border-dm-border">
        <h4 className="text-sm font-medium mb-2">Token Color</h4>
        <div className="flex gap-2">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-8 h-8 rounded-full transition-all ${
                selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dm-panel scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: colorMap[color] }}
              title={color}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Shapes use this as fill color. Images use this as border color.
        </p>
      </div>

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
                  onClick={() => handleTokenClick(template)}
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
                  onClick={() => handleTokenClick(template)}
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
    </div>
  );
};

export default TokensTab;
