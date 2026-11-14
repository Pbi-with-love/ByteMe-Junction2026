# Design Handoff — 010: Game World (PixiJS Pixel Kitchen, Robot, Overlay Kit)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/010-game-world.md` only. Supersedes `docs/design/002`–`008` for visuals; reuses `002` copy, state lists, and accessibility rules.  
> **Domain framing:** Interactive simulation platform for trusted autonomous purchasing (*Valio Aimo Trust Gateway*). Never frame as a restaurant management game.

---

## 1. Design Decisions & Rationale

1. **Valio-Inspired Clean Cold-Room Pixel Aesthetic:**  
   The kitchen reads like a modern Nordic commercial dairy/hotel prep room—bright tiled floors (`#EEF4FA` / `#F8FAFC`), brushed stainless steel counters (`#CBD5E1` / `#94A3B8`), Valio-inspired brand blues (`#0052B4` / `#003E8A` / `#60A5FA`), and a warm oak Manager Desk (`#D49B6A` / `#9C663B`) that anchors the human-authority zone. Every actor and station has a 1 px deep navy outline (`#0B1B33`) so silhouettes pop from 3–5 m on a projector.
2. **Strict Policy Light Isolation:**  
   The four policy light colours (`GREEN`, `BLUE`, `YELLOW`, `RED`) are **one shared set** across Pixi and CSS (`palette.ts` ↔ `index.css`) and are reserved exclusively for policy outcomes (robot emotes, badges, future log lights). Application/network errors use distinct rose-burgundy (`#881337` on `#FDF2F5`) with a warning triangle icon so they are never confused with policy `RED`.
3. **320×180 Integer-Scaled Canvas + Crisp HTML Overlays:**  
   Rendering PixiJS at `320×180` (`resolution: 1`, `TextureStyle.defaultOptions.scaleMode = 'nearest'`) and sizing the `<canvas>` CSS box to `320k × 180k` (`k = 6` → `1920×1080`, `k = 4` → `1280×720` centred inside `1366×768`) with `image-rendering: pixelated` guarantees razor-sharp pixels. All text, panels, speech bubbles, and hotspots live in the HTML overlay layer so typography stays legible and accessible at any zoom.
4. **Own Pixel Art (Zero External Sprite Dependencies):**  
   All tiles, 5 stations, 11 robot frames, 4 shape-distinct emote icons, and the carry box are provided below as verified palette-indexed character grids. Only the two self-hosted OFL fonts (`Pixelify Sans`, `Press Start 2P`) are external assets.

---

## 2. Pixel Palette (24 Colours)

Export the 4 light colours in `src/world/palette.ts` and mirror all colours in `src/index.css` `@theme`. `.` represents transparent in sprite grids.

