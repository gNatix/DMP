# Changelog

All notable changes to DM Planner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.9.7] - 2025-12-26

### Added
- **Assets Tool & Asset Library (Proof of Concept)**: New decorative asset placement system
  - Asset Tool in toolbar for placing and managing decorative elements
  - Asset Library tab in right panel with browsable categories
  - Drag-and-drop assets directly onto maps
  - Shift+click stamp mode for quick continuous placement
  - 360° rotation with invisible handles outside corners
  - Free resize with dynamic cursors based on rotation
  - Multi-selection with orange selection box (separate from other tools)
  - Room binding: Assets placed on modular rooms follow when rooms move
  - Category styling with preview images
  - Automatic asset naming from filenames (editable in left panel)
  - Assets display in element lists and game mode playlists
  - Support for both Asset Tool and Pointer Tool interactions
  - More asset libraries will be added in future updates

### Fixed
- Modular room ghost preview vertical walls now render correctly during drag

---

## [0.9.6] - Previous Updates

### Added
- **Modular Room Multi-Select Drag**: Pointer tool now supports dragging multiple modular rooms together
  - Shift-click to select multiple modular rooms
  - All selected rooms move together with ghost preview
  - Tokens linked to rooms follow automatically with correct offsets
  - Magnetic snapping works for the entire group
  - Connected component logic for wallGroupId management (merge/split)
- **Orphan Token Auto-Linking**: Tokens placed on modular rooms are automatically linked with `parentRoomId` on scene load
- **Modular Room Tool Error Message**: Shows "Modular Room tool can only interact with modular rooms" when trying to interact with other element types
- **Room Rotation Token Handling**: Tokens maintain their relative wall position when a modular room is rotated
- **Room Rotation Group Restriction**: Rooms connected to other rooms cannot be rotated (must be separated first)

### Fixed
- **Pointer Tool Ghost Preview**: Multi-selected modular rooms now show proper ghost preview during drag (was using wrong drag system)
- **Token Movement with Rooms**: Tokens with `parentRoomId` now correctly move when their parent room is dragged via pointer tool
- **Door Recalculation Spam**: Fixed excessive console logging and re-renders during modular room drag operations
- **Wall Style Per Room in Preview**: Ghost preview now shows each room's own wall style instead of using primary room's style for all

### Changed
- Pointer tool uses modular room drag system (with ghost preview) when all selected elements are modular rooms
- Door recalculation is skipped during active drag operations for better performance

---

### Added (Previous Session)
- **Toolbar Settings System**: Customizable toolbar with preset profiles
  - 3 built-in presets: Beginner (all tools), Advanced (focused toolset), Minimalistic (essential only)
  - Custom mode auto-activates when settings don't match any preset
  - Auto-detection switches back to preset if custom settings match
  - Settings saved per user to cloud (Supabase)
  - Individual button toggles in Advanced Settings section
  - Preset config files for easy customization (`src/config/toolbarPresets/`)
- **Wall Cutter Tool**: Added tooltip label "Wall Cutter (A)" for better tool identification
- **Lock System Enhancement**: Arrow key movement now properly respects locked element status
- **Name Badges Global Toggle**: Badge toggle now affects all tokens globally (keybind: N)
- **Layer Up/Down Keybinds**: Changed from `]`/`[` to `Ctrl+↑`/`Ctrl+↓` for better ergonomics

### Fixed
- **Toolbar Button Visibility**: Fixed ID mismatches preventing buttons from hiding/showing
  - Fixed: fit-to-view, color-picker, layer-up, layer-down, badge-toggle, wallCutterTool, doorTool
- **Wall Cutter**: Now works atomically across all 4 wall types simultaneously (wall line, polyline walls, room outer walls, and hole walls)
- **Undo/Redo System**: Comprehensive quality fixes
  - History now saves BEFORE operations start (not after), ensuring correct state restoration
  - Added initial history state when scene loads
  - Fixed 15+ locations where history timing was incorrect:
    - Element drag, resize, rotation, and scaling operations
    - Vertex manipulation (move, add for walls, rooms, and holes)
    - Multi-element drag operations
    - Wall merge and room merge operations
    - Erase tool operations
    - Wall cutter operations
  - Removed duplicate history saves after operations completed
  - Fixed state declaration order to prevent useEffect/useState conflicts

### Removed
- Unused `replaceElements` function (replaced by atomic `updateScene` calls)

---

### Added (Previous Updates)
- **Game Mode**: Complete game mode implementation for running D&D sessions
  - Game Playlist panel with draggable positioning
  - Interactive element selection and InfoBox system
  - Automatic token locking as default in game mode
  - Playlist navigation with Numpad +/- keyboard shortcuts
  - Auto-scroll to selected element in playlist
  - InfoBox with colored borders matching token colors
  - Visual connector lines from tokens to InfoBoxes
  - Pin/unpin functionality for InfoBoxes
  - Locked/readonly mode for InfoBox widgets
  - GameModeLockButton for quick token locking/unlocking
  - Smart drag detection preventing interference with interactive elements
  - "Start Game Mode" / "End Game Mode" toggle buttons with clear action text
  
- **Toolbox Enhancements**:
  - Game mode specific toolbox showing only Pointer, Pan, and Zoom tools
  - ColorPickerButton now available in game mode
  - 16th color (green) added to complete color picker grid
  - Auto-switch to pointer tool when entering game mode
  
- **Widget System**:
  - Auto-enable playlistObject when first widget is added to an element
  - Manual disable tracking to respect user preferences
  - Text, StatBlock, EncounterTable, and MonsterCard widgets
  
- **Color System**:
  - Complete 16-color palette support across all components
  - Colors: red, blue, yellow, purple, orange, pink, brown, gray, black, white, cyan, magenta, lime, indigo, teal, green
  - Synchronized colors between tokens, InfoBox borders, and connector lines

### Changed
- Mode toggle buttons now use action-oriented text ("Start/End Game Mode")
- Token placement drag-to-size now works seamlessly with preventDefault
- Terrain shape preview now works correctly on both canvas and maps
- Playlist elements automatically lock when selected in game mode
- InfoBox lock icon now accurately reflects element's locked state

### Fixed
- Terrain tool freehand painting restored (selectedTerrainBrush support)
- Terrain shape preview SVG positioning using viewport offsets
- User-selection interference during drag operations
- Token placement drag-to-size broken by browser drag prevention
- InfoBox and PlaylistPanel dragging with intelligent element detection
- Locked element selection in game mode (opens InfoBox without error)
- Non-playlist elements show "End Game Mode to move" message
- Color mapping consistency across all game mode components

## [0.1.0] - 2025-12-09

### Initial Features
- Canvas-based map builder with pan and zoom
- Token placement and management
- Room builder with floor textures
- Wall tool with opening/window support
- Terrain brush system
- Grid overlay with customizable size
- Undo/redo functionality
- Layer management (move up/down)
- Element duplication and deletion
- Scene and collection organization
- Left panel for element properties
- Right panel with Tokens, Maps, Draw, and X-Lab tabs
- Token library with categories (monsters, NPCs, items, objects, environment)
- Shape tokens (circle, square, triangle, star, diamond, heart)
- POI markers (quest, clue, hidden, door, landmark, footprint, info, skull)
- Multiple map support with background images
- FTP deployment scripts for asset management

[Unreleased]: https://github.com/gNatix/DMP/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gNatix/DMP/releases/tag/v0.1.0
