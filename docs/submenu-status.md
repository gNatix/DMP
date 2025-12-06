# 🧭 Submenu System Status

**Sidst opdateret:** 6. december 2024  
**Status:** GridButton + ColorButton migrated to GRID_PATTERN ✅  
**Liste-tool shortcut behavior:** Implemented for all list-tools (token, terrain, room, color) ✅  
**Keybind system:** Dynamic keybind mapping from button configs ✅

---

## 🎮 KEYBIND CONFIGURATION

**Alle keyboard shortcuts styres fra button config files:**

### **Sådan ændrer du en keybind:**

1. Åbn den relevante button file (f.eks. `TokenButton.tsx`, `TerrainButton.tsx`)
2. Find `buttonConfig` objektet i toppen af filen
3. Ændre `shortcutKey` property:
   ```typescript
   export const tokenButtonConfig: ToolButtonConfig = {
     // ... other properties ...
     shortcutKey: 'B',  // ← ÆNDRE DETTE for at ændre keybind
   };
   ```
4. Gem filen - keybind er nu automatisk opdateret!

### **Nuværende keybinds:**
- **Pointer tool:** `V` (defineret i `PointerButton.tsx`)
- **Token tool:** `B` (defineret i `TokenButton.tsx`)
- **Terrain tool:** `T` (defineret i `TerrainButton.tsx`)
- **Room tool:** `R` (defineret in `RoomButton.tsx`)
- **Pan tool:** `H` (defineret i `PanButton.tsx`)
- **Zoom tool:** `Z` (defineret i `ZoomButton.tsx`)
- **Undo:** `Ctrl+Z` (defineret i `UndoButton.tsx`)
- **Redo:** `Ctrl+Y` (defineret i `RedoButton.tsx`)
- **Duplicate:** `D` (defineret i `DuplicateButton.tsx`)
- **Delete:** `Del` (defineret i `DeleteButton.tsx`)
- **Layer Up:** `]` (defineret i `LayerUpButton.tsx`)
- **Layer Down:** `[` (defineret i `LayerDownButton.tsx`)
- **Toggle Badges:** `N` (defineret in `BadgeToggleButton.tsx`)
- **Lock:** `L` (defineret in `LockButton.tsx`)
- **Grid:** `G` (defineret i `GridButton.tsx`)
- **Color picker:** `C` (defineret i `ColorPickerButton.tsx`)
- **Fit to View:** `F` (defineret i `FitToViewButton.tsx`)

### **Teknisk implementation:**
- **Hver knap håndterer sin egen keyboard shortcut** i sin egen fil
- Keyboard handler læser `shortcutKey` direkte fra button config
- **INGEN central keyboard handling** - alt er decentraliseret til button-filerne
- Case-insensitive (både 'b' og 'B' virker)
- Support for special keys: `Delete`, `Ctrl+Z`, `Ctrl+Y`, `[`, `]`, osv.
- Automatisk skip hvis typing i INPUT eller TEXTAREA felter

### **Fordele ved dette system:**
✅ **Single source of truth** - Ændre shortcut ét sted, det virker overalt  
✅ **Gennemsigtig configuration** - Alle settings i button-filens config  
✅ **Let at vedligeholde** - Ingen hardcoded keys spredt rundt i koden  
✅ **Nem at tilpasse** - Bare ændre `shortcutKey` værdien  
✅ **Type-safe** - TypeScript sikrer korrekt configuration  

---

## LISTE-TOOL SHORTCUT STANDARD

**Alle liste-tools (token, terrain, room, color) følger samme adfærd:**

### **Første shortcut-tryk:**
- Åbner submenu (`openSubmenu('<id>', 'shortcut')`)
- Vælger sidste brugte option for dette tool
- Hvis ingen sidste brugt → vælger første item i listen
- Submenu er visuelt åben og viser valget
- **Starter 4000ms inaktivitet timer**

