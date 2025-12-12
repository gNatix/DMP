import { supabase } from '../auth/supabaseClient';
import type { Scene } from '../types';

export interface SupabaseScene {
  id: string;
  user_id: string;
  name: string;
  background_map_url: string | null;
  background_map_name: string | null;
  collection_id: string | null;
  elements: any;
  terrain_tiles: any;
  created_at: string;
  updated_at: string;
}

/**
 * Save a scene to Supabase
 * CRITICAL: Requires valid UUID for user_id - RLS policies will block invalid IDs
 */
export const saveSceneToSupabase = async (scene: Scene, userId: string): Promise<{ error: Error | null }> => {
  try {
    // Validate userId is a UUID before attempting save
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[Supabase] ❌ CRITICAL: Invalid userId provided:', typeof userId, userId);
      return { error: new Error('Invalid user ID - must be a valid UUID') };
    }

    const sceneData = {
      id: scene.id,
      user_id: userId,
      name: scene.name,
      background_map_url: scene.backgroundMapUrl || null,
      background_map_name: scene.backgroundMapName || null,
      collection_id: scene.collectionId || null,
      elements: scene.elements || [],
      terrain_tiles: scene.terrainTiles || {},
    };

    console.log('[Supabase] Saving scene:', scene.name, 'with user_id:', userId);
    console.log("[DEBUG RAW SCENE OBJECT]", scene);
    console.log("[DEBUG PAYLOAD]", sceneData);

    const { data, error } = await supabase
      .from('scenes')
      .upsert(sceneData, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase] ❌ Save FAILED:', error.message);
      console.error('[Supabase] Error code:', error.code);
      if (error.hint) console.error('[Supabase] Hint:', error.hint);
      console.error("[Supabase ERROR OBJECT] =>", error);
      return { error };
    }

    console.log('[Supabase] ✅ Scene saved successfully');
    return { error: null };
  } catch (error) {
    console.error('[Supabase] Save exception:', error);
    return { error: error as Error };
  }
};

/**
 * Load all scenes for a user from Supabase
 */
export const loadScenesFromSupabase = async (userId: string): Promise<{ scenes: Scene[] | null; error: Error | null }> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[Supabase] ❌ CRITICAL: Invalid userId for load:', userId);
      return { scenes: null, error: new Error('Invalid user ID') };
    }

    const { data, error } = await supabase
      .from('scenes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Load error:', error.message);
      return { scenes: null, error };
    }

    const scenes: Scene[] = (data || []).map((row: SupabaseScene) => ({
      id: row.id,
      name: row.name,
      backgroundMapUrl: row.background_map_url || '',
      backgroundMapName: row.background_map_name || '',
      collectionId: row.collection_id || undefined,
      elements: row.elements || [],
      terrainTiles: row.terrain_tiles || {},
      width: 5000, // Default canvas width
      height: 5000, // Default canvas height
    }));

    console.log('[Supabase] Loaded', scenes.length, 'scenes');
    return { scenes, error: null };
  } catch (error) {
    console.error('[Supabase] Load exception:', error);
    return { scenes: null, error: error as Error };
  }
};

/**
 * Delete a scene from Supabase
 */
export const deleteSceneFromSupabase = async (sceneId: string, userId: string): Promise<{ error: Error | null }> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[Supabase] ❌ CRITICAL: Invalid userId for delete:', userId);
      return { error: new Error('Invalid user ID') };
    }

    console.log('[Supabase] Deleting scene:', sceneId);

    const { error } = await supabase
      .from('scenes')
      .delete()
      .eq('id', sceneId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Delete error:', error);
      return { error };
    }

    console.log('[Supabase] Scene deleted successfully');
    return { error: null };
  } catch (error) {
    console.error('[Supabase] Delete exception:', error);
    return { error: error as Error };
  }
};

/**
 * Sync local scenes to Supabase
 * Uploads all scenes that don't exist in cloud yet
 */
export const syncLocalScenesToSupabase = async (localScenes: Scene[], userId: string): Promise<{ error: Error | null }> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      console.error('[Supabase] ❌ CRITICAL: Invalid userId for sync:', userId);
      return { error: new Error('Invalid user ID') };
    }

    console.log('[Supabase] Syncing', localScenes.length, 'local scenes to cloud');

    // Get existing scene IDs from Supabase
    const { data: existingScenes } = await supabase
      .from('scenes')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existingScenes || []).map((s: any) => s.id));

    // Upload scenes that don't exist in cloud
    const scenesToUpload = localScenes.filter(scene => !existingIds.has(scene.id));

    if (scenesToUpload.length === 0) {
      console.log('[Supabase] All scenes already in cloud');
      return { error: null };
    }

    console.log('[Supabase] Uploading', scenesToUpload.length, 'new scenes');

    for (const scene of scenesToUpload) {
      await saveSceneToSupabase(scene, userId);
    }

    console.log('[Supabase] Sync complete');
    return { error: null };
  } catch (error) {
    console.error('[Supabase] Sync exception:', error);
    return { error: error as Error };
  }
};
