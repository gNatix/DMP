/**
 * Modular Rooms Utility Functions
 * 
 * This module provides utility functions for the modular rooms system:
 * - Asset path resolution
 * - Adjacency calculation between rooms
 * - Wall group management (connected components)
 * - Wall run generation
 * - Pillar placement
 * - Door management
 * - Drop simulation for preview
 */

import {
  ModularRoomElement,
  WallGroup,
  ModularDoor,
  ModularRoomsState,
  ModularDropSimulation,
  MapElement,
  SegmentState,
  SegmentPattern,
  SegmentStatesMap,
  EdgeKey,
  WallSegmentGroup,
  EdgeDoor,
  EdgeDoorsMap,
  RenderPiece,
} from '../types';

import {
  MODULAR_TILE_PX,
  MODULAR_WALL_THICKNESS_PX,
  MODULAR_WALL_SPRITE_2TILE_WIDTH,
  MODULAR_ASSETS_BASE_URL,
  MODULAR_FLOORS_PATH,
  MODULAR_WALLS_PATH,
  DEFAULT_WALL_STYLE_ID,
} from '../constants';

// Debug flag for door/segment state logging
const DEBUG_DOORS = true;

// Verify module load
console.log('[modularRooms.ts] Module loaded, DEBUG_DOORS =', DEBUG_DOORS);

// ============================================
// ASSET PATH RESOLVER
// ============================================

/**
 * Get the URL for a modular floor image
 */
export function getFloorImageUrl(floorStyleId: string, tilesW: number, tilesH: number): string {
  return `${MODULAR_ASSETS_BASE_URL}/${MODULAR_FLOORS_PATH}/${floorStyleId}/floor_${tilesW}x${tilesH}.png`;
}

/**
 * Get the URL for a wall sprite
 * @param tiles - 0.5 for 64px, 1 for 128px, 2 for 256px
 */
export function getWallSpriteUrl(wallStyleId: string, tiles: 0.5 | 1 | 2): string {
  const width = tiles === 2 ? 256 : tiles === 1 ? 128 : 64;
  return `${MODULAR_ASSETS_BASE_URL}/${MODULAR_WALLS_PATH}/${wallStyleId}/wall_${width}x32.png`;
}

/**
 * Get the URL for a pillar sprite
 */
export function getPillarSpriteUrl(wallStyleId: string): string {
  return `${MODULAR_ASSETS_BASE_URL}/${MODULAR_WALLS_PATH}/${wallStyleId}/pillar_64x64.png`;
}

/**
 * Get the URL for a door overlay sprite
 */
export function getDoorSpriteUrl(wallStyleId: string): string {
  return `${MODULAR_ASSETS_BASE_URL}/${MODULAR_WALLS_PATH}/${wallStyleId}/closed_door_128x32.png`;
}

/**
 * Get the API URL to list floor styles (folders)
 */
export function getFloorStylesApiUrl(): string {
  // Add cache-busting parameter to avoid stale data
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_FLOORS_PATH}&_t=${Date.now()}`;
}

/**
 * Get the API URL to list wall styles (folders)
 */
export function getWallStylesApiUrl(): string {
  // Add cache-busting parameter to avoid stale data
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_WALLS_PATH}&_t=${Date.now()}`;
}

/**
 * Get the API URL to list floor images within a style
 */
export function getFloorImagesApiUrl(floorStyleId: string): string {
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_FLOORS_PATH}/${floorStyleId}`;
}

/**
 * Get the API URL to list wall assets within a style
 */
export function getWallAssetsApiUrl(wallStyleId: string): string {
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_WALLS_PATH}/${wallStyleId}`;
}

// ============================================
// FREE-PLACEMENT DOOR SYSTEM (NEW)
// ============================================
// This system allows doors to be placed at any 64px position along an edge.
// Wall pieces (256, 128, 64px) are dynamically generated to fill gaps.
// Door positions are stored relative to edge, so they persist when rooms move.

const DOOR_WIDTH_PX = 128;
const MIN_WALL_PIECE_PX = 64;
const PILLAR_MARGIN_PX = 64;  // Minimum distance from edge corners (pillars)

/**
 * Generate a stable edge ID from a PerimeterEdge
 * 
 * For EXTERNAL edges (only 1 room): Uses ROOM-RELATIVE coordinates
 *   Format: "h|roomA|side:length" where side is N/S/E/W and length is edge length in tiles
 *   This ensures doors follow the room when it moves or changes groups
 * 
 * For INTERNAL edges (2 rooms): Uses absolute geometry (both rooms must stay adjacent)
 *   Format: "h|roomA+roomB|pos:range"
 * 
 * Room IDs are sorted for consistency.
 */
export function getEdgeId(edge: PerimeterEdge, _edgeIndex: number, rooms?: ModularRoomElement[]): string {
  const o = edge.orientation === 'horizontal' ? 'h' : 'v';
  const roomIds = [edge.roomAId, edge.roomBId].filter(Boolean).sort();
  const isExternal = roomIds.length === 1;
  
  if (isExternal && rooms) {
    // EXTERNAL edge: use room-relative coordinates
    const room = rooms.find(r => r.id === roomIds[0]);
    if (room) {
      const roomX = room.x / MODULAR_TILE_PX;
      const roomY = room.y / MODULAR_TILE_PX;
      const roomRight = roomX + room.tilesW;
      const roomBottom = roomY + room.tilesH;
      
      let side: string;
      if (edge.orientation === 'horizontal') {
        // Check if this is top or bottom of room
        if (Math.abs(edge.position - roomY) < 0.1) {
          side = 'N'; // North (top)
        } else if (Math.abs(edge.position - roomBottom) < 0.1) {
          side = 'S'; // South (bottom)
        } else {
          // Edge is somewhere in the middle (shouldn't happen for external)
          side = `y${Math.round(edge.position - roomY)}`;
        }
      } else {
        // Vertical edge: check if left or right of room
        if (Math.abs(edge.position - roomX) < 0.1) {
          side = 'W'; // West (left)
        } else if (Math.abs(edge.position - roomRight) < 0.1) {
          side = 'E'; // East (right)
        } else {
          side = `x${Math.round(edge.position - roomX)}`;
        }
      }
      
      // Include edge length to differentiate walls of same side but different length
      // Use room-relative range (offset from room corner)
      const rangeLength = Math.round((edge.rangeEnd - edge.rangeStart) * 10) / 10;
      const rangeOffset = edge.orientation === 'horizontal' 
        ? Math.round((edge.rangeStart - roomX) * 10) / 10
        : Math.round((edge.rangeStart - roomY) * 10) / 10;
      
      return `${o}|${roomIds[0]}|${side}:${rangeOffset}+${rangeLength}`;
    }
  }
  
  // INTERNAL edge or no room data: use absolute geometry
  const pos = Math.round(edge.position * 10) / 10;
  const rangeStart = Math.round(edge.rangeStart * 10) / 10;
  const rangeEnd = Math.round(edge.rangeEnd * 10) / 10;
  return `${o}|${roomIds.join('+')}|${pos}:${rangeStart}-${rangeEnd}`;
}

/**
 * Generate wall and door pieces for an edge
 * Uses greedy algorithm: largest pieces first (256 > 128 > 64)
 * 
 * @param edgeLengthPx - Total length of the edge in pixels
 * @param doors - Array of doors on this edge (sorted by offsetPx)
 * @returns Array of render pieces (walls and doors)
 */
export function generateEdgePieces(edgeLengthPx: number, doors: EdgeDoor[]): RenderPiece[] {
  const pieces: RenderPiece[] = [];
  const sortedDoors = [...doors].sort((a, b) => a.offsetPx - b.offsetPx);
  
  let pos = 0;
  
  for (const door of sortedDoors) {
    // Fill wall gap before this door
    fillWallGap(pos, door.offsetPx, pieces);
    
    // Add the door
    pieces.push({ type: 'door', offsetPx: door.offsetPx, widthPx: DOOR_WIDTH_PX });
    pos = door.offsetPx + DOOR_WIDTH_PX;
  }
  
  // Fill remaining wall after last door
  fillWallGap(pos, edgeLengthPx, pieces);
  
  return pieces;
}

/**
 * Fill a gap with wall pieces using largest-first strategy
 * Priority: 256px > 128px > 64px
 */
function fillWallGap(startPx: number, endPx: number, pieces: RenderPiece[]): void {
  let pos = startPx;
  
  while (pos < endPx) {
    const remaining = endPx - pos;
    
    // Choose largest piece that fits
    let width: number;
    if (remaining >= 256) {
      width = 256;
    } else if (remaining >= 128) {
      width = 128;
    } else if (remaining >= 64) {
      width = 64;
    } else {
      // Remaining gap is less than 64px - shouldn't happen with 64px grid
      // But handle gracefully by stopping
      break;
    }
    
    pieces.push({ type: 'wall', offsetPx: pos, widthPx: width });
    pos += width;
  }
}

/**
 * Handle a door tool click on an edge
 * - Snaps to 64px grid
 * - Enforces 64px margin from corners (pillar space)
 * - Toggles door if clicking existing door, otherwise adds new door
 * 
 * @param edge - The edge that was clicked
 * @param edgeIndex - Index of this edge (for stable ID)
 * @param clickOffsetPx - Click position relative to edge start
 * @param edgeDoors - Current door state
 * @param rooms - All rooms (needed for room-relative edge IDs)
 * @returns Updated EdgeDoorsMap
 */
export function handleEdgeDoorClick(
  edge: PerimeterEdge,
  edgeIndex: number,
  clickOffsetPx: number,
  edgeDoors: EdgeDoorsMap,
  rooms: ModularRoomElement[]
): EdgeDoorsMap {
  const edgeId = getEdgeId(edge, edgeIndex, rooms);
  const doors = edgeDoors[edgeId] || [];
  const edgeLengthPx = Math.round((edge.rangeEnd - edge.rangeStart) * MODULAR_TILE_PX);
  
  // SPECIAL CASE: 1-tile edge (128px) - allow door without margin
  // This happens when two rooms share exactly 1 tile of overlap
  // In this case, the door goes under the pillars (pillars stay visible)
  const isSingleTileEdge = edgeLengthPx === DOOR_WIDTH_PX;
  
  // Snap click position to 64px grid
  let doorPos = Math.floor(clickOffsetPx / MIN_WALL_PIECE_PX) * MIN_WALL_PIECE_PX;
  
  if (isSingleTileEdge) {
    // For 1-tile edges, door must start at 0 (only one position possible)
    doorPos = 0;
  } else {
    // Enforce pillar margin: minimum 64px from start
    doorPos = Math.max(PILLAR_MARGIN_PX, doorPos);
    
    // Enforce pillar margin: door end must be at least 64px from edge end
    const maxDoorPos = edgeLengthPx - PILLAR_MARGIN_PX - DOOR_WIDTH_PX;
    doorPos = Math.min(doorPos, maxDoorPos);
    
    // Edge too short for any door (shouldn't happen for multi-tile edges, but safety check)
    if (maxDoorPos < PILLAR_MARGIN_PX) {
      console.log('[handleEdgeDoorClick] Edge too short for door:', edgeLengthPx);
      return edgeDoors;
    }
  }
  
  // Check if click hits an existing door
  const hitIdx = doors.findIndex(d => 
    clickOffsetPx >= d.offsetPx && clickOffsetPx < d.offsetPx + DOOR_WIDTH_PX
  );
  
  if (hitIdx !== -1) {
    // Remove the door (toggle off)
    if (DEBUG_DOORS) {
      console.log('[handleEdgeDoorClick] Removing door at', doors[hitIdx].offsetPx);
    }
    const newDoors = doors.filter((_, i) => i !== hitIdx);
    return { ...edgeDoors, [edgeId]: newDoors };
  }
  
  // Check for overlap with existing doors
  const wouldOverlap = doors.some(d => {
    const newStart = doorPos;
    const newEnd = doorPos + DOOR_WIDTH_PX;
    const existingStart = d.offsetPx;
    const existingEnd = d.offsetPx + DOOR_WIDTH_PX;
    return newStart < existingEnd && newEnd > existingStart;
  });
  
  if (wouldOverlap) {
    if (DEBUG_DOORS) {
      console.log('[handleEdgeDoorClick] Would overlap existing door, skipping');
    }
    return edgeDoors;
  }
  
  // Add new door
  if (DEBUG_DOORS) {
    console.log('[handleEdgeDoorClick] Adding door at', doorPos);
  }
  const newDoor: EdgeDoor = { offsetPx: doorPos, source: 'manual' };
  return { ...edgeDoors, [edgeId]: [...doors, newDoor] };
}

/**
 * Clean up edgeDoors that now conflict with corner positions due to geometry changes.
 * 
 * When rooms are merged or geometry changes, new corners may appear at positions
 * where doors already exist. This function:
 * 1. Removes doors that are within PILLAR_MARGIN_PX (64px) of corners
 * 2. Removes doors on edges that no longer exist
 * 
 * Edge IDs are now geometry-based (position + range), so external wall doors are
 * automatically preserved when rooms split/merge - no migration needed.
 * 
 * Exception: 1-tile edges (128px) are allowed to have doors at position 0.
 * 
 * Call this whenever room geometry changes (merge, rotate, move, split, etc.)
 */
export function cleanupEdgeDoorsForGeometry(
  rooms: ModularRoomElement[],
  edgeDoors: EdgeDoorsMap
): EdgeDoorsMap {
  if (rooms.length === 0 || !edgeDoors || Object.keys(edgeDoors).length === 0) {
    return edgeDoors;
  }
  
  const roomIds = rooms.map(r => r.id);
  const { externalEdges, internalEdges } = getGroupEdges(roomIds, rooms);
  const allEdges = [...externalEdges, ...internalEdges];
  
  // Build a set of current edge IDs for quick lookup
  const currentEdgeIds = new Set<string>();
  for (let edgeIndex = 0; edgeIndex < allEdges.length; edgeIndex++) {
    const edge = allEdges[edgeIndex];
    currentEdgeIds.add(getEdgeId(edge, edgeIndex, rooms));
  }
  
  // Build new edgeDoors map
  const cleanedEdgeDoors: EdgeDoorsMap = {};
  let hasChanges = false;
  
  // Process each old edge ID
  for (const edgeId of Object.keys(edgeDoors)) {
    const doors = edgeDoors[edgeId];
    if (!doors || doors.length === 0) continue;
    
    // Check if this edge still exists
    if (!currentEdgeIds.has(edgeId)) {
      console.log('[cleanupEdgeDoors] Edge no longer exists, removing doors:', edgeId);
      hasChanges = true;
      continue;
    }
    
    // Find the edge to validate door positions
    let matchedEdge: PerimeterEdge | null = null;
    for (let edgeIndex = 0; edgeIndex < allEdges.length; edgeIndex++) {
      const edge = allEdges[edgeIndex];
      if (getEdgeId(edge, edgeIndex, rooms) === edgeId) {
        matchedEdge = edge;
        break;
      }
    }
    
    if (!matchedEdge) {
      // Shouldn't happen since we checked currentEdgeIds, but handle gracefully
      console.log('[cleanupEdgeDoors] Edge not found:', edgeId);
      hasChanges = true;
      continue;
    }
    
    // Validate doors against edge geometry
    const edgeLengthPx = Math.round((matchedEdge.rangeEnd - matchedEdge.rangeStart) * MODULAR_TILE_PX);
    const isSingleTileEdge = edgeLengthPx === DOOR_WIDTH_PX;
    
    const validDoors = doors.filter(door => {
      const doorEndPx = door.offsetPx + DOOR_WIDTH_PX;
      
      // For 1-tile edges, only position 0 is valid
      if (isSingleTileEdge) {
        return door.offsetPx === 0;
      }
      
      // Check if door is too close to start (corner)
      if (door.offsetPx < PILLAR_MARGIN_PX) {
        console.log('[cleanupEdgeDoors] Removing door at', door.offsetPx, '- too close to start corner');
        return false;
      }
      
      // Check if door end is too close to edge end (corner)
      if (doorEndPx > edgeLengthPx - PILLAR_MARGIN_PX) {
        console.log('[cleanupEdgeDoors] Removing door ending at', doorEndPx, '- too close to end corner (edgeLength:', edgeLengthPx, ')');
        return false;
      }
      
      // Check if edge is now too short for this door
      if (edgeLengthPx < DOOR_WIDTH_PX + PILLAR_MARGIN_PX * 2) {
        console.log('[cleanupEdgeDoors] Removing door - edge too short:', edgeLengthPx);
        return false;
      }
      
      return true;
    });
    
    if (validDoors.length !== doors.length) {
      hasChanges = true;
    }
    
    if (validDoors.length > 0) {
      cleanedEdgeDoors[edgeId] = validDoors;
    }
  }
  
  return hasChanges ? cleanedEdgeDoors : edgeDoors;
}

/**
 * Rotate edge doors when a room is rotated.
 * 
 * When a room rotates 90° clockwise (right):
 *   N → E, E → S, S → W, W → N
 * 
 * When a room rotates 90° counter-clockwise (left):
 *   N → W, W → S, S → E, E → N
 * 
 * Door offsets must also be transformed because room dimensions swap.
 * 
 * @param edgeDoors - Current edge doors map
 * @param roomId - The room being rotated
 * @param direction - Rotation direction ('left' or 'right')
 * @param oldTilesW - Room width before rotation (in tiles)
 * @param oldTilesH - Room height before rotation (in tiles)
 * @returns Updated EdgeDoorsMap with rotated door positions
 */
