import { TextWidget as TextWidgetType } from '../types';
import RichTextEditor from './RichTextEditor';

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
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-all z-10"
        title="Remove widget"
      >
        Remove
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
