import { supabase } from '../auth/supabaseClient';
import type { Collection } from '../types';

/**
 * User Settings Service
 * 
 * Handles saving/loading all user preferences to Supabase:
 * - Collections (name, appearance/gradient)
 * - Active scene ID
 * - Other preferences
 */

export interface UserSettings {
  collections: Collection[];
  activeSceneId: string | null;
  viewport?: { x: number; y: number; zoom: number };
  // Add more settings as needed
}

interface SupabaseUserSettings {
  id: string;
  user_id: string;
  collections: Collection[];
  active_scene_id: string | null;
  viewport: { x: number; y: number; zoom: number } | null;
  updated_at: string;
}

/**
 * Save user settings to Supabase
 */
export const saveUserSettings = async (
  userId: string,
  settings: UserSettings,
  userHandle?: string,
  authProvider?: string
): Promise<{ error: Error | null }> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[UserSettings] Invalid userId:', userId);
      return { error: new Error('Invalid user ID') };
    }

    const settingsData = {
      user_id: userId,
      user_handle: userHandle || null,
      auth_provider: authProvider || null,
      collections: settings.collections,
      active_scene_id: settings.activeSceneId,
      viewport: settings.viewport || { x: 0, y: 0, zoom: 1 },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_settings')
      .upsert(settingsData, { onConflict: 'user_id' });

    if (error) {
      console.error('[UserSettings] Save failed:', error.message);
      return { error };
    }

    console.log('[UserSettings] Saved successfully');
    return { error: null };
  } catch (error) {
    console.error('[UserSettings] Save exception:', error);
    return { error: error as Error };
  }
};

/**
 * Load user settings from Supabase
 */
export const loadUserSettings = async (
  userId: string
): Promise<{ settings: UserSettings | null; error: Error | null }> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[UserSettings] Invalid userId:', userId);
      return { settings: null, error: new Error('Invalid user ID') };
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found - not an error, just no settings yet
      if (error.code === 'PGRST116') {
        console.log('[UserSettings] No settings found for user (first time)');
        return { settings: null, error: null };
      }
      console.error('[UserSettings] Load failed:', error.message);
      return { settings: null, error };
    }

    const row = data as SupabaseUserSettings;
    
    console.log('[UserSettings] Loaded from DB:', {
      collections: row.collections?.length || 0,
      activeSceneId: row.active_scene_id,
    });
    
    const settings: UserSettings = {
      collections: row.collections || [],
      activeSceneId: row.active_scene_id,
      viewport: row.viewport || undefined,
    };

    return { settings, error: null };
  } catch (error) {
    console.error('[UserSettings] Load exception:', error);
    return { settings: null, error: error as Error };
  }
};
