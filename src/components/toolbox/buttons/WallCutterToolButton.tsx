import { Scissors } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';

// ========== BUTTON CONFIGURATION ==========
export const wallCutterToolButtonConfig: ToolButtonConfig = {
  id: 'wallCutterTool',
  enabled: true,
  enabledInPlanningMode: true,
  enabledInGameMode: false,
  category: 'drawing',
  weight: 5,
  
  icon: <Scissors size={18} />,
  label: 'Wall Cutter',
  shortcutKey: 'A',
  
  buttonType: 'tool',
  highlightStyle: 'full',
  
  tool: 'wallCutterTool',
  hasSubmenu: false,
};
// ==========================================

const WallCutterToolButton = ({
  activeTool,
  setActiveTool,
}: ToolButtonProps) => {
  const isActive = activeTool === wallCutterToolButtonConfig.tool;

  // Keyboard shortcut: A
  useKeyboardShortcut('a', () => {
    setActiveTool('wallCutterTool');
  });

  const handleClick = () => {
    setActiveTool('wallCutterTool');
  };

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector('.wall-cutter-badge') as HTMLElement;
        if (badge) badge.style.display = 'block';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector('.wall-cutter-badge') as HTMLElement;
        if (badge) badge.style.display = 'none';
      }}
    >
      <button
        onClick={handleClick}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
      >
        {wallCutterToolButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">{wallCutterToolButtonConfig.shortcutKey}</span>
      <div
        className="wall-cutter-badge"
        style={{
          display: 'none',
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '20px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '12px',
          color: '#9ca3af',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}
      >
        {wallCutterToolButtonConfig.label} ({wallCutterToolButtonConfig.shortcutKey})
      </div>
    </div>
  );
};

export default WallCutterToolButton;