### **Efterfølgende shortcut-tryk:**
- **MÅ IKKE** lukke submenuen
- Cykler til næste item (wrap-around)
- Opdaterer aktivt tool-option
- Visuelt markerer den nye valgte option
- Gemmer optionen som "last used"
- **Resetter 4000ms inaktivitet timer**

### **Shortcut inactivity auto-close (4000ms):**
- Timer starter når submenu åbnes via shortcut
- Timer resettes ved HVER interaktion:
  * Shortcut-tryk (cycling)
  * MouseEnter på knappen
  * MouseEnter på submenuen
  * Klik på item i submenu
  * Scroll/ændring af værdi i submenu
- Auto-close KUN hvis:
  * Submenu stadig åben via 'shortcut' (ikke opgraderet til 'click')
  * Ingen interaktion i 4000ms
  * Bruger ikke hover over submenu/knap
- **Grid undtaget:** Ingen inactivity timer for grid

### **GRID er eneste undtagelse:**
- Grid G-shortcut toggler grid on/off
- Grid on → åbner submenu
- Grid off → lukker submenu
- Ingen "cykling" eller last-used for grid
- Ingen inactivity timer

### **Click-adfærd (alle tools):**
- Klik åbner submenu
- Klik igen på samme knap → lukker submenu

### **Hover-adfærd (alle tools):**
- Hover 100ms → åbner
- Hover-leave 200ms → lukker kun hvis openedBy='hover'

### **Pointer/Select tool:**
- Lukker altid alle submenus når aktiveret

---

## 1) Toolbox.tsx – Central Submenu Arkitektur

### **State-felter:**

- **`openSubmenuId: SubmenuId | null`**  
  Hvilken submenu er åben ('token' | 'terrain' | 'room' | 'grid' | 'color' | null)
  
- **`submenuOpenedBy: OpenedBy | null`**  
  Hvordan blev den åbnet ('click' | 'shortcut' | 'hover' | null)
  
- **`hoverCloseTimerRef: useRef<number | null>`**  
  Timer-handle til 100ms open-delay og 200ms close-delay

### **Kernefunktioner:**

- **`openSubmenu(id: SubmenuId, openedBy: OpenedBy)`**
  - **Hvad:** Åbner en submenu eller toggle den af
  - **Hvornår:**
    - Når knap klikkes (openedBy='click')
    - Når keyboard shortcut bruges (openedBy='shortcut')
    - Når hover delay fyrer (openedBy='hover')
    - Fra useEffect når tool skifter (auto-open)
  - **Logik:**
    1. Hvis id === null: kalder closeSubmenu('explicit-null')
    2. Hvis samme submenu allerede åben:
       - For click/shortcut: toggle off via closeSubmenu('toggle-off')
       - For hover: holder den åben (tidlig return)
    3. Hvis anden submenu er åben: kalder closeSubmenu('opening-another') først
    4. Sætter openSubmenuId = id og submenuOpenedBy = openedBy

- **`closeSubmenu(reason?: string)`**
  - **Hvad:** Lukker den aktive submenu
  - **Hvornår:**
    - Toggle-off (samme knap klikkes igen)
    - Opening another submenu
    - Escape-tast
    - Outside click (kun for click/shortcut-opened)
    - Hover timeout (kun for hover-opened)
  - **Logik:**
    1. Clearer hoverCloseTimerRef
    2. Sætter openSubmenuId = null
    3. Sætter submenuOpenedBy = null
    4. Logger til console hvis MENU_DEBUG_MODE=true

- **`onToolboxButtonMouseEnter(id: SubmenuId)`**
  - **Hvad:** Starter hover-åbning af submenu
  - **Hvornår:** Når mus kommer ind over en toolbox-knap
  - **Logik:**
    1. Clearer eksisterende hoverCloseTimerRef
    2. Sætter en 100ms delay timer
    3. Timer kalder openSubmenu(id, 'hover')
  - **Note:** Fjernet blocking-condition - hover kan nu altid åbne/skifte submenu

