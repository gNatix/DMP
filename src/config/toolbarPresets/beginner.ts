// ========================================
// BEGINNER PRESET - All buttons visible
// ========================================
// This preset shows ALL toolbar buttons
// Perfect for new users learning the app
// 
// NOTE: Buttons marked as 'required' in their config (Pointer, Token, 
// Asset, Terrain, Modular Room, Door) cannot be hidden regardless of 
// any settings. They will always be visible in the toolbar.
// ========================================

// List of button IDs that are HIDDEN in this preset
// Legacy room/wall tools are always hidden (replaced by Modular Rooms)
// NOTE: Required buttons will be ignored by Toolbox even if listed here
export const BEGINNER_HIDDEN_BUTTONS: string[] = [
  'room',        // Legacy room tool - use Modular Rooms instead
  'wall',        // Legacy wall tool - use Modular Rooms instead
  'wall-cutter', // Legacy wall cutter - use Door tool instead
];

export const BEGINNER_PRESET = {
  id: 'beginner',
  name: 'Beginner',
  description: 'All tools visible - perfect for learning',
  hiddenButtons: BEGINNER_HIDDEN_BUTTONS,
};
