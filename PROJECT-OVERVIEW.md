# DM Planner - Project Overview

## Hvad er DM Planner?

DM Planner er en webbaseret kampagneplanlægningsapplikation designet specifikt til Dungeons & Dragons Dungeon Masters. Programmet fungerer som et digitalt værktøj til at organisere, visualisere og styre kampagner i realtid.

## Primær Funktionalitet

### 1. **Interaktivt Kortværktøj**
- Upload og visning af baggrundskort (dungeons, indendørs, udendørs, tavernaer)
- Zoom og pan funktionalitet med musehjul og genvejstaster
- Fit-to-screen funktion med låsemulighed
- Dynamisk viewport der tilpasser sig panelåbning/-lukning

### 2. **Token Management System**
- **Token Bibliotek**: Organiseret i kategorier (monsters, NPCs, items, objects, environment)
  - Image-baserede tokens fra webhotel
  - Shape tokens (cirkel, firkant, trekant, stjerne, diamant, hjerte, kranium)
  - POI markers (Point of Interest med specialiserede ikoner)
- **Token Picker**: Quick-access menu ved højreklik/B-tast på token tool
  - Viser seneste 16 tokens fra samme kategori
  - Visual preview med farve og ikon
  - Hover effekter med gul kant
- **Token Customization**:
  - Farveramme (16 almindelige farver: rød, blå, grøn, gul, lilla, orange, pink, brun, grå, sort, hvid, cyan, magenta, lime, indigo, teal)
  - Navngivning og notater
  - Togglebare name badges der skalerer dynamisk med token størrelse
  - Størrelsesjustering
  - Layering (bring forward/send backward)

### 3. **Scene & Collection Management**
- **Collections**: Grupperingsmulighed for relaterede maps
  - Custom gradient baggrunde for visuel organisering
  - Expand/collapse funktionalitet
  - Edit og delete funktioner med ikoner
- **Scenes**: Individuelle maps med baggrund og elementer
  - Token oversigt direkte i scene listen
  - Visibility toggle per token
  - Navngivning og organisering
  - Quick edit med Edit ikon

### 4. **Properties Panel (Venstre Side)**
- **Widget System**: Fleksibel egenskabs-system
  - **Rich Text Editor**: Formaterede notater med bold, italic, underline, lists
  - **D&D Stat Block**: Ability scores (STR, DEX, CON, INT, WIS, CHA) med automatisk modifier beregning
  - Drag-and-drop rækkefølge
  - Delete med Trash ikon
- **Element Properties**: Detaljeret redigering af valgte tokens/annotatøringer
- **Multi-select**: Bulk operationer på flere elementer

### 5. **Tastatur Genvejer & UX**
- **Tool Selection**: V (pointer), B (token), N (pan), Z (zoom in), X (zoom out), F (marker)
- **Actions**: Ctrl+D (duplicate), Delete (slet), Ctrl+Z/Y (undo/redo), Ctrl+↑/↓ (layering)
- **ESC Key Priority System**:
  1. Blur text inputs (første tryk)
  2. Luk popups/dialogs (andet tryk)
  3. Deselect tokens (tredje tryk)
- **Token Picker**: B-tast eller højreklik på token tool
- **Fit to View**: F-tast toggle

### 6. **Floating Toolbar**
- Centreret bottom toolbar med alle værktøjer
- Visual feedback for aktive tools
- Indicator for token badges (gul kant når aktiveret)
- **Farve-vælger**: Paintbrush ikon ved siden af badges - klik for at vælge fra 16 farver
- Fit-to-view lock indicator (rød kant)
- Undo/Redo med state management
- Konsistent størrelse (border-2 border-transparent box-content forhindrer vækst)

### 7. **Data Integration**
- Webhotel API integration for maps og tokens
- Dynamic loading fra kategoriserede mapper
- Automatic rotation detection for landscape billeder
- Config-driven endpoints

## Teknisk Stack

### Frontend
- **React 18** med TypeScript
- **Vite** build tool
- **Tailwind CSS** for styling
- **Lucide React** for ikoner

### State Management
- React Hooks (useState, useEffect, useRef)
- Local state med prop drilling
- History system til undo/redo

### Deployment
- **Vercel** for hosting
- **GitHub** for version control
- **FTP deployment** for assets til webhotel

## Custom Features

### Dark Theme System
- Custom CSS variables (dm-panel, dm-dark, dm-highlight, dm-border)
- Konsistent color scheme gennem hele applikationen

### Responsive Design
- Dynamisk panel system (venstre properties, højre scenes/tokens)
- Collapsible panels
- Auto-switching til properties ved selection

### Advanced Interactions
- Right-click panning
- Space+click panning
- Ctrl+click multiple selection
- Drag-and-drop tokens
- Resize handles med corner detection
- Selection box drag

## Workflow Example

1. **Setup**: Opret collection for kampagne
2. **Map**: Tilføj scene med baggrundskort fra bibliotek
3. **Populate**: Placer tokens (monsters, NPCs, POIs) fra token picker eller panel
4. **Customize**: Tilføj farver, navne, badges, notater via properties panel
5. **Organize**: Brug layering til at arrangere elementer korrekt
6. **Play**: Zoom, pan, vis/skjul elementer under session
7. **Document**: Tilføj widgets (notes, stat blocks) til tokens

## Use Cases

- **Battlemap Planning**: Præcis placering af encounters
- **Location Tracking**: POI markers til vigtige steder
- **NPC Management**: Token bibliotek med notater og stats
- **Session Prep**: Pre-loaded scenes klar til brug
- **Campaign Organization**: Collection system til organisering af relaterede maps

## Fremtidige Muligheder

- Fog of war system
- Real-time multiplayer sync
- Dice roller integration
- Initiative tracker
- Custom token upload
- Export/import campaigns
- Template system

---

**Udviklet til**: Dungeon Masters der har brug for et visuelt, intuitivt værktøj til at styre komplekse D&D kampagner med fokus på hurtighed, organisation og brugervenlig UX.
