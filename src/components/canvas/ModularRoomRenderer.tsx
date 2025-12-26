/**
 * ModularRoomRenderer - Component for rendering modular rooms on the canvas
 * 
 * This component handles rendering of:
 * - Modular room floors (PNG images)
 * - Generated walls from wall groups
 * - Pillars at corners and intervals
 * - Door openings and overlays
 */

import React, { useMemo } from 'react';
import {
  ModularRoomElement,
  WallGroup,
  ModularDoor,
  TokenElement,
  AssetElement,
  ToolType,
  SegmentStatesMap,
  EdgeDoorsMap,
} from '../../types';
import {
  MODULAR_WALL_THICKNESS_PX,
  MODULAR_PILLAR_SIZE,
  MODULAR_TILE_PX,
} from '../../constants';
import {
  getFloorImageUrl,
  getWallSpriteUrl,
  getPillarSpriteUrl,
  getDoorSpriteUrl,
  getRoomPixelRect,
  getGroupEdges,
  generateWallSegments,
  generateInternalWallSegments,
  generateInternalWallSegmentsFromSegmentStates,
  generateDoorRenderings,
  generatePillarsWithEdgeInfo,
  // getAllDoorOpeningsFromSegmentStates, // LEGACY - disabled
  generateRenderableWallPieces,
  RenderableWallPiece,
  // NEW: Free-placement door system
  generateRenderablePiecesFromEdgeDoors,
} from '../../utils/modularRooms';

interface ModularRoomRendererProps {
  // Direct room data (preferred)
  modularRooms: ModularRoomElement[];
  wallGroups: WallGroup[];
  doors: ModularDoor[];
  segmentStates?: SegmentStatesMap; // Legacy SegmentState-based door system
  edgeDoors?: EdgeDoorsMap; // NEW: Free-placement door system
  selectedRoomId: string | null;
  selectedRoomIds: string[];
  renderLayer: 'floor' | 'walls' | 'full';
  gridSize: number;
  // For drag preview with floating effect - supports GROUP dragging
  dragPreview?: {
    roomId: string;  // Primary room being dragged (the one clicked)
    groupRoomIds: string[];  // All rooms in the wall group (including roomId)
    groupTokenIds: string[];  // All tokens linked to rooms in the group
    originalPositions: Map<string, { x: number; y: number }>;  // Original positions of all
    ghostPosition: { x: number; y: number };  // Ghost position of primary room (pixels)
    cursorPosition: { x: number; y: number };  // Raw cursor position (pixels)
    delta: { x: number; y: number };  // Movement delta from original
    snappedToRoom: string | null;  // ID of room we snapped to (outside our group)
    sharedEdgeTiles: number;  // How many tiles shared (0 if free)
  } | null;
  // For placing new floor from panel
  placingFloor?: {
    floorStyleId: string;
    tilesW: number;
    tilesH: number;
    imageUrl: string;
  } | null;
  // Tokens linked to rooms (for showing in drag preview)
  linkedTokens?: TokenElement[];
  // Assets linked to rooms (for showing in drag preview)
  linkedAssets?: AssetElement[];
  // Active tool - used to disable door pointer events when door tool is active
  activeTool?: ToolType;
}

/**
 * Render walls around a floating room during drag
 * Uses relative positioning within a container positioned at room.x, room.y
 */