| Key | Name | Hex | Role / Usage |
|---|---|---|---|
| `o` | Deep Navy Ink / Outline | `#0B1B33` | 1 px actor & station outlines, primary UI ink (`17.23:1` on `#FFFFFF`) |
| `w` | Crisp Paper White | `#FFFFFF` | Panel paper, fridge doors, robot shell, counter speculars, CTA text |
| `f` | Floor Tile Light | `#EEF4FA` | Canvas background, primary kitchen floor tile |
| `p` | Floor Tile Alt / Subtle Paper | `#F8FAFC` | Checkerboard alternate floor tile, subtle highlights |
| `g` | Floor Grout / Subtle Surface | `#D6E3F0` | Floor tile grout, HUD subtle surface, disabled field bg |
| `b` | Valio Brand Blue | `#0052B4` | Primary buttons, focus ring, robot visor/accents, cold-room trim (`7.33:1` w/ `#FFFFFF`) |
| `d` | Deep Brand Blue | `#003E8A` | Button hover, wall top cap, delivery dock stripe |
| `s` | Cold Sky / Cyan Glow | `#60A5FA` | Robot eyes/antenna glow, terminal scanlines, station hover highlight |
| `t` | Terminal / Wall Mid Blue | `#1E3A5F` | Wall face, terminal panel frame, phone handset |
| `c` | Steel Light | `#CBD5E1` | Stainless counter top, fridge trim, delivery frame |
| `m` | Steel Mid | `#94A3B8` | Counter front apron, clipboard metal clip, hairline borders |
| `k` | Steel Dark / Muted Ink | `#475569` | Counter base shadow, secondary UI ink (`7.5:1` on `#FFFFFF`) |
| `u` | Warm Wood Light | `#D49B6A` | Manager Desk top, clipboard board, carry box top |
| `n` | Warm Wood Dark | `#9C663B` | Manager Desk front, clipboard edge, carry box shadow |
| `G` | **Policy Light GREEN** | `#15803D` | Reserved: `GREEN` outcome, `calm` emote (`4.57:1` on `#DCFCE7`) |
| `1` | Policy GREEN BG | `#DCFCE7` | Reserved: `GREEN` badge/chip background |
| `B` | **Policy Light BLUE** | `#0369A1` | Reserved: `BLUE` outcome, `info` emote (`5.17:1` on `#E0F2FE`) |
| `2` | Policy BLUE BG | `#E0F2FE` | Reserved: `BLUE` badge/chip background |
| `Y` | **Policy Light YELLOW** | `#A16207` | Reserved: `YELLOW` outcome, `puzzled` emote (`4.58:1` on `#FEF9C3`) |
| `3` | Policy YELLOW BG | `#FEF9C3` | Reserved: `YELLOW` badge/chip background |
| `R` | **Policy Light RED** | `#B91C1C` | Reserved: `RED` outcome, `stop` emote (`5.30:1` on `#FEE2E2`) |
| `4` | Policy RED BG | `#FEE2E2` | Reserved: `RED` badge/chip background |
| `e` | Alert Rose Ink | `#881337` | System/gateway error text & border (`8.74:1` on `#FDF2F5`; never policy `RED`) |
| `a` | Alert Rose BG | `#FDF2F5` | System/gateway error panel background |

---

## 3. Canvas & 20×11 Kitchen Map

- **Logical canvas:** `320 × 180` px (`TILE = 16`).
- **Map dimensions:** `MAP_COLS = 20`, `MAP_ROWS = 11` (`320 × 176` px) drawn at `MAP_ORIGIN = { x: 0, y: 2 }` (leaving a 2 px top/bottom margin in `#0B1B33` / `#EEF4FA`).
- **Scale helper:** `fitScale(viewW, viewH) = Math.max(1, Math.floor(Math.min(viewW / 320, viewH / 180)))`.
  - `1920×1080` → `k = 6` (`1920×1080` canvas CSS box, zero letterbox).
  - `1366×768` → `k = 4` (`1280×720` canvas CSS box, centred with `43px` left/right and `24px` top/bottom `#0B1B33` letterbox).

### Map Rows
Legend: `#` wall (blocked), `.` floor (walkable, checkerboard `floor_a` when `(x+y)%2===0` else `floor_b`), `C` counter (blocked), `S` storage (3×2), `T` terminal (3×1), `P` phone (2×1), `D` delivery (1×2), `M` desk (3×2).

```text
####################   y0
#SSS....TTT....PP..#   y1
#SSS...............#   y2
#..................#   y3
#....CC......CC....#   y4
#....CC......CC....D   y5
#..................D   y6
#..................#   y7
#MMM...............#   y8
#MMM...............#   y9
####################   y10
```

### Station Coordinates & Access Tiles
| StationId | Label | Tiles `{x, y, w, h}` | Logical Rect `{x, y, w, h}` (incl. `MAP_ORIGIN`) | Access Tile `{x, y}` |
|---|---|---|---|---|
| `storage` | `"Storage"` | `{1, 1, 3, 2}` | `{16, 18, 48, 32}` | `{4, 2}` |
| `terminal` | `"Order Terminal"` | `{8, 1, 3, 1}` | `{128, 18, 48, 16}` | `{9, 2}` |
| `phone` | `"Phone Station"` | `{15, 1, 2, 1}` | `{240, 18, 32, 16}` | `{15, 2}` |
| `delivery` | `"Delivery Entrance"` | `{19, 5, 1, 2}` | `{304, 82, 16, 32}` | `{18, 5}` |
| `desk` | `"Manager Desk"` | `{1, 8, 3, 2}` | `{16, 130, 48, 32}` | `{4, 8}` |

