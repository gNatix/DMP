# State of Work 1.0 - DM Planner
**Date:** December 9, 2025  
**Version:** 0.1.0 (Game Mode Release)  
**Status:** Active Development

---

## 🎯 Project Overview

DM Planner is a web-based virtual tabletop (VTT) application designed for Dungeons & Dragons Dungeon Masters. The application provides comprehensive tools for map creation, token management, and real-time game session management with a dual-mode architecture (Planning Mode and Game Mode).

---

## 📊 Current State

### Core Systems - Status

#### ✅ **Completed & Stable**

**Canvas & Rendering System**
- Multi-layer canvas rendering (background, terrain, rooms, walls, tokens, annotations)
- Viewport management with pan and zoom functionality
- Grid overlay with customizable size
- Element z-index management
- Double-click element editing
- Drag-to-select and multi-selection support

**Token System**
- Image-based tokens with customizable size and color borders
- 16-color palette (red, blue, yellow, purple, orange, pink, brown, gray, black, white, cyan, magenta, lime, indigo, teal, green)
- Shape tokens (circle, square, triangle, star, diamond, heart)
- POI markers (quest, clue, hidden, door, landmark, footprint, info, skull)
- Token library with category organization
- Badge visibility toggle
- Token placement with drag-to-size
- Locked token support

**Room Builder**
- Drag-to-draw rooms (rectangle, pentagon, hexagon, octagon)
- Custom/magnetic room drawing with vertex placement
- Floor texture application with tiling
- Wall generation with openings/windows
- Room merging and subtraction
- Wall eraser tool
- Hole/cutout support

**Terrain Brush System**
- Freehand painting with circular brush
- Shape mode (circle, rectangle, polygon)
- Brush size adjustment
- Terrain stamping with position tracking
- X-Lab integration for background textures

**Wall System**
- Wall drawing along room perimeters
- Configurable wall thickness and texture
- Wall tile size adjustment
- Wall opening/window creation
- Wall merging between rooms

**Scene Management**
- Multiple scenes with background maps
- Collection-based organization
- Scene switching
- Active scene tracking

**History System**
- Undo/redo functionality with stack management
- History tracking for all element modifications
- Canvas state preservation

**Toolbox System**
- Modular button architecture
- Tool/toggle/action/submenu button types
- Keyboard shortcuts
- Category-based organization
- View mode filtering (planning/game mode)
- Submenu system with hover/click control

#### 🚧 **In Progress**

**Game Mode Features**
- ✅ Playlist panel with element filtering
- ✅ InfoBox system with widgets
- ✅ Token auto-locking
- ✅ InfoBox connector lines
- ✅ Playlist navigation (keyboard shortcuts)
- ✅ Game mode toolbox (pointer, pan, zoom only)
- ⚠️ Widget types (Text, StatBlock, EncounterTable, MonsterCard implemented)
- 🔄 Additional widget types needed
- 🔄 Label editing for playlist elements
- 🔄 Music/sound integration

**Asset Management**
- ✅ FTP upload scripts for tokens and terrain
- ✅ Server-side file listing API
- ⚠️ Asset library browser needs UX improvements
- 🔄 Asset categorization and tagging
- 🔄 Custom asset upload interface

#### ❌ **Not Started**

**Multiplayer Support**
- Real-time collaboration
- Player clients
- WebSocket communication
- Session hosting/joining

**Advanced Features**
- Fog of war system
- Dynamic lighting
- Vision/line of sight
- Measurement tools
- Combat tracker
- Initiative management
- Dice roller integration
- Character sheet integration

**Performance Optimization**
- Canvas rendering optimization
- Large map handling
- Asset lazy loading
- Memory management

---

## 🏗️ Architecture

### Technology Stack
- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Canvas:** HTML5 Canvas API
- **Icons:** Lucide React
- **State Management:** React Hooks (useState, useEffect, useRef)

### Project Structure
```
src/
├── components/
│   ├── Canvas.tsx              # Main canvas component (7000+ lines)
│   ├── gameMode/               # Game mode specific components
│   │   ├── InfoBox.tsx         # Element info panel
│   │   ├── InfoBoxConnector.tsx
│   │   └── PlaylistPanel.tsx   # Game session element list
│   ├── leftPanel/              # Properties panel
│   │   ├── LeftPanel.tsx
│   │   └── widgets/            # InfoBox widgets
│   ├── rightPanel/             # Asset library panels
│   │   ├── TokensTab.tsx
│   │   ├── MapSelectorModal.tsx
│   │   ├── RoomBuilderPanel.tsx
│   │   └── XLabPanel.tsx
│   └── toolbox/                # Tool buttons
│       ├── Toolbox.tsx
│       ├── buttons/            # Individual tool buttons
│       └── submenus/           # Tool submenus
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Application constants
└── App.tsx                     # Main application component
```