- **`onToolboxButtonMouseLeave(id: SubmenuId)`**
  - **Hvad:** Starter hover-lukning af submenu
  - **Hvornår:** Når mus forlader en toolbox-knap
  - **Logik:**
    - Kun hvis denne submenu er åben OG openedBy='hover':
      - Sætter 200ms delay timer
      - Timer kalder closeSubmenu('hover-timeout')
  - **Note:** Click/shortcut-opened menuer påvirkes ikke

- **`onSubmenuMouseEnter(id: SubmenuId)`**
  - **Hvad:** Holder hover-åbnet submenu i live
  - **Hvornår:** Når mus kommer ind i selve submenu-området
  - **Logik:** Clearer hoverCloseTimerRef (annullerer pending close)

- **`onSubmenuMouseLeave(id: SubmenuId)`**
  - **Hvad:** Starter hover-lukning når mus forlader submenu
  - **Hvornår:** Når mus forlader submenu-området
  - **Logik:**
    - Kun hvis openedBy='hover':
      - Sætter 200ms delay timer
      - Timer kalder closeSubmenu('hover-timeout')

- **`handleKeyDown` (useEffect)**
  - **Hvad:** Lukker submenu ved ESC
  - **Hvornår:** Når ESC trykkes og en submenu er åben
  - **Logik:** Kalder closeSubmenu('escape')

- **`handleDocumentClick` (useEffect)**
  - **Hvad:** Lukker click/shortcut-opened menuer ved klik udenfor
  - **Hvornår:** Når der klikkes et sted i dokumentet
  - **Logik:**
    - Kun hvis submenu åben OG openedBy ≠ 'hover':
      - Tjekker om klik er udenfor [data-toolbox-container] og [data-submenu-container]
      - Hvis ja: kalder closeSubmenu('outside-click')

### **Match vs. spec:**

| Regel | Status | Noter |
|-------|--------|-------|
| Single source of truth | ✅ | openSubmenuId, submenuOpenedBy, hoverCloseTimerRef |
| Click/shortcut/hover åbning | ✅ | Alle tre metoder går gennem openSubmenu() |
| Hover open delay (100ms) | ✅ | Implementeret med setTimeout |
| Hover close delay (200ms) | ✅ | Implementeret med setTimeout |
| Click toggle-regel | ✅ | Samme knap toggle virker korrekt |
| Hover kan skifte submenus | ✅ | FIX: Blocking-condition fjernet |
| ESC-lukning | ✅ | handleKeyDown implementeret |
| Outside-click-adfærd | ✅ | FIX: data-toolbox-container tilføjet |
| Debug flag og logging | ✅ | MENU_DEBUG_MODE=true, omfattende console.log |
| DOM-debug attributter | ✅ | FIX: Alle attributter implementeret på GridButton |
| Debug overlay | ✅ | FIX: Visual overlay nederst til højre |

---

## 2) GridButton Integration

### **Props brugt fra Toolbox:**

```tsx
// Central submenu system
openSubmenuId: string | null
submenuOpenedBy: 'click' | 'shortcut' | 'hover' | null
onOpenSubmenu: (id, openedBy) => void
onCloseSubmenu: (reason) => void
onToolboxButtonMouseEnter: (id) => void
onToolboxButtonMouseLeave: (id) => void
onSubmenuMouseEnter: (id) => void
onSubmenuMouseLeave: (id) => void

// Grid-specific
showGrid: boolean
gridSize: number
onToggleGrid: () => void
onGridSizeChange: (size: number) => void
handleGridScroll: (e: React.WheelEvent) => void
```

### **Click-adfærd:**

**Når submenu er lukket:**
- Klik på Grid → onToggleGrid() + onOpenSubmenu('grid', 'click')
- Submenu åbner, grid toggle virker

**Når submenu er åben via click:**
- Klik på Grid igen → onToggleGrid() + onOpenSubmenu(null, 'click')
- Submenu lukker (toggle off), grid toggle virker