- **`ROBOT_START`:** `{ x: 9, y: 2 }` (`STATIONS.terminal.access`).
- **Desk ↔ Terminal distance:** 11+ tiles around the left counter island (`(5,4)–(6,5)`), so the walk visibly reads on screen (~1.5 s at `8 tiles/s`).

---

## 4. Pixel Art Grids (`src/world/art.ts`)

Every row in a grid has identical length; `.` = transparent; all other characters map to Section 2 palette keys.

### 4.1 Environment Tiles (16×16)

**`floor_a` (16×16)**
```text
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
fffffffffffffffg
gggggggggggggggg
```

**`floor_b` (16×16)**
```text
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
pppppppppppppppg
gggggggggggggggg
```

**`wall` (16×16)**
```text
oooooooooooooooo
oddddddddddddddo
oddddddddddddddo
obbbbbbbbbbbbbbo
otttttttttttttto
ottttttgttttttto
otttttttttttttto
otttttttttttttto
otttttttttttttto
otttttttttttttto
otttttttttttttto
oddddddddddddddo
occcccccccccccco
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
oooooooooooooooo
```

**`counter` (16×16)**
```text
oooooooooooooooo
owwwwwwwwwwwwwwo
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
occcccccccccccco
ommmmmmmmmmmmmmo
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
oooooooooooooooo
```

### 4.2 Stations

**`storage` — Cold-Room Double-Door Refrigerator (48×32)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
oddddddddddddddddddddddddddddddddddddddddddddddo
oddddddddddddddddddddddddddddddddddddddddddddddo
obbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbo
obbbbbbbbbbbbbbbbbbossossossobbbbbbbbbbbbbbbbbbo
obbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbo
oooooooooooooooooooooooooooooooooooooooooooooooo
occccccccccccccccccccccoocccccccccccccccccccccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
occccccccccccccccccccccoocccccccccccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooooooooooooooooooo
```

**`terminal` — Order Terminal (48×16)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccttttttttttttttttttttccccccccccccco
occccccccccccctbbbbbbbbbbbbbbbbbbtccccccccccccco
occccccccccccctbssssssssssbbwwwwbtccccccccccccco
occccccccccccctbbbbbbbbbbbbbbbbbbtccccccccccccco
occctttttttccctbwwwwwwwwwwwwwwbbbtcccdddddddccco
occcwwwwwwwccctbbbbbbbbbbbbbbbbbbtcccsssssssccco
occctttttttccctbsssssssbbbbbbbbbbtcccdddddddccco
occccccccccccctbbbbbbbbbbbbbbbbbbtccccccccccccco
occcccccccccccttttttttttttttttttttccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooooooooooooooooooo
```

**`phone` — Phone Station (32×16)**
```text
oooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccccccccccccccccccco
occccccccttbbbbbbbbbbttcccccccco
occccccccttttttttttttttcccccccco
occcccccccbbbbbbbbbbbbccccccccco
occcccccccbbssssssssbbccccccccco
occcccccccbbbbbbbbbbbbccccccccco
occcccccccbbwbwbwbwbsbccccccccco
occcccccccbbbbbbbbbbbbccccccccco
occcccccccccccccccccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

**`delivery` — Delivery Entrance (16×32)**
```text
oooooooooooooooo
oooooooooooooooo
occcccccccccccco
occcccccccccccco
ommmmmmmmmmmmmmo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbwdbbbbddo
obbbbwwddbbbbddo
obbwwbbddbbbbddo
obbwwwwwwwwbbddo
obbwwwwwwwwbbddo
obbwwbbddbbbbddo
obbbbwwddbbbbddo
obbbbbbwdbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
obbbbbbddbbbbddo
ommmmmmmmmmmmmmo
occcccccccccccco
occcccccccccccco
oooooooooooooooo
oooooooooooooooo
```

**`desk` — Manager Desk with Clipboard & Stamp Pad (48×32)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuunnnnmmmmmmnnnnuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuoooooooouuuuuuuuuo
ouuuuunwwkkkkkkkkwwnuuuuuuuuuuobbbbbbouuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuobssssbouuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuobssssbouuuuuuuuuo
ouuuuunwwkkkkkkkkwwnuuuuuuuuuuobssssbouuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuobbbbbbouuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuoooooooouuuuuuuuuo
ouuuuunwwkkkkkkkkwwnuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuoooouuuo
ouuuuunwwwwwwbbbbwwnuuuuuuuuuuuuuuuuuuuuowwouuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuowwouuuo
ouuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuowwouuuo
ouuuuunnnnnnnnnnnnnnuuuuuuuuuuuuuuuuuuuuoooouuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooooooooooooooooooo
```

