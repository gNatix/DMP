import { supabase } from '../auth/supabaseClient';
import type { Scene, Collection } from '../types';

/**
 * Deleted Items Service (Trash/Recycle Bin)
 * 
 * Handles moving items to trash and restoring them:
 * - Scenes (maps/canvases)
 * - Collections
 * 
 * Items are stored for 30 days before permanent deletion.
 */

export type DeletedItemType = 'scene' | 'collection';

export interface DeletedItem {
  id: string;
  user_id: string;
  item_type: DeletedItemType;
  original_id: string;
  name: string;
  data: Scene | Collection;
  deleted_at: string;
  expires_at: string;
}

/**
 * Move a scene to trash
 */
export const moveSceneToTrash = async (
  scene: Scene,
  userId: string
): Promise<{ error: Error | null }> => {
  try {
    // First, insert into deleted_items
    const { error: insertError } = await supabase
      .from('deleted_items')
      .insert({
        user_id: userId,
        item_type: 'scene',
        original_id: scene.id,
        name: scene.name,
        data: scene,
      });

    if (insertError) {
      console.error('[DeletedItems] Failed to move scene to trash:', insertError.message);
      return { error: insertError };
    }

    // Then delete from scenes table
    const { error: deleteError } = await supabase
      .from('scenes')
      .delete()
      .eq('id', scene.id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[DeletedItems] Failed to delete original scene:', deleteError.message);
      // Try to rollback the insert
      await supabase.from('deleted_items').delete().eq('original_id', scene.id).eq('user_id', userId);
      return { error: deleteError };
    }

    console.log('[DeletedItems] Scene moved to trash:', scene.name);
    return { error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception moving scene to trash:', error);
    return { error: error as Error };
  }
};

/**
 * Move a collection to trash (including all scenes in it)
 */
export const moveCollectionToTrash = async (
  collection: Collection,
  scenesInCollection: Scene[],
  userId: string
): Promise<{ error: Error | null }> => {
  try {
    // Store collection with embedded scenes for full recovery
    const collectionWithScenes = {
      ...collection,
      _deletedScenes: scenesInCollection,
    };

    // Insert collection into deleted_items
    const { error: insertError } = await supabase
      .from('deleted_items')
      .insert({
        user_id: userId,
        item_type: 'collection',
        original_id: collection.id,
        name: collection.name,
        data: collectionWithScenes,
      });

    if (insertError) {
      console.error('[DeletedItems] Failed to move collection to trash:', insertError.message);
      return { error: insertError };
    }

    // Delete all scenes in collection from scenes table
    for (const scene of scenesInCollection) {
      const { error: deleteError } = await supabase
        .from('scenes')
        .delete()
        .eq('id', scene.id)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[DeletedItems] Failed to delete scene from collection:', deleteError.message);
        // Continue anyway - partial cleanup is better than none
      }
    }

    console.log('[DeletedItems] Collection moved to trash:', collection.name, `(${scenesInCollection.length} scenes)`);
    return { error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception moving collection to trash:', error);
    return { error: error as Error };
  }
};

/**
 * Get IDs of all deleted items for filtering during load
 * Returns sets of deleted scene IDs and collection IDs
 */
export const getDeletedItemIds = async (
  userId: string
): Promise<{ 
  deletedSceneIds: Set<string>; 
  deletedCollectionIds: Set<string>; 
  error: Error | null 
}> => {
  try {
    const { data, error } = await supabase
      .from('deleted_items')
      .select('item_type, original_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[DeletedItems] Failed to get deleted item IDs:', error.message);
      return { deletedSceneIds: new Set(), deletedCollectionIds: new Set(), error };
    }

    const deletedSceneIds = new Set<string>();
    const deletedCollectionIds = new Set<string>();

    for (const item of data || []) {
      if (item.item_type === 'scene') {
        deletedSceneIds.add(item.original_id);
      } else if (item.item_type === 'collection') {
        deletedCollectionIds.add(item.original_id);
      }
    }

    console.log('[DeletedItems] Found deleted items:', {
      scenes: deletedSceneIds.size,
      collections: deletedCollectionIds.size
    });

    return { deletedSceneIds, deletedCollectionIds, error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception getting deleted item IDs:', error);
    return { deletedSceneIds: new Set(), deletedCollectionIds: new Set(), error: error as Error };
  }
};

/**
 * Get all deleted items for a user (for displaying in trash UI)
 */
export const getDeletedItems = async (
  userId: string
): Promise<{ items: DeletedItem[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('deleted_items')
      .select('*')
      .eq('user_id', userId)
      .order('deleted_at', { ascending: false });

    if (error) {
      console.error('[DeletedItems] Failed to get deleted items:', error.message);
      return { items: null, error };
    }

    return { items: data as DeletedItem[], error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception getting deleted items:', error);
    return { items: null, error: error as Error };
  }
};

/**
 * Permanently delete an item from trash
 */
export const permanentlyDeleteItem = async (
  itemId: string,
  userId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('deleted_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      console.error('[DeletedItems] Failed to permanently delete:', error.message);
      return { error };
    }

    console.log('[DeletedItems] Item permanently deleted');
    return { error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception permanently deleting:', error);
    return { error: error as Error };
  }
};

/**
 * Restore a scene from trash
 */
export const restoreSceneFromTrash = async (
  deletedItem: DeletedItem,
  userId: string
): Promise<{ scene: Scene | null; error: Error | null }> => {
  try {
    if (deletedItem.item_type !== 'scene') {
      return { scene: null, error: new Error('Item is not a scene') };
    }

    const scene = deletedItem.data as Scene;

    // Re-insert scene into scenes table
    const { error: insertError } = await supabase
      .from('scenes')
      .insert({
        id: scene.id,
        user_id: userId,
        name: scene.name,
        background_map_url: scene.backgroundMapUrl,
        background_map_name: scene.backgroundMapName,
        collection_id: scene.collectionId,
        elements: scene.elements,
        terrain_tiles: (scene as any).terrainTiles || {},
        modular_rooms_state: (scene as any).modularRoomsState || { doors: [], wallGroups: [] },
        width: scene.width || 5000,
        height: scene.height || 5000,
      });

    if (insertError) {
      console.error('[DeletedItems] Failed to restore scene:', insertError.message);
      return { scene: null, error: insertError };
    }

    // Remove from deleted_items
    await supabase.from('deleted_items').delete().eq('id', deletedItem.id).eq('user_id', userId);

    console.log('[DeletedItems] Scene restored:', scene.name);
    return { scene, error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception restoring scene:', error);
    return { scene: null, error: error as Error };
  }
};

/**
 * Restore a collection from trash (including all its scenes)
 */
export const restoreCollectionFromTrash = async (
  deletedItem: DeletedItem,
  userId: string
): Promise<{ collection: Collection | null; scenes: Scene[] | null; error: Error | null }> => {
  try {
    if (deletedItem.item_type !== 'collection') {
      return { collection: null, scenes: null, error: new Error('Item is not a collection') };
    }

    const dataWithScenes = deletedItem.data as Collection & { _deletedScenes?: Scene[] };
    const { _deletedScenes, ...collection } = dataWithScenes;
    const scenes = _deletedScenes || [];

    // Restore all scenes in the collection
    for (const scene of scenes) {
      const { error: insertError } = await supabase
        .from('scenes')
        .insert({
          id: scene.id,
          user_id: userId,
          name: scene.name,
          background_map_url: scene.backgroundMapUrl,
          background_map_name: scene.backgroundMapName,
          collection_id: scene.collectionId,
          elements: scene.elements,
          terrain_tiles: (scene as any).terrainTiles || {},
          modular_rooms_state: (scene as any).modularRoomsState || { doors: [], wallGroups: [] },
          width: scene.width || 5000,
          height: scene.height || 5000,
        });

      if (insertError) {
        console.error('[DeletedItems] Failed to restore scene in collection:', insertError.message);
        // Continue anyway
      }
    }

    // Remove from deleted_items
    await supabase.from('deleted_items').delete().eq('id', deletedItem.id).eq('user_id', userId);

    console.log('[DeletedItems] Collection restored:', collection.name, `(${scenes.length} scenes)`);
    return { collection, scenes, error: null };
  } catch (error) {
    console.error('[DeletedItems] Exception restoring collection:', error);
    return { collection: null, scenes: null, error: error as Error };
  }
};