export function rotateEdgeDoorsForRoom(
  edgeDoors: EdgeDoorsMap,
  roomId: string,
  direction: 'left' | 'right',
  oldTilesW: number,
  oldTilesH: number
): EdgeDoorsMap {
  if (!edgeDoors || Object.keys(edgeDoors).length === 0) {
    return edgeDoors;
  }
  
  // New dimensions after rotation
  const newTilesW = oldTilesH;
  const newTilesH = oldTilesW;
  
  // Side rotation mappings
  const rotateRight: Record<string, string> = { 'N': 'E', 'E': 'S', 'S': 'W', 'W': 'N' };
  const rotateLeft: Record<string, string> = { 'N': 'W', 'W': 'S', 'S': 'E', 'E': 'N' };
  const sideMap = direction === 'right' ? rotateRight : rotateLeft;
  
  const newEdgeDoors: EdgeDoorsMap = {};
  
  for (const edgeId of Object.keys(edgeDoors)) {
    const doors = edgeDoors[edgeId];
    if (!doors || doors.length === 0) continue;
    
    // Parse edge ID: format is "h|roomId|side:offset+length" for external walls
    const parts = edgeId.split('|');
    if (parts.length !== 3) {
      // Not matching expected format - keep as-is
      newEdgeDoors[edgeId] = doors;
      continue;
    }
    
    const [_orientationChar, edgeRoomId, sideInfo] = parts;
    
    // Only process doors belonging to the room being rotated
    if (edgeRoomId !== roomId) {
      newEdgeDoors[edgeId] = doors;
      continue;
    }
    
    // Parse side info: "side:offset+length" e.g. "N:0+4"
    const sideMatch = sideInfo.match(/^([NSEW]):(.+)$/);
    if (!sideMatch) {
      // Internal wall or unknown format - keep as-is
      newEdgeDoors[edgeId] = doors;
      continue;
    }
    
    const oldSide = sideMatch[1];
    const rangeInfo = sideMatch[2]; // e.g. "0+4"
    
    // Get new side after rotation
    const newSide = sideMap[oldSide];
    if (!newSide) {
      newEdgeDoors[edgeId] = doors;
      continue;
    }
    
    // Parse range info to get offset and length
    const rangeMatch = rangeInfo.match(/^(-?[\d.]+)\+([\d.]+)$/);
    if (!rangeMatch) {
      newEdgeDoors[edgeId] = doors;
      continue;
    }
    
    const oldRangeOffset = parseFloat(rangeMatch[1]);
    // oldRangeLength not needed - we use newRangeLength based on new dimensions
    
    // Calculate new orientation and range based on side rotation
    // N/S are horizontal (h), E/W are vertical (v)
    const isNewHorizontal = newSide === 'N' || newSide === 'S';
    const newOrientationChar = isNewHorizontal ? 'h' : 'v';
    
    // After rotation, the wall length changes if orientation changes
    // Horizontal walls span tilesW, vertical walls span tilesH
    const newRangeLength = isNewHorizontal ? newTilesW : newTilesH;
    
    // Door offset transformation:
    // When rotating, the door's position along the wall needs to be recalculated
    // because the wall's "start" corner changes
    const newDoors = doors.map(door => {
      const oldOffsetPx = door.offsetPx;
      const newWallLengthPx = newRangeLength * MODULAR_TILE_PX;
      
      let newOffsetPx: number;
      
      // Offset transformation based on which corner the wall "starts" from
      // and where that corner ends up after rotation.
      //
      // Wall start corners (offset 0):
      //   N: TOP-LEFT,  E: TOP-RIGHT,  S: BOTTOM-LEFT,  W: TOP-LEFT
      //
      // Clockwise rotation moves corners:
      //   TOP-LEFT → TOP-RIGHT,  TOP-RIGHT → BOTTOM-RIGHT
      //   BOTTOM-LEFT → TOP-LEFT,  BOTTOM-RIGHT → BOTTOM-LEFT
      //
      // Counter-clockwise rotation moves corners:
      //   TOP-LEFT → BOTTOM-LEFT,  TOP-RIGHT → TOP-LEFT
      //   BOTTOM-LEFT → BOTTOM-RIGHT,  BOTTOM-RIGHT → TOP-RIGHT
      
      if (direction === 'right') {
        // Clockwise rotation
        if (oldSide === 'N') {
          // N→E: N's offset 0 (TOP-LEFT) → E's offset 0 (TOP-RIGHT = old TOP-LEFT). BEVARES!
          newOffsetPx = oldOffsetPx;
        } else if (oldSide === 'E') {
          // E→S: E's offset 0 (TOP-RIGHT) → S's offset max (BOTTOM-RIGHT = old TOP-RIGHT). INVERTERES!
          newOffsetPx = newWallLengthPx - oldOffsetPx - DOOR_WIDTH_PX;
        } else if (oldSide === 'S') {
          // S→W: S's offset 0 (BOTTOM-LEFT) → W's offset 0 (TOP-LEFT = old BOTTOM-LEFT). BEVARES!
          newOffsetPx = oldOffsetPx;
        } else {
          // W→N: W's offset 0 (TOP-LEFT) → N's offset max (TOP-RIGHT = old TOP-LEFT). INVERTERES!
          newOffsetPx = newWallLengthPx - oldOffsetPx - DOOR_WIDTH_PX;
        }
      } else {
        // Counter-clockwise rotation
        if (oldSide === 'N') {
          // N→W: N's offset 0 (TOP-LEFT) → W's offset max (BOTTOM-LEFT = old TOP-LEFT). INVERTERES!
          newOffsetPx = newWallLengthPx - oldOffsetPx - DOOR_WIDTH_PX;
        } else if (oldSide === 'W') {
          // W→S: W's offset 0 (TOP-LEFT) → S's offset 0 (BOTTOM-LEFT = old TOP-LEFT). BEVARES!
          newOffsetPx = oldOffsetPx;
        } else if (oldSide === 'S') {
          // S→E: S's offset 0 (BOTTOM-LEFT) → E's offset max (BOTTOM-RIGHT = old BOTTOM-LEFT). INVERTERES!
          newOffsetPx = newWallLengthPx - oldOffsetPx - DOOR_WIDTH_PX;
        } else {
          // E→N: E's offset 0 (TOP-RIGHT) → N's offset 0 (TOP-LEFT = old TOP-RIGHT). BEVARES!
          newOffsetPx = oldOffsetPx;
        }
      }
      
      // Clamp to valid range
      newOffsetPx = Math.max(0, Math.min(newOffsetPx, newWallLengthPx - DOOR_WIDTH_PX));
      
      return { ...door, offsetPx: newOffsetPx };
    });
    
    // Build new edge ID with rotated side
    // Range offset is typically 0 for full walls, keep it the same
    const newEdgeId = `${newOrientationChar}|${roomId}|${newSide}:${oldRangeOffset}+${newRangeLength}`;
    
    console.log('[rotateEdgeDoors] Rotating doors:', oldSide, '→', newSide, 'edgeId:', edgeId, '→', newEdgeId);
    
    // Merge with any existing doors on this edge
    const existingDoors = newEdgeDoors[newEdgeId] || [];
    newEdgeDoors[newEdgeId] = [...existingDoors, ...newDoors];
  }
  
  return newEdgeDoors;
}

/**
 * Renderable wall piece with absolute position (for ModularRoomRenderer)
 */
export interface RenderableEdgePiece {
  x: number;           // Center X position (absolute)
  y: number;           // Center Y position (absolute)
  widthPx: number;     // Sprite width (256, 128, 64 for walls; 128 for doors)
  heightPx: number;    // Wall thickness (32px)
  rotation: number;    // 0 for horizontal, 90 for vertical
  type: 'wall' | 'door';
  wallStyleId: string;
  edgeId: string;
}

/**
 * Generate all renderable pieces for a room group
 * Combines edge geometry with door positions to create render-ready pieces
 */
export function generateRenderablePiecesFromEdgeDoors(
  rooms: ModularRoomElement[],
  wallGroups: WallGroup[],
  edgeDoors: EdgeDoorsMap
): RenderableEdgePiece[] {
  const pieces: RenderableEdgePiece[] = [];
  
  if (rooms.length === 0) return pieces;
  
  // Get all edges
  const roomIds = rooms.map(r => r.id);
  const { externalEdges, internalEdges } = getGroupEdges(roomIds, rooms);
  const allEdges = [...externalEdges, ...internalEdges];
  
  // Get wall style from first room
  let wallStyleId = DEFAULT_WALL_STYLE_ID;
  if (rooms[0]?.wallGroupId) {
    const wallGroup = wallGroups.find(g => g.id === rooms[0].wallGroupId);
    if (wallGroup) wallStyleId = wallGroup.wallStyleId;
  }
  
  // Process each edge
  allEdges.forEach((edge, edgeIndex) => {
    const edgeId = getEdgeId(edge, edgeIndex, rooms);
    const doors = edgeDoors[edgeId] || [];
    
    const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const edgeEndPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const edgeLengthPx = edgeEndPx - edgeStartPx;
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Generate pieces for this edge
    const edgePieces = generateEdgePieces(edgeLengthPx, doors);
    
    // Convert to absolute positions
    for (const piece of edgePieces) {
      let x: number, y: number;
      
      if (edge.orientation === 'horizontal') {
        x = edgeStartPx + piece.offsetPx + piece.widthPx / 2;
        y = positionPx;
      } else {
        x = positionPx;
        y = edgeStartPx + piece.offsetPx + piece.widthPx / 2;
      }
      
      pieces.push({
        x,
        y,
        widthPx: piece.widthPx,
        heightPx: MODULAR_WALL_THICKNESS_PX,
        rotation: edge.orientation === 'vertical' ? 90 : 0,
        type: piece.type,
        wallStyleId,
        edgeId,
      });
    }
  });
  
  return pieces;
}

/**
 * Check if a position is inside any door (for pillar generation)
 */
