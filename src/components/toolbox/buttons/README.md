# Tool Buttons - Plugin System

Dette er et plugin-baseret system for toolbar-knapper, der gør det nemt at tilføje, redigere eller fjerne knapper.

## ⚙️ Toolbar Konfiguration

I toppen af `FloatingToolbar.tsx` finder du `TOOLBAR_CONFIG`:

```typescript
const TOOLBAR_CONFIG = {
  // Vis keyboard genveje under knapperne
  showKeyboardShortcuts: true,  // true = vis | false = skjul
  
  // Rækkefølge af kategorier (knapper grupperes i disse kategorier)
  categoryOrder: [
    'selection',   // Valg (pointer)
    'drawing',     // Tegneværktøjer (token, terrain, room)
    'navigation',  // Navigation (pan, zoom)
    'history',     // Fortryd/gendan
    'layers',      // Lag-håndtering (duplicate, delete, layer up/down)
    'view',        // Visning (grid, fit to view)
    'utilities',   // Værktøjer (lock, badges, color picker)
  ],
  
  // Vis vertikale streger mellem kategorier
  showCategoryDividers: true,  // true = vis | false = skjul
};
```

### Skjul Keyboard Shortcuts
Sæt `showKeyboardShortcuts: false` for at skjule alle keyboard genveje.

### Ændr Kategori Rækkefølge
Flyt kategorier i `categoryOrder` arrayet for at ændre toolbar layout.

### Skjul en Kategori
Fjern en kategori fra `categoryOrder` for at skjule alle dens knapper.

---

## 📁 Struktur

```
src/components/tool-buttons/
├── types.ts              # Type definitioner med FULD dokumentation
├── index.ts              # Central registry for alle knapper
├── PointerButton.tsx     # Eksempel: Tool button
├── TokenButton.tsx       # Eksempel: Tool med submenu
├── GridButton.tsx        # Eksempel: Toggle button
├── UndoButton.tsx        # Eksempel: Action button
└── ColorPickerButton.tsx # Eksempel: Submenu button
```

## 🎯 Hurtig Reference - Knap Konfiguration

### Minimum Konfiguration
```typescript
export const myButtonConfig: ToolButtonConfig = {
  id: 'my-button',              // Unikt ID
  enabled: true,                // true = vis knappen
  category: 'drawing',          // se kategorier nedenfor
  weight: 5,                    // højere = længere til højre
  
  icon: <MyIcon size={18} />,   // import fra 'lucide-react'
  label: 'My Tool',             // tooltip tekst
  shortcutKey: 'M',             // keyboard shortcut (optional)
  
  buttonType: 'tool',           // 'tool' | 'toggle' | 'action' | 'submenu'
  highlightStyle: 'full',       // 'full' | 'border' | null
  
  tool: 'my-tool',              // kun for buttonType: 'tool'
  hasSubmenu: false,            // true hvis den har submenu
};
```

## 📋 Komplet Oversigt - Alle Muligheder

### CATEGORY (kategori) - Hvor knappen vises
```typescript
'selection'   // → Valg og markering (fx Pointer)
'drawing'     // → Tegneværktøjer (fx Token, Terrain, Room)
'navigation'  // → Navigation (fx Pan, Zoom)
'history'     // → Undo/Redo operationer
'layers'      // → Lag-håndtering (fx Duplicate, Delete, Layer Up/Down)
'view'        // → Visningsindstillinger (fx Grid, Fit to View)
'utilities'   // → Diverse funktioner (fx Badges, Lock, Color Picker)
```

### BUTTON TYPE (buttonType) - Hvordan knappen opfører sig

#### `'tool'` - Værktøjsknap
- Bliver aktiv når du klikker
- Forbliver aktiv indtil et andet værktøj vælges
- Kun ét værktøj kan være aktivt ad gangen
- Skal have `tool: 'værktøjsnavn'` defineret
- **Eksempler:** Pointer, Token, Terrain, Room, Pan, Zoom