### 4.3 Robot Sprites (16×16)

Robot chassis uses only neutral Valio blue/white/steel (`o, w, b, s, c`) so policy colours never leak into neutral states. Policy colours appear exclusively in the 4 emote icons above the head.

**`idle` (2 frames)**

`idle_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbsswbbwssbwo.
.owbsswbbwssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
.owwwbbbbbbwwwo.
.ow.owwwwwwo.wo.
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

`idle_1`:
```text
.......oo.......
......obbo......
.......oo.......
................
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbsswbbwssbwo.
.owbsswbbwssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
.owwwbbbbbbwwwo.
.ow.owwwwwwo.wo.
....obb..bbo....
....ooo..ooo....
```

**`walk` (4 frames, facing right; mirror horizontally for left)**

`walk_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbbsswbbssbwo.
.owbbsswbbssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
..owwbbbbbbwwo..
..owowwwwwwo.o..
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_1`:
```text
................
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbbsswbbssbwo.
.owbbsswbbssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
.owwwbbbbbbwwo..
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

`walk_2`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbbsswbbssbwo.
.owbbsswbbssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
..owwbbbbbbwwo..
..o.owwwwwwooo..
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_3`:
```text
................
.......oo.......
......obbo......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbbsswbbssbwo.
.owbbsswbbssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
..owwbbbbbbwwwo.
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

**`work` (2 frames, arms forward at station)**

`work_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbwwwbbwwwbwo.
.owbsswbbwssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
.oooccccccccooo.
oww.wbbbbbbw.wwo
oo..owwwwwwo..oo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

`work_1`:
```text
.......oo.......
......obbo......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbsswbbwssbwo.
.owbwwwbbwwwbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
oow.wbbbbbbw.woo
ow..owwwwwwo..wo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

**`wait` (2 frames, looking aside / tapping foot)**

`wait_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbssbbbwssbwo.
.owbssbbbwssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
.owwwbbbbbbwwwo.
.ow.owwwwwwo.wo.
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

`wait_1`:
```text
.......oo.......
......ocbo......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbbsswbbssbwo.
.owbbsswbbssbwo.
.owwbbbbbbbbwwo.
..owwwwwwwwwwo..
..ooccccccccoo..
.owwwbbbbbbwwwo.
.ow.owwwwwwo.wo.
....ooccccoo....
....obb...bbo...
....ooo...ooo...
```

**`blocked` (1 frame, raised palm / halt)**

`blocked_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwwwwwwwwo..
.owwbbbbbbbbwwo.
.owbswwbbwwsbwo.
.owbwwsbbwswwwo.
.owwbbbbbbbbwwo.
.ooowwwwwwwwooo.
owwooccccccccooo
oww.wbbbbbbwwwo.
oo..owwwwwwo.wo.
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

### 4.4 Carry Box & Emote Icons (8×8)

**`box` (8×8, drawn at robot centre-front `(x + 4, y + 6)` when `carry === true`)**
```text
oooooooo
ouuuuuuo
ouuwwuuo
ouuuuuuo
onnnnnno
onwwnnno
onnnnnno
oooooooo
```

**Emote Icons (8×8, drawn above robot head at `(x + 4, y - 10)`):**
Each emote is distinct by **silhouette/shape** as well as colour:

