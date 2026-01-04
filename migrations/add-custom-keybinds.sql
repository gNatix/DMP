-- Migration: Add custom_keybinds column to user_settings table
-- Date: 2026-01-04
-- Description: Adds support for user-specific custom keyboard shortcuts

-- Add custom_keybinds column to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS custom_keybinds jsonb DEFAULT '{}'::jsonb;

-- Add comment to column
COMMENT ON COLUMN user_settings.custom_keybinds IS 'Custom keyboard shortcuts mapping buttonId to key combination';

-- Verify column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings' 
  AND column_name = 'custom_keybinds';
