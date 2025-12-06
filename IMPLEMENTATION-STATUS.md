# 📝 STATUS-RAPPORT: Central Submenu System Implementation

## **Ændringer i Toolbox.tsx**

### **A) Outside-click fix ✅**
- **Tilføjet:** `data-toolbox-container="true"` på toolbox root div
- **Resultat:** `handleDocumentClick` kan nu korrekt detektere om klik er udenfor toolbox

### **B) Hover kan skifte submenu ✅**
- **Fjernet:** Conditionen `if (openSubmenuId === null || openSubmenuId === id)` i `onToolboxButtonMouseEnter`
- **Ny logik:** Hover starter ALTID en 100ms timer der kalder `openSubmenu(id, 'hover')`
- **Resultat:** Hover kan nu skifte fra en click-opened grid-submenu til en hover-opened token-submenu

### **C) Debug-attributter & overlay ✅**

**Debug overlay (når MENU_DEBUG_MODE=true):**
- Placeret nederst til højre med grøn tekst på sort baggrund
- Viser live:
  - `openSubmenuId` (fx 'grid' eller 'null')
  - `submenuOpenedBy` (fx 'click', 'hover', 'shortcut' eller 'null')
  - `hoverTimerActive` (true/false baseret på `hoverCloseTimerRef.current !== null`)

**DOM attributter:**
- Toolbox container har `data-toolbox-container="true"`
- Submenus får (via GridButton som eksempel):
  - `data-submenu-id="grid"`
  - `data-submenu-open="true"` (eller "false")
  - `data-opened-by="click"` (eller "hover", "shortcut", "null")
  - `data-submenu-container="true"`

---

## **GridButton Integration**

### **Hvad GridButton nu gør:**

**Props modtaget fra Toolbox:**
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
showGrid, gridSize, onToggleGrid, onGridSizeChange, handleGridScroll
```

**Click-handling:**
```tsx
handleClick = () => {
  onToggleGrid(); // Toggle grid visibility
  
  if (isSubmenuOpen && submenuOpenedBy === 'click') {
    onOpenSubmenu(null, 'click'); // Toggle off
  } else if (!isSubmenuOpen) {
    onOpenSubmenu('grid', 'click'); // Open
  } else {
    onOpenSubmenu('grid', 'click'); // Switch from hover/shortcut to click
  }
}
```

**Shortcut-handling (G-tast):**
```tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'g' || e.key === 'G') {
      // Ignore if typing in input/textarea
      // Toggle grid + toggle submenu via shortcut
      if (isSubmenuOpen && submenuOpenedBy === 'shortcut') {
        onOpenSubmenu(null, 'shortcut'); // Toggle off
      } else {
        onOpenSubmenu('grid', 'shortcut'); // Open
      }
    }
  }
}, [isSubmenuOpen, submenuOpenedBy, onOpenSubmenu]);
```

**Hover-handling:**
```tsx
onMouseEnter={() => onToolboxButtonMouseEnter('grid')}
onMouseLeave={() => onToolboxButtonMouseLeave('grid')}
```
- Delegerer til centrale hover handlers
- Starter 100ms open-delay
- Starter 200ms close-delay ved leave (kun for hover-opened)

**Scroll-handling:**
```tsx
onWheel={handleGridScroll} // Scroll to change grid size
```

---

## **Grid Submenu Rendering**

**Betinget rendering:**
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
    <GridControlsSubmenu ... />
  </div>
)}
```

**Data-attributter sat:**
- ✅ `data-submenu-id="grid"`
- ✅ `data-submenu-open="true"` (når åben)
- ✅ `data-opened-by="click"` (eller "hover"/"shortcut" afhængig af hvordan den åbnedes)
- ✅ `data-submenu-container="true"`

**Mouse handlers:**
- ✅ `onMouseEnter` → kalder `onSubmenuMouseEnter('grid')` → clearer hover-close timer
- ✅ `onMouseLeave` → kalder `onSubmenuMouseLeave('grid')` → starter 200ms close timer (kun for hover-opened)

---

## **Forventede Test-scenarier**

Med `MENU_DEBUG_MODE=true` skulle følgende nu virke:

### **1. Click-åbning:**
- Klik på Grid-knap → submenu åbner
- Debug viser: `openSubmenuId: grid`, `submenuOpenedBy: click`
- Klik igen på Grid-knap → submenu lukker (toggle)
- Hover væk fra submenu → submenu forbliver åben
- ESC eller klik udenfor → submenu lukker

### **2. Shortcut-åbning:**
- Tryk G → grid toggle + submenu åbner
- Debug viser: `openSubmenuId: grid`, `submenuOpenedBy: shortcut`
- Tryk G igen → submenu lukker (toggle)
- ESC eller klik udenfor → submenu lukker

### **3. Hover-åbning:**
- Hover over Grid-knap i 100ms → submenu åbner
- Debug viser: `openSubmenuId: grid`, `submenuOpenedBy: hover`
- Hover væk i 200ms → submenu lukker
- Hover tilbage før 200ms → timer cleares, submenu forbliver åben
- Hover-kæde virker: knap → submenu → knap → submenu

### **4. Cross-interaction:**
- Åbn grid via click → hover over anden knap → anden submenu åbner (grid lukkes)
- Åbn grid via hover → klik på grid-knap → ændrer til click-opened (forbliver åben ved hover-away)

### **5. Outside-click:**
- Åbn grid via click → klik på toolbox selv → forbliver åben
- Åbn grid via click → klik på canvas → lukker
- Åbn grid via hover → klik på canvas → forbliver åben (hover ignorerer outside-click)

---

## **Næste Trin (EFTER TEST)**

Når Grid fungerer perfekt i browseren:
1. Rul samme mønster ud til ColorButton
2. Derefter Token/Terrain/Room
3. Ryd op i auto-open useEffect hooks
4. Sæt `MENU_DEBUG_MODE = false`

**STOP HER - INTET MERE KODE FØR TEST** ✋
