import { useState } from 'react';
import { Skull, Trash2, Image as ImageIcon } from 'lucide-react';
import { MonsterCardWidget as MonsterCardWidgetType } from '../types';

interface MonsterCardWidgetProps {
  widget: MonsterCardWidgetType;
  onUpdate: (updates: Partial<MonsterCardWidgetType>) => void;
  onDelete: () => void;
}

const MonsterCardWidget = ({ widget, onUpdate, onDelete }: MonsterCardWidgetProps) => {
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

  return (
    <div className="bg-dm-dark rounded-lg border border-gray-600 overflow-hidden" style={{ fontFamily: 'serif' }}>
      {/* Header with scroll design */}
      <div className="relative bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 border-b-2 border-amber-950">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 flex-1">
            <Skull size={18} className="text-amber-200" />
            {isEditingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="flex-1 bg-amber-950/50 border border-amber-700 rounded px-2 py-1 text-base text-amber-100 focus:outline-none focus:border-amber-500 font-bold"
                placeholder="Monster Name"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => setIsEditingName(true)}
                className="text-base font-bold text-amber-100 cursor-pointer hover:text-amber-200 transition-colors uppercase tracking-wide"
              >
                {widget.name || 'Monster'}
              </h3>
            )}
          </div>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-900/40 rounded transition-colors"
            title="Delete widget"
          >
            <Trash2 size={14} className="text-red-300" />
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 text-gray-900">
        {/* Monster Image */}
        {widget.image && widget.image.trim() !== '' ? (
          <div className="mb-3 rounded border-2 border-amber-900 overflow-hidden">
            <img src={widget.image} alt={widget.name} className="w-full h-32 object-cover" />
          </div>
        ) : (
          <div className="mb-3 rounded border-2 border-dashed border-amber-700/40 bg-amber-100/30 h-32 flex items-center justify-center">
            <div className="text-center">
              <ImageIcon size={24} className="mx-auto mb-1 text-amber-700/40" />
              <input
                type="text"
                placeholder="Image URL..."
                value={widget.image || ''}
                onChange={(e) => onUpdate({ image: e.target.value })}
                className="w-full max-w-[200px] px-2 py-1 text-xs bg-white border border-amber-700/30 rounded focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>
        )}

        {/* AC, HP, Speed */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="bg-amber-100 border border-amber-800 rounded p-1.5">
            <div className="text-[10px] uppercase text-amber-900 font-semibold">AC</div>
            <input
              type="number"
              value={widget.ac}
              onChange={(e) => onUpdate({ ac: parseInt(e.target.value) || 0 })}
              className="w-full text-center font-bold text-lg bg-transparent focus:outline-none"
            />
          </div>
          <div className="bg-amber-100 border border-amber-800 rounded p-1.5">
            <div className="text-[10px] uppercase text-amber-900 font-semibold">HP</div>
            <input
              type="number"
              value={widget.hp}
              onChange={(e) => onUpdate({ hp: parseInt(e.target.value) || 0 })}
              className="w-full text-center font-bold text-lg bg-transparent focus:outline-none"
            />
          </div>
          <div className="bg-amber-100 border border-amber-800 rounded p-1.5">
            <div className="text-[10px] uppercase text-amber-900 font-semibold">Speed</div>
            <input
              type="number"
              value={widget.speed}
              onChange={(e) => onUpdate({ speed: parseInt(e.target.value) || 0 })}
              className="w-full text-center font-bold text-lg bg-transparent focus:outline-none"
            />
            <div className="text-[9px] text-amber-800">ft.</div>
          </div>
        </div>

        {/* Ability Scores */}
        <div className="border-t-2 border-b-2 border-amber-900 py-2 mb-3">
          <div className="grid grid-cols-6 gap-1 text-center">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
              <div key={ability} className="bg-white/50 rounded p-1">
                <div className="text-[9px] uppercase font-bold text-amber-900">{ability}</div>
                <input
                  type="number"
                  value={widget.abilities[ability]}
                  onChange={(e) => onUpdate({
                    abilities: {
                      ...widget.abilities,
                      [ability]: parseInt(e.target.value) || 10
                    }
                  })}
                  className="w-full text-center text-sm font-semibold bg-transparent focus:outline-none"
                />
                <div className="text-[10px] font-bold text-amber-800">
                  {calculateModifier(widget.abilities[ability])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="mb-2">
          <label className="text-[10px] uppercase font-bold text-amber-900 block mb-0.5">Skills</label>
          <input
            type="text"
            value={widget.skills}
            onChange={(e) => onUpdate({ skills: e.target.value })}
            placeholder="Perception +4, Deception +5"
            className="w-full px-2 py-1 text-xs bg-white border border-amber-700/30 rounded focus:outline-none focus:border-amber-600"
          />
        </div>

        {/* Languages */}
        <div className="mb-2">
          <label className="text-[10px] uppercase font-bold text-amber-900 block mb-0.5">Languages</label>
          <input
            type="text"
            value={widget.languages}
            onChange={(e) => onUpdate({ languages: e.target.value })}
            placeholder="Common, Draconic"
            className="w-full px-2 py-1 text-xs bg-white border border-amber-700/30 rounded focus:outline-none focus:border-amber-600"
          />
        </div>

        {/* Challenge Rating */}
        <div className="mb-3">
          <label className="text-[10px] uppercase font-bold text-amber-900 block mb-0.5">Challenge</label>
          <input
            type="text"
            value={widget.challenge}
            onChange={(e) => onUpdate({ challenge: e.target.value })}
            placeholder="1/4 or 5"
            className="w-full px-2 py-1 text-xs bg-white border border-amber-700/30 rounded focus:outline-none focus:border-amber-600"
          />
        </div>

        {/* Special Abilities */}
        <div>
          <label className="text-[10px] uppercase font-bold text-amber-900 block mb-0.5">Special Abilities</label>
          <textarea
            value={widget.special}
            onChange={(e) => onUpdate({ special: e.target.value })}
            placeholder="SKILLS: Acura +5, Deception +5&#13;&#10;PASSIVE PERCEPTION: 14&#13;&#10;LANGUAGES: —&#13;&#10;CHALLENGE RATING: 1/4"
            className="w-full px-2 py-1.5 text-xs bg-white border border-amber-700/30 rounded focus:outline-none focus:border-amber-600 resize-none min-h-[60px]"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};

export default MonsterCardWidget;
