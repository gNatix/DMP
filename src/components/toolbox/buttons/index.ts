// Central registry of all toolbar buttons
// Buttons are automatically sorted by category and weight

import PointerButton, { pointerButtonConfig } from './PointerButton';
import TokenButton, { tokenButtonConfig } from './TokenButton';
import TerrainButton, { terrainButtonConfig } from './TerrainButton';
import RoomButton, { roomButtonConfig } from './RoomButton';
import WallButton, { wallButtonConfig } from './WallButton';
import PanButton, { panButtonConfig } from './PanButton';
import ZoomButton, { zoomButtonConfig } from './ZoomButton';
import UndoButton, { undoButtonConfig } from './UndoButton';
import RedoButton, { redoButtonConfig } from './RedoButton';
import DuplicateButton, { duplicateButtonConfig } from './DuplicateButton';
import DeleteButton, { deleteButtonConfig } from './DeleteButton';
import LayerUpButton, { layerUpButtonConfig } from './LayerUpButton';
import LayerDownButton, { layerDownButtonConfig } from './LayerDownButton';
import BadgeToggleButton, { badgeToggleButtonConfig } from './BadgeToggleButton';
import LockButton, { lockButtonConfig } from './LockButton';
import GridButton, { gridButtonConfig } from './GridButton';
import ColorPickerButton, { colorPickerButtonConfig } from './ColorPickerButton';
import FitToViewButton, { fitToViewButtonConfig } from './FitToViewButton';

export const toolButtons = [
  // Selection tools
  { component: PointerButton, config: pointerButtonConfig },
  
  // Drawing tools
  { component: TokenButton, config: tokenButtonConfig },
  { component: TerrainButton, config: terrainButtonConfig },
  { component: RoomButton, config: roomButtonConfig },
  { component: WallButton, config: wallButtonConfig },
  
  // Navigation tools
  { component: PanButton, config: panButtonConfig },
  { component: ZoomButton, config: zoomButtonConfig },
  
  // History tools
  { component: UndoButton, config: undoButtonConfig },
  { component: RedoButton, config: redoButtonConfig },
  
  // Layer tools
  { component: DuplicateButton, config: duplicateButtonConfig },
  { component: DeleteButton, config: deleteButtonConfig },
  { component: LayerUpButton, config: layerUpButtonConfig },
  { component: LayerDownButton, config: layerDownButtonConfig },
  
  // Utilities
  { component: BadgeToggleButton, config: badgeToggleButtonConfig },
  { component: LockButton, config: lockButtonConfig },
  { component: ColorPickerButton, config: colorPickerButtonConfig },
  
  // View tools
  { component: GridButton, config: gridButtonConfig },
  { component: FitToViewButton, config: fitToViewButtonConfig },
];

// Helper to get buttons by category, sorted by weight
export const getButtonsByCategory = (category: string) => {
  return toolButtons
    .filter(btn => btn.config.category === category && btn.config.enabled)
    .sort((a, b) => a.config.weight - b.config.weight);
};

// Helper to get all enabled buttons grouped by category
export const getButtonsGroupedByCategory = () => {
  const categories = ['selection', 'drawing', 'navigation', 'history', 'layers', 'view', 'utilities'];
  
  return categories
    .map(category => ({
      category,
      buttons: getButtonsByCategory(category)
    }))
    .filter(group => group.buttons.length > 0);
};

export * from './types';
export {
  PointerButton,
  TokenButton,
  TerrainButton,
  RoomButton,
  WallButton,
  PanButton,
  ZoomButton,
  UndoButton,
  RedoButton,
  DuplicateButton,
  DeleteButton,
  LayerUpButton,
  LayerDownButton,
  BadgeToggleButton,
  LockButton,
  GridButton,
  ColorPickerButton,
  FitToViewButton,
};
