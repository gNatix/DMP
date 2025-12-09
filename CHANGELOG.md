# Changelog

All notable changes to DM Planner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
