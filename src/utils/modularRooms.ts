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
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_FLOORS_PATH}`;
}

/**
 * Get the API URL to list wall styles (folders)
 */
export function getWallStylesApiUrl(): string {
  return `${MODULAR_ASSETS_BASE_URL}/list-files.php?path=${MODULAR_WALLS_PATH}`;
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
      externalEdges.push(edgesOnLine[0].edge);
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
  
  // Check if a door already exists for this edge
  const existingDoor = existingDoors.find(d =>
    d.roomAId === roomAId &&
    d.roomBId === roomBId &&
    d.edgeOrientation === sharedEdge.orientation &&
    d.edgePosition === sharedEdge.position
  );
  
  if (existingDoor) {
    return null; // Door already exists
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
    const lengthPx = lengthTiles * MODULAR_TILE_PX;
    const startPx = edge.rangeStart * MODULAR_TILE_PX;
    
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
    const edgeDoors = doors.filter(d => 
      d.edgeOrientation === edge.orientation &&
      d.edgePosition === edge.position &&
      d.edgeRangeStart === edge.rangeStart &&
      d.edgeRangeEnd === edge.rangeEnd
    );
    
    // Combine all split points (pillars and doors) and sort
    const splitPoints: number[] = [...interiorPillarOffsets];
    
    for (const door of edgeDoors) {
      splitPoints.push(door.offsetTiles * MODULAR_TILE_PX);
      splitPoints.push((door.offsetTiles + door.widthTiles) * MODULAR_TILE_PX);
    }
    
    // Sort and deduplicate
    const uniqueSplitPoints = [...new Set(splitPoints)].sort((a, b) => a - b);
    
    if (uniqueSplitPoints.length === 0) {
      // No pillars or doors - single wall segment
      if (edge.orientation === 'horizontal') {
        segments.push({
          x: startPx + lengthPx / 2,
          y: edge.position * MODULAR_TILE_PX,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 0,
          wallStyleId,
        });
      } else {
        segments.push({
          x: edge.position * MODULAR_TILE_PX,
          y: startPx + lengthPx / 2,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 90,
          wallStyleId,
        });
      }
    } else {
      // Split wall into segments at split points
      let currentOffset = 0;
      
      for (const splitPoint of uniqueSplitPoints) {
        // Check if this is a door start (skip the door opening)
        const isDoorStart = edgeDoors.some(d => d.offsetTiles * MODULAR_TILE_PX === splitPoint);
        
        if (splitPoint > currentOffset) {
          // Create segment from currentOffset to splitPoint
          const segLengthPx = splitPoint - currentOffset;
          
          if (edge.orientation === 'horizontal') {
            segments.push({
              x: startPx + currentOffset + segLengthPx / 2,
              y: edge.position * MODULAR_TILE_PX,
              width: segLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 0,
              wallStyleId,
            });
          } else {
            segments.push({
              x: edge.position * MODULAR_TILE_PX,
              y: startPx + currentOffset + segLengthPx / 2,
              width: segLengthPx,
              height: MODULAR_WALL_THICKNESS_PX,
              rotation: 90,
              wallStyleId,
            });
          }
        }
        
        // If this is a door start, skip to door end
        if (isDoorStart) {
          const door = edgeDoors.find(d => d.offsetTiles * MODULAR_TILE_PX === splitPoint)!;
          currentOffset = (door.offsetTiles + door.widthTiles) * MODULAR_TILE_PX;
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
            y: edge.position * MODULAR_TILE_PX,
            width: segLengthPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: edge.position * MODULAR_TILE_PX,
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
    const edgeStartPx = edge.rangeStart * MODULAR_TILE_PX;
    const edgeEndPx = edge.rangeEnd * MODULAR_TILE_PX;
    
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
      const lengthPx = lengthTiles * MODULAR_TILE_PX;
      if (edge.orientation === 'horizontal') {
        segments.push({
          x: edge.rangeStart * MODULAR_TILE_PX + lengthPx / 2,
          y: edge.position * MODULAR_TILE_PX,
          width: lengthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: 0,
          wallStyleId,
        });
      } else {
        segments.push({
          x: edge.position * MODULAR_TILE_PX,
          y: edge.rangeStart * MODULAR_TILE_PX + lengthPx / 2,
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
      
      // Calculate centered door position
      const doorCenterPx = edgeStartPx + edgeLengthPx / 2;
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
            y: edge.position * MODULAR_TILE_PX,
            width: wallBeforePx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: edge.position * MODULAR_TILE_PX,
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
            y: edge.position * MODULAR_TILE_PX,
            width: wallAfterPx,
            height: MODULAR_WALL_THICKNESS_PX,
            rotation: 0,
            wallStyleId,
          });
        } else {
          segments.push({
            x: edge.position * MODULAR_TILE_PX,
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
    const edgeStartPx = currentEdge 
      ? currentEdge.rangeStart * MODULAR_TILE_PX 
      : door.edgeRangeStart * MODULAR_TILE_PX;
    const edgeEndPx = currentEdge 
      ? currentEdge.rangeEnd * MODULAR_TILE_PX 
      : door.edgeRangeEnd * MODULAR_TILE_PX;
    const edgePositionPx = currentEdge
      ? currentEdge.position * MODULAR_TILE_PX
      : door.edgePosition * MODULAR_TILE_PX;
    
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
    
    const startPx = edge.rangeStart * MODULAR_TILE_PX;
    const endPx = edge.rangeEnd * MODULAR_TILE_PX;
    const lengthPx = endPx - startPx;
    const positionPx = edge.position * MODULAR_TILE_PX;
    
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
      // Snap to 128px grid
      const rawPos = startPx + lengthPx * ratio;
      const snappedPos = Math.round(rawPos / MODULAR_TILE_PX) * MODULAR_TILE_PX;
      
      let pillarPos: { x: number; y: number };
      if (edge.orientation === 'horizontal') {
        pillarPos = { x: snappedPos, y: positionPx };
      } else {
        pillarPos = { x: positionPx, y: snappedPos };
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
  doors: ModularDoor[] = []
): PillarWithEdgeInfo[] {
  const pillars: PillarWithEdgeInfo[] = [];
  const pillarPositions = new Map<string, PillarWithEdgeInfo>(); // Track position -> pillar for dedup
  
  // Helper to check if a position overlaps with any door
  // Door position is ALWAYS centered on its edge (matching generateDoorRenderings and generateInternalWallSegments)
  // Uses internalEdges to get CURRENT edge position (handles rotated rooms)
  const isPositionInDoor = (x: number, y: number): boolean => {
    for (const door of doors) {
      // Find the CURRENT edge between these two rooms
      // Match on room IDs ONLY - orientation may have changed
      const currentEdge = internalEdges.find(e => {
        const roomsMatch = e.roomAId && e.roomBId &&
          ((door.roomAId === e.roomAId && door.roomBId === e.roomBId) ||
           (door.roomAId === e.roomBId && door.roomBId === e.roomAId));
        return roomsMatch;
      });
      
      // Use current edge if found, otherwise fall back to stored door values
      const doorPositionPx = currentEdge 
        ? currentEdge.position * MODULAR_TILE_PX 
        : door.edgePosition * MODULAR_TILE_PX;
      const edgeStartPx = currentEdge 
        ? currentEdge.rangeStart * MODULAR_TILE_PX 
        : door.edgeRangeStart * MODULAR_TILE_PX;
      const edgeEndPx = currentEdge 
        ? currentEdge.rangeEnd * MODULAR_TILE_PX 
        : door.edgeRangeEnd * MODULAR_TILE_PX;
      
      // Use CURRENT edge orientation
      const orientation = currentEdge ? currentEdge.orientation : door.edgeOrientation;
      
      const edgeLengthPx = edgeEndPx - edgeStartPx;
      const doorWidthPx = door.widthTiles * MODULAR_TILE_PX;
      
      // Door is centered on the edge
      const doorCenterPx = edgeStartPx + edgeLengthPx / 2;
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
    const startPx = edge.rangeStart * MODULAR_TILE_PX;
    const endPx = edge.rangeEnd * MODULAR_TILE_PX;
    const lengthPx = endPx - startPx;
    const positionPx = edge.position * MODULAR_TILE_PX;
    
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
      // Use exact position without snapping to tile grid
      const exactPos = startPx + lengthPx * ratio;
      
      if (edge.orientation === 'horizontal') {
        addPillar(exactPos, positionPx, false, true);
      } else {
        addPillar(positionPx, exactPos, false, true);
      }
    }
  }
  
  // Process INTERNAL edges - endpoint pillars ONLY, no interior pillars
  for (const edge of internalEdges) {
    const startPx = edge.rangeStart * MODULAR_TILE_PX;
    const endPx = edge.rangeEnd * MODULAR_TILE_PX;
    const positionPx = edge.position * MODULAR_TILE_PX;
    
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
 * Generate stable edge key for door lookup
 */
export function generateEdgeKey(
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
  allRooms: ModularRoomElement[]
): ModularDoor[] {
  const newDoors: ModularDoor[] = [];
  
  // Find all pairs of adjacent rooms
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
        // Create door at midpoint of shared edge
        const door = createDoorAtMidpoint(roomA.id, roomB.id, sharedEdge);
        newDoors.push(door);
      }
    }
  }
  
  return newDoors;
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
  for (const adjRoom of newlyAdjacentRooms) {
    const edge = getSharedEdge(virtualRoom, adjRoom);
    if (edge) {
      // Check if door already exists for this edge
      const existingDoors = findDoorsForEdge(state.doors, edge);
      if (existingDoors.length === 0) {
        // Create new door at midpoint
        newDoors.push(createDoorAtMidpoint(virtualRoom.id, adjRoom.id, edge));
      }
    }
  }
  
  // Find doors to remove (adjacencies that break)
  const removedDoorIds: string[] = [];
  for (const door of state.doors) {
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
  
  console.log('[findConnectedComponents] rooms:', rooms.length, rooms.map(r => ({ id: r.id.slice(-8), x: r.x, y: r.y, w: r.tilesW, h: r.tilesH })));
  
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
          console.log('[findConnectedComponents] checking adjacency:', current.id.slice(-8), 'vs', other.id.slice(-8), '=', adjacent);
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
  console.log('[checkGroupSplitAfterRemoval] removedRoom:', removedRoom?.id, 'groupId:', removedRoom?.wallGroupId);
  
  if (!removedRoom || !removedRoom.wallGroupId) {
    console.log('[checkGroupSplitAfterRemoval] No room or no group, returning false');
    return { needsSplit: false, components: [] };
  }
  
  // Get all other rooms in the same group
  const sameGroupRooms = allRooms.filter(
    r => r.id !== removedRoomId && r.wallGroupId === removedRoom.wallGroupId
  );
  
  console.log('[checkGroupSplitAfterRemoval] sameGroupRooms:', sameGroupRooms.length, sameGroupRooms.map(r => r.id.slice(-8)));
  
  if (sameGroupRooms.length <= 1) {
    // 0 or 1 room remaining - no split needed
    console.log('[checkGroupSplitAfterRemoval] 0 or 1 rooms remaining, no split needed');
    return { needsSplit: false, components: sameGroupRooms.length === 1 ? [sameGroupRooms] : [] };
  }
  
  // Find connected components among remaining rooms
  const components = findConnectedComponents(sameGroupRooms);
  
  console.log('[checkGroupSplitAfterRemoval] components:', components.length, components.map(c => c.map(r => r.id.slice(-8))));
  
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
  
  console.log('[generateSplitUpdates] First component (keeps original ID):', sortedComponents[0].map(r => r.id.slice(-8)));
  
  // Other components get new IDs
  for (let i = 1; i < sortedComponents.length; i++) {
    const component = sortedComponents[i];
    const newGroupId = `wallgroup-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[generateSplitUpdates] Component', i, 'gets new group:', newGroupId.slice(-12), 'rooms:', component.map(r => r.id.slice(-8)));
    
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
  
  console.log('[generateSplitUpdates] roomUpdates:', roomUpdates.length, roomUpdates.map(u => ({ room: u.roomId.slice(-8), group: u.newWallGroupId.slice(-12) })));
  console.log('[generateSplitUpdates] newWallGroups:', newWallGroups.length);
  
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

