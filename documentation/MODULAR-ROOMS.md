# Modular Room System Documentation
**Date:** December 17, 2025  
**Version:** 1.0  
**Status:** Active Development

---

## 🎯 Overview

The Modular Room System is a grid-based room building feature that allows users to create interconnected rooms using pre-made floor tiles and automatically generated walls. Unlike the freehand room builder, modular rooms snap to a tile grid and automatically generate walls, pillars, and doors between connected rooms.

---

## 📐 Core Concepts

### Tile System
- **Tile Size:** 128×128 pixels (`MODULAR_TILE_PX`)
- **Wall Thickness:** 32 pixels (`MODULAR_WALL_THICKNESS_PX`)
- **Pillar Size:** 64×64 pixels (`MODULAR_PILLAR_SIZE`)
- Rooms are defined by their tile dimensions (e.g., 2×3 means 256×384 pixels)

### Room Structure
Each modular room consists of:
- **Floor:** A PNG image matching the tile dimensions
- **Floor Style ID:** Identifier for the floor texture set
- **Position:** Pixel coordinates (x, y) on the canvas
- **Rotation:** 0, 90, 180, or 270 degrees
- **Tile dimensions:** Width and height in tiles (tilesW, tilesH)

### Wall Groups
Rooms that are connected (share an edge) form a **Wall Group**. The wall group system:
- Calculates the external perimeter of all connected rooms
- Generates walls along the perimeter
- Places pillars at corners and intervals
- Creates internal walls between rooms with door openings

---

## 🔧 Key Components

### Data Structures

#### ModularRoomElement (types.ts)
```typescript
interface ModularRoomElement {
  id: string;
  type: 'modularRoom';
  x: number;           // Pixel position
  y: number;           // Pixel position
  tilesW: number;      // Width in tiles
  tilesH: number;      // Height in tiles
  floorStyleId: string;
  rotation?: number;   // 0, 90, 180, 270
  locked?: boolean;
}
```

#### ModularDoor (types.ts)
```typescript
interface ModularDoor {
  id: string;
  roomAId: string;     // First room (sorted alphabetically)
  roomBId: string;     // Second room (sorted alphabetically)
  edgeOrientation: 'horizontal' | 'vertical';
  edgePosition: number;     // Position of shared edge (tile units)
  edgeRangeStart: number;   // Start of shared edge range
  edgeRangeEnd: number;     // End of shared edge range
  offsetTiles: number;      // Door offset from range start (legacy)
  widthTiles: number;       // Door width (typically 1 tile)
}
```

#### WallGroup (types.ts)
```typescript
interface WallGroup {
  id: string;
  roomIds: string[];
  wallStyleId: string;
}
```

#### ModularRoomsState (types.ts)
```typescript
interface ModularRoomsState {
  wallGroups: WallGroup[];
  doors: ModularDoor[];
}
```

---

## 🖱️ User Interaction

### Placement Mode (modularRoom tool)
1. Select floor style and dimensions from Modules tab
2. Click "Place Floor" button
3. Click on canvas to place the room
4. Room automatically snaps to nearest room if adjacent

### Selection & Movement (pointer tool)
1. **Click** on a modular room → Selects the room
2. **Drag** a modular room → Picks up the room (drag-to-pick-up)
   - Drag threshold: 5 pixels before drag activates
   - Doors involving this room are removed immediately
   - Room floats with cursor and shows magnetic snap preview
3. **Click** while holding a room → Drops the room (click-to-drop)
   - Doors are recalculated for new position
   - Cannot overlap with other rooms

### Magnetic Snapping
When dragging a room near another room:
- System detects if edges can align
- Shows preview of snapped position
- Green indicator shows shared edge tiles
- Automatically places door at shared edge on drop

### Rotation
- Select a room
- Use rotate buttons in toolbox or keyboard shortcuts
- Room rotates 90° around its center
- tilesW and tilesH swap on rotation

---

## 🏗️ Wall Generation Algorithm

### External Perimeter (`getGroupEdges`)
1. For each room in the group, get the 4 edges (top, bottom, left, right)
2. Use sweep-line algorithm to find overlapping edges
3. Edges covered by only 1 room = **external edges** (walls)
4. Edges covered by 2 rooms = **internal edges** (shared walls with doors)

### Wall Segments (`generateWallSegments`)
For external edges:
1. Calculate interior pillar positions based on wall length
   - 6-8 tiles: 1 pillar at 50%
   - 10+ tiles: 3 pillars at 25%, 50%, 75%
2. Split wall at pillar positions
3. Create wall segment for each section

### Internal Wall Segments (`generateInternalWallSegments`)
For internal (shared) edges:
1. Find doors that connect the two rooms
2. Center door on the shared edge
3. Create wall segments before and after door opening

### Door Rendering (`generateDoorRenderings`)
1. Find current edge position from `internalEdges` (handles rotation)
2. Center door on the edge
3. Render door sprite at calculated position

---

## 🏛️ Pillar Placement Algorithm