- **`calm` (GREEN `G`, rounded badge + checkmark ✓):**
```text
.oooooo.
oGGGGGGo
oGGGGwGo
oGGGwGGo
oGwGwGGo
oGGwGGGo
oGGGGGGo
.oooooo.
```

- **`info` (BLUE `B`, square-rounded badge + `"i"`):**
```text
.oooooo.
oBBwBBBo
oBBBBBBo
oBBwBBBo
oBBwBBBo
oBBwBBBo
oBBBBBBo
.oooooo.
```

- **`puzzled` (YELLOW `Y` / `3`, warning triangle + `"?"`):**
```text
...oo...
..oYYo..
..o33o..
.o3oo3o.
.o33o3o.
o333333o
o333o33o
oooooooo
```

- **`stop` (RED `R`, octagon stop sign + `"X"`):**
```text
..oooo..
.oRRRRo.
oRwRRwRo
oRRwwRRo
oRRwwRRo
oRwRRwRo
.oRRRRo.
..oooo..
```

---

## 5. Motion, Highlights & Particle Bursts

- **Walk speed:** `WALK_TILES_PER_SEC = 8` (`128` logical px/s). Robot position snaps to `Math.round(x)`, `Math.round(y)` each ticker frame so pixels never half-step.
- **Animation frame rates:**
  - `idle`: `2 fps` (alternates `idle_0` / `idle_1` every `500 ms`; subtle 1 px antenna/head breathe baked into `idle_1`, no whole-sprite jitter).
  - `walk`: `8 fps` (cycles `walk_0..3` every `125 ms`; horizontal scale `-1` when `dx < 0`).
  - `work`: `4 fps` (`250 ms` per frame).
  - `wait`: `2 fps` (`500 ms` per frame).
  - `blocked`: static single frame (`blocked_0`).
- **Station highlight (`pixiWorld.highlight(id)`):**  
  When a station hotspot is hovered or keyboard-focused, draw a `1` logical px (`#60A5FA` outer / `#FFFFFF` inner) dashed/solid pixel border around `stationRect(id)` in Pixi. Disabled hotspots still show the DOM focus ring on keyboard focus, but Pixi highlight is dimmed (`alpha: 0.45`).
- **Particle bursts (`controller.burst(kind)`):**  
  Square `2×2` logical px particles (no alpha fade, crisp step-shrink to `1×1` at 50% lifetime):
  - `stamp` (anchored at `desk` top-right): **10 particles**, colours `['#0052B4', '#60A5FA', '#FFFFFF']`, radial upward arc, lifetime **`600 ms`**.
  - `delivered` (anchored at `delivery` centre): **12 particles**, colours `['#15803D', '#60A5FA', '#FFFFFF', '#D49B6A']`, celebratory fountain burst, lifetime **`750 ms`**.
- **Reduced motion (`prefers-reduced-motion: reduce`):**
  - `walkTo`: jumps immediately to destination access tile and emits arrival.
  - Animations: hold frame `0` (`idle_0`, `work_0`, `wait_0`, `blocked_0`).
  - Particles: skipped (`data-last-burst` attribute still updates).
  - Emotes, `carry` box, and HTML speech bubble still update normally.

---

## 6. Speech Bubble (HTML)

- **Element:** `<div role="status" className="speech-bubble">` inside the overlay layer, rendered only when `say(text)` is non-null.
- **Anchoring:** Positioned from `pixiWorld.onRobotMove({ x, y })` (logical px, top-centre of robot):
  - `left: calc(x * var(--px))`, `top: calc((y - 12) * var(--px))`, `transform: translate(-50%, -100%)`, clamped horizontally within the canvas (`8 * --px` margin) so it never clips off-screen at `storage` or `delivery`.
  - The `-12 * --px` vertical offset leaves room for the `8×8` emote icon (`y - 10` to `y - 2`) so **the bubble never covers the emote icon**.
