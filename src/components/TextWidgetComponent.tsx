import { TextWidget as TextWidgetType } from '../types';
import RichTextEditor from './RichTextEditor';
import { Trash2 } from 'lucide-react';

interface TextWidgetComponentProps {
  widget: TextWidgetType;
  onChange: (updates: Partial<TextWidgetType>) => void;
  onDelete: () => void;
}

const TextWidgetComponent = ({ widget, onChange, onDelete }: TextWidgetComponentProps) => {
  return (
    <div className="bg-dm-dark border border-dm-border rounded-lg p-4 relative group">
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all z-10 p-1 hover:bg-red-900/20 rounded"
        title="Remove widget"
      >
        <Trash2 size={16} />
      </button>
      
      <RichTextEditor
        content={widget.content}
        onChange={(content) => onChange({ content })}
        placeholder="Add notes, descriptions, or any information..."
      />
    </div>
  );
};

export default TextWidgetComponent;