### Rules (`generatePillarsWithEdgeInfo`)
1. **Corner pillars:** At every edge endpoint (all edges)
2. **Interior pillars:** Only on external edges
   - 6-8 tiles: 1 pillar at center
   - 10+ tiles: 3 pillars at 25%, 50%, 75%
3. **Door avoidance:** No pillars inside door openings
   - Uses strict inequality (> and <) so endpoint pillars remain

### Position Calculation
- Uses exact center positions (no snap to grid)
- For 6-tile wall (768px): pillar at 384px from start
- Pillars are deduplicated by position key

---

## 🚪 Door System

### Automatic Door Creation
When a room is placed adjacent to another:
1. `getSharedEdge()` finds the overlapping edge
2. `createDoorAtMidpoint()` creates door at edge center
3. Door is stored in `modularRoomsState.doors`

### Door Persistence
- Doors are saved with room IDs (sorted for stability)
- Edge position/range stored but may become outdated on rotation
- Rendering uses `internalEdges` to get CURRENT edge position

### Rotation Handling
When rooms rotate, stored door positions become outdated. The system:
1. Matches doors by room IDs and orientation only
2. Uses current `internalEdges` to find actual edge position
3. Renders door at current edge, not stored position

---

## 📁 File Structure

### Utility Functions (src/utils/modularRooms.ts)
- `getFloorImageUrl()` - URL for floor PNG
- `getWallSpriteUrl()` - URL for wall sprites (64, 128, 256px)
- `getPillarSpriteUrl()` - URL for pillar sprite
- `getDoorSpriteUrl()` - URL for door sprite
- `getRoomTileRect()` - Room bounds in tile units
- `getRoomPixelRect()` - Room bounds in pixels
- `getSharedEdge()` - Find shared edge between two rooms
- `areRoomsAdjacent()` - Check if rooms share an edge
- `getGroupEdges()` - Calculate external and internal perimeter
- `generateWallSegments()` - Create wall segments for external edges
- `generateInternalWallSegments()` - Create wall segments around doors
- `generateDoorRenderings()` - Create door render data
- `generatePillarsWithEdgeInfo()` - Calculate pillar positions
- `findMagneticSnapPosition()` - Find snap position during drag
- `recalculateAllDoors()` - Recalculate all doors for room set
- `createDoorsForNewRoom()` - Create doors when placing new room

### Renderer (src/components/canvas/ModularRoomRenderer.tsx)
- `ModularRoomFloor` - Renders floor image with rotation
- `WallGroupRenderer` - Renders walls, pillars, doors for a group
- `FloatingWalls` - Renders walls for room being dragged
- `ModularRoomRenderer` - Main component orchestrating all renders

### UI Components
- `ModulesTab` (src/components/rightPanel/ModulesTab.tsx) - Floor/wall style selection
- `RoomBuilderPanel` (src/components/rightPanel/RoomBuilderPanel.tsx) - Contains Modules tab

---

## 🗄️ Database Schema

### scenes table
```sql
modular_rooms_state JSONB DEFAULT '{"wallGroups": [], "doors": []}'
```

Stores:
- `wallGroups`: Array of room groupings with wall style
- `doors`: Array of door objects connecting rooms

---

## 🎨 Asset Structure

### Floor Assets
```
assets/room-elements/floors/{floorStyleId}/
  floor_1x1.png
  floor_1x2.png
  floor_2x2.png
  floor_2x3.png
  ...
```

### Wall Assets
```
assets/room-elements/walls/{wallStyleId}/
  wall_64x32.png   (0.5 tiles)
  wall_128x32.png  (1 tile)
  wall_256x32.png  (2 tiles)
  pillar_64x64.png
  closed_door_128x32.png
```

---

## 🔄 State Flow

### Placing a New Room
1. User clicks canvas with `placingModularFloor` active
2. `findMagneticSnapPosition()` calculates position
3. Room element created and added to scene
4. `createDoorsForNewRoom()` creates doors for adjacent rooms
5. Wall group updated or created
6. Scene saved to database

### Moving an Existing Room
1. User drags room (triggers `pendingModularRoomDrag`)
2. Mouse moves > 5px → `modularRoomDragPreview` activated
3. Doors involving room are removed immediately
4. Ghost room follows cursor with snap preview
5. User clicks to drop
6. Position validated (no overlap)
7. `recalculateAllDoors()` creates new doors
8. Scene saved to database

### Deleting a Room
1. Room removed from elements
2. Wall group updated (room removed from roomIds)
3. Doors involving room are filtered out
4. If wall group empty, it's removed

---

## ⚠️ Known Limitations

1. **Door position on rotation:** Doors store original edge position; system recalculates at render time
2. **Single door per shared edge:** Only one door centered on each shared edge
3. **No partial overlap:** Rooms must fully share an edge to connect
4. **Grid alignment:** All rooms must align to 128px tile grid

---

## 🔮 Future Improvements

- [ ] Multiple doors per shared edge
- [ ] Adjustable door positions
- [ ] Door open/close state
- [ ] Window support on external walls
- [ ] Custom wall segment textures
- [ ] Room copy/paste
- [ ] Room templates/prefabs