- **Styling:** Crisp `#FFFFFF` background, `1 * --px` solid `#0B1B33` border, `2 * --px` hard drop-shadow (`#0B1B33`), downward pixel pointer tail (`border-top` triangle), `max-width: calc(140 * var(--px))`, `padding: calc(2 * var(--px)) calc(3 * var(--px))`.
- **Typography & clamping:** `Pixelify Sans`, `font-size: calc(4 * var(--px))` (`24px` at 1080p, `16px` at 768p), `line-height: 1.25`, `color: #0B1B33` (`17.23:1` contrast), `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;` (max 2 lines with ellipsis).

---

## 7. Typography & CSS Tokens (`src/index.css`)

Self-host both fonts under `frontend/public/fonts/` with their OFL licence files (no Google Fonts CDN):
- **Body / UI / Labels / Buttons / Chips:** `Pixelify Sans` (`PixelifySans-VariableFont_wght.ttf`, fallback `sans-serif`).
- **Titles Only (`<h1>`, `<h2>`, `"VALTAKIRJA"`):** `Press Start 2P` (`PressStart2P-Regular.ttf`, fallback `monospace`).
- **Minimum visible text size:** `calc(4 * var(--px))` (`24px` at 1080p, `16px` at 768p). No visible text may be smaller than `4 * --px`.

### Type Scale
| Role | Token / Size | At `1920×1080` (`--px: 6px`) | At `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| Game / Panel Title (`<h1>`) | `calc(6 * var(--px))` | `36px` | `24px` | `Press Start 2P` |
| Section / Card Heading (`<h2>`) | `calc(5 * var(--px))` | `30px` | `20px` | `Press Start 2P` |
| Body / Clauses / Controls / Bubble / HUD | `calc(4 * var(--px))` | `24px` | `16px` | `Pixelify Sans` |

### `@theme` & Pixel Tokens (`frontend/src/index.css`)
```css
@font-face {
  font-family: "Pixelify Sans";
  src: url("/fonts/PixelifySans-VariableFont_wght.ttf") format("truetype");
  font-weight: 400 700;
  font-display: swap;
}
@font-face {
  font-family: "Press Start 2P";
  src: url("/fonts/PressStart2P-Regular.ttf") format("truetype");
  font-weight: 400;
  font-display: swap;
}

@theme {
  --px: 4px;
  --color-canvas: #EEF4FA;
  --color-letterbox: #0B1B33;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #D6E3F0;
  --color-ink: #0B1B33;
  --color-ink-muted: #475569;
  --color-brand: #0052B4;
  --color-brand-hover: #003E8A;
  --color-brand-subtle: #E0F2FE;
  --color-sky: #60A5FA;
  --color-terminal-bg: #1E3A5F;
  --color-wood: #D49B6A;
  --color-wood-dark: #9C663B;
  --color-border: #94A3B8;
  --color-border-strong: #0B1B33;
  --color-stamp: #0052B4;
  --color-error-surface: #FDF2F5;
  --color-error-ink: #881337;
  --color-light-green: #15803D;
  --color-light-green-bg: #DCFCE7;
  --color-light-blue: #0369A1;
  --color-light-blue-bg: #E0F2FE;
  --color-light-yellow: #A16207;
  --color-light-yellow-bg: #FEF9C3;
  --color-light-red: #B91C1C;
  --color-light-red-bg: #FEE2E2;
  --font-sans: "Pixelify Sans", system-ui, sans-serif;
  --font-display: "Press Start 2P", monospace;
  --font-mono: "Pixelify Sans", ui-monospace, monospace;
  --text-title: calc(6 * var(--px));
  --text-heading: calc(5 * var(--px));
  --text-body: calc(4 * var(--px));
  --shadow-pixel: calc(1 * var(--px)) calc(1 * var(--px)) 0 #0B1B33;
  --shadow-focus: 0 0 0 calc(0.5 * var(--px)) #FFFFFF, 0 0 0 calc(1.25 * var(--px)) #0052B4;
}
```

---

## 8. PixelPanel Kit & Control States

### 8.1 `PixelPanel` Variants (`role="dialog" aria-modal="false"`, except `alert` → `role="alert"`)
All panels use sharp pixel corners (`border-radius: 0`), `calc(1 * var(--px)) solid #0B1B33` outer border, `var(--shadow-pixel)` drop shadow, and max-width `calc(200 * var(--px))` (`62.5%` of `320` logical px — strictly `≤ 0.65 × canvasWidth`: `1200px` at 1080p, `800px` at 768p) so the kitchen world remains visible around the panel.