const FloatingWalls: React.FC<{
  room: ModularRoomElement;
  wallStyleId: string;
}> = ({ room, wallStyleId }) => {
  const widthPx = room.tilesW * MODULAR_TILE_PX;
  const heightPx = room.tilesH * MODULAR_TILE_PX;
  const wallHeight = MODULAR_WALL_THICKNESS_PX;
  const pillarSize = MODULAR_PILLAR_SIZE;
  
  const wall1xUrl = getWallSpriteUrl(wallStyleId, 1);
  const wall2xUrl = getWallSpriteUrl(wallStyleId, 2);
  const pillarUrl = getPillarSpriteUrl(wallStyleId);
  
  const tilesW = room.tilesW;
  const tilesH = room.tilesH;
  
  // Use a container at room position, then relative positioning inside
  // This matches the initial placement preview approach
  return (
    <div style={{
      position: 'absolute',
      left: room.x,
      top: room.y,
      width: widthPx,
      height: heightPx,
      pointerEvents: 'none',
    }}>
      {/* Top wall */}
      <div style={{
        position: 'absolute',
        left: pillarSize / 2,
        top: -wallHeight / 2,
        width: widthPx - pillarSize,
        height: wallHeight,
        backgroundImage: `url(${tilesW > 2 ? wall2xUrl : wall1xUrl})`,
        backgroundSize: `${MODULAR_TILE_PX * (tilesW > 2 ? 2 : 1)}px ${wallHeight}px`,
        backgroundRepeat: 'repeat-x',
      }} />
      
      {/* Bottom wall */}
      <div style={{
        position: 'absolute',
        left: pillarSize / 2,
        bottom: -wallHeight / 2,
        width: widthPx - pillarSize,
        height: wallHeight,
        backgroundImage: `url(${tilesW > 2 ? wall2xUrl : wall1xUrl})`,
        backgroundSize: `${MODULAR_TILE_PX * (tilesW > 2 ? 2 : 1)}px ${wallHeight}px`,
        backgroundRepeat: 'repeat-x',
        transform: 'scaleY(-1)',
      }} />
      
      {/* Left wall - rotated horizontal sprite using same method as normal wall rendering */}
      <div style={{
        position: 'absolute',
        left: -wallHeight / 2,
        top: pillarSize / 2,
        width: wallHeight,
        height: heightPx - pillarSize,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: (wallHeight - (heightPx - pillarSize)) / 2,
          top: ((heightPx - pillarSize) - wallHeight) / 2,
          width: heightPx - pillarSize,
          height: wallHeight,
          backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
          backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1)}px ${wallHeight}px`,
          backgroundRepeat: 'repeat-x',
          transform: 'rotate(90deg)',
          transformOrigin: 'center center',
        }} />
      </div>
      
      {/* Right wall - rotated horizontal sprite using same method as normal wall rendering */}
      <div style={{
        position: 'absolute',
        left: widthPx - wallHeight / 2,
        top: pillarSize / 2,
        width: wallHeight,
        height: heightPx - pillarSize,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: (wallHeight - (heightPx - pillarSize)) / 2,
          top: ((heightPx - pillarSize) - wallHeight) / 2,
          width: heightPx - pillarSize,
          height: wallHeight,
          backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
          backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1)}px ${wallHeight}px`,
          backgroundRepeat: 'repeat-x',
          transform: 'rotate(90deg)',
          transformOrigin: 'center center',
        }} />
      </div>
      
      {/* Corner pillars - centered on tile corners */}
      {/* Top-left */}
      <img src={pillarUrl} style={{
        position: 'absolute',
        left: -pillarSize / 2,
        top: -pillarSize / 2,
        width: pillarSize,
        height: pillarSize,
      }} draggable={false} />
      {/* Top-right */}
      <img src={pillarUrl} style={{
        position: 'absolute',
        left: widthPx - pillarSize / 2,
        top: -pillarSize / 2,
        width: pillarSize,
        height: pillarSize,
      }} draggable={false} />
      {/* Bottom-left */}
      <img src={pillarUrl} style={{
        position: 'absolute',
        left: -pillarSize / 2,
        top: heightPx - pillarSize / 2,
        width: pillarSize,
        height: pillarSize,
      }} draggable={false} />
      {/* Bottom-right */}
      <img src={pillarUrl} style={{
        position: 'absolute',
        left: widthPx - pillarSize / 2,
        top: heightPx - pillarSize / 2,
        width: pillarSize,
        height: pillarSize,
      }} draggable={false} />
    </div>
  );
};

/**
 * Render a single modular room floor
 */
const ModularRoomFloor: React.FC<{
  room: ModularRoomElement;
  isSelected: boolean;
  isMultiSelected?: boolean; // Part of multi-selection (shift-click or box select)
  isGhost?: boolean;
  isFloating?: boolean;
  activeTool?: ToolType;
}> = ({ room, isSelected, isMultiSelected = false, isGhost = false, isFloating = false, activeTool }) => {
  const rect = getRoomPixelRect(room);
  const rotation = room.rotation || 0;
  
  // At 90/270: current tilesW/H are swapped, so swap back to get original image dimensions
  // At 0/180: current tilesW/H ARE the original dimensions
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const origW = isRotated90or270 ? room.tilesH : room.tilesW;
  const origH = isRotated90or270 ? room.tilesW : room.tilesH;
  
  // Load the original floor image
  const floorUrl = getFloorImageUrl(room.floorStyleId, origW, origH);
  
  // Original image size in pixels
  const imgW = origW * MODULAR_TILE_PX;
  const imgH = origH * MODULAR_TILE_PX;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity: isGhost ? 0.5 : 1,
        pointerEvents: isGhost || isFloating || (activeTool && activeTool !== 'pointer') ? 'none' : 'auto',
      }}
    >
      {/* Inner container that rotates - sized to original image, centered, then rotated */}
      <div
        style={{
          position: 'absolute',
          width: imgW,
          height: imgH,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        <img
          src={floorUrl}
          alt={`Floor ${origW}x${origH}`}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      
      {/* Selection highlight - dashed inner border that's clearly visible */}
      {isSelected && !isGhost && (
        <div
          style={{
            position: 'absolute',
            inset: isFloating ? 0 : 20, // Inset 20px to be clearly inside the walls
            border: isFloating ? '3px solid #4ade80' : '4px dashed #4ade80',
            borderRadius: 6,
            pointerEvents: 'none',
            boxShadow: isFloating 
              ? '0 0 20px rgba(74, 222, 128, 0.7)' 
              : '0 0 15px rgba(74, 222, 128, 0.5), inset 0 0 30px rgba(74, 222, 128, 0.1)',
            background: isFloating ? 'transparent' : 'rgba(74, 222, 128, 0.08)',
          }}
        />
      )}
      
      {/* Multi-selection border - purple dashed border inside walls */}
      {isMultiSelected && !isSelected && !isGhost && (
        <div
          style={{
            position: 'absolute',
            inset: 20, // Inset to be inside the walls
            border: '3px dashed #c4b5fd',
            borderRadius: 6,
            pointerEvents: 'none',
            boxShadow: '0 0 12px rgba(196, 181, 253, 0.4), inset 0 0 25px rgba(196, 181, 253, 0.1)',
            background: 'rgba(196, 181, 253, 0.06)',
          }}
        />
      )}
    </div>
  );
};

