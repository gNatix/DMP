# FTP Upload Guide til DM Planner Assets

## For Udviklere (PowerShell Script)

### Opsætning

1. **Opret FTP-konto i hPanel:**
   - Log ind på Hostinger hPanel
   - Gå til "FTP Accounts"
   - Klik "Create FTP Account"
   - **Directory**: `/domains/natixlabs.com/public_html/assets`
   - **Username**: Vælg et brugernavn (f.eks. `dmp-assets`)
   - **Password**: Vælg en stærk adgangskode
   - Gem oplysningerne!

2. **Opdater FTP credentials:**
   - Åbn `assets\deploy-to-ftp.ps1`
   - Erstat `YOUR_FTP_USERNAME` med dit FTP brugernavn
   - Erstat `YOUR_FTP_PASSWORD` med din FTP adgangskode
   - Gem filen

3. **Upload alle assets:**
   ```powershell
   cd "d:\IT projekter\DM planner\assets"
   .\deploy-to-ftp.ps1
   ```

4. **Upload PHP fil til serveren:**
   - Brug FTP klient (se nedenfor) til at uploade `server\list-files.php` til `/domains/natixlabs.com/public_html/`

### Automatisk Upload

Hver gang du tilføjer nye billeder:
```powershell
cd "d:\IT projekter\DM planner\assets"
.\deploy-to-ftp.ps1
```

---

## For Non-Tech Brugere (FileZilla)

### Første Gang Opsætning

#### Trin 1: Download FileZilla
1. Gå til https://filezilla-project.org/download.php?type=client
2. Download "FileZilla Client" (gratis)
3. Installer programmet

#### Trin 2: Få FTP Oplysninger fra Stefan
Du skal bruge følgende oplysninger:
- **Host/Server**: `ftp.natixlabs.com`
- **Brugernavn**: `u647298325.dmpAdmin`
- **Adgangskode**: `DMP-admin1`
- **Port**: `21`

#### Trin 3: Forbind til Serveren
1. Åbn FileZilla
2. I toppen af vinduet, indtast:
   - **Host**: `ftp.natixlabs.com`
   - **Username**: `u647298325.dmpAdmin`
   - **Password**: `DMP-admin1`
   - **Port**: `21`
3. Klik "Quickconnect"
4. Du skulle nu se serveren i højre side af vinduet

#### Trin 4: Naviger til Assets Mappen
1. I højre side (server), find og dobbeltklik på:
   - `domains` → `natixlabs.com` → `public_html` → `assets`
2. Du skulle nu se mapperne: `maps/` og `tokens/`

### Upload Nye Billeder

#### For Maps (Kort):
1. **Venstre side**: Find dit billede på din computer
2. **Højre side**: Dobbeltklik på `assets` → `maps` → vælg kategori:
   - `dungeons/` - Dungeon kort
   - `indoors/` - Indendørs kort
   - `outdoors/` - Udendørs kort
   - `taverns/` - Kro/taverne kort
   - `other/` - Andre kort
3. **Træk billedet** fra venstre til højre side
4. ✅ Færdig! Billedet vises automatisk i appen ved næste refresh

#### For Tokens (Spillebrikker):
1. **Venstre side**: Find dit billede på din computer
2. **Højre side**: Dobbeltklik på `assets` → `tokens` → vælg kategori:
   - `monsters/` - Monstre
   - `npcs/` - NPCs/personer
   - `items/` - Genstande (våben, smykker, etc.)
   - `objects/` - Objekter (møbler, miljø, etc.)
   - `other/` - Andre tokens
3. **Træk billedet** fra venstre til højre side
4. ✅ Færdig! Token'et vises automatisk i appen ved næste refresh

### Tips til Filnavne

**Gode filnavne:**
- `dark-dungeon.jpg` → vises som "dark dungeon"
- `elven-warrior.png` → vises som "elven warrior"
- `magic-sword.jpg` → vises som "magic sword"

**Undgå:**
- Mellemrum i filnavne
- Danske tegn (æ, ø, å)
- Specialtegn (!@#$%^&*)

**Brug i stedet:**
- Bindestreg (`-`) mellem ord
- Kun engelske bogstaver (a-z)
- Tal (0-9)

### Fejlfinding

**"Connection timed out":**
- Tjek at din internetforbindelse virker
- Prøv at slå firewall/antivirus fra midlertidigt

**"Login incorrect":**
- Tjek at brugernavn og adgangskode er korrekte
- Spørg Stefan om nye FTP oplysninger

**Billedet vises ikke i appen:**
- Vent 1-2 minutter efter upload
- Refresh browseren (Ctrl + F5)
- Tjek at billedet er i den rigtige mappe
- Tjek at filnavnet ikke har mellemrum

---

## Server Struktur

```
dmp.natixlabs.com/
├── assets/
│   ├── maps/
│   │   ├── dungeons/
│   │   ├── indoors/
│   │   ├── outdoors/
│   │   ├── taverns/
│   │   └── other/
│   └── tokens/
│       ├── monsters/
│       ├── npcs/
│       ├── items/
│       ├── objects/
│       └── other/
└── list-files.php
```

## Tekniske Detaljer

### FTP Indstillinger (Hostinger)
- **Host**: `ftp.natixlabs.com`
- **Username**: `u647298325.dmpAdmin`
- **Password**: `DMP-admin1`
- **Port**: `21` (Standard FTP)
- **Protokol**: FTP (ikke SFTP eller FTPS)
- **Adgangssti**: `/domains/natixlabs.com/public_html/assets`

### PHP API
- **Endpoint**: `https://dmp.natixlabs.com/list-files.php?path=maps/dungeons`
- **Returnerer**: JSON array med filer og download URLs
- **CORS**: Enabled for alle origins (development)

### Sikkerhed
- Directory traversal beskyttelse (`..` fjernes fra paths)
- Kun image filer vises (.jpg, .jpeg, .png, .gif, .webp)
- CORS headers for API adgang

### For Produktion
Når appen går i produktion, opdater:
1. CORS headers i `list-files.php` til kun at tillade din domain
2. Tilføj `.htaccess` beskyttelse hvis assets skal være private
3. Overvej CDN (Cloudflare) for bedre performance
