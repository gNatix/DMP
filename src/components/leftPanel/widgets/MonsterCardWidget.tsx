import { useState } from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { MonsterCardWidget as MonsterCardWidgetType, ViewMode } from '../../../types';
import RichTextEditor from '../../RichTextEditor';

interface MonsterCardWidgetProps {
  widget: MonsterCardWidgetType;
  onUpdate: (updates: Partial<MonsterCardWidgetType>) => void;
  onDelete: () => void;
  viewMode?: ViewMode;
}

const MonsterCardWidget = ({ widget, onUpdate, onDelete, viewMode }: MonsterCardWidgetProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(widget.name || '');

  const handleNameSave = () => {
    onUpdate({ name: nameInput.trim() || 'Monster' });
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setNameInput(widget.name || '');
      setIsEditingName(false);
    }
  };

  const calculateModifier = (score: number): string => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const handleCRScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const crValues = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
    const currentIndex = crValues.indexOf(widget.challenge);
    
    if (e.deltaY < 0 && currentIndex < crValues.length - 1) {
      onUpdate({ challenge: crValues[currentIndex + 1] });
    } else if (e.deltaY > 0 && currentIndex > 0) {
      onUpdate({ challenge: crValues[currentIndex - 1] });
    }
  };

  const handleNumberScroll = (e: React.WheelEvent, field: 'ac' | 'hp' | 'speed') => {
    e.preventDefault();
    const currentValue = widget[field];
    const delta = e.deltaY < 0 ? 1 : -1;
    const newValue = Math.max(0, currentValue + delta);
    onUpdate({ [field]: newValue });
  };

  const handleAbilityScroll = (e: React.WheelEvent, stat: keyof MonsterCardWidgetType['abilities']) => {
    e.preventDefault();
    const currentValue = widget.abilities[stat];
    const delta = e.deltaY < 0 ? 1 : -1;
    const newValue = Math.max(1, Math.min(30, currentValue + delta));
    onUpdate({
      abilities: {
        ...widget.abilities,
        [stat]: newValue
      }
    });
  };

  const renderStat = (label: string, stat: keyof MonsterCardWidgetType['abilities']) => {
    const value = widget.abilities[stat];
    const modifier = calculateModifier(value);
    
    return (
      <div className="flex flex-col items-center">
        <div className="text-xs font-bold text-amber-600 uppercase mb-1">{label}</div>
        <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark relative">
          <input
            type="number"
            value={value}
            onChange={(e) => onUpdate({
              abilities: {
                ...widget.abilities,
                [stat]: parseInt(e.target.value) || 10
              }
            })}
            onWheel={(e) => handleAbilityScroll(e, stat)}
            className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
            min="1"
            max="30"
          />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-6 flex items-center justify-center">
            <div className="w-full h-full border border-gray-600 rounded bg-dm-panel flex items-center justify-center">
              <span className="text-xs font-semibold">{modifier}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-neutral-800/90 border-2 border-neutral-700 rounded-lg p-4 relative group shadow-lg">
      {viewMode !== 'game' && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all z-10 p-1 hover:bg-red-900/20 rounded"
          title="Remove widget"
        >
          <Trash2 size={16} />
        </button>
      )}

      {/* Row 1: Info/Stats and Image */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Column 1 (2/3): Name, Info, Stats */}
        <div className="flex flex-col gap-3">
          {/* Row 1: Monster Name and Info */}
          <div className="bg-dm-dark border border-gray-600 rounded p-2 flex flex-col gap-1">
            {/* Monster Name */}
            {isEditingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="w-full bg-transparent text-center text-base font-bold focus:outline-none text-white border-b border-gray-600 pb-1 cursor-text"
                placeholder="Monster Name"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="text-center text-base font-bold text-white hover:text-amber-400 transition-colors border-b border-gray-600 pb-1 cursor-text"
              >
                {widget.name || 'Monster'}
              </div>
            )}
            {/* Monster Info */}
            <input
              type="text"
              placeholder="Medium Beast, Neutral..."
              value={widget.monsterType || ''}
              onChange={(e) => onUpdate({ monsterType: e.target.value })}
              className="w-full bg-transparent text-center text-xs text-gray-300 focus:outline-none placeholder:text-gray-600 italic cursor-text"
            />
          </div>

          {/* Row 2: Stats (CR, AC, HP, SPD) */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-amber-600 uppercase mb-1">CR</div>
              <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark">
                <input
                  type="text"
                  value={widget.challenge}
                  onChange={(e) => onUpdate({ challenge: e.target.value })}
                  onWheel={handleCRScroll}
                  placeholder="1/4"
                  className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white cursor-text"
                />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-amber-600 uppercase mb-1">AC</div>
              <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark">
                <input
                  type="text"
                  value={widget.ac}
                  onChange={(e) => onUpdate({ ac: parseInt(e.target.value) || 0 })}
                  onWheel={(e) => handleNumberScroll(e, 'ac')}
                  className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-amber-600 uppercase mb-1">HP</div>
              <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark">
                <input
                  type="text"
                  value={widget.hp}
                  onChange={(e) => onUpdate({ hp: parseInt(e.target.value) || 0 })}
                  onWheel={(e) => handleNumberScroll(e, 'hp')}
                  className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-amber-600 uppercase mb-1">SPD</div>
              <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark">
                <input
                  type="text"
                  value={widget.speed}
                  onChange={(e) => onUpdate({ speed: parseInt(e.target.value) || 0 })}
                  onWheel={(e) => handleNumberScroll(e, 'speed')}
                  className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2 (1/3): Monster Image - Full height */}
        <div className="bg-dm-dark border border-gray-600 rounded overflow-hidden h-full">
          {widget.image && widget.image.trim() !== '' ? (
            <img src={widget.image} alt={widget.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <ImageIcon size={20} className="mx-auto mb-1 text-gray-600" />
                <input
                  type="text"
                  placeholder="Image URL..."
                  value={widget.image || ''}
                  onChange={(e) => onUpdate({ image: e.target.value })}
                  className="w-20 px-1 py-0.5 text-[10px] bg-dm-panel border border-gray-600 rounded focus:outline-none text-gray-300 text-center"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: DnD Stat Block */}
      <div className="my-4 py-4 border-t border-b border-gray-600">
        <div className="grid grid-cols-6 gap-3 pb-4">
          {renderStat('STR', 'str')}
          {renderStat('DEX', 'dex')}
          {renderStat('CON', 'con')}
          {renderStat('INT', 'int')}
          {renderStat('WIS', 'wis')}
          {renderStat('CHA', 'cha')}
        </div>
      </div>

      {/* Row 3: Abilities Table */}
      <div className="bg-dm-dark border border-gray-600 rounded">
        <div className="text-xs font-bold text-amber-600 uppercase p-2 text-center border-b border-gray-600">Special Abilities</div>
        <RichTextEditor
          content={widget.special}
          onChange={(content) => onUpdate({ special: content })}
          placeholder="Skills, Languages, Traits, Actions..."
        />
      </div>
    </div>
  );
};

export default MonsterCardWidget;