/**
 * Render walls, pillars, and doors for a wall group
 */
const WallGroupRenderer: React.FC<{
  groupId: string;
  roomIds: string[];
  wallStyleId: string;
  rooms: ModularRoomElement[];
  doors: ModularDoor[];
  segmentStates?: SegmentStatesMap;
  edgeDoors?: EdgeDoorsMap;
  activeTool?: ToolType;
}> = ({ groupId, roomIds, wallStyleId, rooms, doors, segmentStates, edgeDoors, activeTool: _activeTool }) => {
  // Generate perimeter and walls
  // LEGACY: doorRenderings, externalDoorRenderings, segmentStateDoorRenderings are no longer rendered
  // We now use edgePieces for all wall/door rendering
  const { wallSegments, internalWallSegments, doorRenderings: _doorRenderings, pillars, externalDoorRenderings: _externalDoorRenderings, segmentStateDoorRenderings: _segmentStateDoorRenderings, renderableWallPieces, edgePieces } = useMemo(() => {
    const groupRooms = rooms.filter(r => roomIds.includes(r.id));
    const { externalEdges, internalEdges } = getGroupEdges(roomIds, groupRooms);
    
    // Get doors that belong to rooms in this group (both rooms must be in the group)
    // These are internal doors (between adjacent rooms)
    const groupDoors = doors.filter(d => 
      roomIds.includes(d.roomAId) && roomIds.includes(d.roomBId)
    );
    
    // LEGACY DISABLED - segmentDoorOpenings no longer needed
    // const segmentDoorOpenings = segmentStates 
    //   ? getAllDoorOpeningsFromSegmentStates(segmentStates, groupRooms)
    //   : [];
    
    // LEGACY DISABLED - Now using edgePieces system for all door rendering
    // Convert SegmentState openings to door renderings - DISABLED
    const sssDoorRenderings: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      wallStyleId: string;
      doorId: string;
    }> = [];
    
    /* LEGACY - disabled, edgePieces handles all wall/door rendering
    for (const edgeInfo of segmentDoorOpenings) {
      // Only process if at least one room is in this group
      if (!roomIds.includes(edgeInfo.roomAId) && !roomIds.includes(edgeInfo.roomBId)) continue;
      
      // Use the edge start position from the edgeInfo (already calculated correctly)
      const edgeStartPx = edgeInfo.rangeStartPx;
      
      for (const opening of edgeInfo.openings) {
        const openingWidthPx = opening.endPx - opening.startPx;
        const openingCenterPx = edgeStartPx + opening.startPx + openingWidthPx / 2;
        
        let x: number, y: number;
        if (edgeInfo.orientation === 'horizontal') {
          x = openingCenterPx;
          y = edgeInfo.positionPx;
        } else {
          x = edgeInfo.positionPx;
          y = openingCenterPx;
        }
        
        console.log('[SegmentStateDoor] Rendering:', {
          roomAId: edgeInfo.roomAId,
          roomBId: edgeInfo.roomBId,
          orientation: edgeInfo.orientation,
          positionPx: edgeInfo.positionPx,
          rangeStartPx: edgeInfo.rangeStartPx,
          rangeEndPx: edgeInfo.rangeEndPx,
          openingStartPx: opening.startPx,
          openingEndPx: opening.endPx,
          openingWidthPx,
          openingCenterPx,
          finalX: x,
          finalY: y,
          pattern: opening.pattern,
        });
        
        // Generate a unique door ID from room IDs and segment info
        const doorId = `${edgeInfo.roomAId}|${edgeInfo.roomBId || 'ext'}|${opening.segmentIndex}`;
        sssDoorRenderings.push({
          x,
          y,
          width: openingWidthPx,
          height: MODULAR_WALL_THICKNESS_PX,
          rotation: edgeInfo.orientation === 'vertical' ? 90 : 0,
          wallStyleId,
          doorId,
        });
      }
    }
    LEGACY - end of disabled sssDoorRenderings generation */
    
    // Get manual external doors (doors on external walls where one or both rooms are in this group)
    // Also match by wallSegmentGroupId for legacy doors with empty roomAId
    const externalDoors = doors.filter(d => {
      if (!d.isManual) return false;
      
      // Check if it's an external door (no roomBId or same as roomAId)
      const isExternalDoor = !d.roomBId || d.roomBId === '' || d.roomBId === d.roomAId;
      if (!isExternalDoor) return false;
      
      // Match by roomAId if set
      if (d.roomAId && roomIds.includes(d.roomAId)) return true;
      
      // Fallback: match by edge position if roomAId is empty (legacy doors)
      // Check if any external edge matches this door's position
      if (!d.roomAId || d.roomAId === '') {
        return externalEdges.some(edge => 
          edge.orientation === d.edgeOrientation &&
          Math.abs(edge.position * MODULAR_TILE_PX - d.edgePosition) < 2
        );
      }
      
      return false;
    });
    
    // Generate external door renderings using stored edge data
    const extDoorRenderings = externalDoors.map(door => {
      const doorWidthPx = door.widthTiles * MODULAR_TILE_PX;
      const orientation = door.edgeOrientation;
      
      // For manual external doors, edge data is stored in PIXELS (from WallSegmentGroup)
      // For auto doors (internal), edge data is in TILES
      // Check isManual to determine which unit system to use
      let edgeStartPx: number;
      let edgePositionPx: number;
      
      if (door.isManual) {
        // Manual doors store edge data in pixels
        edgeStartPx = Math.round(door.edgeRangeStart);
        edgePositionPx = Math.round(door.edgePosition);
      } else {
        // Auto doors store edge data in tiles
        edgeStartPx = Math.round(door.edgeRangeStart * MODULAR_TILE_PX);
        edgePositionPx = Math.round(door.edgePosition * MODULAR_TILE_PX);
      }
      
      const doorOffsetPx = Math.round((door.offsetTiles || 0) * MODULAR_TILE_PX);
      
      // Door position is at the offset from edge start
      let x: number, y: number;
      
      if (orientation === 'horizontal') {
        x = edgeStartPx + doorOffsetPx + doorWidthPx / 2; // Center of door
        y = edgePositionPx;
      } else {
        x = edgePositionPx;
        y = edgeStartPx + doorOffsetPx + doorWidthPx / 2; // Center of door
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
    
    // Use SegmentStates for internal wall segments if available, otherwise fall back to legacy
    const internalWallSegs = segmentStates && Object.keys(segmentStates).length > 0
      ? generateInternalWallSegmentsFromSegmentStates(internalEdges, segmentStates, wallStyleId)
      : generateInternalWallSegments(internalEdges, groupDoors, wallStyleId);
    
    // NEW: Generate renderable wall pieces using SegmentStates
    // This includes both wall and door sprites based on each segment's state
    // Create a minimal wallGroups array for the function
    // Always generate these - they use SOLID_256 as default when no state is set
    const minimalWallGroups = [{ id: groupId, wallStyleId, roomIds, roomCount: roomIds.length }];
    const renderableWallPieces: RenderableWallPiece[] = generateRenderableWallPieces(
      groupRooms, 
      minimalWallGroups, 
      doors, 
      segmentStates || {}
    );
    
    return {
      wallSegments: generateWallSegments(externalEdges, [...groupDoors, ...externalDoors], wallStyleId),
      internalWallSegments: internalWallSegs,
      // Pass internalEdges to get CURRENT edge positions for rotated rooms
      // Only generate legacy door renderings if SegmentStates are NOT available
      doorRenderings: (segmentStates && Object.keys(segmentStates).length > 0)
        ? [] // Skip legacy - using SegmentState doors instead
        : generateDoorRenderings(groupDoors, wallStyleId, internalEdges),
      // External door renderings (manual doors on external walls)
      externalDoorRenderings: extDoorRenderings,
      // Use edge-aware pillar generation: corners on all walls, interior only on external
      // Pass doors, SegmentStates, AND edgeDoors so pillars aren't placed where doors are
      pillars: generatePillarsWithEdgeInfo(
        externalEdges, 
        internalEdges, 
        wallStyleId, 
        [...groupDoors, ...externalDoors],
        segmentStates || {},
        groupRooms,
        [], // wallGroups - we don't have access here but it's optional
        edgeDoors || {} // NEW: edgeDoors for pillar blocking
      ),
      // NEW: SegmentState-based door renderings
      segmentStateDoorRenderings: sssDoorRenderings,
      // NEW: Renderable wall pieces (wall + door sprites combined) - legacy system
      renderableWallPieces,
      // NEW: Free-placement door system - ALWAYS use this for wall rendering
      // Generates wall pieces with doors from edgeDoors, falls back to solid walls if empty
      edgePieces: generateRenderablePiecesFromEdgeDoors(groupRooms, [], edgeDoors || {}),
    };
  }, [groupId, roomIds, wallStyleId, rooms, doors, segmentStates, edgeDoors]);

  const wallSprite2x = getWallSpriteUrl(wallStyleId, 2);    // 256px (2 tiles)
  const wallSprite1x = getWallSpriteUrl(wallStyleId, 1);    // 128px (1 tile)
  const wallSpriteHalf = getWallSpriteUrl(wallStyleId, 0.5); // 64px (0.5 tile)
  const pillarSprite = getPillarSpriteUrl(wallStyleId);
  const doorSprite = getDoorSpriteUrl(wallStyleId);

  // Helper to break a segment into optimal tile pieces (largest first: 256 -> 128 -> 64)
  // Returns array of { offset, size } where offset is from segment start
  const packWallTiles = (totalWidth: number): Array<{ offset: number; size: number }> => {
    const tiles: Array<{ offset: number; size: number }> = [];
    let remaining = totalWidth;
    let offset = 0;
    
    // Greedy approach: use largest tiles first
    while (remaining > 0) {
      if (remaining >= 256) {
        tiles.push({ offset, size: 256 });
        offset += 256;
        remaining -= 256;
      } else if (remaining >= 128) {
        tiles.push({ offset, size: 128 });
        offset += 128;
        remaining -= 128;
      } else if (remaining >= 64) {
        tiles.push({ offset, size: 64 });
        offset += 64;
        remaining -= 64;
      } else {
        // Should not happen if segments are aligned to 64px grid
        break;
      }
    }
    
    return tiles;
  };
  
  // Get sprite URL for a specific tile size
  const getSpriteForSize = (size: number): string => {
    if (size === 256) return wallSprite2x;
    if (size === 128) return wallSprite1x;
    return wallSpriteHalf;
  };

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {/* NEW FREE-PLACEMENT DOOR SYSTEM: Render edge pieces when edgeDoors is in use */}
      {edgePieces.length > 0 && edgePieces.map((piece, pieceIdx) => {
        const isVertical = piece.rotation === 90;
        
        // For vertical walls: width becomes height and vice versa when rendered
        const tileWidth = isVertical ? piece.heightPx : piece.widthPx;
        const tileHeight = isVertical ? piece.widthPx : piece.heightPx;
        const pieceLeft = piece.x - tileWidth / 2;
        const pieceTop = piece.y - tileHeight / 2;
        
        // Get sprite URL based on piece type and size
        let spriteUrl: string;
        if (piece.type === 'door') {
          spriteUrl = doorSprite;  // Always 128px door sprite
        } else if (piece.widthPx === 256) {
          spriteUrl = wallSprite2x;
        } else if (piece.widthPx === 128) {
          spriteUrl = wallSprite1x;
        } else {
          spriteUrl = wallSpriteHalf;
        }
        
        return (
          <div
            key={`edge-piece-${groupId}-${pieceIdx}`}
            style={{
              position: 'absolute',
              left: pieceLeft,
              top: pieceTop,
              width: tileWidth,
              height: tileHeight,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: isVertical ? (tileWidth - tileHeight) / 2 : 0,
                top: isVertical ? (tileHeight - tileWidth) / 2 : 0,
                width: isVertical ? tileHeight : tileWidth,
                height: isVertical ? tileWidth : tileHeight,
                backgroundImage: `url(${spriteUrl})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${piece.widthPx}px ${piece.heightPx}px`,
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
      })}
      
      {/* LEGACY: Renderable wall pieces from SegmentStates (includes doors) */}
      {/* Only render if edgePieces is empty (not using new system) */}
      {edgePieces.length === 0 && renderableWallPieces.length > 0 && renderableWallPieces.map((piece, pieceIdx) => {
        const isVertical = piece.rotation === 90;
        
        // For vertical walls: width becomes height and vice versa when rendered
        // piece.widthPx = sprite width (128, 64), piece.heightPx = wall thickness (32)
        const tileWidth = isVertical ? piece.heightPx : piece.widthPx;
        const tileHeight = isVertical ? piece.widthPx : piece.heightPx;
        const pieceLeft = piece.x - tileWidth / 2;
        const pieceTop = piece.y - tileHeight / 2;
        
        // Get sprite URL based on piece type and size
        const spriteUrl = piece.type === 'door' 
          ? doorSprite  // Always 128px door sprite
          : (piece.widthPx === 128 ? wallSprite1x : wallSpriteHalf); // 128px or 64px wall
        
        return (
          <div
            key={`segment-piece-${groupId}-${pieceIdx}`}
            style={{
              position: 'absolute',
              left: pieceLeft,
              top: pieceTop,
              width: tileWidth,
              height: tileHeight,
              overflow: 'hidden',
              // No backgroundColor - only show sprites
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: isVertical ? (tileWidth - tileHeight) / 2 : 0,
                top: isVertical ? (tileHeight - tileWidth) / 2 : 0,
                width: isVertical ? tileHeight : tileWidth,
                height: isVertical ? tileWidth : tileHeight,
                backgroundImage: `url(${spriteUrl})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${piece.widthPx}px ${piece.heightPx}px`,
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
      })}
      
      {/* Wall segments - only render if NOT using any door system */}
      {edgePieces.length === 0 && renderableWallPieces.length === 0 && wallSegments.map((segment, segIdx) => {
        const isVertical = segment.rotation === 90;
        const tiles = packWallTiles(segment.width);
        
        // Calculate segment start position
        const segmentLength = segment.width;
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : segmentLength;
        const renderHeight = isVertical ? segmentLength : MODULAR_WALL_THICKNESS_PX;
        const segmentLeft = segment.x - renderWidth / 2;
        const segmentTop = segment.y - renderHeight / 2;
        
        return tiles.map((tile, tileIdx) => {
          // Position this tile within the segment
          const tileLeft = isVertical ? segmentLeft : segmentLeft + tile.offset;
          const tileTop = isVertical ? segmentTop + tile.offset : segmentTop;
          const tileWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : tile.size;
          const tileHeight = isVertical ? tile.size : MODULAR_WALL_THICKNESS_PX;
          
          return (
            <div
              key={`wall-${groupId}-${segIdx}-${tileIdx}`}
              style={{
                position: 'absolute',
                left: tileLeft,
                top: tileTop,
                width: tileWidth,
                height: tileHeight,
                overflow: 'hidden',
                backgroundColor: '#5d4037',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: isVertical ? (tileWidth - tileHeight) / 2 : 0,
                  top: isVertical ? (tileHeight - tileWidth) / 2 : 0,
                  width: isVertical ? tileHeight : tileWidth,
                  height: isVertical ? tileWidth : tileHeight,
                  backgroundImage: `url(${getSpriteForSize(tile.size)})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${tile.size}px ${MODULAR_WALL_THICKNESS_PX}px`,
                  transform: isVertical ? 'rotate(90deg)' : undefined,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          );
        });
      })}
      
      {/* Internal wall segments (shared walls between rooms) - only render if NOT using any door system */}
      {edgePieces.length === 0 && renderableWallPieces.length === 0 && internalWallSegments.map((segment, segIdx) => {
        const isVertical = segment.rotation === 90;
        const tiles = packWallTiles(segment.width);
        
        const segmentLength = segment.width;
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : segmentLength;
        const renderHeight = isVertical ? segmentLength : MODULAR_WALL_THICKNESS_PX;
        const segmentLeft = segment.x - renderWidth / 2;
        const segmentTop = segment.y - renderHeight / 2;
        
        return tiles.map((tile, tileIdx) => {
          const tileLeft = isVertical ? segmentLeft : segmentLeft + tile.offset;
          const tileTop = isVertical ? segmentTop + tile.offset : segmentTop;
          const tileWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : tile.size;
          const tileHeight = isVertical ? tile.size : MODULAR_WALL_THICKNESS_PX;
          
          return (
            <div
              key={`internal-wall-${groupId}-${segIdx}-${tileIdx}`}
              style={{
                position: 'absolute',
                left: tileLeft,
                top: tileTop,
                width: tileWidth,
                height: tileHeight,
                overflow: 'hidden',
                backgroundColor: '#5d4037',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: isVertical ? (tileWidth - tileHeight) / 2 : 0,
                  top: isVertical ? (tileHeight - tileWidth) / 2 : 0,
                  width: isVertical ? tileHeight : tileWidth,
                  height: isVertical ? tileWidth : tileHeight,
                  backgroundImage: `url(${getSpriteForSize(tile.size)})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${tile.size}px ${MODULAR_WALL_THICKNESS_PX}px`,
                  transform: isVertical ? 'rotate(90deg)' : undefined,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          );
        });
      })}
      
      {/* Door sprites - LEGACY: DISABLED - now using edgePieces system */}
      {/* All legacy door renderings removed - edgePieces handles all wall/door rendering */}
      
      {/* Pillars - ALWAYS rendered on top of walls */}
      {pillars.map((pillar, idx) => (
        <div
          key={`pillar-${groupId}-${idx}`}
          style={{
            position: 'absolute',
            left: pillar.x - MODULAR_PILLAR_SIZE / 2,
            top: pillar.y - MODULAR_PILLAR_SIZE / 2,
            width: MODULAR_PILLAR_SIZE,
            height: MODULAR_PILLAR_SIZE,
            backgroundImage: `url(${pillarSprite})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            zIndex: 10, // Ensure pillars are above walls
          }}
        />
      ))}
    </div>
  );
};

/**
 * Main renderer component for all modular rooms
 */
const ModularRoomRenderer: React.FC<ModularRoomRendererProps> = ({
  modularRooms,
  wallGroups,
  doors,
  segmentStates,
  edgeDoors,
  selectedRoomId,
  selectedRoomIds,
  renderLayer,
  gridSize: _gridSize, // Reserved for future use
  dragPreview,
  placingFloor,
  linkedTokens,
  linkedAssets,
  activeTool,
}) => {
  // When dragging, exclude ALL rooms in the group from static rendering
  const staticRooms = useMemo(() => {
    if (!dragPreview) return modularRooms;
    const draggedIds = new Set(dragPreview.groupRoomIds);
    return modularRooms.filter(r => !draggedIds.has(r.id));
  }, [modularRooms, dragPreview]);
  
  // When dragging, filter out doors that involve ANY dragged room
  // This makes walls "close up" immediately when a group is picked up
  const activeDoors = useMemo(() => {
    if (!dragPreview) return doors;
    const draggedIds = new Set(dragPreview.groupRoomIds);
    return doors.filter(d => !draggedIds.has(d.roomAId) && !draggedIds.has(d.roomBId));
  }, [doors, dragPreview]);
  
  // When dragging, filter segment states that involve dragged rooms
  const activeSegmentStates = useMemo(() => {
    if (!dragPreview || !segmentStates) return segmentStates || {};
    // For now, keep all segment states - the room IDs in keys are stable
    // The position updates are handled by updateSegmentStatesForRoomMove
    return segmentStates;
  }, [segmentStates, dragPreview]);
  
  // When dragging, filter edge doors that involve dragged rooms
  const activeEdgeDoors = useMemo(() => {
    if (!dragPreview || !edgeDoors) return edgeDoors || {};
    // Edge IDs contain room IDs, so we filter out edges involving dragged rooms
    const draggedIds = new Set(dragPreview.groupRoomIds);
    const filtered: typeof edgeDoors = {};
    for (const [edgeId, doors] of Object.entries(edgeDoors)) {
      // Edge ID format: "h|roomA+roomB|edgeIndex"
      const roomsPart = edgeId.split('|')[1] || '';
      const roomIds = roomsPart.split('+');
      const involveDragged = roomIds.some(id => draggedIds.has(id));
      if (!involveDragged) {
        filtered[edgeId] = doors;
      }
    }
    return filtered;
  }, [edgeDoors, dragPreview]);
  
  // Group rooms by wallGroupId for rendering with separate wall styles
  const roomsByWallGroup = useMemo(() => {
    const groups = new Map<string, ModularRoomElement[]>();
    staticRooms.forEach(room => {
      const groupId = room.wallGroupId || 'default';
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(room);
    });
    return groups;
  }, [staticRooms]);

  if (modularRooms.length === 0 && !placingFloor) {
    return null;
  }

  return (
    <>
      {/* Layer: Floors */}
      {(renderLayer === 'floor' || renderLayer === 'full') && (
        <>
          {/* Render all rooms - hide the ones being dragged (entire group) */}
          {modularRooms.map(room => {
            // Check if this room is part of the dragged group
            const isBeingDragged = dragPreview?.groupRoomIds.includes(room.id);
            
            // Don't render the room at its original position when being dragged
            if (isBeingDragged) return null;
            
            return (
              <div
                key={`floor-wrapper-${room.id}`}
              >
                <ModularRoomFloor
                  room={room}
                  isSelected={selectedRoomId === room.id}
                  isMultiSelected={selectedRoomIds.includes(room.id)}
                  activeTool={activeTool}
                />
              </div>
            );
          })}
          
          {/* Floating GROUP preview during drag - shows ALL rooms and tokens in the group */}
          {dragPreview && (() => {
            // Get the primary room (the one that was clicked)
            const primaryRoom = modularRooms.find(r => r.id === dragPreview.roomId);
            if (!primaryRoom) return null;
            
            // Get all rooms in the group being dragged
            const groupRooms = modularRooms.filter(r => dragPreview.groupRoomIds.includes(r.id));
            const groupRoomIdsSet = new Set(dragPreview.groupRoomIds);
            
            // Get ALL tokens linked to any room in the group (using parentRoomId)
            const groupTokens = linkedTokens?.filter(t => t.parentRoomId && groupRoomIdsSet.has(t.parentRoomId)) || [];
            
            // Get ALL assets linked to any room in the group (using parentRoomId)
            const groupAssets = linkedAssets?.filter(a => a.parentRoomId && groupRoomIdsSet.has(a.parentRoomId)) || [];
            
            // Build map of wallGroupId -> wallStyleId for quick lookup
            const wallStyleByGroupId = new Map<string, string>();
            for (const wg of wallGroups) {
              wallStyleByGroupId.set(wg.id, wg.wallStyleId || 'worn-castle');
            }
            
            // Movement delta for the entire group
            const deltaX = dragPreview.delta.x;
            const deltaY = dragPreview.delta.y;
            
            // Build a map of room new positions for token calculations
            const roomNewPositions = new Map<string, { x: number; y: number }>();
            groupRooms.forEach(room => {
              const origPos = dragPreview.originalPositions.get(room.id);
              if (origPos) {
                roomNewPositions.set(room.id, { x: origPos.x + deltaX, y: origPos.y + deltaY });
              }
            });
            
            return (
              <div
                style={{
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              >
                {/* Render ALL floors in the group at their new positions */}
                {groupRooms.map(room => {
                  const origPos = dragPreview.originalPositions.get(room.id);
                  if (!origPos) return null;
                  
                  // Create floating room at offset position
                  const floatingRoom: ModularRoomElement = {
                    ...room,
                    x: origPos.x + deltaX,
                    y: origPos.y + deltaY,
                  };
                  
                  // Get wall style for this room's group
                  const roomWallStyle = wallStyleByGroupId.get(room.wallGroupId || '') || 'worn-castle';
                  
                  return (
                    <React.Fragment key={`floating-room-${room.id}`}>
                      <ModularRoomFloor
                        room={floatingRoom}
                        isSelected={room.id === dragPreview.roomId}
                        isFloating={true}
                        activeTool={activeTool}
                      />
                      {/* Walls around each floating room - using room's group wall style */}
                      <FloatingWalls room={floatingRoom} wallStyleId={roomWallStyle} />
                    </React.Fragment>
                  );
                })}
                
                {/* Render ALL linked tokens at their new positions using parentRoomOffset */}
                {groupTokens.map(token => {
                  if (!token.parentRoomId) return null;
                  const roomNewPos = roomNewPositions.get(token.parentRoomId);
                  if (!roomNewPos) return null;
                  
                  // Get room's ORIGINAL position from dragPreview (before drag started)
                  const roomOrigPos = dragPreview.originalPositions.get(token.parentRoomId);
                  
                  // Calculate token position using parentRoomOffset or calculate from original room position
                  let tokenX: number, tokenY: number;
                  if (token.parentRoomOffset) {
                    tokenX = roomNewPos.x + token.parentRoomOffset.x;
                    tokenY = roomNewPos.y + token.parentRoomOffset.y;
                  } else if (roomOrigPos) {
                    // Fallback: calculate offset from room's ORIGINAL position
                    const currentOffset = { x: token.x - roomOrigPos.x, y: token.y - roomOrigPos.y };
                    tokenX = roomNewPos.x + currentOffset.x;
                    tokenY = roomNewPos.y + currentOffset.y;
                  } else {
                    return null;
                  }
                  
                  return (
                    <div
                      key={`ghost-token-${token.id}`}
                      style={{
                        position: 'absolute',
                        left: tokenX - token.size / 2,
                        top: tokenY - token.size / 2,
                        width: token.size,
                        height: token.size,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: `2px solid ${token.color || '#8b5cf6'}`,
                        backgroundColor: token.isShape ? (token.color || '#8b5cf6') : 'transparent',
                      }}
                    >
                      {token.imageUrl && (
                        <img
                          src={token.imageUrl}
                          alt={token.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          draggable={false}
                        />
                      )}
                    </div>
                  );
                })}
                
                {/* Render ALL linked assets at their new positions using parentRoomOffset */}
                {groupAssets.map(asset => {
                  if (!asset.parentRoomId) return null;
                  const roomNewPos = roomNewPositions.get(asset.parentRoomId);
                  if (!roomNewPos) return null;
                  
                  // Get room's ORIGINAL position from dragPreview (before drag started)
                  const roomOrigPos = dragPreview.originalPositions.get(asset.parentRoomId);
                  
                  // Calculate asset position using parentRoomOffset or calculate from original room position
                  let assetX: number, assetY: number;
                  if (asset.parentRoomOffset) {
                    assetX = roomNewPos.x + asset.parentRoomOffset.x;
                    assetY = roomNewPos.y + asset.parentRoomOffset.y;
                  } else if (roomOrigPos) {
                    // Fallback: calculate offset from room's ORIGINAL position
                    const currentOffset = { x: asset.x - roomOrigPos.x, y: asset.y - roomOrigPos.y };
                    assetX = roomNewPos.x + currentOffset.x;
                    assetY = roomNewPos.y + currentOffset.y;
                  } else {
                    return null;
                  }
                  
                  return (
                    <div
                      key={`ghost-asset-${asset.id}`}
                      style={{
                        position: 'absolute',
                        left: assetX - asset.size / 2,
                        top: assetY - asset.size / 2,
                        width: asset.size,
                        height: asset.size,
                        transform: asset.rotation ? `rotate(${asset.rotation}deg)` : undefined,
                        opacity: 0.8,
                      }}
                    >
                      <img
                        src={asset.imageUrl}
                        alt={asset.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                        draggable={false}
                      />
                    </div>
                  );
                })}
                
                {/* Dashed border around the PRIMARY room (the one clicked) */}
                {(() => {
                  const origPos = dragPreview.originalPositions.get(primaryRoom.id);
                  if (!origPos) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      left: origPos.x + deltaX,
                      top: origPos.y + deltaY,
                      width: primaryRoom.tilesW * MODULAR_TILE_PX,
                      height: primaryRoom.tilesH * MODULAR_TILE_PX,
                      border: '2px dashed #8b5cf6',
                      borderRadius: 4,
                      pointerEvents: 'none',
                    }} />
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}

      {/* Layer: Walls */}
      {(renderLayer === 'walls' || renderLayer === 'full') && (
        <>
          {/* Render each wall group separately with its own wall style */}
          {Array.from(roomsByWallGroup.entries()).map(([groupId, groupRooms]) => {
            // Find wall style for this group
            const wallGroup = wallGroups.find(g => g.id === groupId);
            const wallStyleId = wallGroup?.wallStyleId || 'worn-castle';
            const roomIds = groupRooms.map(r => r.id);
            
            return (
              <WallGroupRenderer
                key={`walls-${groupId}`}
                groupId={groupId}
                roomIds={roomIds}
                wallStyleId={wallStyleId}
                rooms={groupRooms}
                activeTool={activeTool}
                segmentStates={activeSegmentStates}
                edgeDoors={activeEdgeDoors}
                doors={activeDoors.filter(d => {
                  // Include doors where roomAId is in this group AND either:
                  // 1. roomBId is also in this group (internal door), OR
                  // 2. roomBId is empty/same as roomAId (external door)
                  const isInGroup = roomIds.includes(d.roomAId);
                  const isInternalDoor = roomIds.includes(d.roomBId);
                  const isExternalDoor = !d.roomBId || d.roomBId === '' || d.roomBId === d.roomAId;
                  return isInGroup && (isInternalDoor || isExternalDoor);
                })}
              />
            );
          })}
        </>
      )}
    </>
  );
};

export default ModularRoomRenderer;
