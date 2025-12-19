/**
 * Texture Preloading Utility
 * 
 * Preloads texture images into browser cache during loading screen
 * so they're instantly available when user opens Draw tab.
 */

// Cache to track what's been preloaded
let preloadedTerrainBrushes = false;
let preloadedWallTextures = false;

/**
 * Preload an array of image URLs into browser cache
 */
const preloadImages = (urls: string[]): void => {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

/**
 * Preload terrain brush textures
 */
export const preloadTerrainBrushes = (brushes: { name: string; download_url: string }[]): void => {
  if (preloadedTerrainBrushes || brushes.length === 0) return;
  
  console.log(`[Preload] Preloading ${brushes.length} terrain brushes...`);
  preloadImages(brushes.map(b => b.download_url));
  preloadedTerrainBrushes = true;
};

/**
 * Preload wall textures
 */
export const preloadWallTextures = (textures: { name: string; download_url: string }[]): void => {
  if (preloadedWallTextures || textures.length === 0) return;
  
  console.log(`[Preload] Preloading ${textures.length} wall textures...`);
  preloadImages(textures.map(t => t.download_url));
  preloadedWallTextures = true;
};

/**
 * Reset preload flags (useful for testing)
 */
export const resetTexturePreloadFlags = (): void => {
  preloadedTerrainBrushes = false;
  preloadedWallTextures = false;
};