**Når submenu er åben via hover/shortcut:**
- Klik på Grid → onToggleGrid() + onOpenSubmenu('grid', 'click')
- Submenu skifter til click-mode (forbliver åben ved hover-away)

### **Shortcut-adfærd (G):**

**useEffect implementation:**
```tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'g' || e.key === 'G') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // Ignore if typing in input/textarea
        e.preventDefault();
        onToggleGrid();
        
        if (isSubmenuOpen && submenuOpenedBy === 'shortcut') {
          onOpenSubmenu(null, 'shortcut'); // Toggle off
        } else {
          onOpenSubmenu('grid', 'shortcut'); // Open
        }
      }
    }
  }
}, [isSubmenuOpen, submenuOpenedBy, onOpenSubmenu]);
```

**Adfærd:**
- G trykkes første gang → grid toggle + submenu åbner via shortcut
- G trykkes igen → grid toggle + submenu lukker (toggle off)
- Spiller godt sammen med grid visibility toggle

### **Hover-adfærd:**

**Button handlers:**
```tsx
onMouseEnter={() => onToolboxButtonMouseEnter('grid')}
onMouseLeave={() => onToolboxButtonMouseLeave('grid')}
```

**Flow:**
1. Hover over Grid-knap → starter 100ms timer
2. Efter 100ms → openSubmenu('grid', 'hover')
3. Hover væk → starter 200ms timer (kun hvis opened by hover)
4. Hover tilbage inden 200ms → timer cleares, submenu forbliver åben
5. Efter 200ms uden hover → closeSubmenu('hover-timeout')

**Hover-kæde:**
- Knap → Submenu → Knap → Submenu fungerer korrekt
- onSubmenuMouseEnter/Leave håndterer hover inde i submenu

---

## 3) Grid Submenu Rendering

### **Betinget rendering:**

```tsx
{isSubmenuOpen && (
  <div
    data-submenu-id="grid"
    data-submenu-open={isSubmenuOpen ? 'true' : 'false'}
    data-opened-by={submenuOpenedBy || 'null'}
    data-submenu-container="true"
    onMouseEnter={() => onSubmenuMouseEnter('grid')}
    onMouseLeave={() => onSubmenuMouseLeave('grid')}
    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2"
  >
    <GridControlsSubmenu
      gridSize={gridSize}
      onGridSizeChange={onGridSizeChange}
      onWheel={handleGridScroll}
    />
  </div>
)}
```

**Vises når:** `openSubmenuId === 'grid'`  
**Placering:** Above button, centered (`bottom-full mb-2 left-1/2 -translate-x-1/2`)

### **Data-attributter:**

| Attribut | Værdi | Formål |
|----------|-------|--------|
| `data-submenu-id` | `"grid"` | Identificerer hvilken submenu dette er |
| `data-submenu-open` | `"true"/"false"` | Om submenuen er åben |
| `data-opened-by` | `"click"/"hover"/"shortcut"/"null"` | Hvordan den blev åbnet |
| `data-submenu-container` | `"true"` | Bruges af handleDocumentClick til outside-click detection |

### **Mouse handling:**

- **`onMouseEnter={() => onSubmenuMouseEnter('grid')}`**
  - Clearer hoverCloseTimerRef
  - Holder hover-åbnet submenu i live

- **`onMouseLeave={() => onSubmenuMouseLeave('grid')}`**
  - Starter 200ms close timer (kun for hover-opened)
  - Click/shortcut-opened påvirkes ikke

---

## 4) Kendte issues / TODOs

### **🚨 Critical - Må testes før videre arbejde:**

1. **Grid submenu funktionalitet:**
   - [ ] Click-åbning virker
   - [ ] Click-toggle virker
   - [ ] Shortcut (G) åbning virker
   - [ ] Shortcut toggle virker
   - [ ] Hover-åbning efter 100ms delay virker
   - [ ] Hover-lukning efter 200ms delay virker
   - [ ] Hover-kæde (knap↔submenu) virker
   - [ ] ESC lukker submenu
   - [ ] Outside-click lukker click/shortcut-opened
   - [ ] Outside-click IKKE lukker hover-opened
   - [ ] Debug overlay viser korrekt state
   - [ ] Console logs ser korrekte ud