```typescript
buttonType: 'tool',
highlightStyle: 'full',    // fuld farvet baggrund når aktiv
tool: 'pointer',           // hvilket værktøj aktiveres
```

#### `'toggle'` - Til/Fra knap
- Skifter mellem til og fra tilstand
- Tilstand bibeholdes indtil du klikker igen
- Kan være aktiv samtidig med et værktøj
- **Eksempler:** Grid (on/off), Lock (locked/unlocked), Badges (show/hide)

```typescript
buttonType: 'toggle',
highlightStyle: 'full',    // eller 'border' for subtil fremhævning
tool: undefined,           // toggle buttons har ikke tool
```

#### `'action'` - Øjeblikkelig handling
- Udfører handling med det samme
- Ingen aktiv tilstand
- Går tilbage til normal efter klik
- **Eksempler:** Undo, Redo, Duplicate, Delete, Layer Up/Down, Fit to View

```typescript
buttonType: 'action',
highlightStyle: null,      // ingen fremhævning
tool: undefined,           // action buttons har ikke tool
```

#### `'submenu'` - Åbner submenu
- Åbner en picker eller menu
- Ændrer ikke værktøj eller tilstand
- Giver adgang til flere valgmuligheder
- **Eksempler:** Color Picker

```typescript
buttonType: 'submenu',
highlightStyle: null,      // eller 'full'/'border' hvis relevant
hasSubmenu: true,          // SKAL være true
```

### HIGHLIGHT STYLE (highlightStyle) - Visuel fremhævning

#### `'full'` - Fuld farvet baggrund
- Hele knappen får farvet baggrund når aktiv
- **Brug til:** Værktøjer, vigtige toggle states
- **Eksempler:** Pointer (grøn), Token (blå), Grid (når tændt)

```typescript
highlightStyle: 'full',
// Knappen bliver: bg-dm-highlight eller bg-green-600 etc.
```

#### `'border'` - Farvet ramme
- Kun ramme omkring knappen
- **Brug til:** Subtile state indikatorer
- **Eksempler:** Badge toggle (gul ramme når token har badge)

```typescript
highlightStyle: 'border',
// Knappen får: border-2 border-yellow-500
```

#### `null` - Ingen fremhævning
- Ingen visuel fremhævning
- **Brug til:** Action buttons, submenu openers
- **Eksempler:** Undo, Redo, Delete, Color Picker

```typescript
highlightStyle: null,
// Kun hover effekt, ingen aktiv state
```

## 🔧 Praktiske Eksempler

### Eksempel 1: Tool Button (Værktøj)
```typescript
// MyDrawingTool.tsx
export const myDrawingToolConfig: ToolButtonConfig = {
  id: 'my-drawing-tool',
  enabled: true,
  category: 'drawing',
  weight: 4,
  
  icon: <Pencil size={18} />,
  label: 'My Drawing Tool',
  shortcutKey: 'X',
  
  buttonType: 'tool',        // ← Værktøj der forbliver aktivt
  highlightStyle: 'full',    // ← Fuld farvet baggrund
  tool: 'my-drawing',        // ← Værktøjsnavn
  hasSubmenu: false,
};
```

### Eksempel 2: Toggle Button (Til/Fra)
```typescript
// MyToggle.tsx
export const myToggleConfig: ToolButtonConfig = {
  id: 'my-toggle',
  enabled: true,
  category: 'view',
  weight: 2,
  
  icon: <Eye size={18} />,
  label: 'Toggle Something',
  shortcutKey: 'E',
  
  buttonType: 'toggle',      // ← On/Off tilstand
  highlightStyle: 'full',    // ← Farvet når tændt
  hasSubmenu: false,
};
```

### Eksempel 3: Action Button (Øjeblikkelig handling)
```typescript
// MyAction.tsx
export const myActionConfig: ToolButtonConfig = {
  id: 'my-action',
  enabled: true,
  category: 'utilities',
  weight: 5,
  
  icon: <Wand size={18} />,
  label: 'Do Something',
  shortcutKey: 'Shift+A',
  
  buttonType: 'action',      // ← Udfører handling med det samme
  highlightStyle: null,      // ← Ingen fremhævning
  hasSubmenu: false,
};
```

