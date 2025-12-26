/**
 * AssetsTab - Right panel tab for assets library
 * 
 * Provides browsing and drag-and-drop placement of furniture, 
 * decorations, and interactive objects.
 * 
 * Features:
 * - Drag-and-drop to canvas (like tokens)
 * - Category headers with background images (like Room Styles)
 * - Three view modes: list, grid (3-col), small grid (5-col)
 * - Collapsible categories
 */

import { useState, useEffect, useRef } from 'react';
import { List, Grid3x3, LayoutGrid, ChevronDown, ChevronRight } from 'lucide-react';
import { AssetTemplate, ToolType } from '../../types';

interface AssetsTabProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedAsset: AssetTemplate | null;
  onSelectAsset: (asset: AssetTemplate) => void;
  onStartDragAsset?: (asset: AssetTemplate | null) => void;
}

type ViewMode = 'list' | 'grid3' | 'grid5';

interface AssetCategory {
  name: string;
  displayName: string;
  assets: AssetTemplate[];
  previewUrl: string; // First asset image for category header background
}

interface AssetFile {
  name: string;
  type: string;
  download_url: string;
}

// Module-level cache
let cachedCategories: AssetCategory[] | null = null;
let assetsPromise: Promise<AssetCategory[]> | null = null;

/**
 * Preload assets during loading screen.
 */
export const preloadAssets = (): void => {
  if (!cachedCategories && !assetsPromise) {
    assetsPromise = loadAssetsFromServer();
  }
};

async function loadAssetsFromServer(): Promise<AssetCategory[]> {
  try {
    const categoriesResponse = await fetch('https://dmp.natixlabs.com/list-files.php?path=assets-library');
    const categoriesData = await categoriesResponse.json();
    
    const items = categoriesData.files || categoriesData;
    const folders = categoriesData.folders || [];
    
    const categoryFolders = folders.length > 0 
      ? folders 
      : (Array.isArray(items) ? items.filter((f: any) => f.type === 'dir' || f.type === 'folder') : []);

    const loadedCategories: AssetCategory[] = [];

    for (const folder of categoryFolders) {
      const categoryName = folder.name;
      
      const assetsResponse = await fetch(`https://dmp.natixlabs.com/list-files.php?path=assets-library/${categoryName}`);
      const assetsData = await assetsResponse.json();
      
      const allItems = assetsData.files || assetsData;
      
      const files: AssetFile[] = Array.isArray(allItems) 
        ? allItems.filter((f: any) => 
            f.type === 'file' && 
            /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
          )
        : [];

      const assets: AssetTemplate[] = files.map(file => ({
        id: `${categoryName}-${file.name}`,
        name: file.name.split('.')[0]
          .replace(/[_-]/g, ' ')              // Remove underscores and hyphens
          .replace(/[\[\]()]/g, '')          // Remove brackets and parentheses
          .replace(/\s+/g, ' ')               // Normalize multiple spaces
          .trim(),                             // Remove leading/trailing spaces
        imageUrl: file.download_url,
        category: categoryName,
        download_url: file.download_url,
      }));

      if (assets.length > 0) {
        loadedCategories.push({
          name: categoryName,
          displayName: categoryName.split('-').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          assets,
          previewUrl: assets[0].imageUrl, // Use first image as category preview
        });
      }
    }

    cachedCategories = loadedCategories;
    return loadedCategories;
  } catch (error) {
    console.error('Failed to load assets:', error);
    return [];
  }
}