### Key Design Patterns
- **Component Composition:** Modular button system with shared configuration
- **Render Props:** Toolbox button registry with dynamic rendering
- **Controlled Components:** Canvas state managed by App.tsx
- **Hook-based State:** Custom hooks for keyboard shortcuts and text input detection
- **Context API:** Text input context for keyboard shortcut management

---

## 🎨 Features Deep Dive

### Dual Mode Architecture

**Planning Mode**
- Full access to all drawing and editing tools
- Element creation and modification
- Asset library access
- Scene setup and configuration
- No element restrictions

**Game Mode**
- Restricted toolbox (pointer, pan, zoom only)
- Playlist-based element management
- InfoBox system for interactive elements
- Token locking as default
- Read-only for non-playlist elements
- Focus on gameplay rather than editing

### Widget System

**Implemented Widgets:**
1. **Text Widget** - Rich text notes
2. **StatBlock Widget** - Monster/NPC statistics
3. **EncounterTable Widget** - Event roll tables
4. **MonsterCard Widget** - Combat reference cards

**Widget Features:**
- Drag-to-reorder (planned)
- Collapsible sections
- Edit/delete controls
- Read-only mode when locked

### Color System

**16-Color Palette with Hex Values:**
- Red: #ef4444
- Blue: #3b82f6
- Yellow: #eab308
- Purple: #a855f7
- Orange: #f97316
- Pink: #ec4899
- Brown: #92400e
- Gray: #6b7280
- Black: #000000
- White: #ffffff
- Cyan: #06b6d4
- Magenta: #d946ef
- Lime: #84cc16
- Indigo: #6366f1
- Teal: #14b8a6
- Green: #22c55e

---

## 🐛 Known Issues

### Critical
- None identified

### Major
- Arrow key navigation conflicts with other features (resolved by using Numpad +/-)
- Large canvas performance degradation with 100+ elements

### Minor
- InfoBox position calculation needs viewport info from Canvas
- Asset library UX could be improved
- No loading states for asset fetching
- Double-click timing threshold may need tuning

### Technical Debt
- Canvas.tsx is 7000+ lines and needs refactoring
- Color mapping duplicated across multiple components (needs centralization)
- Type definitions could be more granular
- Missing prop types documentation

---

## 🔧 Development Workflow

### Current Practices
- Git-based version control
- Feature branch workflow
- Build before commit
- TypeScript strict mode enabled
- Vite HMR for development
- Manual testing workflow

### Deployment
- FTP deployment to web hosting
- Build artifacts in `/dist` directory
- Asset hosting via webhotel API
- Static file serving

---

## 📈 Metrics

### Codebase Statistics
- **Total Lines:** ~15,000+ (estimated)
- **Main Component:** Canvas.tsx (7,181 lines)
- **Components:** 40+ files
- **Type Definitions:** 100+ interfaces/types
- **Tool Buttons:** 20+ buttons

### Performance Benchmarks
- **Initial Load:** < 2 seconds
- **Tool Switching:** < 50ms
- **Canvas Render:** 60 FPS (< 100 elements)
- **Undo/Redo:** < 100ms

---

## 🎯 Next Milestones

### Short Term (1-2 weeks)
1. Label editing for playlist elements
2. Widget drag-to-reorder
3. Additional widget types
4. Canvas.tsx refactoring (split into smaller components)
5. Centralized color mapping utility

### Medium Term (1-2 months)
1. Fog of war system
2. Dynamic lighting
3. Measurement tools
4. Combat tracker
5. Performance optimization for large maps

### Long Term (3-6 months)
1. Multiplayer support
2. Player client interface
3. Character sheet integration
4. Advanced automation features
5. Mobile responsive design

---

## 🤝 Collaboration Notes

### For New Developers
- Main logic is in `Canvas.tsx` - start there
- Type definitions in `types.ts` are crucial
- Toolbox system is modular - add buttons via registry
- Game mode components are in `components/gameMode/`
- Use existing color palette from `ColorPickerSubmenu.tsx`

### Code Style
- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS for styling
- Inline styles for dynamic values (colors, positions)
- Comments for complex logic blocks

### Testing Approach
- Manual testing in browser
- Build verification before commit
- Visual regression testing (manual)
- No automated test suite yet

---

## 📝 Notes

### Design Decisions
- **Canvas over SVG:** Better performance for complex scenes
- **Dual Mode:** Separation of concerns between planning and gameplay
- **Widget System:** Extensible architecture for future features
- **Color Synchronization:** Consistent visual language across components
- **Keyboard Shortcuts:** Power user efficiency

### Future Considerations
- Consider moving to Canvas API libraries (Konva, Fabric.js) for better performance
- Evaluate state management libraries (Redux, Zustand) as app grows
- Plan for real-time collaboration architecture early
- Consider PWA features for offline support
- Evaluate WebGL for rendering optimization

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Next Review:** December 16, 2025
