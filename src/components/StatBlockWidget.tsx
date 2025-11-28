import { StatBlockWidget as StatBlockWidgetType } from '../types';
import { Trash2 } from 'lucide-react';

interface StatBlockWidgetProps {
  widget: StatBlockWidgetType;
  onChange: (updates: Partial<StatBlockWidgetType>) => void;
  onDelete: () => void;
}

const StatBlockWidget = ({ widget, onChange, onDelete }: StatBlockWidgetProps) => {
  const handleStatChange = (stat: keyof StatBlockWidgetType['stats'], value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({
      stats: {
        ...widget.stats,
        [stat]: numValue
      }
    });
  };

  const calculateModifier = (score: number): string => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const renderStat = (label: string, stat: keyof StatBlockWidgetType['stats']) => {
    const value = widget.stats[stat];
    const modifier = calculateModifier(value);
    
    return (
      <div className="flex flex-col items-center">
        <div className="text-xs font-bold text-amber-600 uppercase mb-1">{label}</div>
        <div className="border-2 border-gray-600 rounded-lg px-2 py-1 bg-dm-dark relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => handleStatChange(stat, e.target.value)}
            className="w-8 bg-transparent text-center text-base font-bold focus:outline-none text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
    <div className="bg-dm-panel border border-dm-border rounded-lg p-4 relative group">
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all z-10 p-1 hover:bg-red-900/20 rounded"
        title="Remove widget"
      >
        <Trash2 size={16} />
      </button>
      
      <div className="grid grid-cols-6 gap-4 pb-4">
        {renderStat('STR', 'str')}
        {renderStat('DEX', 'dex')}
        {renderStat('CON', 'con')}
        {renderStat('INT', 'int')}
        {renderStat('WIS', 'wis')}
        {renderStat('CHA', 'cha')}
      </div>
    </div>
  );
};

export default StatBlockWidget;
