# Door/Wall System - Begrebsafklaring

## Rum & Positioner

| Begreb | Definition |
|--------|------------|
| **ModularRoomElement** | Et rum med x, y position (pixels) og tilesW, tilesH størrelse |
| **Tile** | 128×128 pixels grundenhed |
| **Pixel position** | Præcis position i pixels (room.x, room.y) |

## Wall Segments

| Begreb | Definition |
|--------|------------|
| **WallSegmentGroup** | En 256px vægsektion med unikt `id`, `position`, `rangeStart`, `rangeEnd`, `orientation` |
| **WallGroup** | Gruppe af rum der deler samme væg-STIL (texture). Bruges til rendering. |
| **Segment** | = WallSegmentGroup. En 256px stykke væg. |

## Door States

| Begreb | Definition |
|--------|------------|
| **SegmentState** | `{ pattern, source }` - tilstanden for ét segment |
| **SegmentPattern** | `SOLID_256`, `DOOR_LEFT`, `DOOR_RIGHT`, `DOOR_BOTH`, `DOOR_CENTER` |
| **source** | `'manual'` (bruger klikkede) eller `'auto'` (system genereret) |
| **SegmentStatesMap** | `{ [wallSegmentGroupId]: SegmentState }` - alle door states |

## Positioner i et Segment (256px)

| Begreb | Pixels | Beskrivelse |
|--------|--------|-------------|
| **Venstre halvdel** | 0-128px | Klik her → toggle venstre dør |
| **Højre halvdel** | 128-256px | Klik her → toggle højre dør |
| **DOOR_LEFT** | 0-128px åbning | Dør i venstre halvdel |
| **DOOR_RIGHT** | 128-256px åbning | Dør i højre halvdel |
| **DOOR_BOTH** | 0-256px åbning | Hele segmentet er åbent |

## Edges

| Begreb | Definition |
|--------|------------|
| **Internal edge** | Væg mellem to rum (shared wall) |
| **External edge** | Væg på ydersiden af et rum |
| **SharedEdge** | Info om hvor to rum mødes: orientation, position, rangeStart, rangeEnd |

## Orientering

| Begreb | Beskrivelse |
|--------|-------------|
| **horizontal** | Væg der løber vandret (top/bund af rum) |
| **vertical** | Væg der løber lodret (venstre/højre side af rum) |

---

## Toggle Regler

Når brugeren klikker med Door Tool:

| Nuværende State | Klik Venstre | Klik Højre |
|-----------------|--------------|------------|
| SOLID_256 | → DOOR_LEFT | → DOOR_RIGHT |
| DOOR_LEFT | → SOLID_256 | → DOOR_BOTH |
| DOOR_RIGHT | → DOOR_BOTH | → SOLID_256 |
| DOOR_BOTH | → DOOR_RIGHT | → DOOR_LEFT |

---

## Kort Opsummering

- **Segment** = 256px væg-stykke med unikt ID
- **State** = SOLID eller DOOR_LEFT/RIGHT/BOTH
- **Klik venstre halvdel** → toggle venstre dør
- **Klik højre halvdel** → toggle højre dør

## Nøglefiler

- `src/types.ts` - Type definitioner (SegmentState, SegmentPattern, etc.)
- `src/utils/modularRooms.ts` - Door system logik
- `src/components/Canvas.tsx` - Door tool click handling
- `src/components/canvas/ModularRoomRenderer.tsx` - Door rendering
