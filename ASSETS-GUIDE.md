# DM Planner - Assets Management Guide

## Oversigt

DM Planner bruger et separat GitHub repository til at hoste alle maps og tokens. Dette gør det nemt at administrere billeder uden at påvirke hovedprojektets kode.

## Repository Setup

- **Hovedprojekt**: `DM planner` (din lokale mappe med koden)
- **Assets Repository**: `dm-planner-assets` (separat Git repository på GitHub)
  - GitHub URL: https://github.com/gNatix/dm-planner-assets
  - Lokal mappe: `d:\IT projekter\DM planner\assets\`

## Mappestruktur

```
assets/
├── maps/
│   ├── dungeons/       # Dungeon maps
│   ├── indoors/        # Indoor maps (houses, shops, etc.)
│   ├── outdoors/       # Outdoor maps (forests, roads, etc.)
│   ├── taverns/        # Tavern maps
│   └── other/          # Other maps
└── tokens/
    ├── monsters/       # Monster tokens
    ├── npcs/           # NPC tokens
    ├── items/          # Item tokens (weapons, jewelry, etc.)
    ├── objects/        # Object tokens (furniture, environment, etc.)
    └── other/          # Other tokens (effects, markers, etc.)
```

## Hvordan Systemet Virker

1. **Automatisk scanning**: Når brugere åbner DM Planner, scanner appen automatisk GitHub repositoriet for billeder
2. **Ingen JSON redigering**: Billedfilnavne bliver automatisk til navne i appen
3. **Real-time opdatering**: Når nye billeder uploades til GitHub, vises de automatisk når brugere refresher

### Filnavn → Display Navn

- `goblin-warrior.png` → "goblin warrior"
- `dark-dungeon.jpg` → "dark dungeon"
- `Tavern-Interior.jpg` → "Tavern Interior"

## Tilføj Nye Billeder

### Metode 1: Via GitHub Website (Nemmest for non-tech brugere)

1. Gå til https://github.com/gNatix/dm-planner-assets
2. Naviger til den rigtige mappe (f.eks. `maps/dungeons/`)
3. Klik **"Add file"** → **"Upload files"**
4. Drag & drop dine billeder
5. Skriv en commit besked (f.eks. "Added 3 new dungeon maps")
6. Klik **"Commit changes"**
7. ✅ Færdig! Billederne vises i appen ved næste refresh

### Metode 2: Via Lokal Git (For udviklere)

1. Læg billeder i den rigtige mappe lokalt:
   ```
   d:\IT projekter\DM planner\assets\maps\dungeons\dark-cave.jpg
   ```

2. Åbn terminal i assets mappen:
   ```powershell
   cd "d:\IT projekter\DM planner\assets"
   ```

3. Commit og push:
   ```powershell
   git add .
   git commit -m "Added new dungeon map: dark cave"
   git push
   ```

4. ✅ Færdig! Billederne vises i appen ved næste refresh

## Understøttede Filformater

- JPG/JPEG
- PNG
- WebP
- GIF

## Vigtige Detaljer

### Assets er IKKE en del af hovedprojektet

`assets/` mappen er ekskluderet fra hovedprojektets Git via `.gitignore`:
```
# Assets (managed in separate repository)
/assets
```

Dette betyder:
- ✅ Du kan arbejde på koden uden at bekymre dig om billeder
- ✅ Billeder kan opdateres uafhængigt af koden
- ✅ To separate Git repositories = lettere at administrere

### Konfiguration

Appens konfiguration findes i `public/config.json`:
```json
{
  "githubUser": "gNatix",
  "assetsRepo": "dm-planner-assets",
  "branch": "main"
}
```

Hvis du ændrer repository navn eller bruger, skal denne fil opdateres.

## Test Setup

For at teste at alt virker:

1. Upload et test-billede til GitHub (f.eks. `maps/other/test-map.jpg`)
2. Åbn DM Planner appen
3. Gå til Maps tab → Stock Maps → Other Maps
4. Udvid sektionen
5. Du skulle se "test map" i listen

## Fejlfinding

**Billeder vises ikke:**
- Tjek at repository er public på GitHub
- Tjek at billederne er i de rigtige mapper
- Tjek console for fejlmeddelelser (F12 i browser)
- Prøv hard refresh (Ctrl+F5)

**GitHub API rate limit:**
- GitHub API har en grænse på 60 requests/time uden autentificering
- For normal brug er dette rigeligt
- Ved problemer, vent 1 time eller tilføj GitHub authentication

## For Den Non-Tech Hjælper

Instruktion til personen der skal uploade billeder:

2. Find den rigtige mappe baseret på hvad du uploader:
   - Monster billeder → `tokens/monsters/`
   - NPC billeder → `tokens/npcs/`
   - Item billeder → `tokens/items/`
   - Object billeder → `tokens/objects/`
   - Dungeon maps → `maps/dungeons/`
   - Indoor maps → `maps/indoors/`
   - Outdoor maps → `maps/outdoors/`
   - Tavern maps → `maps/taverns/`
   - Andre maps/tokens → `maps/other/` eller `tokens/other/`ors/`
   - Andre maps → `maps/other/`
3. Klik "Add file" → "Upload files"
4. Drag billeder ind
5. Klik "Commit changes"
6. Færdig! 🎉

**Tips:**
- Giv billederne beskrivende navne (de bliver vist i appen)
- Brug bindestreg (-) i stedet for mellemrum
- Eksempel: `fire-dragon.png` bliver til "fire dragon"
