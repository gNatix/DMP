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
  ToolType,
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
  generateDoorRenderings,
  generatePillarsWithEdgeInfo,
} from '../../utils/modularRooms';

interface ModularRoomRendererProps {
  // Direct room data (preferred)
  modularRooms: ModularRoomElement[];
  wallGroups: WallGroup[];
  doors: ModularDoor[];
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
      
      {/* Left wall - rotated horizontal sprite */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: pillarSize / 2,
        width: heightPx - pillarSize,
        height: wallHeight,
        backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
        backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1)}px ${wallHeight}px`,
        backgroundRepeat: 'repeat-x',
        transform: 'rotate(90deg) translateY(-100%)',
        transformOrigin: '0 0',
      }} />
      
      {/* Right wall - rotated horizontal sprite */}
      <div style={{
        position: 'absolute',
        left: widthPx,
        top: pillarSize / 2,
        width: heightPx - pillarSize,
        height: wallHeight,
        backgroundImage: `url(${tilesH > 2 ? wall2xUrl : wall1xUrl})`,
        backgroundSize: `${MODULAR_TILE_PX * (tilesH > 2 ? 2 : 1)}px ${wallHeight}px`,
        backgroundRepeat: 'repeat-x',
        transform: 'rotate(90deg)',
        transformOrigin: '0 0',
      }} />
      
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
}> = ({ room, isSelected, isMultiSelected = false, isGhost = false, isFloating = false }) => {
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
        pointerEvents: isGhost || isFloating ? 'none' : 'auto',
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
  activeTool?: ToolType;
}> = ({ groupId, roomIds, wallStyleId, rooms, doors, activeTool }) => {
  // Generate perimeter and walls
  const { wallSegments, internalWallSegments, doorRenderings, pillars, externalDoorRenderings } = useMemo(() => {
    const groupRooms = rooms.filter(r => roomIds.includes(r.id));
    const { externalEdges, internalEdges } = getGroupEdges(roomIds, groupRooms);
    
    // Get doors that belong to rooms in this group (both rooms must be in the group)
    // These are internal doors (between adjacent rooms)
    const groupDoors = doors.filter(d => 
      roomIds.includes(d.roomAId) && roomIds.includes(d.roomBId)
    );
    
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
    
    return {
      wallSegments: generateWallSegments(externalEdges, [...groupDoors, ...externalDoors], wallStyleId),
      internalWallSegments: generateInternalWallSegments(internalEdges, groupDoors, wallStyleId),
      // Pass internalEdges to get CURRENT edge positions for rotated rooms
      doorRenderings: generateDoorRenderings(groupDoors, wallStyleId, internalEdges),
      // External door renderings (manual doors on external walls)
      externalDoorRenderings: extDoorRenderings,
      // Use edge-aware pillar generation: corners on all walls, interior only on external
      // Pass doors so pillars aren't placed where doors are
      pillars: generatePillarsWithEdgeInfo(externalEdges, internalEdges, wallStyleId, [...groupDoors, ...externalDoors]),
    };
  }, [groupId, roomIds, wallStyleId, rooms, doors]);

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
      {/* Wall segments - each segment is packed with optimal tile sizes */}
      {wallSegments.map((segment, segIdx) => {
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
      
      {/* Internal wall segments (shared walls between rooms) - packed with optimal tile sizes */}
      {internalWallSegments.map((segment, segIdx) => {
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
      
      {/* Door sprites */}
      {doorRenderings.map((door, idx) => {
        const isVertical = door.rotation === 90;
        
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : door.width;
        const renderHeight = isVertical ? door.width : MODULAR_WALL_THICKNESS_PX;
        
        const left = door.x - renderWidth / 2;
        const top = door.y - renderHeight / 2;
        
        // When door tool is active, disable pointer events so Canvas can detect clicks
        const isDoorToolActive = activeTool === 'doorTool';
        
        return (
          <div
            key={`door-${groupId}-${idx}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: renderWidth,
              height: renderHeight,
              overflow: 'hidden',
              cursor: isDoorToolActive ? 'inherit' : 'pointer',
              pointerEvents: isDoorToolActive ? 'none' : 'auto',
            }}
            title={isDoorToolActive ? undefined : "Door (drag to move)"}
          >
            <div
              style={{
                position: 'absolute',
                left: isVertical ? (renderWidth - renderHeight) / 2 : 0,
                top: isVertical ? (renderHeight - renderWidth) / 2 : 0,
                width: isVertical ? renderHeight : renderWidth,
                height: isVertical ? renderWidth : renderHeight,
                backgroundImage: `url(${doorSprite})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${door.width}px ${MODULAR_WALL_THICKNESS_PX}px`,
                backgroundPosition: 'center',
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
      })}
      
      {/* External door sprites (manual doors on external walls) */}
      {externalDoorRenderings.map((door, idx) => {
        const isVertical = door.rotation === 90;
        
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : door.width;
        const renderHeight = isVertical ? door.width : MODULAR_WALL_THICKNESS_PX;
        
        const left = door.x - renderWidth / 2;
        const top = door.y - renderHeight / 2;
        
        // When door tool is active, disable pointer events so Canvas can detect clicks
        const isDoorToolActive = activeTool === 'doorTool';
        
        return (
          <div
            key={`ext-door-${groupId}-${idx}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: renderWidth,
              height: renderHeight,
              overflow: 'hidden',
              cursor: isDoorToolActive ? 'inherit' : 'pointer',
              pointerEvents: isDoorToolActive ? 'none' : 'auto',
            }}
            title={isDoorToolActive ? undefined : "External Door (click with Door Tool to remove)"}
          >
            <div
              style={{
                position: 'absolute',
                left: isVertical ? (renderWidth - renderHeight) / 2 : 0,
                top: isVertical ? (renderHeight - renderWidth) / 2 : 0,
                width: isVertical ? renderHeight : renderWidth,
                height: isVertical ? renderWidth : renderHeight,
                backgroundImage: `url(${doorSprite})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${door.width}px ${MODULAR_WALL_THICKNESS_PX}px`,
                backgroundPosition: 'center',
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
      })}
      
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
  selectedRoomId,
  selectedRoomIds,
  renderLayer,
  gridSize: _gridSize, // Reserved for future use
  dragPreview,
  placingFloor,
  linkedTokens,
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
            
            console.log('[GHOST PREVIEW] === GHOST PREVIEW DEBUG ===');
            console.log('[GHOST PREVIEW] dragPreview.groupRoomIds:', dragPreview.groupRoomIds.map(id => id.slice(-8)));
            console.log('[GHOST PREVIEW] groupRooms found:', groupRooms.map(r => r.id.slice(-8)));
            console.log('[GHOST PREVIEW] groupTokens found:', groupTokens.map(t => ({ id: t.id.slice(-8), parentRoomId: t.parentRoomId?.slice(-8) })));
            console.log('[GHOST PREVIEW] originalPositions keys:', Array.from(dragPreview.originalPositions.keys()).map(k => k.slice(-8)));
            
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
            
            console.log('[GHOST PREVIEW] roomNewPositions:', Array.from(roomNewPositions.entries()).map(([id, pos]) => ({ id: id.slice(-8), ...pos })));
            
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
                        />
                      )}
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