export function isPositionInEdgeDoor(
  x: number,
  y: number,
  rooms: ModularRoomElement[],
  edgeDoors: EdgeDoorsMap
): boolean {
  if (rooms.length === 0) return false;
  
  const roomIds = rooms.map(r => r.id);
  const { externalEdges, internalEdges } = getGroupEdges(roomIds, rooms);
  const allEdges = [...externalEdges, ...internalEdges];
  
  for (let edgeIndex = 0; edgeIndex < allEdges.length; edgeIndex++) {
    const edge = allEdges[edgeIndex];
    const edgeId = getEdgeId(edge, edgeIndex, rooms);
    const doors = edgeDoors[edgeId] || [];
    
    if (doors.length === 0) continue;
    
    const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    for (const door of doors) {
      const doorStartPx = edgeStartPx + door.offsetPx;
      const doorEndPx = doorStartPx + DOOR_WIDTH_PX;
      
      if (edge.orientation === 'horizontal') {
        // Check if point is on horizontal edge and within door range
        if (Math.abs(y - positionPx) < 2 && x > doorStartPx && x < doorEndPx) {
          return true;
        }
      } else {
        // Check if point is on vertical edge and within door range
        if (Math.abs(x - positionPx) < 2 && y > doorStartPx && y < doorEndPx) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if a pillar at position (x, y) should be hidden because a door overlaps it.
 * A pillar should be hidden if ANY door touches any of its 3 adjacent positions:
 * - The pillar's exact position (door covers it)
 * - 64px before (door ends at pillar)
 * - 64px after (door starts at pillar)
 * 
 * This is different from isPositionInEdgeDoor which checks strict interior only.
 */
export function isPillarBlockedByEdgeDoor(
  x: number,
  y: number,
  rooms: ModularRoomElement[],
  edgeDoors: EdgeDoorsMap
): boolean {
  if (rooms.length === 0 || !edgeDoors || Object.keys(edgeDoors).length === 0) return false;
  
  const roomIds = rooms.map(r => r.id);
  const { externalEdges, internalEdges } = getGroupEdges(roomIds, rooms);
  const allEdges = [...externalEdges, ...internalEdges];
  
  for (let edgeIndex = 0; edgeIndex < allEdges.length; edgeIndex++) {
    const edge = allEdges[edgeIndex];
    const edgeId = getEdgeId(edge, edgeIndex, rooms);
    const doors = edgeDoors[edgeId] || [];
    
    if (doors.length === 0) continue;
    
    // SPECIAL CASE: 1-tile edge (128px) - door goes UNDER pillars, don't block them
    const edgeLengthPx = Math.round((edge.rangeEnd - edge.rangeStart) * MODULAR_TILE_PX);
    if (edgeLengthPx === DOOR_WIDTH_PX) {
      continue; // Skip this edge - pillars stay visible on 1-tile edges
    }
    
    const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    for (const door of doors) {
      const doorStartPx = edgeStartPx + door.offsetPx;
      const doorEndPx = doorStartPx + DOOR_WIDTH_PX;
      
      if (edge.orientation === 'horizontal') {
        // Check if pillar is on this horizontal edge
        if (Math.abs(y - positionPx) < 2) {
          // Pillar should be hidden if door covers any of its 3 adjacent positions:
          // 1. Door covers pillar exactly (pillar is between door start and end)
          // 2. Door ends at pillar (doorEndPx == x)
          // 3. Door starts at pillar (doorStartPx == x)
          if (x >= doorStartPx && x <= doorEndPx) {
            return true;
          }
        }
      } else {
        // Check if pillar is on this vertical edge
        if (Math.abs(x - positionPx) < 2) {
          // Same logic for vertical edges (y is the range axis)
          if (y >= doorStartPx && y <= doorEndPx) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// ============================================
// GEOMETRY HELPERS
// ============================================

/**
 * Convert tile coordinates to pixel coordinates
 */
export function tilesToPixels(tiles: number): number {
  return tiles * MODULAR_TILE_PX;
}

/**
 * Convert pixel coordinates to tile coordinates (with snap)
 */
export function pixelsToTiles(pixels: number): number {
  return Math.round(pixels / MODULAR_TILE_PX);
}

/**
 * Snap pixel coordinates to the nearest tile grid
 */
export function snapToTileGrid(pixels: number): number {
  return Math.round(pixels / MODULAR_TILE_PX) * MODULAR_TILE_PX;
}

/**
 * Get the bounding box of a modular room in tile coordinates
 */
export interface TileRect {
  x: number; // Left tile
  y: number; // Top tile
  w: number; // Width in tiles
  h: number; // Height in tiles
}

export function getRoomTileRect(room: ModularRoomElement): TileRect {
  // Rooms now store pixel positions directly.
  // For tile calculations (walls, adjacency), we use the room's pixel position
  // divided by tile size. This preserves exact alignment.
  return {
    x: room.x / MODULAR_TILE_PX,
    y: room.y / MODULAR_TILE_PX,
    w: room.tilesW,
    h: room.tilesH,
  };
}

/**
 * Get the bounding box of a modular room in pixels
 */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getRoomPixelRect(room: ModularRoomElement): PixelRect {
  // Position is already in pixels
  return {
    x: room.x,
    y: room.y,
    w: room.tilesW * MODULAR_TILE_PX,
    h: room.tilesH * MODULAR_TILE_PX,
  };
}

// ============================================
// SIMPLE DOOR SYSTEM (WallSegmentGroup.id based)
// ============================================

/**
 * Segment size constants
 */
export const SEGMENT_SIZE_PX = 256;
export const SEGMENT_SIZE_TILES = 2;
export const HALF_SEGMENT_PX = 128; // Left/Right tile boundary

/**
 * Get the door state for a wall segment group
 * Returns default SOLID_256 if no state exists
 */
export function getSegmentState(
  segmentStates: SegmentStatesMap,
  wallSegmentGroupId: string
): SegmentState {
  return segmentStates[wallSegmentGroupId] || { pattern: 'SOLID_256', source: 'auto' };
}

/**
 * Set the door state for a wall segment group
 * Returns a new SegmentStatesMap (immutable update)
 */
export function setSegmentState(
  segmentStates: SegmentStatesMap,
  wallSegmentGroupId: string,
  newState: SegmentState
): SegmentStatesMap {
  return {
    ...segmentStates,
    [wallSegmentGroupId]: newState,
  };
}

/**
 * Determine if click is on left tile (A+B: 0-128px) or right tile (C+D: 128-256px)
 * 
 * Segment layout (256px total):
 *   A (0-64) | B (64-128) | C (128-192) | D (192-256)
 *   <-- Left Tile (128px) --> <-- Right Tile (128px) -->
 * 
 * @param offsetPx - Offset in pixels from segment start (0-256)
 * @returns 'left' or 'right'
 */
export function getClickSide(offsetPx: number): 'left' | 'right' {
  // Clamp to segment bounds
  const clampedOffset = Math.max(0, Math.min(offsetPx, SEGMENT_SIZE_PX - 1));
  return clampedOffset < HALF_SEGMENT_PX ? 'left' : 'right';
}

/**
 * Toggle door on left tile (A+B area)
 * Follows the toggle rules:
 * - SOLID_256 -> DOOR_LEFT
 * - DOOR_LEFT -> SOLID_256 (toggle off)
 * - DOOR_RIGHT -> DOOR_BOTH (add left door)
 * - DOOR_BOTH -> DOOR_RIGHT (remove left door)
 * - DOOR_CENTER -> DOOR_LEFT (replace center with left)
 */
export function toggleLeftDoor(currentState: SegmentState): SegmentState {
  let newPattern: SegmentPattern;
  
  switch (currentState.pattern) {
    case 'SOLID_256':
      newPattern = 'DOOR_LEFT';
      break;
    case 'DOOR_LEFT':
      newPattern = 'SOLID_256';
      break;
    case 'DOOR_RIGHT':
      newPattern = 'DOOR_BOTH';
      break;
    case 'DOOR_BOTH':
      newPattern = 'DOOR_RIGHT';
      break;
    case 'DOOR_CENTER':
      newPattern = 'DOOR_LEFT';
      break;
    default:
      newPattern = 'DOOR_LEFT';
  }
  
  return { pattern: newPattern, source: 'manual' };
}

/**
 * Toggle door on right tile (C+D area)
 * Follows the toggle rules:
 * - SOLID_256 -> DOOR_RIGHT
 * - DOOR_RIGHT -> SOLID_256 (toggle off)
 * - DOOR_LEFT -> DOOR_BOTH (add right door)
 * - DOOR_BOTH -> DOOR_LEFT (remove right door)
 * - DOOR_CENTER -> DOOR_RIGHT (replace center with right)
 */
export function toggleRightDoor(currentState: SegmentState): SegmentState {
  let newPattern: SegmentPattern;
  
  switch (currentState.pattern) {
    case 'SOLID_256':
      newPattern = 'DOOR_RIGHT';
      break;
    case 'DOOR_RIGHT':
      newPattern = 'SOLID_256';
      break;
    case 'DOOR_LEFT':
      newPattern = 'DOOR_BOTH';
      break;
    case 'DOOR_BOTH':
      newPattern = 'DOOR_LEFT';
      break;
    case 'DOOR_CENTER':
      newPattern = 'DOOR_RIGHT';
      break;
    default:
      newPattern = 'DOOR_RIGHT';
  }
  
  return { pattern: newPattern, source: 'manual' };
}

/**
 * Handle a door tool click on a wall segment group
 * 
 * Simple flow:
 * 1. Get click offset within the segment
 * 2. Determine left or right side
 * 3. If at a corner (isAtEdgeStart/isAtEdgeEnd), use DOOR_CENTER to avoid pillar overlap
 * 4. Toggle the appropriate door
 * 5. Return updated segment states
 * 
 * @param wallSegmentGroup - The segment that was clicked
 * @param clickOffsetPx - Offset from segment start (0 to rangeEnd-rangeStart)
 * @param segmentStates - Current segment states
 * @returns Updated segment states
 */
export function handleDoorToolClick(
  wallSegmentGroup: WallSegmentGroup,
  clickOffsetPx: number,
  segmentStates: SegmentStatesMap
): SegmentStatesMap {
  const groupId = wallSegmentGroup.id;
  const currentState = getSegmentState(segmentStates, groupId);
  const clickSide = getClickSide(clickOffsetPx);
  
  // Check if this segment is at a corner (edge start or end)
  const isAtCorner = wallSegmentGroup.isAtEdgeStart || wallSegmentGroup.isAtEdgeEnd;
  
  let newState: SegmentState;
  
  if (isAtCorner && currentState.pattern === 'SOLID_256') {
    // At a corner with no door - use DOOR_CENTER to keep door away from pillar
    newState = { pattern: 'DOOR_CENTER', source: 'manual' };
  } else if (isAtCorner && currentState.pattern === 'DOOR_CENTER') {
    // Toggle off the center door
    newState = { pattern: 'SOLID_256', source: 'manual' };
  } else {
    // Normal toggle based on click side
    newState = clickSide === 'left' 
      ? toggleLeftDoor(currentState)
      : toggleRightDoor(currentState);
  }
  
  if (DEBUG_DOORS) {
    console.log('[handleDoorToolClick] Toggle:', {
      groupId,
      clickOffsetPx,
      clickSide,
      isAtCorner,
      oldPattern: currentState.pattern,
      newPattern: newState.pattern,
    });
  }
  
  return setSegmentState(segmentStates, groupId, newState);
}

/**
 * Create auto-door for a wall segment group (internal walls between rooms)
 * Only sets state if no manual state exists
 * 
 * @param segmentStates - Current segment states
 * @param wallSegmentGroupId - The segment to set
 * @returns Updated segment states (unchanged if manual state exists)
 */
export function createAutoDoor(
  segmentStates: SegmentStatesMap,
  wallSegmentGroupId: string
): SegmentStatesMap {
  const existing = segmentStates[wallSegmentGroupId];
  
  // Never override manual states
  if (existing?.source === 'manual') {
    return segmentStates;
  }
  
  // Set auto door on left tile
  return setSegmentState(segmentStates, wallSegmentGroupId, {
    pattern: 'DOOR_LEFT',
    source: 'auto',
  });
}

/**
 * Get door openings for a wall segment group (for rendering)
 * Returns array of { startPx, endPx } relative to segment start
 */
export function getDoorOpenings(
  segmentStates: SegmentStatesMap,
  wallSegmentGroup: WallSegmentGroup
): { startPx: number; endPx: number; isLeftDoor: boolean }[] {
  const state = getSegmentState(segmentStates, wallSegmentGroup.id);
  const openings: { startPx: number; endPx: number; isLeftDoor: boolean }[] = [];
  
  switch (state.pattern) {
    case 'DOOR_LEFT':
      openings.push({ startPx: 0, endPx: 128, isLeftDoor: true });
      break;
    case 'DOOR_RIGHT':
      openings.push({ startPx: 128, endPx: 256, isLeftDoor: false });
      break;
    case 'DOOR_BOTH':
      openings.push({ startPx: 0, endPx: 128, isLeftDoor: true });
      openings.push({ startPx: 128, endPx: 256, isLeftDoor: false });
      break;
    case 'DOOR_CENTER':
      openings.push({ startPx: 64, endPx: 192, isLeftDoor: true }); // Center door
      break;
    // SOLID_256 has no openings
  }
  
  return openings;
}

/**
 * Segment tile piece - represents one visual element in a segment
 */
export interface SegmentTilePiece {
  type: 'wall' | 'door';      // What sprite type to use
  offsetPx: number;           // Offset from segment start (0, 64, 128, 192)
  widthPx: number;            // Width of this piece (64 or 128)
}

/**
 * Get the visual composition of a wall segment based on its state
 * Returns array of pieces that together form the 256px segment
 * 
 * Compositions:
 * - SOLID_256: [wall_256] or [wall_128, wall_128]
 * - DOOR_LEFT: [door_128, wall_128]  (A+B=door, C+D=wall)
 * - DOOR_RIGHT: [wall_128, door_128] (A+B=wall, C+D=door)
 * - DOOR_BOTH: [door_128, door_128]  (two doors)
 * - DOOR_CENTER: [wall_64, door_128, wall_64] (A=wall, B+C=door, D=wall)
 */
export function getSegmentComposition(
  segmentStates: SegmentStatesMap,
  wallSegmentGroupId: string
): SegmentTilePiece[] {
  const state = getSegmentState(segmentStates, wallSegmentGroupId);
  
  switch (state.pattern) {
    case 'SOLID_256':
      // Full wall - use two 128px wall pieces for compatibility
      return [
        { type: 'wall', offsetPx: 0, widthPx: 128 },
        { type: 'wall', offsetPx: 128, widthPx: 128 },
      ];
    
    case 'DOOR_LEFT':
      // Left door (0-128), right wall (128-256)
      return [
        { type: 'door', offsetPx: 0, widthPx: 128 },
        { type: 'wall', offsetPx: 128, widthPx: 128 },
      ];
    
    case 'DOOR_RIGHT':
      // Left wall (0-128), right door (128-256)
      return [
        { type: 'wall', offsetPx: 0, widthPx: 128 },
        { type: 'door', offsetPx: 128, widthPx: 128 },
      ];
    
    case 'DOOR_BOTH':
      // Two doors side by side
      return [
        { type: 'door', offsetPx: 0, widthPx: 128 },
        { type: 'door', offsetPx: 128, widthPx: 128 },
      ];
    
    case 'DOOR_CENTER':
      // Center door with wall pieces on sides
      return [
        { type: 'wall', offsetPx: 0, widthPx: 64 },
        { type: 'door', offsetPx: 64, widthPx: 128 },
        { type: 'wall', offsetPx: 192, widthPx: 64 },
      ];
    
    default:
      // Default to solid wall
      return [
        { type: 'wall', offsetPx: 0, widthPx: 128 },
        { type: 'wall', offsetPx: 128, widthPx: 128 },
      ];
  }
}

/**
 * A renderable wall piece with position and type info
 */
export interface RenderableWallPiece {
  x: number;             // Center X position in pixels
  y: number;             // Center Y position in pixels
  widthPx: number;       // Width (along wall direction)
  heightPx: number;      // Height (wall thickness, usually 32px)
  rotation: number;      // 0 for horizontal, 90 for vertical
  type: 'wall' | 'door'; // Sprite type to use
  wallStyleId: string;
  segmentGroupId: string; // For debugging/identification
}

/**
 * Generate all renderable wall pieces for a set of rooms using SegmentStates
 * This replaces the old wall segment generation when SegmentStates are used
 * 
 * Each WallSegmentGroup (256px) is converted to pieces based on its SegmentState:
 * - SOLID_256: 2x wall_128 pieces
 * - DOOR_LEFT: 1x door_128 + 1x wall_128
 * - DOOR_RIGHT: 1x wall_128 + 1x door_128
 * - DOOR_BOTH: 2x door_128 pieces
 * - DOOR_CENTER: wall_64 + door_128 + wall_64
 */
export function generateRenderableWallPieces(
  rooms: ModularRoomElement[],
  wallGroups: WallGroup[],
  doors: ModularDoor[],
  segmentStates: SegmentStatesMap
): RenderableWallPiece[] {
  const pieces: RenderableWallPiece[] = [];
  
  if (rooms.length === 0) return pieces;
  
  // Generate WallSegmentGroups from geometry
  const wallSegmentGroups = generateWallSegmentGroups(rooms, doors, wallGroups);
  
  // Note: No debug logging here - this runs on every render
  
  for (const group of wallSegmentGroups) {
    // Get composition for this segment based on state
    const composition = getSegmentComposition(segmentStates, group.id);
    
    // Convert each piece in composition to renderable piece
    for (const piece of composition) {
      let x: number, y: number;
      
      if (group.orientation === 'horizontal') {
        // Horizontal wall - piece runs along X axis
        x = group.rangeStart + piece.offsetPx + piece.widthPx / 2;
        y = group.position;
      } else {
        // Vertical wall - piece runs along Y axis
        x = group.position;
        y = group.rangeStart + piece.offsetPx + piece.widthPx / 2;
      }
      
      pieces.push({
        x,
        y,
        widthPx: piece.widthPx,
        heightPx: MODULAR_WALL_THICKNESS_PX,
        rotation: group.orientation === 'vertical' ? 90 : 0,
        type: piece.type,
        wallStyleId: group.wallStyleId,
        segmentGroupId: group.id,
      });
    }
  }
  
  return pieces;
}

// ============================================
// LEGACY COMPATIBILITY FUNCTIONS
// These functions provide backward compatibility while we migrate
// ============================================

/**
 * Generate edge key from edge info - for backward compatibility
 * @deprecated Will be removed when we fully migrate to WallSegmentGroup.id based system
 */
export function generateEdgeKey(
  orientation: 'horizontal' | 'vertical',
  positionTiles: number,
  roomAId: string,
  roomBId?: string
): EdgeKey {
  // Sort room IDs for consistency
  if (roomBId) {
    const [id1, id2] = [roomAId, roomBId].sort();
    return `${orientation}|${positionTiles}|${id1}|${id2}` as EdgeKey;
  }
  return `${orientation}|${positionTiles}|${roomAId}` as EdgeKey;
}

/**
 * Generate segment key from edge key and segment index - for backward compatibility
 * @deprecated Will be removed when we fully migrate to WallSegmentGroup.id based system
 */
export function generateSegmentKey(edgeKey: EdgeKey, segmentIndex: number): string {
  return `${edgeKey}|seg${segmentIndex}`;
}

/**
 * Parse segment key - for backward compatibility
 * @deprecated Will be removed when we fully migrate to WallSegmentGroup.id based system
 */
export function parseSegmentKey(segmentKey: string): { edgeKey: EdgeKey; segmentIndex: number } {
  const match = segmentKey.match(/^(.+)\|seg(\d+)$/);
  if (!match) {
    throw new Error(`Invalid segment key: ${segmentKey}`);
  }
  return {
    edgeKey: match[1] as EdgeKey,
    segmentIndex: parseInt(match[2], 10),
  };
}

/**
 * Parse edge key - for backward compatibility
 * @deprecated Will be removed when we fully migrate to WallSegmentGroup.id based system
 */
export function parseEdgeKey(edgeKey: EdgeKey): {
  orientation: 'horizontal' | 'vertical';
  positionTiles: number;
  roomAId: string;
  roomBId: string;
} {
  const parts = edgeKey.split('|');
  return {
    orientation: parts[0] as 'horizontal' | 'vertical',
    positionTiles: parseFloat(parts[1]),
    roomAId: parts[2],
    roomBId: parts[3] || '',
  };
}

/**
 * Get segment state with EdgeKey - backward compatibility overload
 * @deprecated Use getSegmentState(segmentStates, wallSegmentGroupId) instead
 */
export function getSegmentStateByEdgeKey(
  segmentStates: SegmentStatesMap,
  edgeKey: EdgeKey,
  segmentIndex: number
): SegmentState {
  const key = generateSegmentKey(edgeKey, segmentIndex);
  return segmentStates[key] || { pattern: 'SOLID_256', source: 'auto' };
}

/**
 * Set segment state with EdgeKey - backward compatibility
 * @deprecated Use setSegmentState(segmentStates, wallSegmentGroupId, newState) instead
 */
export function setSegmentStateByEdgeKey(
  segmentStates: SegmentStatesMap,
  edgeKey: EdgeKey,
  segmentIndex: number,
  newState: SegmentState
): SegmentStatesMap {
  const key = generateSegmentKey(edgeKey, segmentIndex);
  const existingState = segmentStates[key];
  
  // Never override manual with auto
  if (newState.source === 'auto' && existingState?.source === 'manual') {
    return segmentStates;
  }
  
  return {
    ...segmentStates,
    [key]: newState,
  };
}

/**
 * Get edge door openings - backward compatibility
 * @deprecated Use getDoorOpenings(segmentStates, wallSegmentGroup) instead
 */
export function getEdgeDoorOpenings(
  segmentStates: SegmentStatesMap,
  edgeKey: EdgeKey,
  edgeLengthTiles: number
): { startPx: number; endPx: number; segmentIndex: number; pattern: SegmentPattern }[] {
  const openings: { startPx: number; endPx: number; segmentIndex: number; pattern: SegmentPattern }[] = [];
  const segmentCount = Math.ceil(edgeLengthTiles / SEGMENT_SIZE_TILES);
  
  for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
    const state = getSegmentStateByEdgeKey(segmentStates, edgeKey, segIdx);
    
    if (state.pattern === 'SOLID_256') continue;
    
    const segmentStartPx = segIdx * SEGMENT_SIZE_PX;
    
    switch (state.pattern) {
      case 'DOOR_LEFT':
        openings.push({
          startPx: segmentStartPx,
          endPx: segmentStartPx + 128,
          segmentIndex: segIdx,
          pattern: state.pattern,
        });
        break;
      case 'DOOR_RIGHT':
        openings.push({
          startPx: segmentStartPx + 128,
          endPx: segmentStartPx + 256,
          segmentIndex: segIdx,
          pattern: state.pattern,
        });
        break;
      case 'DOOR_BOTH':
        openings.push({
          startPx: segmentStartPx,
          endPx: segmentStartPx + 256,
          segmentIndex: segIdx,
          pattern: state.pattern,
        });
        break;
      case 'DOOR_CENTER':
        openings.push({
          startPx: segmentStartPx + 64,
          endPx: segmentStartPx + 192,
          segmentIndex: segIdx,
          pattern: state.pattern,
        });
        break;
    }
  }
  
  return openings;
}

/**
 * Recalculate segment states - stub for backward compatibility
 * In the new system, we just preserve existing states
 * @deprecated This will be simplified when we fully migrate
 */
export function recalculateSegmentStates(
  _allRooms: ModularRoomElement[],
  existingStates: SegmentStatesMap = {}
): SegmentStatesMap {
  // For now, just preserve all states
  // In the new system, states are keyed by WallSegmentGroup.id which is stable
  return { ...existingStates };
}

/**
 * Update segment states for room move - stub for backward compatibility
 * In the new system, states are keyed by WallSegmentGroup.id which moves with the room
 * @deprecated This will be simplified when we fully migrate
 */
export function updateSegmentStatesForRoomMove(
  existingStates: SegmentStatesMap,
  _roomId: string,
  _oldRoom: ModularRoomElement,
  _newRoom: ModularRoomElement,
  _allRooms: ModularRoomElement[]
): SegmentStatesMap {
  // In the new system, WallSegmentGroup.id stays with the segment
  // So we just return existing states - they're already correct
  return { ...existingStates };
}

/**
 * Get all door openings for rendering - backward compatibility
 * @deprecated Use getDoorOpenings with WallSegmentGroups instead
 */
export function getAllDoorOpeningsFromSegmentStates(
  segmentStates: SegmentStatesMap,
  allRooms: ModularRoomElement[]
): {
  orientation: 'horizontal' | 'vertical';
  positionPx: number;
  rangeStartPx: number;
  rangeEndPx: number;
  openings: { startPx: number; endPx: number; segmentIndex: number; pattern: SegmentPattern }[];
  roomAId: string;
  roomBId: string;
}[] {
  const result: {
    orientation: 'horizontal' | 'vertical';
    positionPx: number;
    rangeStartPx: number;
    rangeEndPx: number;
    openings: { startPx: number; endPx: number; segmentIndex: number; pattern: SegmentPattern }[];
    roomAId: string;
    roomBId: string;
  }[] = [];
  
  // Group segment states by edge key pattern
  const edgeGroups = new Map<string, { segmentIndex: number; state: SegmentState }[]>();
  
  for (const [key, state] of Object.entries(segmentStates)) {
    // Handle both new (wallSegmentGroupId) and old (edgeKey|seg#) formats
    const segMatch = key.match(/^(.+)\|seg(\d+)$/);
    if (segMatch) {
      // Old format: edgeKey|seg#
      const edgeKey = segMatch[1];
      const segmentIndex = parseInt(segMatch[2], 10);
      if (!edgeGroups.has(edgeKey)) {
        edgeGroups.set(edgeKey, []);
      }
      edgeGroups.get(edgeKey)!.push({ segmentIndex, state });
    } else {
      // New format: wallSegmentGroupId - convert to opening format
      // For now, we'll handle this differently
      // The new format stores data directly on the WallSegmentGroup
      // This function is for backward compat, so we skip new format keys
    }
  }
  
  // Process old-format edge groups
  for (const [edgeKey, _segments] of edgeGroups.entries()) {
    const parsed = parseEdgeKey(edgeKey as EdgeKey);
    
    // Find rooms
    const roomA = allRooms.find(r => r.id === parsed.roomAId);
    const roomB = parsed.roomBId ? allRooms.find(r => r.id === parsed.roomBId) : null;
    
    if (!roomA) continue;
    
    let rangeStartPx = 0;
    let rangeEndPx = 0;
    let positionPx = 0;
    let edgeLengthTiles = 0;
    
    if (roomA && roomB) {
      const sharedEdge = getSharedEdge(roomA, roomB);
      if (sharedEdge) {
        rangeStartPx = sharedEdge.rangeStart * MODULAR_TILE_PX;
        rangeEndPx = sharedEdge.rangeEnd * MODULAR_TILE_PX;
        positionPx = sharedEdge.position * MODULAR_TILE_PX;
        edgeLengthTiles = sharedEdge.rangeEnd - sharedEdge.rangeStart;
      }
    } else {
      const pixelRect = getRoomPixelRect(roomA);
      if (parsed.orientation === 'horizontal') {
        rangeStartPx = pixelRect.x;
        rangeEndPx = pixelRect.x + pixelRect.w;
        edgeLengthTiles = roomA.tilesW;
        positionPx = parsed.positionTiles * MODULAR_TILE_PX;
      } else {
        rangeStartPx = pixelRect.y;
        rangeEndPx = pixelRect.y + pixelRect.h;
        edgeLengthTiles = roomA.tilesH;
        positionPx = parsed.positionTiles * MODULAR_TILE_PX;
      }
    }
    
    const openings = getEdgeDoorOpenings(segmentStates, edgeKey as EdgeKey, edgeLengthTiles);
    
    if (openings.length > 0) {
      result.push({
        orientation: parsed.orientation,
        positionPx,
        rangeStartPx,
        rangeEndPx,
        openings,
        roomAId: parsed.roomAId,
        roomBId: parsed.roomBId,
      });
    }
  }
  
  return result;
}

// ============================================
// ADJACENCY DETECTION
// ============================================

/**
 * Shared edge between two rooms
 */
export interface SharedEdge {
  orientation: 'horizontal' | 'vertical';
  position: number; // Fixed coordinate (tile units)
  rangeStart: number; // Start of overlap (tile units)
  rangeEnd: number; // End of overlap (tile units)
}

/**
 * Check if two rooms share an edge (are adjacent)
 * Returns the shared edge info or null if not adjacent
 */
export function getSharedEdge(roomA: ModularRoomElement, roomB: ModularRoomElement): SharedEdge | null {
  const rectA = getRoomTileRect(roomA);
  const rectB = getRoomTileRect(roomB);
  
  // Check horizontal adjacency (A's right edge touches B's left edge or vice versa)
  // Vertical edge between them
  if (rectA.x + rectA.w === rectB.x) {
    // A is to the left of B
    const overlapStart = Math.max(rectA.y, rectB.y);
    const overlapEnd = Math.min(rectA.y + rectA.h, rectB.y + rectB.h);
    if (overlapEnd > overlapStart) {
      return {
        orientation: 'vertical',
        position: rectA.x + rectA.w,
        rangeStart: overlapStart,
        rangeEnd: overlapEnd,
      };
    }
  }
  
  if (rectB.x + rectB.w === rectA.x) {
    // B is to the left of A
    const overlapStart = Math.max(rectA.y, rectB.y);
    const overlapEnd = Math.min(rectA.y + rectA.h, rectB.y + rectB.h);
    if (overlapEnd > overlapStart) {
      return {
        orientation: 'vertical',
        position: rectB.x + rectB.w,
        rangeStart: overlapStart,
        rangeEnd: overlapEnd,
      };
    }
  }
  
  // Check vertical adjacency (A's bottom edge touches B's top edge or vice versa)
  // Horizontal edge between them
  if (rectA.y + rectA.h === rectB.y) {
    // A is above B
    const overlapStart = Math.max(rectA.x, rectB.x);
    const overlapEnd = Math.min(rectA.x + rectA.w, rectB.x + rectB.w);
    if (overlapEnd > overlapStart) {
      return {
        orientation: 'horizontal',
        position: rectA.y + rectA.h,
        rangeStart: overlapStart,
        rangeEnd: overlapEnd,
      };
    }
  }
  
  if (rectB.y + rectB.h === rectA.y) {
    // B is above A
    const overlapStart = Math.max(rectA.x, rectB.x);
    const overlapEnd = Math.min(rectA.x + rectA.w, rectB.x + rectB.w);
    if (overlapEnd > overlapStart) {
      return {
        orientation: 'horizontal',
        position: rectB.y + rectB.h,
        rangeStart: overlapStart,
        rangeEnd: overlapEnd,
      };
    }
  }
  
  return null;
}

/**
 * Check if two rooms are adjacent
 */
export function areRoomsAdjacent(roomA: ModularRoomElement, roomB: ModularRoomElement): boolean {
  return getSharedEdge(roomA, roomB) !== null;
}

/**
 * Get all rooms adjacent to a given room
 */
export function getAdjacentRooms(
  room: ModularRoomElement,
  allRooms: ModularRoomElement[]
): ModularRoomElement[] {
  return allRooms.filter(other => other.id !== room.id && areRoomsAdjacent(room, other));
}

// ============================================
// WALL GROUP MANAGEMENT
// ============================================

/**
 * Build connected components (wall groups) from all modular rooms
 * Using Union-Find algorithm
 */
export function buildWallGroups(rooms: ModularRoomElement[]): Map<string, string[]> {
  // Union-Find parent map
  const parent = new Map<string, string>();
  
  // Initialize each room as its own parent
  rooms.forEach(room => parent.set(room.id, room.id));
  
  // Find with path compression
  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };
  
  // Union
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  };
  
  // Union adjacent rooms
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (areRoomsAdjacent(rooms[i], rooms[j])) {
        union(rooms[i].id, rooms[j].id);
      }
    }
  }
  
  // Build groups map: groupId -> [roomIds]
  const groups = new Map<string, string[]>();
  rooms.forEach(room => {
    const root = find(room.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(room.id);
  });
  
  return groups;
}

/**
 * Get the wall group for a room
 */
export function getRoomWallGroup(
  roomId: string,
  state: ModularRoomsState
): WallGroup | null {
  // Find room element and get its wallGroupId
  // Then find the corresponding WallGroup
  return state.wallGroups.find(g => g.id === roomId) || null;
}

/**
 * Calculate the total shared boundary length between a room and a set of rooms
 */
export function calculateSharedBoundaryLength(
  room: ModularRoomElement,
  targetRooms: ModularRoomElement[]
): number {
  let totalLength = 0;
  
  for (const target of targetRooms) {
    const edge = getSharedEdge(room, target);
    if (edge) {
      totalLength += edge.rangeEnd - edge.rangeStart;
    }
  }
  
  return totalLength;
}

// ============================================
// WALL RUN GENERATION
// ============================================

/**
 * Wall segment for rendering
 */
export interface WallSegment {
  x: number; // Pixel position (center of wall thickness)
  y: number;
  width: number; // Length of wall in pixels (along the wall direction)
  height: number; // Thickness (MODULAR_WALL_THICKNESS_PX)
  rotation: number; // Degrees (0 for horizontal, 90 for vertical)
  wallStyleId: string;
}

/**
 * Pillar for rendering
 */
export interface Pillar {
  x: number; // Center x in pixels
  y: number; // Center y in pixels
  wallStyleId: string;
}

/**
 * Door opening for rendering
 */
export interface DoorOpening {
  x: number; // Position x in pixels
  y: number; // Position y in pixels
  width: number; // Width in pixels
  height: number; // Height in pixels (thickness)
  rotation: number;
  wallStyleId: string;
  doorId: string;
}

/**
 * Get external perimeter edges of a wall group (rooms that form a connected component)
 */
export interface PerimeterEdge {
  orientation: 'horizontal' | 'vertical';
  position: number; // Fixed coordinate in tiles
  rangeStart: number; // Start in tiles
  rangeEnd: number; // End in tiles
  isInternalEdge: boolean; // True if this edge is shared between rooms in the group
  roomAId?: string; // For internal edges: first room
  roomBId?: string; // For internal edges: second room
}

/**
 * Get all edges for a group of rooms - both external perimeter and internal (shared) edges
 */
export function getGroupEdges(
  roomIds: string[],
  allRooms: ModularRoomElement[]
): { externalEdges: PerimeterEdge[], internalEdges: PerimeterEdge[] } {
  const rooms = allRooms.filter(r => roomIds.includes(r.id));
  
  // Track all edges with their owning room
  interface EdgeWithRoom {
    edge: PerimeterEdge;
    roomId: string;
  }
  
  const allEdges: EdgeWithRoom[] = [];
  
  for (const room of rooms) {
    const rect = getRoomTileRect(room);
    
    // Top edge (horizontal)
    allEdges.push({
      roomId: room.id,
      edge: {
        orientation: 'horizontal',
        position: rect.y,
        rangeStart: rect.x,
        rangeEnd: rect.x + rect.w,
        isInternalEdge: false,
      }
    });
    
    // Bottom edge (horizontal)
    allEdges.push({
      roomId: room.id,
      edge: {
        orientation: 'horizontal',
        position: rect.y + rect.h,
        rangeStart: rect.x,
        rangeEnd: rect.x + rect.w,
        isInternalEdge: false,
      }
    });
    
    // Left edge (vertical)
    allEdges.push({
      roomId: room.id,
      edge: {
        orientation: 'vertical',
        position: rect.x,
        rangeStart: rect.y,
        rangeEnd: rect.y + rect.h,
        isInternalEdge: false,
      }
    });
    
    // Right edge (vertical)
    allEdges.push({
      roomId: room.id,
      edge: {
        orientation: 'vertical',
        position: rect.x + rect.w,
        rangeStart: rect.y,
        rangeEnd: rect.y + rect.h,
        isInternalEdge: false,
      }
    });
  }
  
  // Group edges by orientation and position (NOT by range - we need to find overlaps)
  const edgesByLine = new Map<string, EdgeWithRoom[]>();
  
  for (const edgeWithRoom of allEdges) {
    const lineKey = `${edgeWithRoom.edge.orientation}-${edgeWithRoom.edge.position}`;
    if (!edgesByLine.has(lineKey)) {
      edgesByLine.set(lineKey, []);
    }
    edgesByLine.get(lineKey)!.push(edgeWithRoom);
  }
  
  const externalEdges: PerimeterEdge[] = [];
  const internalEdges: PerimeterEdge[] = [];
  
  // For each line (same orientation + position), find overlapping segments
  edgesByLine.forEach((edgesOnLine) => {
    if (edgesOnLine.length === 1) {
      // Only one edge on this line - it's all external
      // Make sure to include the roomId!
      externalEdges.push({
        ...edgesOnLine[0].edge,
        roomAId: edgesOnLine[0].roomId,
      });
      return;
    }
    
    // Multiple edges on same line - need to find overlaps
    // Use a sweep line algorithm to find segments
    const orientation = edgesOnLine[0].edge.orientation;
    const position = edgesOnLine[0].edge.position;
    
    // Collect all segment events (start and end points)
    interface SegmentEvent {
      pos: number;
      type: 'start' | 'end';
      roomId: string;
      edgeIdx: number;
    }
    
    const events: SegmentEvent[] = [];
    edgesOnLine.forEach((e, idx) => {
      events.push({ pos: e.edge.rangeStart, type: 'start', roomId: e.roomId, edgeIdx: idx });
      events.push({ pos: e.edge.rangeEnd, type: 'end', roomId: e.roomId, edgeIdx: idx });
    });
    
    // Sort by position, with 'start' before 'end' at same position
    events.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      return a.type === 'start' ? -1 : 1;
    });
    
    // Sweep through events and track active edges
    const activeRooms = new Set<string>();
    let lastPos: number | null = null;
    
    for (const event of events) {
      // If we have a segment from lastPos to current pos
      if (lastPos !== null && event.pos > lastPos && activeRooms.size > 0) {
        const segmentStart = lastPos;
        const segmentEnd = event.pos;
        
        if (activeRooms.size === 1) {
          // Only one room covers this segment - external edge
          const roomId = Array.from(activeRooms)[0];
          externalEdges.push({
            orientation,
            position,
            rangeStart: segmentStart,
            rangeEnd: segmentEnd,
            isInternalEdge: false,
            roomAId: roomId,
          });
        } else if (activeRooms.size === 2) {
          // Two rooms cover this segment - internal/shared edge
          const roomIds = Array.from(activeRooms);
          internalEdges.push({
            orientation,
            position,
            rangeStart: segmentStart,
            rangeEnd: segmentEnd,
            isInternalEdge: true,
            roomAId: roomIds[0],
            roomBId: roomIds[1],
          });
        }
        // If more than 2 rooms overlap (shouldn't happen in valid layouts), treat as internal
      }
      
      // Update active rooms
      if (event.type === 'start') {
        activeRooms.add(event.roomId);
      } else {
        activeRooms.delete(event.roomId);
      }
      
      lastPos = event.pos;
    }
  });
  
  // NOTE: We previously merged adjacent external edges on the same line,
  // but this caused incorrect interior pillar placement when rooms shared edges.
  // Each room should maintain its own edge boundaries for correct pillar/wall generation.
  // The wall rendering already handles adjacent walls correctly without merging.
  
  return { externalEdges, internalEdges };
}

/**
 * Legacy function for backward compatibility
 */
export function getGroupPerimeter(
  roomIds: string[],
  allRooms: ModularRoomElement[]
): PerimeterEdge[] {
  const { externalEdges } = getGroupEdges(roomIds, allRooms);
  return externalEdges;
}

/**
 * Create a door for a shared edge between two rooms
 * The door is centered on the shared edge with a width of 1 tile (128px)
 */
export function createDoorForSharedEdge(
  sharedEdge: PerimeterEdge,
  existingDoors: ModularDoor[]
): ModularDoor | null {
  if (!sharedEdge.isInternalEdge || !sharedEdge.roomAId || !sharedEdge.roomBId) {
    return null;
  }
  
  // Sort room IDs for stable key
  const [roomAId, roomBId] = [sharedEdge.roomAId, sharedEdge.roomBId].sort();
  
  // Convert shared edge to pixels for comparison with manual doors
  const edgePositionPx = sharedEdge.position * MODULAR_TILE_PX;
  const edgeRangeStartPx = sharedEdge.rangeStart * MODULAR_TILE_PX;
  const edgeRangeEndPx = sharedEdge.rangeEnd * MODULAR_TILE_PX;
  
  // Check if ANY door already exists on this shared edge
  // This includes manual doors that were on an external wall and now are on the intersection
  const existingDoorOnEdge = existingDoors.find(d => {
    // Check orientation match
    if (d.edgeOrientation !== sharedEdge.orientation) return false;
    
    // Check if it's an auto door for this exact edge
    if (d.roomAId === roomAId && d.roomBId === roomBId && 
        d.edgePosition === sharedEdge.position) {
      return true;
    }
    
    // Check if it's a manual door on this edge position
    if (d.isManual) {
      // Check if door is from one of the rooms in this edge
      const doorInvolvesRoom = d.roomAId === roomAId || d.roomAId === roomBId ||
                               d.roomAId === sharedEdge.roomAId || d.roomAId === sharedEdge.roomBId;
      if (!doorInvolvesRoom) return false;
      
      // Check position match (manual doors store in pixels)
      const positionMatches = Math.abs(d.edgePosition - edgePositionPx) < 2;
      if (!positionMatches) return false;
      
      // Check if door's range overlaps with this shared edge
      const doorRangeStart = d.edgeRangeStart;
      const doorRangeEnd = d.edgeRangeEnd;
      const rangeOverlaps = doorRangeStart < edgeRangeEndPx && doorRangeEnd > edgeRangeStartPx;
      
      return rangeOverlaps;
    }
    
    return false;
  });
  
  if (existingDoorOnEdge) {
    return null; // Door already exists on this edge
  }
  
  // Calculate door position - center it on the shared edge
  const edgeLength = sharedEdge.rangeEnd - sharedEdge.rangeStart;
  const doorWidthTiles = 1; // 128px door
  
  // Center the door, but ensure it fits
  let doorOffset = Math.floor((edgeLength - doorWidthTiles) / 2);
  doorOffset = Math.max(0, Math.min(doorOffset, edgeLength - doorWidthTiles));
  
  const newDoor: ModularDoor = {
    id: `door-${roomAId}-${roomBId}-${Date.now()}`,
    roomAId,
    roomBId,
    edgeOrientation: sharedEdge.orientation,
    edgePosition: sharedEdge.position,
    edgeRangeStart: sharedEdge.rangeStart,
    edgeRangeEnd: sharedEdge.rangeEnd,
    offsetTiles: doorOffset,
    widthTiles: doorWidthTiles,
  };
  
  if (DEBUG_DOORS) {
    console.log('[createDoorForSharedEdge] Created door:', {
      doorId: newDoor.id.slice(-20),
      roomAId: roomAId.slice(-8),
      roomBId: roomBId.slice(-8),
      orientation: sharedEdge.orientation,
      edgePosition: sharedEdge.position,
      edgeRangeStart: sharedEdge.rangeStart,
      edgeRangeEnd: sharedEdge.rangeEnd,
      edgeLength,
      doorOffset,
      doorWidthTiles,
      doorWidthPx: doorWidthTiles * MODULAR_TILE_PX,
    });
  }
  
  return newDoor;
}

/**
 * Find all new shared edges when placing a room, and create doors for them
 */
export function createDoorsForNewRoom(
  newRoom: ModularRoomElement,
  existingRooms: ModularRoomElement[],
  existingDoors: ModularDoor[]
): ModularDoor[] {
  const newDoors: ModularDoor[] = [];
  
  if (DEBUG_DOORS) {
    console.log('[createDoorsForNewRoom] START:', {
      newRoomId: newRoom.id.slice(-8),
      existingRoomsCount: existingRooms.length,
      existingDoorsCount: existingDoors.length,
    });
  }
  
  for (const existingRoom of existingRooms) {
    const sharedEdge = getSharedEdge(newRoom, existingRoom);
    if (sharedEdge) {
      // Create a PerimeterEdge with room references for the door creation
      const edgeWithRooms: PerimeterEdge = {
        ...sharedEdge,
        isInternalEdge: true,
        roomAId: newRoom.id,
        roomBId: existingRoom.id,
      };
      
      const door = createDoorForSharedEdge(edgeWithRooms, existingDoors);
      if (door) {
        newDoors.push(door);
      }
    }
  }
  
  return newDoors;
}

/**
 * Generate wall segments from perimeter edges
 * Accounts for door openings
 */
export function generateWallSegments(
  perimeterEdges: PerimeterEdge[],
  doors: ModularDoor[],
  wallStyleId: string
): WallSegment[] {
  const segments: WallSegment[] = [];
  
  for (const edge of perimeterEdges) {
    if (edge.isInternalEdge) continue; // Skip internal edges
    
    const lengthTiles = edge.rangeEnd - edge.rangeStart;
    // Round all pixel values to avoid floating point precision issues
    const lengthPx = Math.round(lengthTiles * MODULAR_TILE_PX);
    const startPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Calculate interior pillar positions for this edge (same logic as generatePillarsWithEdgeInfo)
    const numSegments = lengthPx / MODULAR_WALL_SPRITE_2TILE_WIDTH;
    const interiorPillarOffsets: number[] = []; // Offsets in px from edge start
    
    // Interior pillar positions - place exactly at center (no snap to grid)
    // For 6-tile wall: center is at 384 (between tile 3 and 4)
    if (numSegments >= 5) {
      // 10+ tiles: pillars at 25%, 50%, 75%
      interiorPillarOffsets.push(
        lengthPx * 0.25,
        lengthPx * 0.5,
        lengthPx * 0.75
      );
    } else if (numSegments >= 3) {
      // 6-8 tiles: single pillar at exact center
      interiorPillarOffsets.push(lengthPx / 2);
    }
    
    // Check for doors on this edge
    // For internal doors: match exact edge range (tiles)
    // For manual/external doors: edge data is in pixels, check if door position falls within this edge
    const edgeDoors = doors.filter(d => {
      if (d.edgeOrientation !== edge.orientation) return false;
      
      // For manual doors, edge data is in pixels
      // edge.position is in tiles, so we compare in pixels
      if (d.isManual) {
        // Compare positions (both in pixels)
        if (Math.abs(d.edgePosition - positionPx) > 2) return false;
        
        // Check if door falls within edge range (all in pixels)
        const doorStartPx = d.edgeRangeStart + (d.offsetTiles || 0) * MODULAR_TILE_PX;
        const doorEndPx = doorStartPx + d.widthTiles * MODULAR_TILE_PX;
        // Door overlaps with edge if door is within edge bounds
        return doorStartPx >= startPx && doorEndPx <= startPx + lengthPx;
      }
      
      // For auto doors (internal), edge data is in tiles - need to convert
      const doorPositionPx = d.edgePosition * MODULAR_TILE_PX;
      if (Math.abs(doorPositionPx - positionPx) > 2) return false;
      
      // For exact edge range match (tiles converted to pixels)
      const doorRangeStartPx = d.edgeRangeStart * MODULAR_TILE_PX;
      const doorRangeEndPx = d.edgeRangeEnd * MODULAR_TILE_PX;
      if (Math.abs(doorRangeStartPx - startPx) < 2 && Math.abs(doorRangeEndPx - (startPx + lengthPx)) < 2) {
        return true;
      }
      
      return false;
    });
    
    // Calculate adjusted offsets for each door (relative to edge start in pixels)
    const doorAdjustedOffsetsPx = new Map<string, number>();
    const doorRanges: { start: number; end: number }[] = [];
    
    for (const door of edgeDoors) {
      let doorOffsetPx: number;
      
      if (door.isManual) {
        // Manual doors: edgeRangeStart is in pixels, offsetTiles is in tiles
        // startPx is already edge.rangeStart converted to pixels
        doorOffsetPx = (door.edgeRangeStart - startPx) + (door.offsetTiles || 0) * MODULAR_TILE_PX;
      } else {
        // Auto doors: edgeRangeStart is in tiles, offsetTiles is in tiles
        const doorRangeStartPx = door.edgeRangeStart * MODULAR_TILE_PX;
        doorOffsetPx = (doorRangeStartPx - startPx) + (door.offsetTiles || 0) * MODULAR_TILE_PX;
      }
      
      const doorEndPx = doorOffsetPx + door.widthTiles * MODULAR_TILE_PX;
      doorAdjustedOffsetsPx.set(door.id, doorOffsetPx);
      doorRanges.push({ start: doorOffsetPx, end: doorEndPx });
    }
    
    // Filter out pillar offsets that fall inside a door opening
    const filteredPillarOffsets = interiorPillarOffsets.filter(pillarOffset => {
      for (const range of doorRanges) {
        if (pillarOffset >= range.start && pillarOffset <= range.end) {
          return false; // Pillar is inside door, remove it
        }
      }
      return true;
    });
    
    // Combine all split points (filtered pillars and door boundaries) and sort
    const splitPoints: number[] = [...filteredPillarOffsets];
    for (const range of doorRanges) {
      splitPoints.push(range.start);
      splitPoints.push(range.end);
    }
    
    // Sort and deduplicate
    const uniqueSplitPoints = [...new Set(splitPoints)].sort((a, b) => a - b);
    
    if (uniqueSplitPoints.length === 0) {
      // No pillars or doors - single wall segment
      if (edge.orientation === 'horizontal') {
        const seg = {
          x: startPx + lengthPx / 2,
          y: positionPx,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 0,
          wallStyleId,
        };
        segments.push(seg);
      } else {
        const seg = {
          x: positionPx,
          y: startPx + lengthPx / 2,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 90,
          wallStyleId,
        };
        segments.push(seg);
      }
    } else {
      // Split wall into segments at split points
      let currentOffset = 0;
      
      for (const splitPoint of uniqueSplitPoints) {
        // Check if this is a door start (skip the door opening)
        // doorAdjustedOffsetsPx is already in pixels
        const doorAtSplitPoint = edgeDoors.find(d => {
          const adjustedOffsetPx = doorAdjustedOffsetsPx.get(d.id) || 0;
          return Math.round(adjustedOffsetPx) === splitPoint;
        });
        const isDoorStart = !!doorAtSplitPoint;
        
        if (splitPoint > currentOffset) {
          // Create segment from currentOffset to splitPoint
          const segLengthPx = splitPoint - currentOffset;
          
          if (edge.orientation === 'horizontal') {
            const segX = startPx + currentOffset + segLengthPx / 2;
            segments.push({
              x: segX,
              y: positionPx,
              width: segLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 0,
              wallStyleId,
            });
          } else {
            segments.push({
              x: positionPx,
              y: startPx + currentOffset + segLengthPx / 2,
              width: segLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 90,
              wallStyleId,
            });
          }
        }
        
        // If this is a door start, skip to door end
        if (isDoorStart && doorAtSplitPoint) {
          const adjustedOffsetPx = doorAdjustedOffsetsPx.get(doorAtSplitPoint.id) || 0;
          currentOffset = Math.round(adjustedOffsetPx + doorAtSplitPoint.widthTiles * MODULAR_TILE_PX);
        } else {
          currentOffset = splitPoint;
        }
      }
      
      // Final segment from last split point to end
      if (currentOffset < lengthPx) {
        const segLengthPx = lengthPx - currentOffset;
        
        if (edge.orientation === 'horizontal') {
          segments.push({
            x: startPx + currentOffset + segLengthPx / 2,
            y: positionPx,
            width: segLengthPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: positionPx,
            y: startPx + currentOffset + segLengthPx / 2,
            width: segLengthPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 90,
            wallStyleId,
          });
        }
      }
    }
  }
  
  return segments;
}

/**
 * Generate wall segments for internal (shared) edges
 * Internal walls have doors and are split around door openings.
 * 
 * Doors are ALWAYS centered on the edge. Wall segments are placed on each side.
 * For a 2-tile edge (256px) with a 1-tile door (128px):
 * - wall_64px + door_128px + wall_64px = 256px total
 */
export function generateInternalWallSegments(
  internalEdges: PerimeterEdge[],
  doors: ModularDoor[],
  wallStyleId: string
): WallSegment[] {
  const segments: WallSegment[] = [];
  
  for (const edge of internalEdges) {
    if (!edge.isInternalEdge) continue; // Only process internal edges
    
    const lengthTiles = edge.rangeEnd - edge.rangeStart;
    // Round all pixel values to avoid floating point precision issues
    const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const edgeEndPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Find doors between the same two rooms
    // We match on room IDs ONLY - orientation may change if rooms are rotated
    // The door will be rendered at the CURRENT edge position regardless of stored orientation
    const edgeDoors = doors.filter(d => {
      // Match doors that connect the same two rooms
      const roomsMatch = edge.roomAId && edge.roomBId &&
        ((d.roomAId === edge.roomAId && d.roomBId === edge.roomBId) ||
         (d.roomAId === edge.roomBId && d.roomBId === edge.roomAId));
      
      // Only check room IDs - orientation is determined by current edge
      return roomsMatch;
    });
    
    if (edgeDoors.length === 0) {
      // No doors on this internal edge - render full wall
      const lengthPx = Math.round(lengthTiles * MODULAR_TILE_PX);
      if (edge.orientation === 'horizontal') {
        segments.push({
          x: edgeStartPx + lengthPx / 2,
          y: positionPx,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 0,
          wallStyleId,
        });
      } else {
        segments.push({
          x: positionPx,
          y: edgeStartPx + lengthPx / 2,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 90,
          wallStyleId,
        });
      }
    } else {
      // Has doors - split wall around door openings
      // Door is ALWAYS centered on the edge (matching generateDoorRenderings)
      const edgeLengthPx = edgeEndPx - edgeStartPx;
      const doorWidthPx = MODULAR_TILE_PX; // 128px for 1-tile door
      
      // Calculate centered door position (all values already rounded)
      const doorCenterPx = Math.round(edgeStartPx + edgeLengthPx / 2);
      const doorStartPx = doorCenterPx - doorWidthPx / 2;
      const doorEndPx = doorCenterPx + doorWidthPx / 2;
      
      // Calculate wall segments on each side of door
      const wallBeforePx = doorStartPx - edgeStartPx;
      const wallAfterPx = edgeEndPx - doorEndPx;
      
      // Create wall segment before door (if any)
      if (wallBeforePx > 0) {
        const segCenterPx = edgeStartPx + wallBeforePx / 2;
        if (edge.orientation === 'horizontal') {
          segments.push({
            x: segCenterPx,
            y: positionPx,
            width: wallBeforePx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: positionPx,
            y: segCenterPx,
            width: wallBeforePx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 90,
            wallStyleId,
          });
        }
      }
      
      // Create wall segment after door (if any)
      if (wallAfterPx > 0) {
        const segCenterPx = doorEndPx + wallAfterPx / 2;
        if (edge.orientation === 'horizontal') {
          segments.push({
            x: segCenterPx,
            y: positionPx,
            width: wallAfterPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: positionPx,
            y: segCenterPx,
            width: wallAfterPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 90,
            wallStyleId,
          });
        }
      }
    }
  }
  
  return segments;
}

/**
 * Generate internal wall segments using SegmentStates
 * This replaces generateInternalWallSegments when SegmentStates are available
 * 
 * For each internal edge (shared between two rooms), looks up the SegmentStates
 * and generates wall segments with gaps where doors are defined.
 */
export function generateInternalWallSegmentsFromSegmentStates(
  internalEdges: PerimeterEdge[],
  segmentStates: SegmentStatesMap,
  wallStyleId: string
): WallSegment[] {
  const segments: WallSegment[] = [];
  
  // Note: No debug logs in render path - too frequent
  
  for (const edge of internalEdges) {
    if (!edge.isInternalEdge) continue;
    if (!edge.roomAId || !edge.roomBId) continue;
    
    const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const edgeEndPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    const edgeLengthTiles = edge.rangeEnd - edge.rangeStart;
    
    // Generate edge key for this edge
    const edgeKey = generateEdgeKey(edge.orientation, edge.position, edge.roomAId, edge.roomBId);
    
    // Get door openings from SegmentStates
    const doorOpenings = getEdgeDoorOpenings(segmentStates, edgeKey, edgeLengthTiles);
    
    if (doorOpenings.length === 0) {
      // No doors - render full wall
      const lengthPx = edgeEndPx - edgeStartPx;
      if (edge.orientation === 'horizontal') {
        segments.push({
          x: edgeStartPx + lengthPx / 2,
          y: positionPx,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 0,
          wallStyleId,
        });
      } else {
        segments.push({
          x: positionPx,
          y: edgeStartPx + lengthPx / 2,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 90,
          wallStyleId,
        });
      }
    } else {
      // Has door openings - generate wall segments around them
      // Sort openings by start position
      const sortedOpenings = [...doorOpenings].sort((a, b) => a.startPx - b.startPx);
      
      let currentPx = 0; // Position relative to edge start
      const edgeLengthPx = edgeEndPx - edgeStartPx;
      
      for (const opening of sortedOpenings) {
        // Wall segment before this opening
        if (opening.startPx > currentPx) {
          const wallLengthPx = opening.startPx - currentPx;
          const wallCenterPx = edgeStartPx + currentPx + wallLengthPx / 2;
          
          if (edge.orientation === 'horizontal') {
            segments.push({
              x: wallCenterPx,
              y: positionPx,
              width: wallLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 0,
              wallStyleId,
            });
          } else {
            segments.push({
              x: positionPx,
              y: wallCenterPx,
              width: wallLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 90,
              wallStyleId,
            });
          }
        }
        
        currentPx = opening.endPx;
      }
      
      // Wall segment after last opening
      if (currentPx < edgeLengthPx) {
        const wallLengthPx = edgeLengthPx - currentPx;
        const wallCenterPx = edgeStartPx + currentPx + wallLengthPx / 2;
        
        if (edge.orientation === 'horizontal') {
          segments.push({
            x: wallCenterPx,
            y: positionPx,
            width: wallLengthPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: positionPx,
            y: wallCenterPx,
            width: wallLengthPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 90,
            wallStyleId,
          });
        }
      }
    }
  }
  
  return segments;
}

/**
 * Generate door rendering data from ModularDoor objects
 * 
 * Doors are ALWAYS centered on their edge in pixels, regardless of offsetTiles.
 * This ensures the door is perfectly centered between the wall segments,
 * especially when using 64px wall segments near pillars.
 * 
 * Uses internalEdges to get the CURRENT position of the shared edge,
 * which may have changed if rooms were rotated.
 */
export function generateDoorRenderings(
  doors: ModularDoor[],
  wallStyleId: string,
  internalEdges: PerimeterEdge[] = []
): DoorOpening[] {
  if (DEBUG_DOORS && doors.length > 0) {
    console.log('[generateDoorRenderings] START:', {
      doorCount: doors.length,
      internalEdgeCount: internalEdges.length,
    });
  }
  
  return doors.map(door => {
    const doorWidthPx = door.widthTiles * MODULAR_TILE_PX; // 128px for 1-tile door
    
    // Find the CURRENT edge between these two rooms
    // This handles the case where rooms have been rotated and edge positions changed
    // Match on room IDs ONLY - orientation may have changed
    const currentEdge = internalEdges.find(e => {
      const roomsMatch = e.roomAId && e.roomBId &&
        ((door.roomAId === e.roomAId && door.roomBId === e.roomBId) ||
         (door.roomAId === e.roomBId && door.roomBId === e.roomAId));
      return roomsMatch;
    });
    
    // Use current edge if found, otherwise fall back to stored door values
    // Round all pixel values to avoid floating point precision issues
    const edgeStartPx = Math.round(currentEdge 
      ? currentEdge.rangeStart * MODULAR_TILE_PX 
      : door.edgeRangeStart * MODULAR_TILE_PX);
    const edgeEndPx = Math.round(currentEdge 
      ? currentEdge.rangeEnd * MODULAR_TILE_PX 
      : door.edgeRangeEnd * MODULAR_TILE_PX);
    const edgePositionPx = Math.round(currentEdge
      ? currentEdge.position * MODULAR_TILE_PX
      : door.edgePosition * MODULAR_TILE_PX);
    
    // Use CURRENT edge orientation, not stored door orientation
    const orientation = currentEdge ? currentEdge.orientation : door.edgeOrientation;
    
    const edgeLengthPx = edgeEndPx - edgeStartPx;
    
    // Center the door on the edge (in pixels, not tiles)
    // This places the door exactly in the middle, leaving equal wall space on both sides
    const doorCenterOffset = edgeLengthPx / 2;
    
    let x: number, y: number;
    
    if (orientation === 'horizontal') {
      x = edgeStartPx + doorCenterOffset;
      y = edgePositionPx;
    } else {
      x = edgePositionPx;
      y = edgeStartPx + doorCenterOffset;
    }
    
    if (DEBUG_DOORS) {
      console.log('[generateDoorRenderings] Door position:', {
        doorId: door.id.slice(-20),
        x,
        y,
        width: doorWidthPx,
        rotation: orientation === 'vertical' ? 90 : 0,
        orientation,
        edgeStartPx,
        edgeEndPx,
        edgeLengthPx,
        doorCenterOffset,
        currentEdgeFound: !!currentEdge,
      });
    }
    
    return {
      x,
      y,
      width: doorWidthPx,
      height: MODULAR_WALL_THICKNESS_PX,
      rotation: orientation === 'vertical' ? 90 : 0,
      wallStyleId,
      doorId: door.id,
    };
  });
}

/**
 * Calculate pillar positions for wall runs
 * Rules:
 * - Always place corner pillars at run ends
 * - N < 3: no interior pillars
 * - N = 3 or 4: 1 pillar at mid (0.5)
 * - N >= 5: pillars at 0.25, 0.5, 0.75
 * Snap to 128px grid
 */
export function generatePillars(
  perimeterEdges: PerimeterEdge[],
  wallStyleId: string
): Pillar[] {
  const pillars: Pillar[] = [];
  const pillarPositions = new Set<string>(); // Deduplicate pillars at same position
  
  for (const edge of perimeterEdges) {
    if (edge.isInternalEdge) continue;
    
    // Round all pixel values to avoid floating point precision issues
    const startPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const endPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const lengthPx = endPx - startPx;
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Corner pillars at each end
    const cornerPositions: { x: number; y: number }[] = [];
    
    if (edge.orientation === 'horizontal') {
      cornerPositions.push({ x: startPx, y: positionPx });
      cornerPositions.push({ x: endPx, y: positionPx });
    } else {
      cornerPositions.push({ x: positionPx, y: startPx });
      cornerPositions.push({ x: positionPx, y: endPx });
    }
    
    // Add corner pillars
    for (const pos of cornerPositions) {
      const key = `${pos.x},${pos.y}`;
      if (!pillarPositions.has(key)) {
        pillarPositions.add(key);
        pillars.push({ x: pos.x, y: pos.y, wallStyleId });
      }
    }
    
    // Interior pillars based on segment count
    const numSegments = lengthPx / MODULAR_WALL_SPRITE_2TILE_WIDTH;
    
    const interiorPillarRatios: number[] = [];
    if (numSegments >= 5) {
      interiorPillarRatios.push(0.25, 0.5, 0.75);
    } else if (numSegments >= 3) {
      interiorPillarRatios.push(0.5);
    }
    
    for (const ratio of interiorPillarRatios) {
      // Round to avoid floating point issues
      const exactPos = Math.round(startPx + lengthPx * ratio);
      
      let pillarPos: { x: number; y: number };
      if (edge.orientation === 'horizontal') {
        pillarPos = { x: exactPos, y: positionPx };
      } else {
        pillarPos = { x: positionPx, y: exactPos };
      }
      
      const key = `${pillarPos.x},${pillarPos.y}`;
      if (!pillarPositions.has(key)) {
        pillarPositions.add(key);
        pillars.push({ ...pillarPos, wallStyleId });
      }
    }
  }
  
  return pillars;
}

/**
 * Extended Pillar type with edge info
 */
export interface PillarWithEdgeInfo extends Pillar {
  isCorner: boolean;  // True if this pillar is at a corner (edge endpoint)
  isExternal: boolean; // True if on external edge, false if on internal edge
}

/**
 * Calculate pillar positions with edge type awareness
 * 
 * Rules:
 * - ALL edges (external AND internal): Pillars at endpoints (corners)
 * - ONLY external edges: Interior pillars along the wall based on length
 * - Internal edges: NO interior pillars, only endpoint pillars
 * - NO pillars where doors are (pillars at door endpoints are skipped)
 */
export function generatePillarsWithEdgeInfo(
  externalEdges: PerimeterEdge[],
  internalEdges: PerimeterEdge[],
  wallStyleId: string,
  doors: ModularDoor[] = [],
  segmentStates: SegmentStatesMap = {},
  rooms: ModularRoomElement[] = [],
  wallGroups: WallGroup[] = [],
  edgeDoors: EdgeDoorsMap = {}
): PillarWithEdgeInfo[] {
  const pillars: PillarWithEdgeInfo[] = [];
  const pillarPositions = new Map<string, PillarWithEdgeInfo>(); // Track position -> pillar for dedup
  
  // Generate wall segment groups to check for doors from SegmentStates
  const wallSegmentGroups = generateWallSegmentGroups(rooms, doors, wallGroups);
  
  // Helper to check if a position overlaps with a SegmentState door
  const isPositionInSegmentStateDoor = (x: number, y: number): boolean => {
    for (const group of wallSegmentGroups) {
      const state = segmentStates[group.id];
      if (!state || state.pattern === 'SOLID_256') continue;
      
      // Get door openings from composition
      const composition = getSegmentComposition(segmentStates, group.id);
      
      for (const piece of composition) {
        if (piece.type !== 'door') continue;
        
        // Calculate door position
        let doorStartPx: number, doorEndPx: number, doorPositionPx: number;
        
        if (group.orientation === 'horizontal') {
          doorStartPx = group.rangeStart + piece.offsetPx;
          doorEndPx = doorStartPx + piece.widthPx;
          doorPositionPx = group.position;
          
          // Check if pillar is within door range
          if (Math.abs(y - doorPositionPx) < 2 && x > doorStartPx && x < doorEndPx) {
            return true;
          }
        } else {
          doorStartPx = group.rangeStart + piece.offsetPx;
          doorEndPx = doorStartPx + piece.widthPx;
          doorPositionPx = group.position;
          
          // Check if pillar is within door range (for vertical, Y is the range axis)
          if (Math.abs(x - doorPositionPx) < 2 && y > doorStartPx && y < doorEndPx) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  // Helper to check if a position overlaps with any door (legacy + new edgeDoors system)
  // Handles both internal (auto) doors and external (manual) doors
  const isPositionInDoor = (x: number, y: number): boolean => {
    // First check NEW edgeDoors system (free-placement doors)
    if (isPillarBlockedByEdgeDoor(x, y, rooms, edgeDoors)) {
      return true;
    }
    
    // Then check SegmentState doors (legacy)
    if (isPositionInSegmentStateDoor(x, y)) {
      return true;
    }
    
    // Then check legacy doors
    for (const door of doors) {
      // For manual external doors, edge data is in PIXELS
      if (door.isManual) {
        const doorPositionPx = Math.round(door.edgePosition);
        const doorStartPx = Math.round(door.edgeRangeStart + (door.offsetTiles || 0) * MODULAR_TILE_PX);
        const doorEndPx = doorStartPx + door.widthTiles * MODULAR_TILE_PX;
        
        if (door.edgeOrientation === 'horizontal') {
          // Horizontal door: check if pillar is within door range on x-axis
          if (Math.abs(y - doorPositionPx) < 2 && x >= doorStartPx && x <= doorEndPx) {
            return true;
          }
        } else {
          // Vertical door: check if pillar is within door range on y-axis
          if (Math.abs(x - doorPositionPx) < 2 && y >= doorStartPx && y <= doorEndPx) {
            return true;
          }
        }
        continue;
      }
      
      // For internal (auto) doors, find the CURRENT edge between rooms
      const currentEdge = internalEdges.find(e => {
        const roomsMatch = e.roomAId && e.roomBId &&
          ((door.roomAId === e.roomAId && door.roomBId === e.roomBId) ||
           (door.roomAId === e.roomBId && door.roomBId === e.roomAId));
        return roomsMatch;
      });
      
      // Use current edge if found, otherwise fall back to stored door values
      // Round all pixel values to avoid floating point precision issues
      const doorPositionPx = Math.round(currentEdge 
        ? currentEdge.position * MODULAR_TILE_PX 
        : door.edgePosition * MODULAR_TILE_PX);
      const edgeStartPx = Math.round(currentEdge 
        ? currentEdge.rangeStart * MODULAR_TILE_PX 
        : door.edgeRangeStart * MODULAR_TILE_PX);
      const edgeEndPx = Math.round(currentEdge 
        ? currentEdge.rangeEnd * MODULAR_TILE_PX 
        : door.edgeRangeEnd * MODULAR_TILE_PX);
      
      // Use CURRENT edge orientation
      const orientation = currentEdge ? currentEdge.orientation : door.edgeOrientation;
      
      const edgeLengthPx = edgeEndPx - edgeStartPx;
      const doorWidthPx = door.widthTiles * MODULAR_TILE_PX;
      
      // Door is centered on the edge
      const doorCenterPx = Math.round(edgeStartPx + edgeLengthPx / 2);
      const doorStartPx = doorCenterPx - doorWidthPx / 2;
      const doorEndPx = doorCenterPx + doorWidthPx / 2;
      
      if (orientation === 'horizontal') {
        // Horizontal door: check if pillar is within door range on x-axis and at door y-position
        if (y === doorPositionPx && x > doorStartPx && x < doorEndPx) {
          return true;
        }
      } else {
        // Vertical door: check if pillar is within door range on y-axis and at door x-position
        if (x === doorPositionPx && y > doorStartPx && y < doorEndPx) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Helper to add/update pillar (skips if position is inside a door)
  const addPillar = (x: number, y: number, isCorner: boolean, isExternal: boolean) => {
    // Skip pillars that would be inside a door opening
    if (isPositionInDoor(x, y)) {
      return;
    }
    
    const key = `${x},${y}`;
    const existing = pillarPositions.get(key);
    
    if (!existing) {
      const pillar: PillarWithEdgeInfo = { x, y, wallStyleId, isCorner, isExternal };
      pillarPositions.set(key, pillar);
    } else {
      if (isCorner) existing.isCorner = true;
      if (isExternal) existing.isExternal = true;
    }
  };
  
  // Process EXTERNAL edges - endpoint pillars + interior pillars
  for (const edge of externalEdges) {
    // Round all pixel values to avoid floating point precision issues
    const startPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const endPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const lengthPx = endPx - startPx;
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Endpoint pillars
    if (edge.orientation === 'horizontal') {
      addPillar(startPx, positionPx, true, true);
      addPillar(endPx, positionPx, true, true);
    } else {
      addPillar(positionPx, startPx, true, true);
      addPillar(positionPx, endPx, true, true);
    }
    
    // Interior pillars based on segment count (external only)
    // Place exactly at center positions (no snap to grid)
    const numSegments = lengthPx / MODULAR_WALL_SPRITE_2TILE_WIDTH;
    
    const interiorPillarRatios: number[] = [];
    if (numSegments >= 5) {
      interiorPillarRatios.push(0.25, 0.5, 0.75);
    } else if (numSegments >= 3) {
      interiorPillarRatios.push(0.5);
    }
    
    for (const ratio of interiorPillarRatios) {
      // Round to avoid floating point issues - must match generateWallSegments
      const exactPos = Math.round(startPx + lengthPx * ratio);
      
      if (edge.orientation === 'horizontal') {
        addPillar(exactPos, positionPx, false, true);
      } else {
        addPillar(positionPx, exactPos, false, true);
      }
    }
  }
  
  // Process INTERNAL edges - endpoint pillars ONLY, no interior pillars
  for (const edge of internalEdges) {
    // Round all pixel values to avoid floating point precision issues
    const startPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
    const endPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
    const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
    
    // Endpoint pillars only
    if (edge.orientation === 'horizontal') {
      addPillar(startPx, positionPx, true, false);
      addPillar(endPx, positionPx, true, false);
    } else {
      addPillar(positionPx, startPx, true, false);
      addPillar(positionPx, endPx, true, false);
    }
    // NO interior pillars for internal edges!
  }
  
  // Convert map to array
  pillarPositions.forEach(pillar => pillars.push(pillar));
  
  return pillars;
}

// ============================================
// DOOR MANAGEMENT
// ============================================

/**
 * Update manual door positions when a room moves
 * Moves the door's edge data by the same delta as the room
 */
export function updateManualDoorPositions(
  doors: ModularDoor[],
  roomId: string,
  deltaX: number,
  deltaY: number
): ModularDoor[] {
  return doors.map(door => {
    // Only update manual doors that belong to this room
    if (!door.isManual) return door;
    if (door.roomAId !== roomId && door.roomBId !== roomId) return door;
    
    // Calculate pixel deltas based on orientation
    // For horizontal edges (top/bottom walls): position changes with Y, range changes with X
    // For vertical edges (left/right walls): position changes with X, range changes with Y
    let newEdgePosition = door.edgePosition;
    let newEdgeRangeStart = door.edgeRangeStart;
    let newEdgeRangeEnd = door.edgeRangeEnd;
    
    if (door.edgeOrientation === 'horizontal') {
      // Horizontal wall: Y is position, X is range
      newEdgePosition += deltaY;
      newEdgeRangeStart += deltaX;
      newEdgeRangeEnd += deltaX;
    } else {
      // Vertical wall: X is position, Y is range
      newEdgePosition += deltaX;
      newEdgeRangeStart += deltaY;
      newEdgeRangeEnd += deltaY;
    }
    
    return {
      ...door,
      edgePosition: newEdgePosition,
      edgeRangeStart: newEdgeRangeStart,
      edgeRangeEnd: newEdgeRangeEnd,
    };
  });
}

/**
 * Generate stable edge key for door lookup
 * @deprecated Use the new generateEdgeKey in the SegmentState section instead
 */
export function generateLegacyEdgeKey(
  roomAId: string,
  roomBId: string,
  edge: SharedEdge
): string {
  const [id1, id2] = [roomAId, roomBId].sort();
  return `${id1}|${id2}|${edge.orientation}|${edge.position}|${edge.rangeStart}|${edge.rangeEnd}`;
}

/**
 * Recalculate ALL doors for a group of rooms based on their current positions
 * This should be called whenever any room in the group moves
 * Returns a new array of ModularDoor objects
 */
export function recalculateAllDoors(
  allRooms: ModularRoomElement[],
  existingDoors: ModularDoor[] = []
): ModularDoor[] {
  const newDoors: ModularDoor[] = [];
  
  // Separate manual and auto doors
  const manualDoors = existingDoors.filter(d => d.isManual);
  
  // Find all pairs of adjacent rooms and their shared edges
  const sharedEdges: { roomA: ModularRoomElement; roomB: ModularRoomElement; edge: SharedEdge }[] = [];
  const processedPairs = new Set<string>();
  
  for (let i = 0; i < allRooms.length; i++) {
    for (let j = i + 1; j < allRooms.length; j++) {
      const roomA = allRooms[i];
      const roomB = allRooms[j];
      
      // Create stable pair key
      const [id1, id2] = [roomA.id, roomB.id].sort();
      const pairKey = `${id1}-${id2}`;
      
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      
      const sharedEdge = getSharedEdge(roomA, roomB);
      if (sharedEdge) {
        sharedEdges.push({ roomA, roomB, edge: sharedEdge });
      }
    }
  }
  
  // Update manual doors that are now on shared edges (external -> internal)
  // and track which shared edges have manual doors
  const edgesWithManualDoors = new Set<string>();
  const updatedManualDoors: ModularDoor[] = [];
  
  for (const manualDoor of manualDoors) {
    // Check if this manual door is now on a shared edge
    let foundSharedEdge = false;
    
    for (const { roomA, roomB, edge } of sharedEdges) {
      // Check if the manual door's edge matches this shared edge
      // Manual doors store edge data in pixels, shared edge is in tiles
      const edgePositionPx = edge.position * MODULAR_TILE_PX;
      const edgeRangeStartPx = edge.rangeStart * MODULAR_TILE_PX;
      const edgeRangeEndPx = edge.rangeEnd * MODULAR_TILE_PX;
      
      const positionMatches = Math.abs(manualDoor.edgePosition - edgePositionPx) < 2;
      const orientationMatches = manualDoor.edgeOrientation === edge.orientation;
      
      // The manual door is on a shared edge if:
      // 1. Same orientation
      // 2. Same position (wall line)
      // 3. The door's range overlaps with the shared edge range
      const doorRangeStart = manualDoor.edgeRangeStart;
      const doorRangeEnd = manualDoor.edgeRangeEnd;
      const rangeOverlaps = doorRangeStart < edgeRangeEndPx && doorRangeEnd > edgeRangeStartPx;
      
      if (positionMatches && orientationMatches && rangeOverlaps) {
        // This manual door is now on a shared edge - update it to be internal
        const [sortedA, sortedB] = [roomA.id, roomB.id].sort();
        const edgeKey = `${edge.orientation}-${edge.position}-${sortedA}-${sortedB}`;
        edgesWithManualDoors.add(edgeKey);
        
        // Update roomBId if it was empty (was external, now internal)
        if (!manualDoor.roomBId || manualDoor.roomBId === '') {
          const updatedDoor: ModularDoor = {
            ...manualDoor,
            roomAId: sortedA,
            roomBId: sortedB,
            // Update edge data to match current shared edge
            edgeRangeStart: edgeRangeStartPx,
            edgeRangeEnd: edgeRangeEndPx,
          };
          updatedManualDoors.push(updatedDoor);
        } else {
          updatedManualDoors.push(manualDoor);
        }
        foundSharedEdge = true;
        break;
      }
    }
    
    if (!foundSharedEdge) {
      // Manual door is still on external wall
      updatedManualDoors.push(manualDoor);
    }
  }
  
  // Create auto-doors only for shared edges that don't have manual doors
  for (const { roomA, roomB, edge } of sharedEdges) {
    const [sortedA, sortedB] = [roomA.id, roomB.id].sort();
    const edgeKey = `${edge.orientation}-${edge.position}-${sortedA}-${sortedB}`;
    
    if (!edgesWithManualDoors.has(edgeKey)) {
      // No manual door on this edge - create auto door
      const door = createDoorAtMidpoint(roomA.id, roomB.id, edge);
      newDoors.push(door);
    }
  }
  
  // Return auto-doors plus updated manual doors
  return [...newDoors, ...updatedManualDoors];
}

/**
 * Create a door at the midpoint of a shared edge
 */
export function createDoorAtMidpoint(
  roomAId: string,
  roomBId: string,
  edge: SharedEdge
): ModularDoor {
  const [sortedA, sortedB] = [roomAId, roomBId].sort();
  const edgeLength = edge.rangeEnd - edge.rangeStart;
  const midOffset = Math.floor((edgeLength - 1) / 2);
  
  return {
    id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    roomAId: sortedA,
    roomBId: sortedB,
    edgeOrientation: edge.orientation,
    edgePosition: edge.position,
    edgeRangeStart: edge.rangeStart,
    edgeRangeEnd: edge.rangeEnd,
    offsetTiles: midOffset,
    widthTiles: 1,
  };
}

/**
 * Find doors for a specific shared edge
 */
export function findDoorsForEdge(
  doors: ModularDoor[],
  edge: SharedEdge
): ModularDoor[] {
  return doors.filter(d =>
    d.edgeOrientation === edge.orientation &&
    d.edgePosition === edge.position &&
    d.edgeRangeStart === edge.rangeStart &&
    d.edgeRangeEnd === edge.rangeEnd
  );
}

// ============================================
// DROP SIMULATION
// ============================================

/**
 * Simulate dropping a room at a new position (in pixels)
 * Returns preview info without mutating state
 */
export function simulateDrop(
  movedRoom: ModularRoomElement,
  newX: number,
  newY: number,
  allRooms: ModularRoomElement[],
  state: ModularRoomsState
): ModularDropSimulation {
  // Create a virtual moved room
  const virtualRoom: ModularRoomElement = {
    ...movedRoom,
    x: newX,
    y: newY,
  };
  
  // Get rooms that would be adjacent at new position
  const otherRooms = allRooms.filter(r => r.id !== movedRoom.id);
  const newlyAdjacentRooms = getAdjacentRooms(virtualRoom, otherRooms);
  
  // If no adjacency, no merge
  if (newlyAdjacentRooms.length === 0) {
    return {
      newPosition: { x: newX, y: newY },
      willMerge: false,
      targetGroupId: null,
      targetWallStyleId: null,
      newDoors: [],
      removedDoorIds: [],
      affectedRoomIds: [movedRoom.id],
    };
  }
  
  // Find target group using "TARGET WINS" rule
  // Target = group with largest shared boundary overlap
  const groupBoundaries = new Map<string, number>();
  
  for (const adjRoom of newlyAdjacentRooms) {
    const groupId = adjRoom.wallGroupId;
    const roomsInGroup = otherRooms.filter(r => r.wallGroupId === groupId);
    const sharedLength = calculateSharedBoundaryLength(virtualRoom, roomsInGroup);
    
    groupBoundaries.set(groupId, (groupBoundaries.get(groupId) || 0) + sharedLength);
  }
  
  // Pick group with largest shared boundary
  let targetGroupId: string | null = null;
  let maxShared = 0;
  
  groupBoundaries.forEach((length, groupId) => {
    if (length > maxShared) {
      maxShared = length;
      targetGroupId = groupId;
    }
  });
  
  // Get target wall style
  const targetWallStyleId = targetGroupId
    ? state.wallGroups.find(g => g.id === targetGroupId)?.wallStyleId || DEFAULT_WALL_STYLE_ID
    : null;
  
  // Will merge if the moved room's current group is different from target
  const willMerge = movedRoom.wallGroupId !== targetGroupId;
  
  // Find new doors needed (for new adjacencies)
  const newDoors: ModularDoor[] = [];
  const existingDoorsArray = state.doors || [];
  for (const adjRoom of newlyAdjacentRooms) {
    const edge = getSharedEdge(virtualRoom, adjRoom);
    if (edge) {
      // Check if door already exists for this edge
      const existingDoors = findDoorsForEdge(existingDoorsArray, edge);
      if (existingDoors.length === 0) {
        // Create new door at midpoint
        newDoors.push(createDoorAtMidpoint(virtualRoom.id, adjRoom.id, edge));
      }
    }
  }
  
  // Find doors to remove (adjacencies that break)
  const removedDoorIds: string[] = [];
  for (const door of existingDoorsArray) {
    // Check if this door involves the moved room
    if (door.roomAId === movedRoom.id || door.roomBId === movedRoom.id) {
      const otherRoomId = door.roomAId === movedRoom.id ? door.roomBId : door.roomAId;
      const otherRoom = otherRooms.find(r => r.id === otherRoomId);
      
      if (otherRoom) {
        // Check if still adjacent at new position
        const stillAdjacent = areRoomsAdjacent(virtualRoom, otherRoom);
        if (!stillAdjacent) {
          removedDoorIds.push(door.id);
        }
      }
    }
  }
  
  // Collect affected room IDs
  const affectedRoomIds = new Set<string>([movedRoom.id]);
  
  if (willMerge && movedRoom.wallGroupId) {
    // All rooms in the old group are affected
    const oldGroupRooms = allRooms.filter(r => r.wallGroupId === movedRoom.wallGroupId);
    oldGroupRooms.forEach(r => affectedRoomIds.add(r.id));
  }
  
  return {
    newPosition: { x: newX, y: newY },
    willMerge,
    targetGroupId,
    targetWallStyleId,
    newDoors,
    removedDoorIds,
    affectedRoomIds: Array.from(affectedRoomIds),
  };
}

// ============================================
// WALL GROUP ID GENERATION
// ============================================

/**
 * Generate a unique wall group ID
 */
export function generateWallGroupId(): string {
  return `wg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique modular room ID
 */
export function generateModularRoomId(): string {
  return `mr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// HELPER TO GET MODULAR ROOMS FROM ELEMENTS
// ============================================

/**
 * Filter modular rooms from scene elements
 */
export function getModularRooms(elements: MapElement[]): ModularRoomElement[] {
  return elements.filter((el): el is ModularRoomElement => el.type === 'modularRoom');
}

/**
 * Check if a point (in pixels) is inside a modular room
 */
export function isPointInModularRoom(
  x: number,
  y: number,
  room: ModularRoomElement
): boolean {
  const rect = getRoomPixelRect(room);
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/**
 * Find which modular room contains a point
 */
export function findModularRoomAtPoint(
  x: number,
  y: number,
  rooms: ModularRoomElement[]
): ModularRoomElement | null {
  // Return topmost (last in array, assuming z-order)
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (isPointInModularRoom(x, y, rooms[i])) {
      return rooms[i];
    }
  }
  return null;
}

/**
 * Parse floor image filename to extract dimensions
 * Example: "floor_3x4.png" -> { tilesW: 3, tilesH: 4 }
 */
export function parseFloorFilename(filename: string): { tilesW: number; tilesH: number } | null {
  const match = filename.match(/floor_(\d+)x(\d+)\.png$/i);
  if (match) {
    return {
      tilesW: parseInt(match[1], 10),
      tilesH: parseInt(match[2], 10),
    };
  }
  return null;
}

// ============================================
// SMART SNAP FOR MODULAR ROOM DRAGGING
// ============================================

/**
 * Check if two rooms overlap (in pixels)
 */
export function roomsOverlapPx(
  room1: { x: number; y: number; w: number; h: number },
  room2: { x: number; y: number; w: number; h: number }
): boolean {
  // Use small epsilon to prevent floating point issues
  const eps = 0.1;
  return !(
    room1.x + room1.w <= room2.x + eps ||
    room2.x + room2.w <= room1.x + eps ||
    room1.y + room1.h <= room2.y + eps ||
    room2.y + room2.h <= room1.y + eps
  );
}

/**
 * Magnetic snap result - returns the position to snap to and shared edge info
 */
export interface MagneticSnapResult {
  x: number;  // Final X position in pixels
  y: number;  // Final Y position in pixels
  snappedToRoom: string | null;  // ID of room we snapped to, or null if free placement
  sharedEdgeTiles: number;  // How many tiles of edge are shared (0 if free)
}

/**
 * Calculate shared edge length in tiles between two adjacent rooms (pixel coords)
 */
function calculateSharedEdgePx(
  room1: { x: number; y: number; w: number; h: number },
  room2: { x: number; y: number; w: number; h: number }
): number {
  const eps = 0.1;
  
  // Check horizontal adjacency (vertical shared edge)
  if (Math.abs(room1.x + room1.w - room2.x) < eps || Math.abs(room2.x + room2.w - room1.x) < eps) {
    const overlapStart = Math.max(room1.y, room2.y);
    const overlapEnd = Math.min(room1.y + room1.h, room2.y + room2.h);
    if (overlapEnd > overlapStart) {
      return Math.round((overlapEnd - overlapStart) / MODULAR_TILE_PX);
    }
  }
  
  // Check vertical adjacency (horizontal shared edge)
  if (Math.abs(room1.y + room1.h - room2.y) < eps || Math.abs(room2.y + room2.h - room1.y) < eps) {
    const overlapStart = Math.max(room1.x, room2.x);
    const overlapEnd = Math.min(room1.x + room1.w, room2.x + room2.w);
    if (overlapEnd > overlapStart) {
      return Math.round((overlapEnd - overlapStart) / MODULAR_TILE_PX);
    }
  }
  
  return 0;
}

/**
 * Find magnetic snap position for a modular room being dragged.
 * 
 * Key behavior:
 * 1. If no other rooms exist → place FREELY at cursor position
 * 2. Room follows cursor freely until it gets close to another room's edge
 * 3. "Close" = within magnetDistancePx of an edge (default ~1 tile)
 * 4. When close, snap to align edges and use target room's grid
 * 5. Never overlap with other rooms
 */
export function findMagneticSnapPosition(
  draggedRoom: ModularRoomElement,
  cursorX: number,  // Cursor position in pixels
  cursorY: number,
  otherRooms: ModularRoomElement[],
  magnetDistancePx: number = 128  // 1 tile distance for snap activation
): MagneticSnapResult {
  const draggedW = draggedRoom.tilesW * MODULAR_TILE_PX;
  const draggedH = draggedRoom.tilesH * MODULAR_TILE_PX;
  
  // NO OTHER ROOMS = completely free placement, no grid, no snap
  if (otherRooms.length === 0) {
    return { x: cursorX, y: cursorY, snappedToRoom: null, sharedEdgeTiles: 0 };
  }
  
  // Filter out the dragged room itself
  const validOtherRooms = otherRooms.filter(r => r.id !== draggedRoom.id);
  if (validOtherRooms.length === 0) {
    return { x: cursorX, y: cursorY, snappedToRoom: null, sharedEdgeTiles: 0 };
  }
  
  // Find the closest room edge and distance
  let bestSnap: { x: number; y: number; roomId: string; sharedEdge: number; distance: number } | null = null;
  
  for (const targetRoom of validOtherRooms) {
    const targetX = targetRoom.x;
    const targetY = targetRoom.y;
    const targetW = targetRoom.tilesW * MODULAR_TILE_PX;
    const targetH = targetRoom.tilesH * MODULAR_TILE_PX;
    const targetRight = targetX + targetW;
    const targetBottom = targetY + targetH;
    
    // IMPORTANT: First check if cursor is actually NEAR this room's bounding box
    // We expand the bounding box by magnetDistancePx in all directions
    // If cursor is outside this expanded box, skip this room entirely
    const expandedLeft = targetX - magnetDistancePx - draggedW;
    const expandedRight = targetRight + magnetDistancePx;
    const expandedTop = targetY - magnetDistancePx - draggedH;
    const expandedBottom = targetBottom + magnetDistancePx;
    
    if (cursorX < expandedLeft || cursorX > expandedRight ||
        cursorY < expandedTop || cursorY > expandedBottom) {
      // Cursor is too far from this room - skip it entirely
      continue;
    }
    
    // Helper to align to target's tile grid
    const alignToGrid = (pos: number, gridOrigin: number): number => {
      const offset = pos - gridOrigin;
      return gridOrigin + Math.round(offset / MODULAR_TILE_PX) * MODULAR_TILE_PX;
    };
    
    // Check each possible snap scenario
    const candidates: Array<{ x: number; y: number; distance: number }> = [];
    
    // 1. Snap dragged room's LEFT edge to target's RIGHT edge
    const leftToRightDist = Math.abs(cursorX - targetRight);
    if (leftToRightDist < magnetDistancePx) {
      const alignedY = alignToGrid(
        Math.max(targetY - draggedH + MODULAR_TILE_PX, Math.min(targetBottom - MODULAR_TILE_PX, cursorY)),
        targetY
      );
      candidates.push({ x: targetRight, y: alignedY, distance: leftToRightDist });
    }
    
    // 2. Snap dragged room's RIGHT edge to target's LEFT edge
    const rightToLeftDist = Math.abs(cursorX + draggedW - targetX);
    if (rightToLeftDist < magnetDistancePx) {
      const alignedY = alignToGrid(
        Math.max(targetY - draggedH + MODULAR_TILE_PX, Math.min(targetBottom - MODULAR_TILE_PX, cursorY)),
        targetY
      );
      candidates.push({ x: targetX - draggedW, y: alignedY, distance: rightToLeftDist });
    }
    
    // 3. Snap dragged room's TOP edge to target's BOTTOM edge
    const topToBottomDist = Math.abs(cursorY - targetBottom);
    if (topToBottomDist < magnetDistancePx) {
      const alignedX = alignToGrid(
        Math.max(targetX - draggedW + MODULAR_TILE_PX, Math.min(targetRight - MODULAR_TILE_PX, cursorX)),
        targetX
      );
      candidates.push({ x: alignedX, y: targetBottom, distance: topToBottomDist });
    }
    
    // 4. Snap dragged room's BOTTOM edge to target's TOP edge
    const bottomToTopDist = Math.abs(cursorY + draggedH - targetY);
    if (bottomToTopDist < magnetDistancePx) {
      const alignedX = alignToGrid(
        Math.max(targetX - draggedW + MODULAR_TILE_PX, Math.min(targetRight - MODULAR_TILE_PX, cursorX)),
        targetX
      );
      candidates.push({ x: alignedX, y: targetY - draggedH, distance: bottomToTopDist });
    }
    
    // Evaluate candidates for this target room
    for (const candidate of candidates) {
      const candidateRect = { x: candidate.x, y: candidate.y, w: draggedW, h: draggedH };
      
      // Check for overlaps with ALL other rooms
      let hasOverlap = false;
      for (const other of validOtherRooms) {
        const otherRect = {
          x: other.x, y: other.y,
          w: other.tilesW * MODULAR_TILE_PX,
          h: other.tilesH * MODULAR_TILE_PX,
        };
        if (roomsOverlapPx(candidateRect, otherRect)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Calculate shared edge
      const targetRect = { x: targetX, y: targetY, w: targetW, h: targetH };
      const sharedEdge = calculateSharedEdgePx(candidateRect, targetRect);
      
      // Only consider if there's actual shared edge
      if (sharedEdge > 0) {
        const isBetter = !bestSnap || 
          candidate.distance < bestSnap.distance - 10 ||
          (Math.abs(candidate.distance - bestSnap.distance) < 10 && sharedEdge > bestSnap.sharedEdge);
        
        if (isBetter) {
          bestSnap = {
            x: candidate.x,
            y: candidate.y,
            roomId: targetRoom.id,
            sharedEdge,
            distance: candidate.distance,
          };
        }
      }
    }
  }
  
  // If we found a valid snap, use it
  if (bestSnap) {
    return {
      x: bestSnap.x,
      y: bestSnap.y,
      snappedToRoom: bestSnap.roomId,
      sharedEdgeTiles: bestSnap.sharedEdge,
    };
  }
  
  // No snap found - check if cursor position overlaps with any room
  // If overlapping, find the best adjacent snap to that room instead of jumping back to start
  const cursorBounds = { x: cursorX, y: cursorY, w: draggedW, h: draggedH };
  for (const other of validOtherRooms) {
    const otherRect = {
      x: other.x, y: other.y,
      w: other.tilesW * MODULAR_TILE_PX,
      h: other.tilesH * MODULAR_TILE_PX,
    };
    if (roomsOverlapPx(cursorBounds, otherRect)) {
      // Overlap detected! Instead of jumping back, snap to closest edge of this room
      const targetX = other.x;
      const targetY = other.y;
      const targetW = other.tilesW * MODULAR_TILE_PX;
      const targetH = other.tilesH * MODULAR_TILE_PX;
      const targetRight = targetX + targetW;
      const targetBottom = targetY + targetH;
      
      // Helper to align to target's tile grid
      const alignToGrid = (pos: number, gridOrigin: number): number => {
        const offset = pos - gridOrigin;
        return gridOrigin + Math.round(offset / MODULAR_TILE_PX) * MODULAR_TILE_PX;
      };
      
      // Find closest edge based on cursor position relative to room center
      const roomCenterX = targetX + targetW / 2;
      const roomCenterY = targetY + targetH / 2;
      const cursorCenterX = cursorX + draggedW / 2;
      const cursorCenterY = cursorY + draggedH / 2;
      
      // Calculate which side cursor is approaching from
      const dx = cursorCenterX - roomCenterX;
      const dy = cursorCenterY - roomCenterY;
      
      let snapX: number, snapY: number;
      
      // Prefer horizontal or vertical based on which direction is more pronounced
      if (Math.abs(dx) / targetW > Math.abs(dy) / targetH) {
        // Horizontal approach - snap to left or right
        if (dx > 0) {
          // Coming from right - snap to right edge
          snapX = targetRight;
        } else {
          // Coming from left - snap to left edge
          snapX = targetX - draggedW;
        }
        snapY = alignToGrid(cursorY, targetY);
        // Clamp Y to valid range for shared edge
        snapY = Math.max(targetY - draggedH + MODULAR_TILE_PX, Math.min(targetBottom - MODULAR_TILE_PX, snapY));
        snapY = alignToGrid(snapY, targetY);
      } else {
        // Vertical approach - snap to top or bottom
        if (dy > 0) {
          // Coming from below - snap to bottom edge
          snapY = targetBottom;
        } else {
          // Coming from above - snap to top edge
          snapY = targetY - draggedH;
        }
        snapX = alignToGrid(cursorX, targetX);
        // Clamp X to valid range for shared edge
        snapX = Math.max(targetX - draggedW + MODULAR_TILE_PX, Math.min(targetRight - MODULAR_TILE_PX, snapX));
        snapX = alignToGrid(snapX, targetX);
      }
      
      // Verify this position doesn't overlap with other rooms
      const proposedRect = { x: snapX, y: snapY, w: draggedW, h: draggedH };
      let isValid = true;
      for (const check of validOtherRooms) {
        const checkRect = {
          x: check.x, y: check.y,
          w: check.tilesW * MODULAR_TILE_PX,
          h: check.tilesH * MODULAR_TILE_PX,
        };
        if (roomsOverlapPx(proposedRect, checkRect)) {
          isValid = false;
          break;
        }
      }
      
      if (isValid) {
        return { x: snapX, y: snapY, snappedToRoom: other.id, sharedEdgeTiles: 1 };
      }
      
      // If not valid, continue checking other rooms - don't jump back to start
    }
  }
  
  // Free placement - no snap, no overlap
  return { x: cursorX, y: cursorY, snappedToRoom: null, sharedEdgeTiles: 0 };
}

// ============================================
// WALL GROUP MANAGEMENT - SPLIT & MERGE
// ============================================

/**
 * Find all connected components within a set of rooms.
 * Returns an array of arrays, where each inner array is a connected component (rooms that are adjacent).
 */
export function findConnectedComponents(rooms: ModularRoomElement[]): ModularRoomElement[][] {
  if (rooms.length === 0) return [];
  
  const visited = new Set<string>();
  const components: ModularRoomElement[][] = [];
  
  function bfs(startRoom: ModularRoomElement): ModularRoomElement[] {
    const component: ModularRoomElement[] = [];
    const queue: ModularRoomElement[] = [startRoom];
    visited.add(startRoom.id);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      
      // Find all adjacent rooms that haven't been visited
      for (const other of rooms) {
        if (!visited.has(other.id)) {
          const adjacent = areRoomsAdjacent(current, other);
          if (adjacent) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
    }
    
    return component;
  }
  
  // Find all connected components
  for (const room of rooms) {
    if (!visited.has(room.id)) {
      const component = bfs(room);
      components.push(component);
    }
  }
  
  return components;
}

/**
 * Check if removing a room would split a group into multiple components.
 * Returns the new components that would result, or null if no split occurs.
 */
export function checkGroupSplitAfterRemoval(
  allRooms: ModularRoomElement[],
  removedRoomId: string
): { needsSplit: boolean; components: ModularRoomElement[][] } {
  // Get the removed room to find its group
  const removedRoom = allRooms.find(r => r.id === removedRoomId);
  
  if (!removedRoom || !removedRoom.wallGroupId) {
    return { needsSplit: false, components: [] };
  }
  
  // Get all other rooms in the same group
  const sameGroupRooms = allRooms.filter(
    r => r.id !== removedRoomId && r.wallGroupId === removedRoom.wallGroupId
  );
  
  if (sameGroupRooms.length <= 1) {
    // 0 or 1 room remaining - no split needed
    return { needsSplit: false, components: sameGroupRooms.length === 1 ? [sameGroupRooms] : [] };
  }
  
  // Find connected components among remaining rooms
  const components = findConnectedComponents(sameGroupRooms);
  
  // If more than one component, a split occurred
  return {
    needsSplit: components.length > 1,
    components,
  };
}

/**
 * Generate updates for rooms when a group is split.
 * The largest component keeps the original group ID, others get new IDs.
 * If sizes are equal, the component with the oldest room (lowest room ID) wins.
 */
export function generateSplitUpdates(
  components: ModularRoomElement[][],
  originalGroupId: string,
  wallGroups: WallGroup[]
): {
  roomUpdates: { roomId: string; newWallGroupId: string }[];
  newWallGroups: WallGroup[];
  updatedOriginalGroup: WallGroup | null;
} {
  if (components.length <= 1) {
    return { roomUpdates: [], newWallGroups: [], updatedOriginalGroup: null };
  }
  
  // Find the original wall group to get its style
  const originalGroup = wallGroups.find(g => g.id === originalGroupId);
  const originalWallStyleId = originalGroup?.wallStyleId || 'dungeon';
  
  // Sort components: largest first, then by oldest room ID (alphabetically for determinism)
  const sortedComponents = [...components].sort((a, b) => {
    // First by size (descending)
    if (b.length !== a.length) {
      return b.length - a.length;
    }
    // Then by oldest room ID in each component (ascending = oldest wins)
    const oldestA = a.map(r => r.id).sort()[0];
    const oldestB = b.map(r => r.id).sort()[0];
    return oldestA.localeCompare(oldestB);
  });
  
  const roomUpdates: { roomId: string; newWallGroupId: string }[] = [];
  const newWallGroups: WallGroup[] = [];
  
  // First component keeps original group ID - update its roomCount
  const updatedOriginalGroup: WallGroup = {
    id: originalGroupId,
    wallStyleId: originalWallStyleId,
    roomCount: sortedComponents[0].length,
  };
  
  // Other components get new IDs
  for (let i = 1; i < sortedComponents.length; i++) {
    const component = sortedComponents[i];
    const newGroupId = `wallgroup-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new wall group with same style as original and correct roomCount
    newWallGroups.push({
      id: newGroupId,
      wallStyleId: originalWallStyleId,
      roomCount: component.length,
    });
    
    // Update all rooms in this component
    for (const room of component) {
      roomUpdates.push({
        roomId: room.id,
        newWallGroupId: newGroupId,
      });
    }
  }
  
  return { roomUpdates, newWallGroups, updatedOriginalGroup };
}

/**
 * Find all groups that a room would connect to if placed at a given position.
 * Returns unique group IDs of adjacent rooms.
 */
export function findAdjacentGroups(
  placedRoom: ModularRoomElement,
  allRooms: ModularRoomElement[]
): string[] {
  const adjacentGroupIds = new Set<string>();
  
  for (const other of allRooms) {
    if (other.id === placedRoom.id) continue;
    if (areRoomsAdjacent(placedRoom, other) && other.wallGroupId) {
      adjacentGroupIds.add(other.wallGroupId);
    }
  }
  
  return Array.from(adjacentGroupIds);
}

/**
 * Determine which group should dominate when merging multiple groups.
 * Largest group (highest roomCount) wins. If equal, oldest group (lowest ID) wins.
 */
export function getDominantGroup(
  groupIds: string[],
  wallGroups: WallGroup[]
): { dominantGroupId: string; dominantWallStyleId: string; dominantRoomCount: number } | null {
  if (groupIds.length === 0) return null;
  if (groupIds.length === 1) {
    const group = wallGroups.find(g => g.id === groupIds[0]);
    return {
      dominantGroupId: groupIds[0],
      dominantWallStyleId: group?.wallStyleId || 'dungeon',
      dominantRoomCount: group?.roomCount || 1,
    };
  }
  
  // Get group info with roomCount
  const groupInfo = groupIds.map(gid => {
    const group = wallGroups.find(g => g.id === gid);
    return {
      groupId: gid,
      roomCount: group?.roomCount || 0,
      wallStyleId: group?.wallStyleId || 'dungeon',
    };
  });
  
  // Sort by roomCount (desc), then by group ID (asc = oldest wins)
  groupInfo.sort((a, b) => {
    if (b.roomCount !== a.roomCount) return b.roomCount - a.roomCount;
    return a.groupId.localeCompare(b.groupId);
  });
  
  const dominant = groupInfo[0];
  
  return {
    dominantGroupId: dominant.groupId,
    dominantWallStyleId: dominant.wallStyleId,
    dominantRoomCount: dominant.roomCount,
  };
}

/**
 * Generate updates when a room connects multiple groups (merge).
 * All rooms from non-dominant groups get updated to the dominant group ID.
 * Returns updated dominant group with new roomCount.
 */
export function generateMergeUpdates(
  placedRoom: ModularRoomElement,
  adjacentGroupIds: string[],
  allRooms: ModularRoomElement[],
  wallGroups: WallGroup[]
): {
  roomUpdates: { roomId: string; newWallGroupId: string }[];
  groupsToRemove: string[];
  updatedDominantGroup: WallGroup;
} | null {
  if (adjacentGroupIds.length <= 1) return null;
  
  const dominant = getDominantGroup(adjacentGroupIds, wallGroups);
  if (!dominant) return null;
  
  const { dominantGroupId, dominantWallStyleId } = dominant;
  const roomUpdates: { roomId: string; newWallGroupId: string }[] = [];
  const groupsToRemove: string[] = [];
  
  // Calculate total room count for merged group
  let totalRoomCount = 0;
  
  // Update all rooms from non-dominant groups
  for (const groupId of adjacentGroupIds) {
    const group = wallGroups.find(g => g.id === groupId);
    totalRoomCount += group?.roomCount || 0;
    
    if (groupId === dominantGroupId) continue;
    
    groupsToRemove.push(groupId);
    
    const roomsInGroup = allRooms.filter(r => r.wallGroupId === groupId);
    for (const room of roomsInGroup) {
      roomUpdates.push({
        roomId: room.id,
        newWallGroupId: dominantGroupId,
      });
    }
  }
  
  // Also update the placed room itself to use dominant group
  if (placedRoom.wallGroupId !== dominantGroupId) {
    // If the placed room had no group or a different group, add 1 to count
    if (!placedRoom.wallGroupId || !adjacentGroupIds.includes(placedRoom.wallGroupId)) {
      totalRoomCount += 1;
    }
    roomUpdates.push({
      roomId: placedRoom.id,
      newWallGroupId: dominantGroupId,
    });
  }
  
  // Create updated dominant group with new total roomCount
  const updatedDominantGroup: WallGroup = {
    id: dominantGroupId,
    wallStyleId: dominantWallStyleId,
    roomCount: totalRoomCount,
  };
  
  return {
    roomUpdates,
    groupsToRemove,
    updatedDominantGroup,
  };
}

// ============================================
// WALL SEGMENT GROUPS (for Door Tool)
// ============================================

import {
  WALL_SEGMENT_GROUP_SIZE_PX,
  WALL_SNAP_SIZE_PX,
} from '../constants';

import {
  // WallSegmentGroup, - moved to top imports
  WallSegmentComponent,
} from '../types';

/**
 * Generate a STABLE wall segment group ID based on rooms and relative edge position
 * This ensures the same wall segment always gets the same ID,
 * so SegmentStates persist when rooms are moved
 */
export function generateWallSegmentGroupId(
  orientation: 'horizontal' | 'vertical',
  roomIds: string[],
  edgeIndex: number,  // Which edge on this room(s)
  segmentIndex: number  // Which 256px segment on the edge
): string {
  // Sort roomIds for consistency (same rooms in any order = same ID)
  const sortedRoomIds = [...roomIds].sort().join('+');
  const o = orientation === 'horizontal' ? 'h' : 'v';
  return `wsg-${o}-${sortedRoomIds}-e${edgeIndex}-s${segmentIndex}`;
}

/**
 * Generate WallSegmentGroups from room geometry and existing doors
 * This is called when loading a scene that doesn't have wallSegmentGroups yet
 */
export function generateWallSegmentGroups(
  rooms: ModularRoomElement[],
  doors: ModularDoor[],
  wallGroups: WallGroup[]
): WallSegmentGroup[] {
  const segmentGroups: WallSegmentGroup[] = [];
  
  if (rooms.length === 0) return segmentGroups;
  
  // Get all edges (internal and external) for the rooms
  const roomIds = rooms.map(r => r.id);
  const { externalEdges, internalEdges } = getGroupEdges(roomIds, rooms);
  
  let edgeIndex = 0;
  
  // Process external edges
  for (const edge of externalEdges) {
    const groups = createWallSegmentGroupsForEdge(edge, doors, wallGroups, rooms, true, edgeIndex);
    segmentGroups.push(...groups);
    edgeIndex++;
  }
  
  // Process internal edges
  for (const edge of internalEdges) {
    const groups = createWallSegmentGroupsForEdge(edge, doors, wallGroups, rooms, false, edgeIndex);
    segmentGroups.push(...groups);
    edgeIndex++;
  }
  
  return segmentGroups;
}

/**
 * Create WallSegmentGroups for a single edge
 * Splits the edge into 256px chunks and handles doors
 */
function createWallSegmentGroupsForEdge(
  edge: PerimeterEdge,
  doors: ModularDoor[],
  wallGroups: WallGroup[],
  rooms: ModularRoomElement[],
  isExternal: boolean,
  edgeIndex: number
): WallSegmentGroup[] {
  const groups: WallSegmentGroup[] = [];
  
  const edgeStartPx = Math.round(edge.rangeStart * MODULAR_TILE_PX);
  const edgeEndPx = Math.round(edge.rangeEnd * MODULAR_TILE_PX);
  const edgeLengthPx = edgeEndPx - edgeStartPx;
  const positionPx = Math.round(edge.position * MODULAR_TILE_PX);
  
  // Get wall style from the room(s)
  let wallStyleId = DEFAULT_WALL_STYLE_ID;
  const roomIds: string[] = [];
  
  if (edge.roomAId) {
    roomIds.push(edge.roomAId);
    const roomA = rooms.find(r => r.id === edge.roomAId);
    if (roomA?.wallGroupId) {
      const wallGroup = wallGroups.find(g => g.id === roomA.wallGroupId);
      if (wallGroup) wallStyleId = wallGroup.wallStyleId;
    }
  }
  if (edge.roomBId) {
    roomIds.push(edge.roomBId);
  }
  
  // Find doors on this edge
  const edgeDoors = doors.filter(d => {
    // For internal edges, check if door connects the same two rooms
    if (!isExternal && edge.roomAId && edge.roomBId) {
      const roomsMatch = 
        (d.roomAId === edge.roomAId && d.roomBId === edge.roomBId) ||
        (d.roomAId === edge.roomBId && d.roomBId === edge.roomAId);
      if (roomsMatch) return true;
    }
    
    // For manual doors (on any edge type), check position overlap
    // Manual doors store position in pixels
    if (d.isManual) {
      // Check orientation matches
      if (d.edgeOrientation !== edge.orientation) return false;
      
      // Check position (wall line) matches
      if (Math.abs(d.edgePosition - positionPx) > 2) return false;
      
      // Check range overlap
      const doorRangeStart = d.edgeRangeStart;
      const doorRangeEnd = d.edgeRangeEnd;
      const edgeRangeOverlaps = doorRangeStart < edgeEndPx && doorRangeEnd > edgeStartPx;
      
      if (edgeRangeOverlaps) return true;
    }
    
    return false;
  });
  
  // Split edge into 256px groups
  let currentPx = edgeStartPx;
  let segmentIndex = 0;
  
  while (currentPx < edgeEndPx) {
    const groupStartPx = currentPx;
    const groupEndPx = Math.min(currentPx + WALL_SEGMENT_GROUP_SIZE_PX, edgeEndPx);
    
    // Determine if this group is at the start/end of the edge (at a corner)
    const isAtEdgeStart = groupStartPx === edgeStartPx;
    const isAtEdgeEnd = groupEndPx === edgeEndPx;
    
    // Find doors within this group
    const groupDoors = edgeDoors.filter(d => {
      let doorStartPx: number;
      let doorEndPx: number;
      
      if (d.isManual) {
        // Manual doors: use edgeRangeStart + offsetTiles to find door position
        // Door's edgeRangeStart is in pixels, offsetTiles is in tiles
        doorStartPx = d.edgeRangeStart + (d.offsetTiles * MODULAR_TILE_PX);
        doorEndPx = doorStartPx + (d.widthTiles * MODULAR_TILE_PX);
      } else {
        // Auto doors: centered on the edge
        const doorCenterPx = edgeStartPx + (edgeLengthPx / 2);
        doorStartPx = doorCenterPx - (d.widthTiles * MODULAR_TILE_PX / 2);
        doorEndPx = doorCenterPx + (d.widthTiles * MODULAR_TILE_PX / 2);
      }
      
      // Check if door overlaps with this group
      return doorStartPx < groupEndPx && doorEndPx > groupStartPx;
    });
    
    // Create components for this group
    const components = createComponentsForGroup(
      groupStartPx,
      groupEndPx,
      groupDoors,
      edgeStartPx,
      edgeLengthPx
    );
    
    const group: WallSegmentGroup = {
      id: generateWallSegmentGroupId(edge.orientation, roomIds, edgeIndex, segmentIndex),
      orientation: edge.orientation,
      position: positionPx,
      rangeStart: groupStartPx,
      rangeEnd: groupEndPx,
      wallStyleId,
      components,
      roomIds,
      isExternal,
      isAtEdgeStart,
      isAtEdgeEnd,
    };
    
    groups.push(group);
    currentPx = groupEndPx;
    segmentIndex++;
  }
  
  return groups;
}

/**
 * Create components for a single 256px (or smaller) wall segment group
 */
function createComponentsForGroup(
  groupStartPx: number,
  groupEndPx: number,
  doors: ModularDoor[],
  _edgeStartPx: number,
  _edgeLengthPx: number
): WallSegmentComponent[] {
  const components: WallSegmentComponent[] = [];
  const groupLengthPx = groupEndPx - groupStartPx;
  
  if (doors.length === 0) {
    // No doors - single wall component
    components.push({
      type: 'wall',
      widthPx: groupLengthPx as 64 | 128 | 256,
      offsetPx: 0,
    });
  } else {
    // Has doors - need to split around them
    // For simplicity, we handle one door per group (most common case)
    const door = doors[0];
    
    // Calculate door position based on door type
    let doorStartPx: number;
    let doorEndPx: number;
    
    if (door.isManual) {
      // Manual doors: use edgeRangeStart + offsetTiles
      doorStartPx = door.edgeRangeStart + (door.offsetTiles * MODULAR_TILE_PX);
      doorEndPx = doorStartPx + (door.widthTiles * MODULAR_TILE_PX);
    } else {
      // Auto doors: centered on the edge
      const doorWidthPx = door.widthTiles * MODULAR_TILE_PX;
      const doorCenterPx = _edgeStartPx + (_edgeLengthPx / 2);
      doorStartPx = doorCenterPx - (doorWidthPx / 2);
      doorEndPx = doorCenterPx + (doorWidthPx / 2);
    }
    
    // Calculate how the door intersects with this group
    const doorStartInGroup = Math.max(0, doorStartPx - groupStartPx);
    const doorEndInGroup = Math.min(groupLengthPx, doorEndPx - groupStartPx);
    
    // Wall before door
    if (doorStartInGroup > 0) {
      components.push({
        type: 'wall',
        widthPx: doorStartInGroup as 64 | 128 | 256,
        offsetPx: 0,
      });
    }
    
    // Door component (only if door is within this group)
    if (doorStartInGroup < groupLengthPx && doorEndInGroup > 0) {
      const doorWidthInGroup = doorEndInGroup - doorStartInGroup;
      components.push({
        type: 'door',
        widthPx: doorWidthInGroup as 64 | 128 | 256,
        offsetPx: doorStartInGroup,
        doorId: door.id,
      });
    }
    
    // Wall after door
    if (doorEndInGroup < groupLengthPx) {
      components.push({
        type: 'wall',
        widthPx: (groupLengthPx - doorEndInGroup) as 64 | 128 | 256,
        offsetPx: doorEndInGroup,
      });
    }
  }
  
  return components;
}

/**
 * Add a door to a wall segment group at a specific position
 * Returns the updated group and a new ModularDoor object
 */
export function addDoorToWallSegmentGroup(
  group: WallSegmentGroup,
  clickOffsetPx: number, // Offset from group start where user clicked
  _rooms: ModularRoomElement[]
): { updatedGroup: WallSegmentGroup; newDoor: ModularDoor } | null {
  const groupLengthPx = group.rangeEnd - group.rangeStart;
  
  // Minimum 64px wall required between door and corner
  const MIN_WALL_FROM_CORNER_PX = 64;
  const DOOR_WIDTH_PX = 128;
  const DOOR_HALF_WIDTH_PX = 64;
  
  // Only require 64px margin from actual corners, not from internal group boundaries
  const marginAtStart = group.isAtEdgeStart ? MIN_WALL_FROM_CORNER_PX : 0;
  const marginAtEnd = group.isAtEdgeEnd ? MIN_WALL_FROM_CORNER_PX : 0;
  
  // Check if wall is long enough for a door
  const minWallLengthForDoor = DOOR_WIDTH_PX + marginAtStart + marginAtEnd;
  if (groupLengthPx < minWallLengthForDoor) {
    return null; // Wall is too short to fit a door with required margins
  }
  
  // Calculate door position centered on click, snapped to 64px grid
  // The door CENTER should be at the nearest 64px grid position to where user clicked
  const clickCenterSnapped = Math.round(clickOffsetPx / WALL_SNAP_SIZE_PX) * WALL_SNAP_SIZE_PX;
  let doorStartPx = clickCenterSnapped - DOOR_HALF_WIDTH_PX;
  
  // Clamp to ensure margin from corners (only where applicable)
  if (doorStartPx < marginAtStart) doorStartPx = marginAtStart;
  if (doorStartPx + DOOR_WIDTH_PX > groupLengthPx - marginAtEnd) {
    doorStartPx = groupLengthPx - marginAtEnd - DOOR_WIDTH_PX;
  }
  
  // Check if there's already a door at this position
  const existingDoor = group.components.find(c => 
    c.type === 'door' && 
    c.offsetPx < doorStartPx + 128 && 
    c.offsetPx + c.widthPx > doorStartPx
  );
  
  if (existingDoor) {
    return null; // Can't place door here, already one exists
  }
  
  // Determine room references
  // For external walls, there's only one room, so roomBId should be empty
  const roomAId = group.roomIds[0] || '';
  const roomBId = group.roomIds.length > 1 ? group.roomIds[1] : '';
  
  // Create the new door
  // Note: WallSegmentGroup uses pixels, but PerimeterEdge also uses pixels
  // So we keep the values in pixels for consistency with generateWallSegments
  const newDoor: ModularDoor = {
    id: `door-manual-${Date.now()}`,
    roomAId,
    roomBId,
    edgeOrientation: group.orientation,
    edgePosition: group.position, // Keep in pixels (matches PerimeterEdge.position)
    edgeRangeStart: group.rangeStart, // Keep in pixels
    edgeRangeEnd: group.rangeEnd, // Keep in pixels
    offsetTiles: doorStartPx / MODULAR_TILE_PX, // Offset is in tiles for consistency
    widthTiles: 1,
    isManual: true,
    wallSegmentGroupId: group.id,
  };
  
  // Rebuild components with the new door
  const newComponents = rebuildComponentsWithDoor(groupLengthPx, doorStartPx, 128, newDoor.id);
  
  const updatedGroup: WallSegmentGroup = {
    ...group,
    components: newComponents,
  };
  
  return { updatedGroup, newDoor };
}

/**
 * Remove a door from a wall segment group
 * Returns the updated group
 */
export function removeDoorFromWallSegmentGroup(
  group: WallSegmentGroup,
  _doorId: string
): WallSegmentGroup {
  const groupLengthPx = group.rangeEnd - group.rangeStart;
  
  // Remove door and rebuild as solid wall
  const newComponents: WallSegmentComponent[] = [{
    type: 'wall',
    widthPx: groupLengthPx as 64 | 128 | 256,
    offsetPx: 0,
  }];
  
  return {
    ...group,
    components: newComponents,
  };
}

/**
 * Rebuild components with a door at a specific position
 */
function rebuildComponentsWithDoor(
  groupLengthPx: number,
  doorStartPx: number,
  doorWidthPx: number,
  doorId: string
): WallSegmentComponent[] {
  const components: WallSegmentComponent[] = [];
  
  // Wall before door
  if (doorStartPx > 0) {
    // Split into valid sizes (64 or 128)
    let remaining = doorStartPx;
    let offset = 0;
    
    while (remaining > 0) {
      const size = remaining >= 128 ? 128 : 64;
      components.push({
        type: 'wall',
        widthPx: size as 64 | 128 | 256,
        offsetPx: offset,
      });
      offset += size;
      remaining -= size;
    }
  }
  
  // Door component
  components.push({
    type: 'door',
    widthPx: doorWidthPx as 64 | 128 | 256,
    offsetPx: doorStartPx,
    doorId,
  });
  
  // Wall after door
  const afterDoorStart = doorStartPx + doorWidthPx;
  if (afterDoorStart < groupLengthPx) {
    let remaining = groupLengthPx - afterDoorStart;
    let offset = afterDoorStart;
    
    while (remaining > 0) {
      const size = remaining >= 128 ? 128 : 64;
      components.push({
        type: 'wall',
        widthPx: size as 64 | 128 | 256,
        offsetPx: offset,
      });
      offset += size;
      remaining -= size;
    }
  }
  
  return components;
}

/**
 * Find which WallSegmentGroup was clicked
 * Returns the group and the offset within it (in pixels)
 */
export function findWallSegmentGroupAtPosition(
  x: number,
  y: number,
  wallSegmentGroups: WallSegmentGroup[],
  wallThickness: number = MODULAR_WALL_THICKNESS_PX
): { group: WallSegmentGroup; offsetPx: number } | null {
  for (const group of wallSegmentGroups) {
    const halfThickness = wallThickness / 2;
    
    if (group.orientation === 'horizontal') {
      // Horizontal wall: check if y is within wall thickness and x is within range
      if (
        y >= group.position - halfThickness &&
        y <= group.position + halfThickness &&
        x >= group.rangeStart &&
        x <= group.rangeEnd
      ) {
        return {
          group,
          offsetPx: x - group.rangeStart,
        };
      }
    } else {
      // Vertical wall: check if x is within wall thickness and y is within range
      if (
        x >= group.position - halfThickness &&
        x <= group.position + halfThickness &&
        y >= group.rangeStart &&
        y <= group.rangeEnd
      ) {
        return {
          group,
          offsetPx: y - group.rangeStart,
        };
      }
    }
  }
  
  return null;
}

/**
 * Find a door component at a specific position within a wall segment group
 */
export function findDoorAtPosition(
  group: WallSegmentGroup,
  offsetPx: number
): WallSegmentComponent | null {
  for (const component of group.components) {
    if (
      component.type === 'door' &&
      offsetPx >= component.offsetPx &&
      offsetPx <= component.offsetPx + component.widthPx
    ) {
      return component;
    }
  }
  return null;
}
