# DM Planner - Dungeon Master Map Tool

A powerful web-based tool for Dungeon Masters to manage interactive dungeon maps with annotations and tokens.

## Features

### 🗺️ Map Management
- Upload and manage multiple dungeon maps
- Switch between maps seamlessly
- Edit map names and descriptions
- View map thumbnails

### 🎯 Interactive Canvas
- **Zoom & Pan**: Mouse wheel to zoom, Shift+Click or middle mouse button to pan
- **Element Placement**: Click to place annotations and tokens on your map
- **Drag & Drop**: Select and drag elements to reposition them
- **Selection**: Click elements to select and edit their properties

### 🛠️ Tools

#### Pointer Tool (Default)
- Select and drag elements
- **CTRL + Click**: Quick annotation placement

#### Marker Tool
- Place annotation circles on the map
- Customizable colors and icons
- Perfect for marking important locations

#### Token Tool
- Place character/creature tokens from your library
- Click a token in the library to activate

### 🎨 Customization

#### Annotations
- **Colors**: Red, Blue, Yellow, Green, Purple, Orange
- **Icons**: Circle, Square, Triangle, Star, Skull, Exclamation, Custom
- **Size**: Adjustable via slider (20-150px)
- **Notes**: Add detailed notes to each annotation

#### Tokens
- Upload custom token images
- Editable names
- Adjustable size (20-150px)
- Add notes for each token

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account (for authentication)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/gNatix/DMP.git
cd DMP
```

2. Install dependencies:
```bash
npm install
```

3. **Setup Environment Variables:**

   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Then add your Supabase credentials to `.env`:
   ```env
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   **Get your Supabase credentials:**
   - Go to [supabase.com](https://supabase.com)
   - Create a project (or use existing)
   - Go to Settings → API
   - Copy `Project URL` and `anon public` key

4. **Setup Supabase Database:**

   Run the SQL from `documentation/` in your Supabase SQL Editor to create:
   - `profiles` table
   - `scenes` table
   - Row Level Security policies
   - Auto-profile creation trigger

5. Start the development server:
```bash
npm run dev
```

6. Open your browser to http://localhost:5173

### Production Deployment

**Environment Variables in Hosting:**

- **Netlify**: Settings → Environment Variables
- **Vercel**: Project Settings → Environment Variables
- **GitHub Pages**: Repository → Settings → Secrets → Actions

Add these variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Build command:**
```bash
npm run build
```

**Output directory:** `dist/`

### Quick Start Guide

1. **Upload a Map**
   - Click the "Maps" tab in the right panel
   - Click "Upload Map"
   - Select your dungeon map image

2. **Place Annotations**
   - Select the Marker tool from the left toolbar
   - Choose a color and icon
   - Click on the map to place annotations
   - Or use CTRL+Click with the Pointer tool for quick placement

3. **Add Tokens**
   - Click the "Tokens" tab in the right panel
   - Upload token images
   - Click a token to activate the Token tool
   - Click on the map to place the token

4. **Edit Elements**
   - Click any element to select it
   - Edit properties in the "Properties" tab
   - Drag elements to reposition them
   - Delete elements using the trash icon

## Keyboard Shortcuts

- **CTRL + Click**: Quick annotation placement (while using Pointer tool)
- **Shift + Click**: Pan the canvas
- **Mouse Wheel**: Zoom in/out
- **Middle Mouse Button**: Pan the canvas

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx          # Main canvas with zoom, pan, and element rendering
│   ├── Toolbar.tsx         # Left toolbar with tools and options
│   ├── RightPanel.tsx      # Right panel with tabs
│   ├── PropertiesTab.tsx   # Element and map properties editor
│   ├── UploadsTab.tsx      # Map upload and management
│   └── TokensTab.tsx       # Token library management
├── types.ts                # TypeScript type definitions
├── App.tsx                 # Main application component
├── main.tsx               # Application entry point
└── index.css              # Global styles
```

## Tips & Tricks

- **Quick Annotations**: Use CTRL+Click with the Pointer tool to quickly drop annotations without switching tools
- **Organize Tokens**: Name your tokens descriptively for easy identification
- **Map Notes**: Use the description field to add session notes or map details
- **Element Notes**: Each annotation and token can have its own notes for tracking information
- **Zoom Navigation**: Use the zoom controls or mouse wheel for precise element placement

## Future Enhancements

- Backend integration for persistent storage
- Fog of war functionality
- Grid overlay system
- Measurement tools
- Layer management
- Multiplayer collaboration
- Export/import functionality

## License

MIT License - Feel free to use and modify for your tabletop gaming sessions!

---

Happy Dungeon Mastering! 🎲