### Eksempel 4: Submenu Button (Med picker)
```typescript
// MyPicker.tsx
export const myPickerConfig: ToolButtonConfig = {
  id: 'my-picker',
  enabled: true,
  category: 'utilities',
  weight: 6,
  
  icon: <Palette size={18} />,
  label: 'Open Picker',
  shortcutKey: 'P',
  
  buttonType: 'submenu',     // ← Åbner submenu
  highlightStyle: null,      // ← Ingen fremhævning
  hasSubmenu: true,          // ← HAR submenu
};
```

## ✏️ Rediger Eksisterende Knap

For at ændre en knap, åbn knap-filen og rediger konfigurationen i toppen:

```typescript
// Eksempel: Deaktiver Token knappen
export const tokenButtonConfig: ToolButtonConfig = {
  // ...
  enabled: false,  // ← Ændret fra true til false
  // ...
};
```

```typescript
// Eksempel: Flyt Grid knappen til anden kategori
export const gridButtonConfig: ToolButtonConfig = {
  // ...
  category: 'utilities',  // ← Ændret fra 'view' til 'utilities'
  weight: 10,             // ← Ny position i kategorien
  // ...
};
```

```typescript
// Eksempel: Skift highlight style
export const badgeToggleButtonConfig: ToolButtonConfig = {
  // ...
  highlightStyle: 'full',  // ← Ændret fra 'border' til 'full'
  // ...
};
```

## 🎨 Tilgængelige Ikoner

