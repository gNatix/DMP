import { Scene, MapElement, AnnotationElement, ColorType, IconType } from '../types';
import { Trash2 } from 'lucide-react';

interface PropertiesTabProps {
  activeMap: Scene | null;
  updateMap: (mapId: string, updates: Partial<Scene>) => void;
  selectedElement: MapElement | null;
  selectedElements: MapElement[];
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
}

const COLORS: { name: ColorType; hex: string }[] = [
  { name: 'red', hex: '#ef4444' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'green', hex: '#22c55e' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'orange', hex: '#f97316' },
];

const ICONS: IconType[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart', 'skull'];

const PropertiesTab = ({
  activeMap,
  updateMap,
  selectedElement,
  selectedElements,
  updateElement,
  deleteElement,
  deleteElements
}: PropertiesTabProps) => {
  const getIconSymbol = (icon: IconType): string => {
    const symbols: Record<IconType, string> = {
      circle: '●',
      square: '■',
      triangle: '▲',
      star: '★',
      diamond: '◆',
      heart: '♥',
      skull: '☠',
      quest: '?',
      clue: '!',
      hidden: '👁',
      door: '🚪',
      landmark: '📍',
      footprint: '👣',
      info: 'ℹ'
    };
    return symbols[icon];
  };

  // Show multi-element properties
  if (selectedElements.length > 1) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Multiple Elements Selected</h3>
          <button
            onClick={() => deleteElements(selectedElements.map(e => e.id))}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
            title="Delete All Selected"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="p-3 bg-dm-dark rounded border border-dm-border">
          <p className="text-gray-300">{selectedElements.length} elements selected</p>
          <p className="text-sm text-gray-400 mt-2">
            Press <kbd className="px-2 py-1 bg-dm-border rounded text-xs">Delete</kbd> to remove all selected elements
          </p>
        </div>
      </div>
    );
  }

  if (selectedElement) {
    // Show element properties
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Element Properties</h3>
          <button
            onClick={() => deleteElement(selectedElement.id)}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
            title="Delete Element"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
          <div className="px-3 py-2 bg-dm-dark rounded border border-dm-border text-gray-300 capitalize">
            {selectedElement.type}
          </div>
        </div>

        {/* Annotation specific properties */}
        {selectedElement.type === 'annotation' && (
          <>
            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
              <div className="grid grid-cols-3 gap-2">
                {COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => updateElement(selectedElement.id, { color: color.name })}
                    className={`p-3 rounded border-2 transition-all ${
                      (selectedElement as AnnotationElement).color === color.name
                        ? 'border-white scale-105'
                        : 'border-transparent hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Icon</label>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => updateElement(selectedElement.id, { icon })}
                    className={`p-3 rounded text-xl transition-colors ${
                      (selectedElement as AnnotationElement).icon === icon
                        ? 'bg-dm-highlight text-white'
                        : 'bg-dm-dark hover:bg-dm-border text-gray-400'
                    }`}
                    title={icon}
                  >
                    {getIconSymbol(icon)}
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Label (Number/Text)</label>
              <input
                type="text"
                value={(selectedElement as AnnotationElement).label || ''}
                onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded focus:outline-none focus:border-dm-highlight text-gray-200"
                placeholder="e.g. 1, 2, A, B..."
              />
            </div>
          </>
        )}

        {/* Token specific properties */}
        {selectedElement.type === 'token' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Token Name</label>
              <input
                type="text"
                value={selectedElement.name}
                onChange={(e) => updateElement(selectedElement.id, { name: e.target.value })}
                className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded focus:outline-none focus:border-dm-highlight text-gray-200"
              />
            </div>

            {/* Token Color/Border */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                {selectedElement.isShape ? 'Fill Color' : 'Border Color'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => updateElement(selectedElement.id, { color: color.name })}
                    className={`p-3 rounded border-2 transition-all ${
                      selectedElement.color === color.name
                        ? 'border-white scale-105'
                        : 'border-transparent hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Size slider */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Size: {selectedElement.size}px
          </label>
          <input
            type="range"
            min="20"
            max="150"
            value={selectedElement.size}
            onChange={(e) => updateElement(selectedElement.id, { size: parseInt(e.target.value) })}
            className="w-full accent-dm-highlight"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
          <textarea
            value={selectedElement.notes}
            onChange={(e) => updateElement(selectedElement.id, { notes: e.target.value })}
            className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded focus:outline-none focus:border-dm-highlight text-gray-200 resize-none"
            rows={4}
            placeholder="Add notes about this element..."
          />
        </div>
      </div>
    );
  }

  // Show map properties
  if (activeMap) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">Map Properties</h3>

        {/* Map Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Map Name</label>
          <input
            type="text"
            value={activeMap.name}
            onChange={(e) => updateMap(activeMap.id, { name: e.target.value })}
            className="w-full px-3 py-2 bg-dm-dark border border-dm-border rounded focus:outline-none focus:border-dm-highlight text-gray-200"
          />
        </div>

        {/* Background Map */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Background</label>
          <div className="text-sm text-gray-200">{activeMap.backgroundMapName}</div>
        </div>

        {/* Element count */}
        <div className="pt-4 border-t border-dm-border">
          <div className="text-sm text-gray-400">
            Elements: <span className="text-gray-200 font-medium">{activeMap.elements.length}</span>
          </div>
        </div>
      </div>
    );
  }

  // No map selected
  return (
    <div className="p-4 text-center text-gray-500">
      <p>No map selected</p>
      <p className="text-sm mt-2">Upload a map to get started</p>
    </div>
  );
};

export default PropertiesTab;
