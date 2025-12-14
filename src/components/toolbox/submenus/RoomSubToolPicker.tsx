import { RoomSubTool } from '../../../types';

interface RoomSubToolPickerProps {
  roomSubTool: RoomSubTool;
  setRoomSubTool: (tool: RoomSubTool) => void;
  setActiveTool: (tool: 'room') => void;
  autoMergeRooms?: boolean;
  setAutoMergeRooms?: (value: boolean) => void;
  onMouseLeave?: () => void;
  onWheel?: (e: React.WheelEvent) => void;
}

const RoomSubToolPicker = ({ 
  roomSubTool, 
  setRoomSubTool,
  setActiveTool,
  autoMergeRooms = false,
  setAutoMergeRooms,
  onMouseLeave,
  onWheel
}: RoomSubToolPickerProps) => {
  return (
    <div>
      {/* Room tool badge */}
      <div 
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '12px',
          color: '#9ca3af',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
        }}
      >
        {roomSubTool?.startsWith('subtract-') ? 'Subtract ' : 'Add '}
        {roomSubTool?.replace('subtract-', '').charAt(0).toUpperCase() + roomSubTool?.replace('subtract-', '').slice(1)} (R)
      </div>
      
      <div
        className="bg-dm-panel border border-dm-border rounded-lg shadow-2xl p-2 z-[100]"
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      >
        <div className="flex gap-1">
          {/* Add/Subtract Mode Toggle - First cell split horizontally */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                const baseShape = roomSubTool?.replace('subtract-', '') as 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'custom' | 'erase' || 'rectangle';
                if (baseShape !== 'erase') {
                  setRoomSubTool(baseShape);
                  setActiveTool('room');
                }
              }}
              className={`w-10 h-5 rounded border-2 transition-all flex items-center justify-center ${
                !roomSubTool?.startsWith('subtract-')
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
              }`}
              title="Add Room"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M12 4v16m8-8H4" strokeLinecap="round"/>
              </svg>
            </button>
            
            <button
              onClick={() => {
                const baseShape = roomSubTool?.replace('subtract-', '') as 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'custom' | 'erase' || 'rectangle';
                if (baseShape !== 'erase') {
                  setRoomSubTool(`subtract-${baseShape}` as RoomSubTool);
                  setActiveTool('room');
                }
              }}
              className={`w-10 h-5 rounded border-2 transition-all flex items-center justify-center ${
                roomSubTool?.startsWith('subtract-')
                  ? 'border-red-500 bg-red-500/20 text-red-400'
                  : 'border-dm-border bg-dm-dark text-gray-400 hover:border-dm-highlight'
              }`}
              title="Subtract"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M20 12H4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Rectangle */}
          <button
            onClick={() => {
              const isSubtract = roomSubTool?.startsWith('subtract-');
              setRoomSubTool(isSubtract ? 'subtract-rectangle' : 'rectangle');
              setActiveTool('room');
            }}
            className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
              roomSubTool?.replace('subtract-', '') === 'rectangle'
                ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                : 'border-dm-border hover:border-dm-highlight'
            }`}
            title="Rectangle"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="6" width="16" height="12" strokeWidth="2"/>
            </svg>
          </button>

          {/* Pentagon */}
          <button
            onClick={() => {
              const isSubtract = roomSubTool?.startsWith('subtract-');
              setRoomSubTool(isSubtract ? 'subtract-pentagon' : 'pentagon');
              setActiveTool('room');
            }}
            className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
              roomSubTool?.replace('subtract-', '') === 'pentagon'
                ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                : 'border-dm-border hover:border-dm-highlight'
            }`}
            title="Pentagon"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 3 L21 9 L18 19 L6 19 L3 9 Z" strokeWidth="2"/>
            </svg>
          </button>

          {/* Hexagon */}
          <button
            onClick={() => {
              const isSubtract = roomSubTool?.startsWith('subtract-');
              setRoomSubTool(isSubtract ? 'subtract-hexagon' : 'hexagon');
              setActiveTool('room');
            }}
            className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
              roomSubTool?.replace('subtract-', '') === 'hexagon'
                ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                : 'border-dm-border hover:border-dm-highlight'
            }`}
            title="Hexagon"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" strokeWidth="2"/>
            </svg>
          </button>

          {/* Octagon */}
          <button
            onClick={() => {
              const isSubtract = roomSubTool?.startsWith('subtract-');
              setRoomSubTool(isSubtract ? 'subtract-octagon' : 'octagon');
              setActiveTool('room');
            }}
            className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
              roomSubTool?.replace('subtract-', '') === 'octagon'
                ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                : 'border-dm-border hover:border-dm-highlight'
            }`}
            title="Octagon"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" strokeWidth="2"/>
            </svg>
          </button>

          {/* Custom */}
          <button
            onClick={() => {
              const isSubtract = roomSubTool?.startsWith('subtract-');
              setRoomSubTool(isSubtract ? 'subtract-custom' : 'custom');
              setActiveTool('room');
            }}
            className={`w-10 h-10 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
              roomSubTool?.replace('subtract-', '') === 'custom'
                ? (roomSubTool?.startsWith('subtract-') ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500 ring-2 ring-amber-500/50')
                : 'border-dm-border hover:border-dm-highlight'
            }`}
            title="Custom Polygon"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18 L12 8 L20 12" strokeWidth="2"/>
              <circle cx="6" cy="18" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="20" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </button>
        </div>
        
        {/* Disable Auto-merge checkbox */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dm-border">
          <label 
            className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300"
            title="When checked, overlapping rooms will NOT automatically merge"
          >
            <div 
              className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                !autoMergeRooms
                  ? 'bg-amber-500/20 border-amber-500'
                  : 'bg-dm-dark border-dm-border hover:border-dm-highlight'
              }`}
              onClick={() => setAutoMergeRooms?.(!autoMergeRooms)}
            >
              {!autoMergeRooms && (
                <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span>Disable auto-merge</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default RoomSubToolPicker;
