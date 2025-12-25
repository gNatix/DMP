// ========================================
// BEGINNER PRESET - All buttons visible
// ========================================
// This preset shows ALL toolbar buttons
// Perfect for new users learning the app
// ========================================

// List of button IDs that are HIDDEN in this preset
// Legacy room/wall tools are always hidden (replaced by Modular Rooms)
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