### **⏳ Pending - Venter på Grid test:**

2. **Andre knapper skal opdateres:**
   - [ ] ColorButton + ColorPickerSubmenu
   - [ ] TokenButton + TokenPickerSubmenu
   - [ ] TerrainButton + TerrainPickerSubmenu
   - [ ] RoomButton + RoomSubToolPicker

3. **Cleanup:**
   - [ ] Ryd op i auto-open useEffect hooks (token, terrain, room)
   - [ ] Fjern legacy handler props fra ToolboxProps interface
   - [ ] Sæt MENU_DEBUG_MODE = false
   - [ ] Fjern debug overlay kode (eller gør den conditional)

4. **Legacy filer:**
   - [ ] Slet Toolbox.new.tsx
   - [ ] Slet Toolbox.backup2.tsx
   - [ ] Slet FloatingToolbar.new.tsx
   - [ ] Overvej om useSubmenuController.ts skal fjernes

### **💡 Mulige forbedringer (ikke kritisk):**

5. **Performance:**
   - Overvej useMemo for buttonsByCategory hvis det bliver et issue
   - Overvej useCallback for hover handlers

6. **Accessibility:**
   - Tilføj ARIA attributter til submenus
   - Tilføj keyboard navigation inde i submenus

7. **Documentation:**
   - Opdater README med submenu system arkitektur
   - Tilføj JSDoc comments til kernefunktioner

---

## 5) Test Checklist for Grid

**Med MENU_DEBUG_MODE=true:**

### Click-åbning:
- [ ] Klik Grid → submenu åbner
- [ ] Debug: `openSubmenuId: grid`, `submenuOpenedBy: click`
- [ ] Klik Grid igen → submenu lukker
- [ ] Hover væk → submenu forbliver åben
- [ ] ESC → submenu lukker
- [ ] Klik udenfor toolbox → submenu lukker

### Shortcut-åbning:
- [ ] Tryk G → grid toggle + submenu åbner
- [ ] Debug: `openSubmenuId: grid`, `submenuOpenedBy: shortcut`
- [ ] Tryk G igen → submenu lukker
- [ ] ESC → submenu lukker
- [ ] Klik udenfor → submenu lukker

### Hover-åbning:
- [ ] Hover Grid i 100ms → submenu åbner
- [ ] Debug: `openSubmenuId: grid`, `submenuOpenedBy: hover`
- [ ] Hover væk i 200ms → submenu lukker
- [ ] Hover tilbage før 200ms → timer cleares, forbliver åben
- [ ] Hover: knap → submenu → knap → submenu (kæde virker)
- [ ] Klik udenfor → submenu forbliver åben (hover ignorer outside-click)

### Cross-interaction:
- [ ] Grid åben via click → hover anden knap (når implementeret) → anden åbner, grid lukker
- [ ] Grid åben via hover → klik Grid → skifter til click-mode (forbliver åben ved hover-away)

### Grid-specific:
- [ ] Scroll på Grid-knap → grid size ændres
- [ ] Scroll i submenu → grid size ændres
- [ ] Slider i submenu → grid size ændres
- [ ] Grid toggle fungerer sammen med submenu

---

**Næste skridt:** Test Grid + Color grundigt → Migrér Token → Terrain → Room

---

## Migration Status

### ✅ COMPLETED:
- **GridButton** - Reference implementation (GRID_PATTERN)
- **ColorPickerButton** - Migrated to central system with 'C' shortcut

### 🔄 IN PROGRESS:
- None

### ⏳ PENDING:
- **TokenButton** - Needs migration to central submenu system with data-attributes
- **TerrainButton** - Needs migration to central submenu system with data-attributes
- **RoomButton** - Needs migration to central submenu system with data-attributes
- **Submenu visual feedback** - Selected items should be visually highlighted in submenus