1. **`clipboard` (Manager Desk — Brief + Valtakirja):**
   - Outer frame: `#D49B6A` wood-board border (`calc(2 * var(--px)) solid #9C663B`), top-centre pixel metal clip (`#CBD5E1` / `#94A3B8` / `#0B1B33` pseudo-element), inner `#FFFFFF` paper sheet.
   - Contains `002`'s `Brief` (`<h1>`/`<h2>`, customer pill, `level.brief`, 2-col schedule strip, `"Write the mandate"` button) → transitions in-place to `MandateScreen` (preset chips, `VALTAKIRJA` metadata, 4 inline bold controls, `"Sign mandate"` button, restyled pixel `Stamp` `#0052B4`).
2. **`terminal` (Order Terminal):**
   - Brand-blue terminal frame (`#1E3A5F` header bar with `#FFFFFF` title + `#60A5FA` status dot; `#FFFFFF` high-contrast body card inside so text stays `17.23:1`—no green-on-black terminal).
   - Displays `start.level.brief`, `start.level.customer.name`, `"Deliver by"` (`formatDateTime(start.level.deadline)`), and primary `"Send to agent"` button.
3. **`notice` (Run Finished / Info):**
   - `#FFFFFF` surface, `#0052B4` top accent bar (`calc(1.5 * var(--px))`), `"The agent is done."`, and `"Back to levels"` button.
4. **`alert` (System / Gateway Error):**
   - `role="alert"`, `#FDF2F5` background, `#881337` text and `calc(1 * var(--px))` border (`calc(2 * var(--px))` left accent), warning triangle SVG icon (`aria-hidden="true"`), error message, and `"Back to levels"` button.

### 8.2 Interactive Controls & States
- **Buttons (`primary`, `ghost`):** `min-height: calc(10 * var(--px))`, `padding: 0 calc(4 * var(--px))`, `border: calc(0.5 * var(--px)) solid #0B1B33`, `box-shadow: calc(0.75 * var(--px)) calc(0.75 * var(--px)) 0 #0B1B33`.
  - `primary`: `#0052B4` bg, `#FFFFFF` text; `hover`: `#003E8A`; `active`: translate `(0.5 * --px, 0.5 * --px)`, shadow reduced; `disabled`/`busy`: `opacity: 0.65`, `cursor: wait` / `not-allowed`.
  - `ghost`: `#FFFFFF` bg, `#0052B4` text; `hover`: `#E0F2FE`.
- **Preset Chips (`aria-pressed`):** `min-height: calc(9 * var(--px))`, `#FFFFFF` bg, `#0B1B33` text; `hover`: `#EEF4FA`; `aria-pressed="true"`: `#0052B4` bg, `#FFFFFF` text; `disabled`: `opacity: 0.55`.
- **Inline `<select>` & `<input type="checkbox">`:** Native controls styled with `#E0F2FE` tint, `calc(0.5 * var(--px)) solid #0052B4` bottom border, `font-weight: 700`.
- **Focus Ring (all interactive elements + station hotspots):** `outline: none; box-shadow: var(--shadow-focus);`.

---

## 9. Screens, Overlay Grid & Copy

### 9.1 Title / Level Select Screen
- Full-viewport `#EEF4FA` canvas-grid background with `#0B1B33` pixel border card container (`max-width: 1040px`, centred).
- Header: `<h1>Agent Kitchen</h1>` (`Press Start 2P`), tagline `"Agents don’t need a chatbot. They need a mandate."`, discovery provider badge (`provider`).
- Level list: 3 `<article>` cards (`#FFFFFF`, `2px solid #0B1B33`, pixel shadow), each with `<h2>{level.title}</h2>` and primary `"Start level"` button.
- Loading / error states: `"Connecting…"`, `"Loading level…"`, or `role="alert"` banner with `"Back to levels"`.

