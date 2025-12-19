-- ============================================
-- DM PLANNER - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. USER SETTINGS TABLE
-- Drop and recreate to ensure correct structure
-- ============================================

DROP TABLE IF EXISTS user_settings;

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_handle TEXT,
  auth_provider TEXT,
  collections JSONB DEFAULT '[]'::jsonb,
  active_scene_id TEXT,
  hidden_toolbar_buttons JSONB DEFAULT '[]'::jsonb,
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_handle ON user_settings(user_handle);
CREATE INDEX idx_user_settings_provider ON user_settings(auth_provider);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON user_settings FOR DELETE USING (auth.uid() = user_id);


-- ============================================
-- 2. ADD COLUMNS TO SCENES TABLE
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'width') THEN
    ALTER TABLE scenes ADD COLUMN width INTEGER DEFAULT 5000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'height') THEN
    ALTER TABLE scenes ADD COLUMN height INTEGER DEFAULT 5000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'user_handle') THEN
    ALTER TABLE scenes ADD COLUMN user_handle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'auth_provider') THEN
    ALTER TABLE scenes ADD COLUMN auth_provider TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scenes_handle ON scenes(user_handle);
CREATE INDEX IF NOT EXISTS idx_scenes_provider ON scenes(auth_provider);


-- ============================================
-- 3. ADD COLUMNS TO PROFILES TABLE
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_handle') THEN
    ALTER TABLE profiles ADD COLUMN user_handle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_provider') THEN
    ALTER TABLE profiles ADD COLUMN auth_provider TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(user_handle);
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(auth_provider);


-- ============================================
-- 4. UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- DONE! 
-- ============================================
-- 
-- user_handle: Best identifier for the user
--   - Google: email address
--   - Discord: username (email may be hidden)
--   - Email: email address
--
-- auth_provider: 'google', 'discord', or 'email'
--


-- ============================================
-- MIGRATION: Add hidden_toolbar_buttons column
-- Run this if you already have the user_settings table
-- ============================================

-- Add hidden_toolbar_buttons column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'hidden_toolbar_buttons') THEN
    ALTER TABLE user_settings ADD COLUMN hidden_toolbar_buttons JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'viewport') THEN
    ALTER TABLE user_settings ADD COLUMN viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb;
  END IF;
END $$;
