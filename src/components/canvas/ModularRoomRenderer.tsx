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
  isGhost?: boolean;
  isFloating?: boolean;
}> = ({ room, isSelected, isGhost = false, isFloating = false }) => {
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
      
      {/* Selection highlight - brighter glow when floating */}
      {isSelected && !isGhost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: isFloating ? '3px solid #4ade80' : '3px solid #22c55e',
            borderRadius: 4,
            pointerEvents: 'none',
            boxShadow: isFloating 
              ? '0 0 20px rgba(74, 222, 128, 0.7)' 
              : '0 0 10px rgba(34, 197, 94, 0.5)',
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
    
    // Get doors that belong to rooms in this group
    const groupDoors = doors.filter(d => 
      roomIds.includes(d.roomAId) || roomIds.includes(d.roomBId)
    );
    
    return {
      wallSegments: generateWallSegments(externalEdges, groupDoors, wallStyleId),
      internalWallSegments: generateInternalWallSegments(internalEdges, groupDoors, wallStyleId),
      doorRenderings: generateDoorRenderings(groupDoors, wallStyleId),
      // Use edge-aware pillar generation: corners on all walls, interior only on external
      pillars: generatePillarsWithEdgeInfo(externalEdges, internalEdges, wallStyleId),
    };
  }, [groupId, roomIds, wallStyleId, rooms, doors]);

  const wallSprite2x = getWallSpriteUrl(wallStyleId, 2);    // 256px
  const wallSprite1x = getWallSpriteUrl(wallStyleId, 1);    // 128px
  const wallSpriteHalf = getWallSpriteUrl(wallStyleId, 0.5); // 64px
  const pillarSprite = getPillarSpriteUrl(wallStyleId);
  const doorSprite = getDoorSpriteUrl(wallStyleId);
  
  // Helper to get the right wall sprite based on segment width
  const getWallSprite = (width: number): string => {
    if (width >= 256) return wallSprite2x;
    if (width >= 128) return wallSprite1x;
    return wallSpriteHalf;
  };

  // Debug: log wall segments
  console.log('[WallGroupRenderer] groupId:', groupId, 'external:', wallSegments.length, 'internal:', internalWallSegments.length, 'doors:', doorRenderings.length, 'pillars:', pillars.length);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {/* Wall segments */}
      {wallSegments.map((segment, idx) => {
        const isVertical = segment.rotation === 90;
        const spriteUrl = getWallSprite(segment.width);
        
        // For horizontal walls: width is segment.width, height is thickness
        // For vertical walls: width is thickness, height is segment.width (length of wall)
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : segment.width;
        const renderHeight = isVertical ? segment.width : MODULAR_WALL_THICKNESS_PX;
        
        // Position: segment.x and segment.y are CENTER of the wall
        const left = segment.x - renderWidth / 2;
        const top = segment.y - renderHeight / 2;
        
        return (
          <div
            key={`wall-${groupId}-${idx}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: renderWidth,
              height: renderHeight,
              overflow: 'hidden',
              backgroundColor: '#5d4037', // Fallback brown color
            }}
          >
            {/* Inner div with rotated sprite for vertical walls */}
            <div
              style={{
                position: 'absolute',
                // For vertical: rotate around center, so we need to offset
                left: isVertical ? (renderWidth - renderHeight) / 2 : 0,
                top: isVertical ? (renderHeight - renderWidth) / 2 : 0,
                width: isVertical ? renderHeight : renderWidth,
                height: isVertical ? renderWidth : renderHeight,
                backgroundImage: `url(${spriteUrl})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: `auto ${MODULAR_WALL_THICKNESS_PX}px`,
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
      })}
      
      {/* Internal wall segments (shared walls between rooms) */}
      {internalWallSegments.map((segment, idx) => {
        const isVertical = segment.rotation === 90;
        const spriteUrl = getWallSprite(segment.width);
        
        const renderWidth = isVertical ? MODULAR_WALL_THICKNESS_PX : segment.width;
        const renderHeight = isVertical ? segment.width : MODULAR_WALL_THICKNESS_PX;
        
        const left = segment.x - renderWidth / 2;
        const top = segment.y - renderHeight / 2;
        
        return (
          <div
            key={`internal-wall-${groupId}-${idx}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: renderWidth,
              height: renderHeight,
              overflow: 'hidden',
              backgroundColor: '#5d4037',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: isVertical ? (renderWidth - renderHeight) / 2 : 0,
                top: isVertical ? (renderHeight - renderWidth) / 2 : 0,
                width: isVertical ? renderHeight : renderWidth,
                height: isVertical ? renderWidth : renderHeight,
                backgroundImage: `url(${spriteUrl})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: `auto ${MODULAR_WALL_THICKNESS_PX}px`,
                transform: isVertical ? 'rotate(90deg)' : undefined,
                transformOrigin: 'center center',
              }}
            />
          </div>
        );
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
}) => {
  // For wall rendering, we need to consider ALL rooms together to properly calculate
  // shared edges and internal walls. The wallGroupId is used for wall STYLE, not grouping.
  // All rooms are rendered as one group for wall calculation purposes.
  // When dragging, exclude the dragged room from static wall rendering
  const staticRooms = useMemo(() => 
    dragPreview ? modularRooms.filter(r => r.id !== dragPreview.roomId) : modularRooms,
    [modularRooms, dragPreview]
  );
  const allRoomIds = useMemo(() => staticRooms.map(r => r.id), [staticRooms]);
  
  // Get the primary wall style (from first room's wall group, or default)
  const primaryWallStyleId = useMemo(() => {
    if (modularRooms.length === 0) return 'worn-castle';
    const firstRoom = modularRooms[0];
    const wallGroup = wallGroups.find(g => g.id === firstRoom.wallGroupId);
    return wallGroup?.wallStyleId || 'worn-castle';
  }, [modularRooms, wallGroups]);

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
                  isSelected={selectedRoomId === room.id || selectedRoomIds.includes(room.id)}
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
          {/* Render all walls as one unified group to properly handle shared edges */}
          {staticRooms.length > 0 && (
            <WallGroupRenderer
              key="walls-unified"
              groupId="unified"
              roomIds={allRoomIds}
              wallStyleId={primaryWallStyleId}
              rooms={staticRooms}
              doors={doors}
            />
          )}


        </>
      )}
    </>
  );
};

export default ModularRoomRenderer;