Alle ikoner kommer fra [Lucide React](https://lucide.dev/icons/):

```typescript
import { 
  MousePointer,    // Pointer/cursor
  Stamp,          // Token
  Paintbrush,     // Pensler/maling
  Square,         // Firkant/rum
  Hand,           // Hånd/pan
  ZoomIn,         // Zoom ind
  Undo, Redo,     // Fortryd/gendan
  Copy, Trash2,   // Kopier/slet
  ChevronUp,      // Pil op
  ChevronDown,    // Pil ned
  Tag,            // Badge/tag
  Lock,           // Lås
  Grid3x3,        // Grid
  Palette,        // Farvepalette
  Maximize2,      // Maksimer/fit
} from 'lucide-react';
```

Søg efter flere på: https://lucide.dev/icons/

## 🆕 Tilføj ny knap

### 1. Opret knap-fil

```tsx
// src/components/tool-buttons/MyButton.tsx

import { MyIcon } from 'lucide-react';
import { ToolButtonConfig, ToolButtonProps } from './types';

// ========== KNAP KONFIGURATION ==========
export const myButtonConfig: ToolButtonConfig = {
  id: 'my-button',
  enabled: true,              // ← Sæt til false for at skjule
  category: 'drawing',        // ← Vælg kategori
  weight: 10,                 // ← Højere = længere til højre
  
  icon: <MyIcon size={18} />,
  label: 'My Tool',
  shortcutKey: 'M',
  
  tool: 'my-tool',
  hasSubmenu: false,
};
// ========================================

const MyButton = ({ activeTool, setActiveTool }: ToolButtonProps) => {
  const isActive = activeTool === myButtonConfig.tool;
  
  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={() => setActiveTool(myButtonConfig.tool!)}
        className={`p-2.5 rounded transition-colors ${
          isActive
            ? 'bg-dm-highlight text-white'
            : 'bg-dm-dark hover:bg-dm-border text-gray-300 hover:text-white'
        }`}
      >
        {myButtonConfig.icon}
      </button>
      <span className="text-[9px] text-gray-500 font-medium mt-0.5">
        {myButtonConfig.shortcutKey}
      </span>
    </div>
  );
};

export default MyButton;
```

### 2. Registrer i index.ts

```typescript
// src/components/tool-buttons/index.ts

import MyButton, { myButtonConfig } from './MyButton';

export const toolButtons = [
  // ... existing buttons ...
  { component: MyButton, config: myButtonConfig },  // ← Tilføj her
];
```

### 3. Importér i FloatingToolbar

```tsx
// src/components/FloatingToolbar.tsx

import MyButton from './tool-buttons/MyButton';

// Brug i toolbar:
<MyButton 
  activeTool={activeTool}
  setActiveTool={setActiveTool}
  activeSubmenu={activeSubmenu}
  setActiveSubmenu={setActiveSubmenu}
/>
```

## 🎨 Knap med Submenu

Se `TokenButton.tsx` for eksempel på knap med submenu:

```tsx
export const tokenButtonConfig: ToolButtonConfig = {
  // ...
  hasSubmenu: true,  // ← Indikerer at den har submenu
};

const TokenButton = ({ /* ... */ }) => {
  return (
    <div className="relative flex flex-col items-center">
      <button>{/* ... */}</button>
      
      {/* Submenu */}
      {activeSubmenu === 'token' && (
        <div className="absolute bottom-full mb-3">
          <TokenPickerSubmenu /* ... */ />
        </div>
      )}
    </div>
  );
};
```

## ⚙️ Action Knap (uden tool)

Se `UndoButton.tsx` for eksempel på knap der kun udfører en handling:

```tsx
export const undoButtonConfig: ToolButtonConfig = {
  // ...
  hasSubmenu: false,
  // tool: undefined  ← Ingen tool (kun action)
};

interface UndoButtonPropsExtended extends ToolButtonProps {
  onUndo: () => void;
  canUndo: boolean;
}

const UndoButton = ({ onUndo, canUndo }: UndoButtonPropsExtended) => {
  return (
    <button
      onClick={onUndo}
      disabled={!canUndo}
    >
      {/* ... */}
    </button>
  );
};
```

## 🔧 Rediger eksisterende knap

Åbn knap-filen og juster konfigurationen i toppen:

```tsx
// Skjul knappen midlertidigt
enabled: false,

// Flyt den til anden kategori
category: 'utilities',

// Giv den ny prioritet
weight: 100,  // Flytter den længere til højre

// Skift keyboard shortcut
shortcutKey: 'K',
```

## 🗑️ Slet/Skjul knap

### Midlertidig (kan aktiveres igen):
```tsx
export const myButtonConfig: ToolButtonConfig = {
  enabled: false,  // ← Sæt til false
  // ...
};
```

### Permanent:
1. Fjern komponenten fra `index.ts`
2. Fjern importen fra `FloatingToolbar.tsx`
3. Fjern selve knap-filen (optional)

## 🎯 Fordele ved systemet

✅ **Nem at redigere** - Alt er samlet ét sted i toppen af hver fil  
✅ **Nem at tilføje** - Kopier eksisterende knap og tilpas  
✅ **Nem at slette** - Sæt `enabled: false` eller fjern fra registry  
✅ **Automatisk sortering** - Knapper sorteres efter kategori og weight  
✅ **Type-safe** - TypeScript sikrer korrekt konfiguration  
✅ **Konsistent** - Alle knapper følger samme pattern  

## 📊 Eksempler på Weight/Prioritering

```typescript
// Drawing category
{ id: 'token',   weight: 1 }   // Først
{ id: 'terrain', weight: 2 }   // Anden
{ id: 'room',    weight: 3 }   // Tredje

// History category  
{ id: 'undo', weight: 1 }      // Først
{ id: 'redo', weight: 2 }      // Anden
```

Jo højere `weight`, jo længere til højre vises knappen i sin kategori.

## 🚀 Fremtidige forbedringer

- Auto-loading: Automatisk import af alle knapper fra mappen
- Dividers: Automatiske dividers mellem kategorier
- Visibility conditions: `showWhen` callback for dynamisk vis/skjul
- Grouping: Automatisk gruppering baseret på kategori