### 9.2 Kitchen Overlay Grid (`GameWorld`)
The overlay `div` matches the `320k × 180k` canvas box (`position: absolute; inset: 0; pointer-events: none`), using CSS Grid:
```css
grid-template-areas:
  "hud hud"
  "center side";
grid-template-rows: calc(14 * var(--px)) 1fr;
grid-template-columns: 1fr calc(96 * var(--px)); /* side = 30% of 320 */
```
- **`hud` (top strip, `14 * --px` = `84px` at 1080p, `56px` at 768p):**  
  Translucent/crisp `#FFFFFF` bar with `#0B1B33` bottom border (`pointer-events: auto`):
  - Left: `<h1>{start.level.title}</h1>` + customer pill `{start.level.customer.name}`.
  - Centre: Hint line (`role="status"`):
    - Before signing: `"Click the Manager Desk to read the brief and sign the mandate."`
    - After signing: `"Click the Order Terminal to send the request."`
    - While running: `"The agent is working."`
  - Right: `"Back to levels"` ghost button.
- **`center` (panels):** Hosts `PixelPanel` centred within the remaining space, `max-width: calc(200 * var(--px))` (`62.5%` of canvas width).
- **`side` (right column, `30%` width):** Empty in `010` (reserved for `003` Activity Log).
- **Loading & Init Error:**
  - Loading: `PixelPanel` (`notice`) with `role="progressbar"` and `"Loading kitchen…"`.
  - Init failure: `PixelPanel` (`alert`) with `"The kitchen could not be drawn: {message}"` and `"Back to levels"`.

### 9.3 Keyboard Order & Accessibility
- **Title screen:** `Tab` moves through `"Start level"` buttons in level order.
- **Kitchen screen:** `Tab` order in `hud` → `"Back to levels"`, then station hotspots in DOM order: `"Manager Desk"` → `"Order Terminal"` (plus `"Storage"`, `"Phone Station"`, `"Delivery Entrance"` if rendered as buttons, with `aria-disabled="true"` when non-interactive/gated and `aria-describedby` pointing to `disabledReason`).
- **Opening a `PixelPanel`:** Focus moves immediately to the panel's `<h2>` (`tabIndex={-1}`).
- **Closing a `PixelPanel`:** `Escape` or the `"Close"` button hides the panel (stays mounted) and returns focus to the station hotspot that opened it.

---

## 10. `frontend/ASSETS.md` Entries

| Asset / Module | Source | Author | Licence |
|---|---|---|---|
| `src/world/art.ts` (tiles, 5 stations, robot frames, box, 4 emotes) | Own pixel art, designed in `docs/design/010-game-world.md` | Antigravity (Argon) / Agent Kitchen team | CC0 / Own |
| `public/fonts/PixelifySans-VariableFont_wght.ttf` + `OFL.txt` | Google Fonts (`ofl/pixelifysans`) | Stefie Justprince | SIL Open Font License 1.1 |
| `public/fonts/PressStart2P-Regular.ttf` + `OFL.txt` | Google Fonts (`ofl/pressstart2p`) | CodeMan38 | SIL Open Font License 1.1 |

---

## 11. Open Questions / Assumptions for Implementation

- **Font glyph check:** Verify `€` (U+20AC), `ä`, `ö`, `å`, `Ä`, `Ö`, `Å` in both TTF files using `fontTools` before shipping.
- **Hotspot overlap with `hud`:** Because `hud` occupies `y = 0..14` logical px and `MAP_ORIGIN.y = 2`, the top wall row (`y0`, `2..18` logical px) sits partially behind the `14` px `hud` strip while all 5 stations (`y1` starts at `18` logical px) sit cleanly below the `hud` strip with zero overlap.
- **002 copy preserved:** All `Brief` and `MandateScreen` copy, preset chip labels (`Strict`, `Balanced`, `Loose`), and `Stamp` semantics remain identical to `docs/design/002-mandate-screen.md`.
