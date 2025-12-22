/**
 * ModularRoomContextMenu - A small floating menu for modular room actions
 * 
 * Displays when a modular room is selected with options like:
 * - Rotate left (90° counter-clockwise)
 * - Rotate right (90° clockwise)
 * 
 * Renders in screen-space (fixed size, doesn't zoom)
 */

import React from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';

interface ModularRoomContextMenuProps {
  // Position to show the menu (screen coordinates)
  screenX: number;
  screenY: number;
  // Callbacks
  onRotateLeft: () => void;
  onRotateRight: () => void;
}

const ModularRoomContextMenu: React.FC<ModularRoomContextMenuProps> = ({
  screenX,
  screenY,
  onRotateLeft,
  onRotateRight,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        left: screenX,
        top: screenY - 100, // Position well above the room (clear of pillars and door icons)
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: 4,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()} // Prevent canvas interactions
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRotateLeft();
        }}
        className="flex items-center justify-center w-9 h-9 bg-transparent hover:bg-white/10 rounded-md transition-colors"
        title="Rotate Left (90°)"
      >
        <RotateCcw size={20} className="text-white" />
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRotateRight();
        }}
        className="flex items-center justify-center w-9 h-9 bg-transparent hover:bg-white/10 rounded-md transition-colors"
        title="Rotate Right (90°)"
      >
        <RotateCw size={20} className="text-white" />
      </button>
    </div>
  );
};

export default ModularRoomContextMenu;
