// Central registry of all toolbar buttons
// Buttons are automatically sorted by category and weight

import PointerButton, { pointerButtonConfig } from './PointerButton';
import TokenButton, { tokenButtonConfig } from './TokenButton';
import AssetButton, { assetButtonConfig } from './AssetButton';
import TerrainButton, { terrainButtonConfig } from './TerrainButton';
import RoomButton, { roomButtonConfig } from './RoomButton';
import ModularRoomButton, { modularRoomButtonConfig } from './ModularRoomButton';
import WallButton, { wallButtonConfig } from './WallButton';
import DoorToolButton, { doorToolButtonConfig } from './DoorToolButton';
import WallCutterToolButton, { wallCutterToolButtonConfig } from './WallCutterToolButton';
import PanButton, { panButtonConfig } from './PanButton';
import ZoomButton, { zoomButtonConfig } from './ZoomButton';
import UndoButton, { undoButtonConfig } from './UndoButton';
import RedoButton, { redoButtonConfig } from './RedoButton';
import DuplicateButton, { duplicateButtonConfig } from './DuplicateButton';
import GroupButton, { groupButtonConfig } from './GroupButton';
import DeleteButton, { deleteButtonConfig } from './DeleteButton';
import LayerUpButton, { layerUpButtonConfig } from './LayerUpButton';
import LayerDownButton, { layerDownButtonConfig } from './LayerDownButton';
import BadgeToggleButton, { badgeToggleButtonConfig } from './BadgeToggleButton';
import LockButton, { lockButtonConfig } from './LockButton';
import GameModeLockButton, { gameModeLockButtonConfig } from './GameModeLockButton';
import GridButton, { gridButtonConfig } from './GridButton';
import ColorPickerButton, { colorPickerButtonConfig } from './ColorPickerButton';
import FitToViewButton, { fitToViewButtonConfig } from './FitToViewButton';
import XLabButton, { xLabButtonConfig } from './XLabButton';
import InfoButton, { infoButtonConfig } from './InfoButton';

// All button configs - used by SettingsTab to auto-generate categories
export const ALL_BUTTON_CONFIGS = [
  pointerButtonConfig,
  tokenButtonConfig,
  assetButtonConfig,
  terrainButtonConfig,
  // roomButtonConfig, // LEGACY - Archived
  modularRoomButtonConfig,
  // wallButtonConfig, // LEGACY - Archived
  doorToolButtonConfig,
  // wallCutterToolButtonConfig, // LEGACY - Archived
  panButtonConfig,
  zoomButtonConfig,
  undoButtonConfig,
  redoButtonConfig,
  duplicateButtonConfig,
  groupButtonConfig,
  deleteButtonConfig,
  layerUpButtonConfig,
  layerDownButtonConfig,
  badgeToggleButtonConfig,
  lockButtonConfig,
  gameModeLockButtonConfig,
  gridButtonConfig,
  colorPickerButtonConfig,
  fitToViewButtonConfig,
  xLabButtonConfig,
  infoButtonConfig,
];

// Category display names
export const CATEGORY_LABELS: Record<string, string> = {
  'selection': 'Selection',
  'drawing': 'Drawing Tools',
  'navigation': 'Navigation',
  'history': 'History',
  'layers': 'Layer Tools',
  'toggle': 'Toggles',
  'view': 'View',
  'utilities': 'Utilities',
  'gameMode': 'Game Mode',
  'experimental': 'Experimental',
};

// Category order for display
export const CATEGORY_ORDER = ['selection', 'drawing', 'navigation', 'history', 'layers', 'toggle', 'utilities', 'gameMode', 'view', 'experimental'];

export const toolButtons = [
  // Selection tools
  { component: PointerButton, config: pointerButtonConfig },
  
  // Drawing tools
  { component: TokenButton, config: tokenButtonConfig },
  { component: AssetButton, config: assetButtonConfig },
  { component: TerrainButton, config: terrainButtonConfig },
  { component: RoomButton, config: roomButtonConfig },
  { component: ModularRoomButton, config: modularRoomButtonConfig },
  { component: WallButton, config: wallButtonConfig },
  { component: DoorToolButton, config: doorToolButtonConfig },
  { component: WallCutterToolButton, config: wallCutterToolButtonConfig },
  
  // Navigation tools
  { component: PanButton, config: panButtonConfig },
  { component: ZoomButton, config: zoomButtonConfig },
  
  // History tools
  { component: UndoButton, config: undoButtonConfig },
  { component: RedoButton, config: redoButtonConfig },
  
  // Layer tools
  { component: DuplicateButton, config: duplicateButtonConfig },
  { component: GroupButton, config: groupButtonConfig },
  { component: DeleteButton, config: deleteButtonConfig },
  { component: LayerUpButton, config: layerUpButtonConfig },
  { component: LayerDownButton, config: layerDownButtonConfig },
  
  // Toggle
  { component: LockButton, config: lockButtonConfig },
  { component: GameModeLockButton, config: gameModeLockButtonConfig },
  { component: GridButton, config: gridButtonConfig },
  { component: FitToViewButton, config: fitToViewButtonConfig },
  { component: InfoButton, config: infoButtonConfig },
  
  // Utilities
  { component: BadgeToggleButton, config: badgeToggleButtonConfig },
  { component: ColorPickerButton, config: colorPickerButtonConfig },
  
  // Experimental
  { component: XLabButton, config: xLabButtonConfig },
];

// Helper to get buttons by category, sorted by weight
export const getButtonsByCategory = (category: string) => {
  return toolButtons
    .filter(btn => btn.config.category === category && btn.config.enabled)
    .sort((a, b) => a.config.weight - b.config.weight);
};

// Helper to get all enabled buttons grouped by category
export const getButtonsGroupedByCategory = () => {
  return CATEGORY_ORDER
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
  AssetButton,
  TerrainButton,
  RoomButton,
  ModularRoomButton,
  WallButton,
  DoorToolButton,
  WallCutterToolButton,
  PanButton,
  ZoomButton,
  UndoButton,
  RedoButton,
  DuplicateButton,
  GroupButton,
  DeleteButton,
  LayerUpButton,
  LayerDownButton,
  BadgeToggleButton,
  LockButton,
  GameModeLockButton,
  GridButton,
  ColorPickerButton,
  FitToViewButton,
  XLabButton,
  InfoButton,
};
