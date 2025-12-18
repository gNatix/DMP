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
  // For drag preview with floating effect (now using pixels)
  dragPreview?: {
    roomId: string;
    originalPosition: { x: number; y: number };  // Pixels
    ghostPosition: { x: number; y: number };     // Pixels
    cursorPosition: { x: number; y: number };    // Pixels
    snappedToRoom: string | null;
    sharedEdgeTiles: number;
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
}> = ({ groupId, roomIds, wallStyleId, rooms, doors }) => {
  // Generate perimeter and walls
  const { wallSegments, internalWallSegments, doorRenderings, pillars } = useMemo(() => {
    const groupRooms = rooms.filter(r => roomIds.includes(r.id));
    const { externalEdges, internalEdges } = getGroupEdges(roomIds, groupRooms);
    
    // Get doors that belong to rooms in this group (both rooms must be in the group)
    const groupDoors = doors.filter(d => 
      roomIds.includes(d.roomAId) && roomIds.includes(d.roomBId)
    );
    
    return {
      wallSegments: generateWallSegments(externalEdges, groupDoors, wallStyleId),
      internalWallSegments: generateInternalWallSegments(internalEdges, groupDoors, wallStyleId),
      // Pass internalEdges to get CURRENT edge positions for rotated rooms
      doorRenderings: generateDoorRenderings(groupDoors, wallStyleId, internalEdges),
      // Use edge-aware pillar generation: corners on all walls, interior only on external
      // Pass doors so pillars aren't placed where doors are
      pillars: generatePillarsWithEdgeInfo(externalEdges, internalEdges, wallStyleId, groupDoors),
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
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            title="Door (drag to move)"
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
}) => {
  // When dragging, exclude the dragged room from static rendering
  const staticRooms = useMemo(() => 
    dragPreview ? modularRooms.filter(r => r.id !== dragPreview.roomId) : modularRooms,
    [modularRooms, dragPreview]
  );
  
  // When dragging, filter out doors that involve the dragged room
  // This makes walls "close up" immediately when a room is picked up
  const activeDoors = useMemo(() =>
    dragPreview ? doors.filter(d => d.roomAId !== dragPreview.roomId && d.roomBId !== dragPreview.roomId) : doors,
    [doors, dragPreview]
  );
  
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
          {/* Render all rooms - hide the one being dragged */}
          {modularRooms.map(room => {
            const isBeingDragged = dragPreview?.roomId === room.id;
            
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
          
          {/* Floating room preview during drag - same style as initial placement */}
          {dragPreview && (() => {
            const room = modularRooms.find(r => r.id === dragPreview.roomId);
            if (!room) return null;
            
            // Create floating room at ghost position (pixels)
            const floatingRoom: ModularRoomElement = {
              ...room,
              x: dragPreview.ghostPosition.x,
              y: dragPreview.ghostPosition.y,
            };
            
            // Calculate movement delta for tokens
            const deltaX = dragPreview.ghostPosition.x - room.x;
            const deltaY = dragPreview.ghostPosition.y - room.y;
            
            // Get tokens linked to this room
            const roomTokens = linkedTokens?.filter(t => t.parentRoomId === room.id) || [];
            
            // Get wall style from room's wall group
            const wallGroup = wallGroups.find(g => g.id === room.wallGroupId);
            const wallStyleId = wallGroup?.wallStyleId || 'worn-castle';
            
            return (
              <div
                style={{
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              >
                {/* Floor */}
                <ModularRoomFloor
                  room={floatingRoom}
                  isSelected={false}
                  isFloating={true}
                />
                {/* Walls around floating room */}
                <FloatingWalls room={floatingRoom} wallStyleId={wallStyleId} />
                
                {/* Linked tokens preview */}
                {roomTokens.map(token => (
                  <div
                    key={`ghost-token-${token.id}`}
                    style={{
                      position: 'absolute',
                      left: token.x + deltaX - token.size / 2,
                      top: token.y + deltaY - token.size / 2,
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
                ))}
                
                {/* Dashed border indicator - same as initial placement */}
                <div style={{
                  position: 'absolute',
                  left: floatingRoom.x,
                  top: floatingRoom.y,
                  width: floatingRoom.tilesW * MODULAR_TILE_PX,
                  height: floatingRoom.tilesH * MODULAR_TILE_PX,
                  border: '2px dashed #8b5cf6',
                  borderRadius: 4,
                  pointerEvents: 'none',
                }} />
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
                doors={activeDoors.filter(d => 
                  // Only include doors where BOTH rooms are in this group
                  // (doors between different groups are invalid and should be filtered out)
                  roomIds.includes(d.roomAId) && roomIds.includes(d.roomBId)
                )}
              />
            );
          })}
        </>
      )}
    </>
  );
};

export default ModularRoomRenderer;
