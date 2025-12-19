// ========================================
// TOOLBAR PRESETS - Central Export
// ========================================

import { BEGINNER_PRESET, BEGINNER_HIDDEN_BUTTONS } from './beginner';
import { ADVANCED_PRESET, ADVANCED_HIDDEN_BUTTONS } from './advanced';
import { MINIMALISTIC_PRESET, MINIMALISTIC_HIDDEN_BUTTONS } from './minimalistic';

// All available presets
export const TOOLBAR_PRESETS = [
  BEGINNER_PRESET,
  ADVANCED_PRESET,
  MINIMALISTIC_PRESET,
] as const;

// Preset type
export type ToolbarPresetId = 'beginner' | 'advanced' | 'minimalistic' | 'custom';

export interface ToolbarPreset {
  id: string;
  name: string;
  description: string;
  hiddenButtons: string[];
}

// Helper to get preset by ID
export const getPresetById = (id: string): ToolbarPreset | undefined => {
  return TOOLBAR_PRESETS.find(preset => preset.id === id);
};

// Helper to check if current settings match a preset
export const detectMatchingPreset = (hiddenButtons: Set<string>): ToolbarPresetId => {
  const hiddenArray = Array.from(hiddenButtons).sort();
  
  for (const preset of TOOLBAR_PRESETS) {
    const presetArray = [...preset.hiddenButtons].sort();
    
    // Check if arrays are equal
    if (hiddenArray.length === presetArray.length && 
        hiddenArray.every((val, idx) => val === presetArray[idx])) {
      return preset.id as ToolbarPresetId;
    }
  }
  
  return 'custom';
};

// Re-export individual presets
export { BEGINNER_PRESET, BEGINNER_HIDDEN_BUTTONS };
export { ADVANCED_PRESET, ADVANCED_HIDDEN_BUTTONS };
export { MINIMALISTIC_PRESET, MINIMALISTIC_HIDDEN_BUTTONS };