const AssetsTab = ({
  activeTool: _activeTool,
  setActiveTool,
  selectedAsset,
  onSelectAsset,
  onStartDragAsset,
}: AssetsTabProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid3');
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Drag state refs (to track drag vs click)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Load assets from FTP (with caching)
  useEffect(() => {
    if (cachedCategories) {
      setCategories(cachedCategories);
      setLoading(false);
      return;
    }

    if (assetsPromise) {
      assetsPromise.then(cats => {
        setCategories(cats);
        setLoading(false);
      });
      return;
    }

    assetsPromise = loadAssetsFromServer();
    assetsPromise.then(cats => {
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // Click handler - only triggers if not dragging
  const handleAssetClick = (asset: AssetTemplate) => {
    onSelectAsset(asset);
    setActiveTool('asset');
  };

  // Mouse down - track drag start position
  const handleAssetMouseDown = (e: React.MouseEvent, _asset: AssetTemplate) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  // Mouse up - trigger click if not dragging
  const handleAssetMouseUp = (_e: React.MouseEvent, asset: AssetTemplate) => {
    if (!isDraggingRef.current) {
      handleAssetClick(asset);
    }
    dragStartRef.current = null;
    isDraggingRef.current = false;
  };

  // Drag start handler
  const handleDragStart = (e: React.DragEvent, asset: AssetTemplate) => {
    isDraggingRef.current = true;
    
    // Set drag data
    e.dataTransfer.setData('application/asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image (asset preview)
    const dragPreview = document.createElement('div');
    dragPreview.style.width = '64px';
    dragPreview.style.height = '64px';
    dragPreview.style.backgroundColor = '#1a1a2e';
    dragPreview.style.border = '2px solid #60a5fa';
    dragPreview.style.borderRadius = '4px';
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-1000px';
    dragPreview.style.display = 'flex';
    dragPreview.style.alignItems = 'center';
    dragPreview.style.justifyContent = 'center';
    dragPreview.style.overflow = 'hidden';
    
    const img = document.createElement('img');
    img.src = asset.imageUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    dragPreview.appendChild(img);
    
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 32, 32);
    
    // Remove preview element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 0);
    
    // Notify parent that we're starting a drag
    if (onStartDragAsset) {
      onStartDragAsset(asset);
    }
    
    // Also select this asset
    onSelectAsset(asset);
    setActiveTool('asset');
  };

  // Drag end handler
  const handleDragEnd = (_e: React.DragEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    // Clear the dragging state (asset was either dropped or cancelled)
    if (onStartDragAsset) {
      onStartDragAsset(null);
    }
  };

  const getAssetName = (asset: AssetTemplate): string => {
    return asset.name;
  };

  // Render asset item with drag support
  const renderAssetItem = (asset: AssetTemplate, mode: 'list' | 'grid3' | 'grid5') => {
    const isSelected = selectedAsset?.id === asset.id;
    
    if (mode === 'list') {
      return (
        <div
          key={asset.id}
          draggable
          onMouseDown={(e) => handleAssetMouseDown(e, asset)}
          onMouseUp={(e) => handleAssetMouseUp(e, asset)}
          onDragStart={(e) => handleDragStart(e, asset)}
          onDragEnd={handleDragEnd}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded cursor-grab active:cursor-grabbing transition-all ${
            isSelected
              ? 'bg-dm-highlight/20 border border-dm-highlight'
              : 'bg-dm-panel/50 border border-transparent hover:border-gray-500'
          }`}
        >
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="w-10 h-10 object-contain rounded"
            loading="lazy"
            draggable={false}
          />
          <span className="text-sm text-gray-300 text-left">
            {getAssetName(asset)}
          </span>
        </div>
      );
    }
    
    // Grid views (grid3 and grid5)
    const gridClass = mode === 'grid3' 
      ? 'aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all hover:scale-105'
      : 'aspect-square rounded overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all hover:scale-105';
    
    return (
      <div
        key={asset.id}
        draggable
        onMouseDown={(e) => handleAssetMouseDown(e, asset)}
        onMouseUp={(e) => handleAssetMouseUp(e, asset)}
        onDragStart={(e) => handleDragStart(e, asset)}
        onDragEnd={handleDragEnd}
        className={`${gridClass} ${
          isSelected
            ? 'border-dm-highlight ring-2 ring-dm-highlight/50'
            : 'border-dm-border/50 hover:border-gray-500'
        }`}
        title={getAssetName(asset)}
      >
        <img
          src={asset.imageUrl}
          alt={asset.name}
          className="w-full h-full object-contain bg-dm-dark/50"
          loading="lazy"
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Fixed Header with View Mode Toggle */}
      <div className="flex-shrink-0 p-4 border-b border-dm-border/30 bg-dm-panel">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            📦 Assets Library
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Drag assets to the canvas to place them
        </p>

        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 bg-dm-dark/50 rounded">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              viewMode === 'list'
                ? 'bg-dm-highlight text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="List View"
          >
            <List size={14} />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode('grid3')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              viewMode === 'grid3'
                ? 'bg-dm-highlight text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Grid View (3 columns)"
          >
            <Grid3x3 size={14} />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('grid5')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              viewMode === 'grid5'
                ? 'bg-dm-highlight text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Small Grid View (5 columns)"
          >
            <LayoutGrid size={14} />
            <span>Small</span>
          </button>
        </div>
      </div>

      {/* Scrollable Categories Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dm-highlight mx-auto mb-2"></div>
              <p className="text-sm">Loading assets...</p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 px-4">
              <p className="text-sm">No asset packs found</p>
              <p className="text-xs mt-1">Add assets to /assets-library on the server</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {categories.map(category => (
              <div key={category.name} className="border border-dm-border rounded-lg overflow-hidden">
                {/* Category Header with background image (like Room Styles) */}
                <div
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between p-2 hover:brightness-110 transition-all relative overflow-hidden cursor-pointer"
                >
                  {/* Background preview with gradient fade to edges */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${category.previewUrl})`,
                      backgroundSize: '64px 64px',
                      backgroundRepeat: 'repeat',
                      backgroundPosition: 'center',
                      opacity: 0.5,
                      mask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                      WebkitMask: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
                    }}
                  />
                  {/* Dark overlay for better text readability */}
                  <div className="absolute inset-0 bg-gradient-to-r from-dm-dark/80 via-dm-dark/60 to-dm-dark/80" />
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <span 
                      className="text-sm font-medium text-white"
                      style={{
                        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 1px 1px 2px rgba(0,0,0,0.9)',
                      }}
                    >
                      {category.displayName}
                    </span>
                    <span 
                      className="text-xs text-gray-300"
                      style={{
                        textShadow: '0 0 4px rgba(0,0,0,0.9)',
                      }}
                    >
                      ({category.assets.length})
                    </span>
                  </div>
                  
                  {/* Arrow button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(category.name);
                    }}
                    className="relative z-10 p-1 hover:bg-black/30 rounded transition-colors"
                  >
                    {expandedCategories.has(category.name) ? (
                      <ChevronDown className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }} />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }} />
                    )}
                  </button>
                </div>

                {/* Category Content */}
                {expandedCategories.has(category.name) && (
                  <div className="p-2 bg-dm-dark/20">
                    {/* List View */}
                    {viewMode === 'list' && (
                      <div className="space-y-1">
                        {category.assets.map(asset => renderAssetItem(asset, 'list'))}
                      </div>
                    )}

                    {/* Grid View (3 columns) */}
                    {viewMode === 'grid3' && (
                      <div className="grid grid-cols-3 gap-2">
                        {category.assets.map(asset => renderAssetItem(asset, 'grid3'))}
                      </div>
                    )}

                    {/* Small Grid View (5 columns) */}
                    {viewMode === 'grid5' && (
                      <div className="grid grid-cols-5 gap-1.5">
                        {category.assets.map(asset => renderAssetItem(asset, 'grid5'))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsTab;
