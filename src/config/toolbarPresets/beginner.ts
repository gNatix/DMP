// ========================================
// BEGINNER PRESET - All buttons visible
// ========================================
// This preset shows ALL toolbar buttons
// Perfect for new users learning the app
// ========================================

// List of button IDs that are HIDDEN in this preset
// Empty array = all buttons visible
export const BEGINNER_HIDDEN_BUTTONS: string[] = [
  // All buttons are visible in beginner mode
  // Add button IDs here to hide them
];

export const BEGINNER_PRESET = {
  id: 'beginner',
  name: 'Beginner',
  description: 'All tools visible - perfect for learning',
  hiddenButtons: BEGINNER_HIDDEN_BUTTONS,
};