---

## Changelog

**2024-12-06 (Final):** Decentralized keyboard shortcut system
- ✅ **ALLE knapper håndterer nu deres egen keyboard shortcut i deres egen fil**
- ✅ Implementeret keyboard handlers i ALLE 17 button-komponenter:
  * PointerButton.tsx - V key
  * TokenButton.tsx - B key
  * TerrainButton.tsx - T key
  * RoomButton.tsx - R key
  * PanButton.tsx - H key
  * ZoomButton.tsx - Z key
  * UndoButton.tsx - Ctrl+Z
  * RedoButton.tsx - Ctrl+Y
  * DuplicateButton.tsx - D key
  * DeleteButton.tsx - Del key
  * LayerUpButton.tsx - ] key
  * LayerDownButton.tsx - [ key
  * BadgeToggleButton.tsx - N key
  * LockButton.tsx - L key
  * GridButton.tsx - G key (opdateret til at bruge config dynamisk)
  * ColorPickerButton.tsx - C key
  * FitToViewButton.tsx - F key
- ✅ Hver knap læser `shortcutKey` direkte fra sin egen `buttonConfig`
- ✅ Ingen central keyboard handling - alt er decentraliseret
- ✅ Support for special keys (Delete, Ctrl+Z/Y, [], osv.)
- ✅ Single source of truth: Ændre `shortcutKey` i config → keybind opdateres automatisk
- ✅ Gennemsigtig configuration - alle keyboard shortcuts defineres samme sted som knappen selv

**2024-12-06 (Latest):** Dynamic keybind system
- ✅ Fixed ColorPickerButton typo (`shortcutKey: 'j,` → `shortcutKey: 'C'`)
- ✅ Created `keybindToSubmenuMap` in Toolbox.tsx that reads from button configs
- ✅ Replaced ALL hardcoded key checks (if e.key === 't' | 'T') with dynamic lookup
- ✅ Keybinds now controlled by `shortcutKey` property in button configs:
  * TokenButton.tsx: `shortcutKey: 'B'`
  * TerrainButton.tsx: `shortcutKey: 'T'`
  * RoomButton.tsx: `shortcutKey: 'R'`
  * ColorPickerButton.tsx: `shortcutKey: 'C'`
  * GridButton.tsx: `shortcutKey: 'G'` (handled separately)
- ✅ Single source of truth for keybinds - change config, keybind updates automatically
- ✅ Case-insensitive keybind matching
- ✅ Safe handling of optional shortcutKey property

**2024-12-06 (Late Night):** Shortcut inactivity timer + duplicate handler fix
- ✅ Implemented 4000ms auto-close for shortcut-opened list-tools (token, terrain, room, color)
- ✅ Timer starts when submenu opened via shortcut
- ✅ Timer resets on ANY interaction:
  * Shortcut-tryk (cycling items)
  * MouseEnter på tool-button
  * MouseEnter på submenu
  * Click på item i submenu
  * Scroll/værdi-ændring i submenu
- ✅ Auto-close only if:
  * Submenu still opened by 'shortcut' (not upgraded to 'click')
  * No interaction for 4000ms
  * User not hovering over submenu/button
- ✅ Grid excluded from inactivity timer (keeps toggle behavior)
- ✅ Timer cleared when submenu closed or upgraded to click-mode
- ✅ Fixed duplicate C-key handler (removed from ColorPickerButton, kept in Toolbox.tsx)
- ✅ Fixed order: selectLastUsedColor() BEFORE openSubmenu() (ensures submenu shows correct selection)

**2024-12-06 (Late Evening):** Liste-tool shortcut behavior implemented
- ✅ Implemented last-used state for token, terrain, room, color
- ✅ Added cycling functions (cycleToken, cycleTerrain, cycleRoomSubTool, cycleColor)
- ✅ Added select-last-used functions for all list-tools
- ✅ Updated openSubmenu() - shortcut ONLY toggles for grid, NOT for list-tools
- ✅ Added keyboard shortcuts in Toolbox.tsx:
  * T key - Token tool (first press: open + select last-used, subsequent: cycle tokens)
  * R key - Room tool (first press: open + select last-used, subsequent: cycle room sub-tools)
  * B key - Terrain tool (first press: open + select last-used, subsequent: cycle terrain brushes)
  * C key - Color tool (first press: open + select last-used, subsequent: cycle colors)
- ✅ Updated ColorPickerButton to use cycling behavior instead of toggle
- ✅ Added onCloseSubmenu to PointerButton - closes all submenus when pointer tool selected
- ✅ Grid remains ONLY exception - G key still toggles grid on/off

**2024-12-06 (Late Night):** Shortcut inactivity timer
- ✅ Implemented 4000ms auto-close for shortcut-opened list-tools (token, terrain, room, color)
- ✅ Timer starts when submenu opened via shortcut
- ✅ Timer resets on ANY interaction:
  * Shortcut-tryk (cycling items)
  * MouseEnter på tool-button
  * MouseEnter på submenu
  * Click på item i submenu
  * Scroll/værdi-ændring i submenu
- ✅ Auto-close only if:
  * Submenu still opened by 'shortcut' (not upgraded to 'click')
  * No interaction for 4000ms
  * User not hovering over submenu/button
- ✅ Grid excluded from inactivity timer (keeps toggle behavior)
- ✅ Timer cleared when submenu closed or upgraded to click-mode

**2024-12-06 (Late Evening):** Liste-tool shortcut behavior implemented
- ✅ Implemented last-used state for token, terrain, room, color
- ✅ Added cycling functions (cycleToken, cycleTerrain, cycleRoomSubTool, cycleColor)
- ✅ Added select-last-used functions for all list-tools
- ✅ Updated openSubmenu() - shortcut ONLY toggles for grid, NOT for list-tools
- ✅ Added keyboard shortcuts in Toolbox.tsx:
  * T key - Token tool (first press: open + select last-used, subsequent: cycle tokens)
  * R key - Room tool (first press: open + select last-used, subsequent: cycle room sub-tools)
  * B key - Terrain tool (first press: open + select last-used, subsequent: cycle terrain brushes)
  * C key - Color tool (first press: open + select last-used, subsequent: cycle colors)
- ✅ Updated ColorPickerButton to use cycling behavior instead of toggle
- ✅ Added onCloseSubmenu to PointerButton - closes all submenus when pointer tool selected
- ✅ Grid remains ONLY exception - G key still toggles grid on/off

**2024-12-06 (Evening):** ColorButton migration
- ✅ Migrated ColorPickerButton to GRID_PATTERN
- ✅ Added shortcut handler for 'C' key (was defined but not implemented)
- ✅ Updated props interface to use central submenu system
- ✅ Updated submenu rendering with data-attributes
- ✅ Simplified ColorPickerSubmenu (removed redundant props)
- ✅ Updated Toolbox.tsx color-picker case to send central props
- ✅ Removed legacy handlers (handleColorClick, handleColorMenuEnter/Leave)

**2024-12-06 (PM):** Critical bug fixes
- 🐛 Fixed state flapping: Disabled auto-open useEffect hooks temporarily
- 🐛 Fixed shortcut openedBy: GridButton now correctly uses 'shortcut' instead of 'click'
- 🐛 Fixed instant close: Simplified GridButton click handler to prevent double-toggle
- 🐛 Fixed hover guards: onToolboxButtonMouseLeave/onSubmenuMouseLeave now properly guard against closing non-hover submenus
- 🐛 Fixed openedBy switching: openSubmenu now allows switching from hover→click or shortcut→click
- ✅ Enhanced debug logging: openSubmenu and closeSubmenu now log prevId and prevOpenedBy

**2024-12-06 (AM):** Initial implementation
- ✅ GridButton proof-of-concept implementeret
- ✅ Central submenu system i Toolbox.tsx
- ✅ Debug overlay tilføjet
