import { Square, Eraser, Pencil } from 'lucide-react';
import { RoomSubTool } from '../types';
import { useRef, useEffect } from 'react';

interface RoomSubToolPickerProps {
  roomSubTool: RoomSubTool;
  setRoomSubTool: (subTool: RoomSubTool) => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

const RoomSubToolPicker = ({
  roomSubTool,
  setRoomSubTool,
  onClose,
  buttonRef
}: RoomSubToolPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        buttonRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, buttonRef]);

  // Position picker next to button
  const buttonRect = buttonRef.current?.getBoundingClientRect();
  const pickerStyle: React.CSSProperties = buttonRect
    ? {
        position: 'fixed',
        left: buttonRect.right + 8,
        top: buttonRect.top,
        zIndex: 1000
      }
    : {};

  return (
    <div
      ref={pickerRef}
      style={pickerStyle}
      className="bg-dm-panel border border-dm-border rounded-lg shadow-xl p-2 flex gap-1"
    >
      {/* Draw Rectangle Room Tool */}
      <button
        onClick={() => {
          setRoomSubTool('rectangle');
          onClose();
        }}
        className={`p-3 rounded transition-all ${
          roomSubTool === 'rectangle'
            ? 'bg-dm-highlight text-white'
            : 'hover:bg-dm-dark text-gray-400 hover:text-gray-200'
        }`}
        title="Draw Room (Rectangle)"
      >
        <Square size={20} />
      </button>

      {/* Draw Custom Room Tool */}
      <button
        onClick={() => {
          setRoomSubTool('custom');
          onClose();
        }}
        className={`p-3 rounded transition-all ${
          roomSubTool === 'custom'
            ? 'bg-dm-highlight text-white'
            : 'hover:bg-dm-dark text-gray-400 hover:text-gray-200'
        }`}
        title="Draw Custom Room (Click to place vertices)"
      >
        <Pencil size={20} />
      </button>

      {/* Wall Eraser Tool */}
      <button
        onClick={() => {
          setRoomSubTool('erase');
          onClose();
        }}
        className={`p-3 rounded transition-all ${
          roomSubTool === 'erase'
            ? 'bg-dm-highlight text-white'
            : 'hover:bg-dm-dark text-gray-400 hover:text-gray-200'
        }`}
        title="Wall Eraser (Paint over walls to remove)"
      >
        <Eraser size={20} />
      </button>
    </div>
  );
};

export default RoomSubToolPicker;
