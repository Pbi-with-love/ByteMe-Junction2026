# Design Handoff — 013: Hotel Kitchen Decor & Ambient Life Pass

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/013-kitchen-decor.md` only. Does **not** modify `docs/design/010-game-world.md` or `docs/design/011-character-art.md`.  
> **Compatibility:** Additive drop-in layer on top of `010` + `011` (`16×16` base tile grid, `320×180` logical canvas, `20×11` map at `MAP_ORIGIN = { x: 0, y: 2 }`, unchanged `STATIONS` rects and access tiles, unchanged `MAX_WALK_MS = 2500` ms budget).  
> **Domain framing:** Interactive simulation platform for trusted autonomous purchasing (*Valio Aimo Trust Gateway* in a working Nordic hotel kitchen). Never frame as a restaurant management game; all art is our own pixel art (`CC0 / Own`), zero third-party logos.

---

## 1. Design Decisions & Rationale

1. **Center Counter Decision — Replace Both Bare `2×2` Center Counters with Hero Kitchen Islands (`MAP` `'C'` Preserved):**  
   In `010`/`011`, the two `2×2` center counter blocks (`{ x: 5, y: 4, w: 2, h: 2 }` and `{ x: 13, y: 4, w: 2, h: 2 }`) rendered as four repeated bare grey `16×16` `counter` cubes, leaving the middle of the room looking sterile and modular. **Decision: Replace the visual rendering of both `2×2` center counter blocks** with two bespoke `32×32` (`2×2` tiles) hero islands while keeping `'C'` in `MAP[4..5][5..6]` and `MAP[4..5][13..14]` unchanged:
   - **Left Center Island (`{ x: 5, y: 4, w: 2, h: 2 }`) → `cooking_range` (`32×32`):** A 4-burner commercial hotel range & convection oven with a simmering Valio cream-soup stockpot, an active glowing burner, a hammered copper reduction saucepan, rotary dials, a warm oven window, and a hanging blue-and-white chef towel.
   - **Right Center Island (`{ x: 13, y: 4, w: 2, h: 2 }`) → `prep_island` (`32×32`):** A garde-manger & pastry prep table with an inset oak butcher block, chopped herbs, a chef's santoku knife, a chilled stainless mixing bowl, cheese wedges, a Valio milk carton, and open under-shelf hotel plate stacks.
   - Keep `ART.counter` (`16×16`) in `src/world/art.ts` so existing `010`/`011` unit tests asserting `ART.counter` stay green, while `pixiWorld.ts` renders `cooking_range` at `{5, 4}` and `prep_island` at `{13, 4}` instead of four individual `counter` tiles per island.

2. **Three-Plane Depth Hierarchy in the Middle of the Kitchen:**  
   To eliminate the empty white floor void across `x = 3..15, y = 3..8` without cluttering the robot's silhouette or blocking BFS highways, the new props are organized into **three depth planes**:
   - **Floor Plane (`floorDecor`, z-order below `propsStations` & `robot`, walkable `isWalkable = true`):** Three `32×16` bevelled anti-fatigue kitchen runners (`floor_mat`) in front of the range, prep island, and service pass, plus two `16×16` flush stainless drainage grates (`floor_drain`) in the wet/prep zones. These break up the pale `#EEF4FA`/`#F8FAFC` checkerboard in the center of the room while preserving a `17.23:1` outline contrast when the robot walks across them.
   - **Equipment & Wall Plane (`propsStations`, z-order below `robot`, blocked via `MAP` `'C'` or `PROP_TILES`):**
     - **`rolling_cart` (`32×16` at `{9, 4, 2, 1}`):** Mobile stainless dairy & pastry trolley bridging the 6-tile central gap between `cooking_range` and `prep_island`, leaving 2-tile-wide vertical aisles on both sides (`x = 7..8` and `x = 11..12`).
     - **`sink_station` (`32×16` at `{1, 5, 2, 1}`):** Commercial double-basin pot-wash sink with gooseneck pre-rinse sprayer, soapy ice-blue water, and stacked dishes in the left bay between `Storage` and `Manager Desk`.
     - **`pass_counter` (`32×16` at `{9, 8, 2, 1}`):** Heated banquet plating & soup pass counter with brass heat-lamp bridge, silver cloche dome, soup tureen, and ticket rail in the lower-central kitchen (between `Manager Desk` at `{1..3, 8..9}` and the right-side HTML `.activity-dock` at `x = 14..19, y = 7..10`).
     - **North Wall Service Band (`y = 1`, 100% visible below the `14 px` top HUD bar):** Because row `y = 0` (`y = 2..18` logical px) sits mostly behind `.kitchen-hud` (`height: calc(14 * var(--px))`), `menu_board` (`32×16` at `{5, 1, 2, 1}`), `wall_clock` (`16×16` at `{7, 1}`), and `utensil_rack` (`32×16` at `{12, 1, 2, 1}`) are placed on **row `y = 1`** (`y = 18..34` logical px) alongside `Storage`, `Order Terminal`, `Phone Station`, and `Plant (18,1)`.
   - **Overhead & Ambient Plane (`overhead`, z-order above `propsStations` & `robot`, non-blocking `isWalkable = true`):** Four industrial enamel & brass pendant lamps (`hanging_lamp`, `16×16` at `{5, 3}`, `{6, 3}`, `{13, 3}`, `{14, 3}`) hang over the range and prep island so the robot passes *underneath* them on row `y = 3`, paired with deterministic 2-frame `steam` (`8×8`) and `burner` (`8×8`) micro-animations.

3. **Projector Readability & Strict Policy Light Isolation:**  
   - Every 3D prop uses a `1 px` `#0B1B33` (`o`) perimeter outline; walkable floor mats use muted dark slate/navy (`t` `#1E3A5F`, `k` `#475569`) with warm wood bevels (`u`/`n`) so they never compete with interactive stations or the robot.
   - **Zero policy colours (`G`, `1`, `B`, `2`, `Y`, `3`, `R`, `4`)** appear anywhere in the kitchen decor. Herbs/soap use decor foliage (`v` `#166534`, `q` `#4ADE80`); heat lamps, brass, and flames use decor amber/coral (`z` `#F59E0B`, `y` `#FDE047`, `x` `#F43F5E`); sink water uses frost/sky (`i` `#93C5FD`, `s` `#60A5FA`).

---

## 2. Palette (`010` + `011` Reused Verbatim)

All 15 new sprite grids in §4 use **only the existing 33 keys** from `docs/design/010-game-world.md` §2 (24 keys) and `docs/design/011-character-art.md` §2 (9 keys), with `.` = transparent. No new `PALETTE` keys are required (`Object.keys(PALETTE)` remains `33`, keeping `world.test.ts` green without changing the palette count assertion).

| Key | Name | Hex | Source | Role in `013` Kitchen Decor |
|---|---|---|---|---|
| `o` | Deep Navy Ink / Outline | `#0B1B33` | `010` | `1 px` prop outlines, cast-iron grates, clock hands, caster tires, chalkboard slate |
| `w` | Crisp Paper White | `#FFFFFF` | `010` | Stainless speculars, porcelain plates, milk cartons, clock face, chalk lines, steam core |
| `f` | Floor Tile Light | `#EEF4FA` | `010` | Ceramic tureen shade, plate stack shade, mid steam puff |
| `p` | Floor Tile Alt | `#F8FAFC` | `010` | Bright steam wisp highlight |
| `g` | Floor Grout | `#D6E3F0` | `010` | Outer dissipating steam wisp, backsplash tile mortar |
| `b` | Valio Brand Blue | `#0052B4` | `010` | Milk carton stripe, chef towel stripe, pendant hood body, wall trim |
| `d` | Deep Brand Blue | `#003E8A` | `010` | Pendant hood top shade, north-wall cap |
| `s` | Cold Sky / Cyan Glow | `#60A5FA` | `010` | Cold water tap indicator, soapy sink water mid-tone, chalk accent |
| `t` | Terminal / Wall Mid Blue | `#1E3A5F` | `010` | Backsplash tile, anti-fatigue floor mat body, oven window frame, chalkboard fill |
| `c` | Steel Light | `#CBD5E1` | `010` | Brushed stainless range/island/sink/cart/pass tops, cloche dome, ladle & knife blades |
| `m` | Steel Mid | `#94A3B8` | `010` | Stainless front aprons, drainboard ribs, floor drain grate bars |
| `k` | Steel Dark / Muted Ink | `#475569` | `010` | Stainless base kicks, floor mat waffle grid, oven body, drain slots |
| `u` | Warm Wood Light | `#D49B6A` | `010` | Oak cutting board, copper pan body, menu board frame, floor mat safety bevel, ticket rail |
| `n` | Warm Wood Dark | `#9C663B` | `010` | Cutting board shadow, copper pan base, spice ledge shadow, floor mat bottom bevel |
| `h` | Skin Light | `#F6C8A8` | `011` | Warm cream highlight (reserved for actors / warm speculars) |
| `j` | Skin Shadow / Copper | `#D99B78` | `011` | Hammered copper skillet & saucepan rim highlight |
| `r` | Espresso / Cast-Iron Dark | `#5C3A21` | `011` | Knife handle, pan handle, dark oven interior recess |
| `v` | Foliage Dark | `#166534` | `011` | Chopped herb shadow, dish-soap bottle shade (non-policy green) |
| `q` | Foliage Light | `#4ADE80` | `011` | Chopped herb highlight, menu board allergen check, garnish leaf (non-policy green) |
| `z` | Gold / Amber Mid | `#F59E0B` | `011` | Brass clock bezel, heat-lamp bar, pendant rim, cheese wheel, soup broth, burner ring |
| `y` | Gold / Amber Highlight | `#FDE047` | `011` | Lamp bulb glow, flame core, butter pat, brass specular |
| `x` | Heart Coral / Ember | `#F43F5E` | `011` | Active burner ember ring, hot water tap dot, clock second hand (non-policy red) |
| `i` | Ice / Frost Tint | `#93C5FD` | `011` | Sink water highlight, chilled mixing bowl interior, milk carton shadow |

> **Policy Colour Reservation (Unchanged):** Keys `G` (`#15803D`), `1` (`#DCFCE7`), `B` (`#0369A1`), `2` (`#E0F2FE`), `Y` (`#A16207`), `3` (`#FEF9C3`), `R` (`#B91C1C`), `4` (`#FEE2E2`), and error keys `e` (`#881337`), `a` (`#FDF2F5`) are **never** used in any `013` sprite.

---

## 3. Complete Prop Placement, Walkability & Z-Order Table (`20×11` Map)

- **Canvas & Map Origin:** `LOGICAL_W = 320`, `LOGICAL_H = 180`, `TILE = 16`, `MAP_COLS = 20`, `MAP_ROWS = 11`, `MAP_ORIGIN = { x: 0, y: 2 }`.
- **Logical coordinate formula:** `px = MAP_ORIGIN.x + tileX * 16`, `py = MAP_ORIGIN.y + tileY * 16`.
- **Pixi Container Z-Order (bottom → top):**
  1. `floor` — `floor_a` / `floor_b` checkerboard, `#` `wall` / `wall_shelf`.
  2. `floorDecor` *(or top of `floor`)* — **`floor_mat`**, **`floor_drain`** (**below `robot`**, walkable).
  3. `propsStations` — 5 interactive stations (`storage`, `terminal`, `phone`, `delivery`, `desk`), `011` props (`plant`, `crate_stack`), and `013` 3D props: **`cooking_range`**, **`prep_island`**, **`burner_0..1`**, **`rolling_cart`**, **`sink_station`**, **`pass_counter`**, **`menu_board`**, **`wall_clock`**, **`utensil_rack`** (**below `robot`**, blocked).
  4. `actors` — `manager` (`{2, 7}`), `courier` (`{18, 6}`) (**below `robot`**, blocked).
  5. `robot` — Aimo-Bot body + `box` + `emote`.
  6. `overhead` — **`hanging_lamp`**, **`steam_0..1`** (**above `robot`**, non-blocking so the robot walks underneath ceiling lamps; below `overlay` station highlight, `particles`, and HTML speech bubble).
  7. `overlay` / `particles` — station highlight rect and burst particles.

| Prop / Sprite Key | Size (px) | Tile Span `{x, y, w, h}` | Logical Rect `{x, y, w, h}` | Blocked? (`isWalkable`) | Mechanism | Z-Order vs Robot |
|---|---|---|---|---|---|---|
| **`cooking_range`** | `32×32` (`2×2`) | `{5, 4, 2, 2}` | `{80, 66, 32, 32}` | **Yes (`false`)** | Replaces left `2×2` `'C'` counters in `MAP` | **Below robot** (`propsStations`) |
| **`prep_island`** | `32×32` (`2×2`) | `{13, 4, 2, 2}` | `{208, 66, 32, 32}` | **Yes (`false`)** | Replaces right `2×2` `'C'` counters in `MAP` | **Below robot** (`propsStations`) |
| **`rolling_cart`** | `32×16` (`2×1`) | `{9, 4, 2, 1}` | `{144, 66, 32, 16}` | **Yes (`false`)** | Add `{9,4}, {10,4}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`sink_station`** | `32×16` (`2×1`) | `{1, 5, 2, 1}` | `{16, 82, 32, 16}` | **Yes (`false`)** | Add `{1,5}, {2,5}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`pass_counter`** | `32×16` (`2×1`) | `{9, 8, 2, 1}` | `{144, 130, 32, 16}` | **Yes (`false`)** | Add `{9,8}, {10,8}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`menu_board`** | `32×16` (`2×1`) | `{5, 1, 2, 1}` | `{80, 18, 32, 16}` | **Yes (`false`)** | Add `{5,1}, {6,1}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`wall_clock`** | `16×16` (`1×1`) | `{7, 1, 1, 1}` | `{112, 18, 16, 16}` | **Yes (`false`)** | Add `{7,1}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`utensil_rack`** | `32×16` (`2×1`) | `{12, 1, 2, 1}` | `{192, 18, 32, 16}` | **Yes (`false`)** | Add `{12,1}, {13,1}` to `PROP_TILES` | **Below robot** (`propsStations`) |
| **`floor_mat`** *(range)* | `32×16` (`2×1`) | `{5, 6, 2, 1}` | `{80, 98, 32, 16}` | **No (`true`)** | Walkable `.` tiles (not in `PROP_TILES`) | **Below robot** (`floorDecor`) |
| **`floor_mat`** *(island)* | `32×16` (`2×1`) | `{13, 6, 2, 1}` | `{208, 98, 32, 16}` | **No (`true`)** | Walkable `.` tiles (not in `PROP_TILES`) | **Below robot** (`floorDecor`) |
| **`floor_mat`** *(pass)* | `32×16` (`2×1`) | `{9, 7, 2, 1}` | `{144, 114, 32, 16}` | **No (`true`)** | Walkable `.` tiles (not in `PROP_TILES`) | **Below robot** (`floorDecor`) |
| **`floor_drain`** *(west)* | `16×16` (`1×1`) | `{3, 5, 1, 1}` | `{48, 82, 16, 16}` | **No (`true`)** | Walkable `.` tile (not in `PROP_TILES`) | **Below robot** (`floorDecor`) |
| **`floor_drain`** *(center)* | `16×16` (`1×1`) | `{11, 5, 1, 1}` | `{176, 82, 16, 16}` | **No (`true`)** | Walkable `.` tile (not in `PROP_TILES`) | **Below robot** (`floorDecor`) |
| **`hanging_lamp`** *(×4)* | `16×16` (`1×1` each) | `{5, 3}`, `{6, 3}`, `{13, 3}`, `{14, 3}` | `{80, 50}`, `{96, 50}`, `{208, 50}`, `{224, 50}` | **No (`true`)** | Walkable `.` tiles (not in `PROP_TILES`) | **Above robot** (`overhead`) |
| **`steam_0` / `steam_1`** | `8×8` (2 frames) | Sub-tile overlay on `{5, 4}` & `{9, 8}` | `{84, 58, 8, 8}` & `{156, 122, 8, 8}` | **No** (ambient) | `2 fps` (`500 ms`); static `steam_0` in reduced motion | **Above robot** (`overhead`) |
| **`burner_0` / `burner_1`** | `8×8` (2 frames) | Sub-tile overlay on `{5, 5}` | `{84, 78, 8, 8}` | **Yes** (on `'C'`) | `4 fps` (`250 ms`); static `burner_0` in reduced motion | **Below robot** (`propsStations`) |

### Preserved `010` & `011` Placements (Unchanged)
- **5 Stations (`STATIONS`):** `storage` `{1,1,3,2}` (access `{4,2}`), `terminal` `{8,1,3,1}` (access `{9,2}`), `phone` `{15,1,2,1}` (access `{15,2}`), `delivery` `{19,5,1,2}` (access `{18,5}`), `desk` `{1,8,3,2}` (access `{4,8}`).
- **`011` Actors & Props:** `MANAGER_TILE = {2, 7}`, `COURIER_TILE = {18, 6}`, `PLANT_TILES = [{18, 1}, {18, 9}]`, `CRATE_TILE = {1, 3}`, `SHELF_TILES = [{5, 0}, {6, 0}, {12, 0}, {13, 0}]`.
- **Combined `PROP_TILES` (`16` blocked `.` tiles total):**
  ```ts
  export const MENU_BOARD_TILES: Tile[] = [{ x: 5, y: 1 }, { x: 6, y: 1 }];
  export const CLOCK_TILE: Tile = { x: 7, y: 1 };
  export const UTENSIL_RACK_TILES: Tile[] = [{ x: 12, y: 1 }, { x: 13, y: 1 }];
  export const ROLLING_CART_TILES: Tile[] = [{ x: 9, y: 4 }, { x: 10, y: 4 }];
  export const SINK_TILES: Tile[] = [{ x: 1, y: 5 }, { x: 2, y: 5 }];
  export const PASS_COUNTER_TILES: Tile[] = [{ x: 9, y: 8 }, { x: 10, y: 8 }];

  export const PROP_TILES: Tile[] = [
    MANAGER_TILE,
    COURIER_TILE,
    ...PLANT_TILES,
    CRATE_TILE,
    ...MENU_BOARD_TILES,
    CLOCK_TILE,
    ...UTENSIL_RACK_TILES,
    ...ROLLING_CART_TILES,
    ...SINK_TILES,
    ...PASS_COUNTER_TILES,
  ];
  ```
  Every tile in `PROP_TILES` satisfies `MAP[t.y][t.x] === '.'` and is distinct from all 5 station `access` tiles, so `actors.test.ts` invariants hold without modification.

---

## 4. Full Palette-Indexed Pixel Grids (`src/world/art.ts`)

Every row in each grid has an exact uniform width (`32`, `16`, or `8`), uses only keys from §2 + `.` (transparent), and is ready to paste verbatim into `ART`.

### 4.1 Hero Center Islands (`32×32` — Replace Bare `counter` Tiles on `'C'`)

#### `cooking_range` (`32×32`, drawn at `{ x: 5, y: 4 }` / logical `{ x: 80, y: 66 }`)
Commercial 4-burner range with simmering Valio cream-soup stockpot (top-left), active glowing induction/gas hob (bottom-left), resting grate (top-right), hammered copper saucepan (bottom-right), control knob strip, warm convection oven window, and Valio-blue/white chef's towel.
```text
oooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccccccccccccccccccmo
ocwooooooooooocccoooooooooooocmo
occoowwwwwwwwooccoottkktttooooco
ocoowccccccccwoocootkzzkttooooco
oowcffffyyyyffcwoootkzyzktooooco
oowcfyyyzzzzffcwoootkzzkttooooco
ocoowccccccccwoocoottkktttooooco
occoowwwwwwwwooccoooooooooooooco
occcooooooooooccccccccccccccccmo
ocwooooooooooocccoooooooooooocmo
occoottxxxxxttoocoooouuuuuuoooco
ocootxzzyyyyzxtocooujzzzzzyjuoco
ocootzyywwwwyztocoouzzyywwyzuooo
ocootxzzyyyyzxtocooujzzzzzyjuoro
occoottxxxxxttoocoounnnnnnnnooco
ocwooooooooooocccoooooooooooocmo
occcccccccccccccccccccccccccccmo
oooooooooooooooooooooooooooooooo
ommmxowmmowmmxowmmowmmxowmmowmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkooooooooooooooooooooooooookko
okkowwwwwwwwwwwwwwwwwwwwwwwwokko
okkottttttoowwwwwootttttttttokko
okkotoooooowbbbbbwoooooooootokko
okkotorrzzzwiiiiiwzzyyzzrrotokko
okkotorzzyywwwwwwwzyyyzzrrotokko
okkotooooooooooooooooooooootokko
okkooooooooooooooooooooooooookko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

#### `prep_island` (`32×32`, drawn at `{ x: 13, y: 4 }` / logical `{ x: 208, y: 66 }`)
Garde-manger & pastry prep island with inset oak butcher block, chopped herbs (`q`/`v`), santoku knife, chilled stainless mixing bowl, cheese wheel (`z`/`y`), Valio milk carton (`w`/`b`/`i`), twin utility drawers, and lower open shelf with stacked white porcelain hotel plates.
```text
oooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccccccccccccccccccmo
ocwcooooooooooooccooooooooooocmo
occouuuuuuuuuuuuuocoowwwwwwoooco
ocouuuuuqqvvqqquuocowiiiiiicwoco
ocouuuqqvvvvqqquuocowiiiwwicwoco
ocouuuqvvqqquuuuuocowiiiiiicwoco
ocouuuuuuuuuuuuuuocoowcccccwooco
ocouuooowwwwccoouocccoooooooocco
ocouuorrowwwwcoouoccccccccccccmo
occouuuuuuuuuuuuuoccooooooooocmo
occnnnnnnnnnnnnnnocowwwwoozzzoco
ocwooooooooooooooocowbbbwozyzoco
occcccccoozzzzoocccowiiiwozzzoco
occcccccozyyyyzocccowwwwwoooooco
occcccccoozzzzoocccoooooooooooco
ocwcccccccccccccccccccccccccccmo
occcccccccccccccccccccccccccccmo
oooooooooooooooooooooooooooooooo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommooooooooooommooooooooooooommo
ommommmwwwmmmommommmwwwmmmommmmo
ommooooooooooommooooooooooooommo
okkooooooooooooooooooooooooookko
okkottttowwwwwwottttowwwwwwotkko
okkottttoccccccottttoccccccotkko
okkottttowwwwwwottttowwwwwwotkko
okkottttoooooooottttooooooootkko
okccccccccccccccccccccccccccccko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

---

### 4.2 Blocked Floor & Wall Equipment Props (`32×16` and `16×16`)

#### `rolling_cart` (`32×16`, drawn at `{ x: 9, y: 4 }` / logical `{ x: 144, y: 66 }`)
Mobile stainless trolley with tubular left push-handle, two Valio milk cartons and golden cheese round on the top tray, oak crate and hotel pan on the lower shelf, and 4 swivel caster wheels.
```text
.oooo...ooooooooooooooooooooooo.
owwwwooowwwwwwwwwwwwwwwwwwwwwwwo
occccoocccowwwwoowwwwooccozzzoco
o..ocoocccowbbbwowbbbwoocozyzoco
o..ocoocccowiiiwowiiiwoocozzzoco
owwwooocccowwwwoowwwwooccoooooco
.oooooooccccccccccccccccccccccmo
...ookmmmmmmmmmmmmmmmmmmmmmmkkoo
...ookooooooooooooooooooooookkoo
...ookottuuuuuuuuunootwwwwwotkoo
...ookottunnnnnnnnnootcccccotkoo
...ookcccccccccccccccccccccckkoo
...ooooooooooooooooooooooooooooo
...ookko.................ookko..
...okmko.................okmko..
....ooo...................ooo...
```

#### `sink_station` (`32×16`, drawn at `{ x: 1, y: 5 }` / logical `{ x: 16, y: 82 }`)
Commercial double-basin pot-wash sink with gooseneck pre-rinse sprayer arch, hot (`x`) and cold (`s`) taps, soapy ice-blue water (`i`/`s`/`w`) in the left basin, stacked white plates on the right ribbed drainboard, and a green dish-soap bottle (`q`/`v`).
```text
oooooooooooooooooooooooooooooooo
owwwwwwwwwwwwoooooowwwwwwwwwwwwo
occcccccccccowwwwwwoccccccccccmo
occccccccoxoommmmmoosocccoooccmo
ocwoooooooooooooooccooooooqvcomo
occooiiiiiisssiiiioocowwwooqcomo
ocooiswwiiiswwiisiioocowwwoocomo
ocooiiiissssssssiiioocowwwoocomo
occooiiiiiisssiiiiooccmcmcmccomo
ocwoooooooooooooooccooooooooocmo
occcccccccccccccccccccccccccccmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

#### `pass_counter` (`32×16`, drawn at `{ x: 9, y: 8 }` / logical `{ x: 144, y: 130 }`)
Heated service & plating pass counter in the lower-central kitchen with a warm brass heat-lamp bar, polished silver cloche dome, ceramic soup tureen with golden broth, garnished banquet plate, and oak ticket rail with pinned order slips.
```text
oooooooooooooooooooooooooooooooo
ouzzzzzzzzyyyyzzzzzzyyyyzzzzzzuo
onnnnnnnnnooooonnnnnooooonnnnnno
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcoowwwwoooowwwwwwooocccccccmo
occoowccccwoowffyyffwooowwwwcomo
ocowcccccccwowffzzzzfwoowqqwcomo
ocooooooooooowffffffwooowwwwcomo
occcccccccccooooooooocccooooocmo
ocwcccccccccccccccccccccccccccmo
ouuuuuuuuuwwwwuuuuwwwwuuuuuuuuuo
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

#### `menu_board` (`32×16`, drawn at `{ x: 5, y: 1 }` / logical `{ x: 80, y: 18 }`)
North-wall oak-framed chalkboard showing today's banquet service schedule, gold course header, allergen-safe green check marks, and a pinned white delivery docket.
```text
oooooooooooooooooooooooooooooooo
oddddddddddddddddddddddddddddddo
ottooooooooooooooooooooooooootto
ottouuuuuuuuuuuuuuuuuuuuuuuuotto
ottouoooooooooooooooooooooouotto
ottouoyyyooowwwwwwoooowwwwouotto
ottouooooooooooooooooowbbbouotto
ottouoqqoowwwwwwwwwwoowwwwouotto
ottouoqqoowwwwwwssooooooooouotto
ottouoooooooooooooooooooooouotto
ottounnnnnnnnnnnnnnnnnnnnnnuotto
ottooooooooooooooooooooooooootto
occcccccccccccccccccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

#### `wall_clock` (`16×16`, drawn at `{ x: 7, y: 1 }` / logical `{ x: 112, y: 18 }`)
Round brass-bezel Nordic kitchen clock on the north wall beside the Order Terminal, showing 10:10 with a coral-red second hand (`x`).
```text
oooooooooooooooo
oddddddddddddddo
otttoooooooottto
ottozzzzzzzyotto
ottozwwookwzytto
ottozwwoowwwztto
ottozwooooxwztto
ottozwwwwwwwztto
ottozwwwookwztto
ottozzzzzzzzotto
otttoooooooottto
oddddddddddddddo
occcccccccccccco
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
oooooooooooooooo
```

#### `utensil_rack` (`32×16`, drawn at `{ x: 12, y: 1 }` / logical `{ x: 192, y: 18 }`)
North-wall brass pot & utensil rail suspending a copper skillet, stainless soup ladle, slotted turner, copper saucepan, and a lower oak spice ledge with herb/oil bottles.
```text
oooooooooooooooooooooooooooooooo
oddddddddddddddddddddddddddddddo
ottooooooooooooooooooooooooootto
ottozzzzzzzzzzzzzzzzzzzzzzzzotto
otttojoottoowoottoowoottoojottto
ottojjjuotowwwottowwwotoujjjotto
ottojuuuotowwwottowkwotouuujotto
ottojuuuotooooottooooootuuujotto
otttoooottoqvoottozyoottoooottto
ottouuuuuuuuuuuuuuuuuuuuuuuuotto
ottonnnnnnnnnnnnnnnnnnnnnnnnotto
oddddddddddddddddddddddddddddddo
occcccccccccccccccccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

---

### 4.3 Walkable Floor & Overhead Props (`32×16` and `16×16` — `isWalkable = true`)

#### `floor_mat` (`32×16`, drawn at `{5, 6}`, `{13, 6}`, and `{9, 7}` in `floorDecor` below `robot`)
Bevelled dark navy/slate anti-fatigue kitchen runner with warm oak safety trim and non-slip waffle texture.
```text
................................
.oooooooooooooooooooooooooooooo.
.ouuuuuuuuuuuuuuuuuuuuuuuuuuuuo.
.outtttttttttttttttttttttttttuo.
.outktktktktktktktktktktktktkuo.
.outtttttttttttttttttttttttttuo.
.outktktktktktktktktktktktktkuo.
.outtttttttttttttttttttttttttuo.
.outktktktktktktktktktktktktkuo.
.outtttttttttttttttttttttttttuo.
.outktktktktktktktktktktktktkuo.
.outtttttttttttttttttttttttttuo.
.onnnnnnnnnnnnnnnnnnnnnnnnnnnno.
.oooooooooooooooooooooooooooooo.
................................
................................
```

#### `floor_drain` (`16×16`, drawn at `{3, 5}` and `{11, 5}` in `floorDecor` below `robot`)
Flush stainless floor drainage grate with slotted bars.
```text
................
................
..oooooooooooo..
..owccccccccmo..
..ocokkokkokmo..
..occcccccccmo..
..ocokkokkokmo..
..occcccccccmo..
..ocokkokkokmo..
..occcccccccmo..
..ocokkokkokmo..
..ocmmmmmmmmko..
..oooooooooooo..
................
................
................
```

#### `hanging_lamp` (`16×16`, drawn at `{5, 3}`, `{6, 3}`, `{13, 3}`, `{14, 3}` in `overhead` above `robot`)
Ceiling-mounted Valio-blue & brass industrial pendant hood with a warm glowing underside (`y`/`w`).
```text
.......oo.......
.......oo.......
......okko......
.....ozzzzo.....
...oooooooooo...
..oddddddddddo..
.odbbbbbbbbbbdo.
.ozzzzzzzzzzzzo.
.oyyyyywwyyyyyo.
..oooooooooooo..
................
................
................
................
................
................
```

---

### 4.4 Ambient Micro-Animations (`8×8` — Deterministic Ticker Loop)

#### `steam_0` & `steam_1` (`8×8`, `2 fps` / `500 ms` per frame, drawn in `overhead` at `{84, 58}` and `{156, 122}`)
Rising pixel steam wisps above the `cooking_range` stockpot (`{84, 58}`) and `pass_counter` soup tureen (`{156, 122}`). Under `prefers-reduced-motion: reduce`, hold `steam_0`.

`steam_0`:
```text
...ww...
..wppw..
...ff...
..wffw..
.wp..pw.
..f..f..
...gg...
........
```

`steam_1`:
```text
..w..w..
.wp..pw.
..f..f..
...ww...
..wppw..
...ff...
..g..g..
........
```

#### `burner_0` & `burner_1` (`8×8`, `4 fps` / `250 ms` per frame, drawn in `propsStations` at `{84, 78}`)
Warm induction/gas flame flicker on the bottom-left burner of `cooking_range` (`{84, 78}`). Under `prefers-reduced-motion: reduce`, hold `burner_0`.

`burner_0`:
```text
.txxxxt.
txzzyzxt
xzywwyzx
xzywyyzx
xzywwyzx
txzzyzxt
.txxxxt.
........
```

`burner_1`:
```text
.tzzzzt.
tzxyyxzt
zxywwyxz
zxywwyxz
zxyyyyxz
tzxxxxzt
.txxxxt.
........
```

---

## 5. Reachability & Walk-Time Budget Proof (`20×11` Map Diagram & All 20 BFS Paths)

### 5.1 Annotated `20×11` Map Diagram

Legend:
- **Blocked tiles (`isWalkable = false`):**
  - `#` = outer wall (`wall` / `wall_shelf` at `(5,0), (6,0), (12,0), (13,0)`)
  - `S` = `storage` (`{1,1,3,2}`), `T` = `terminal` (`{8,1,3,1}`), `P` = `phone` (`{15,1,2,1}`), `D` = `delivery` (`{19,5,1,2}`), `M` = `desk` (`{1,8,3,2}`)
  - `R` = `cooking_range` (`{5,4,2,2}`, `'C'` in `MAP`), `I` = `prep_island` (`{13,4,2,2}`, `'C'` in `MAP`)
  - `011` `PROP_TILES`: `m` = Manager (`{2,7}`), `c` = Courier (`{18,6}`), `p` = Plants (`{18,1}`, `{18,9}`), `k` = Crate (`{1,3}`)
  - `013` `PROP_TILES`: `B` = `menu_board` (`{5,1,2,1}`), `O` = `wall_clock` (`{7,1}`), `U` = `utensil_rack` (`{12,1,2,1}`), `G` = `rolling_cart` (`{9,4,2,1}`), `W` = `sink_station` (`{1,5,2,1}`), `H` = `pass_counter` (`{9,8,2,1}`)
- **Walkable tiles (`isWalkable = true`):**
  - **`[s]` `{4,2}`** (`storage.access`), **`[t]` `{9,2}`** (`terminal.access` / `ROBOT_START`), **`[n]` `{15,2}`** (`phone.access`), **`[d]` `{18,5}`** (`delivery.access`), **`[a]` `{4,8}`** (`desk.access`)
  - `=` = `floor_mat` (`{5..6, 6}`, `{13..14, 6}`, `{9..10, 7}` — walkable below robot)
  - `~` = `floor_drain` (`{3, 5}`, `{11, 5}` — walkable below robot)
  - `^` = `hanging_lamp` (`{5..6, 3}`, `{13..14, 3}` — walkable under overhead lamp)
  - `.` = open checkerboard floor (`floor_a` / `floor_b`)

```text
      x:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
y =  0:   #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #
y =  1:   #  S  S  S  .  B  B  O  T  T  T  .  U  U  .  P  P  .  p  #
y =  2:   #  S  S  S [s] .  .  .  . [t] .  .  .  .  . [n] .  .  .  #
y =  3:   #  k  .  .  .  ^  ^  .  .  .  .  .  .  ^  ^  .  .  .  .  #
y =  4:   #  .  .  .  .  R  R  .  .  G  G  .  .  I  I  .  .  .  .  #
y =  5:   #  W  W  ~  .  R  R  .  .  .  .  ~  .  I  I  .  .  . [d] D
y =  6:   #  .  .  .  .  =  =  .  .  .  .  .  .  =  =  .  .  .  c  D
y =  7:   #  .  m  .  .  .  .  .  .  =  =  .  .  .  .  .  .  .  .  #
y =  8:   #  M  M  M [a] .  .  .  .  H  H  .  .  .  .  .  .  .  .  #
y =  9:   #  M  M  M  .  .  .  .  .  .  .  .  .  .  .  .  .  .  p  #
y = 10:   #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #
```

### 5.2 All 20 Ordered Station-to-Station BFS Paths (`findPath` with `[Up, Right, Down, Left]` Order)

Because the North Highway (`y = 2, x = 4..18`), West Highway (`x = 4, y = 2..8`), Central Aisles (`x = 7..8` and `x = 11..12`), and Cross-Corridors (`y = 6..7, x = 4..17`) remain completely walkable, **every single one of the 20 ordered station pairs achieves its exact Manhattan distance with zero detour**:

| # | From → To | Access Tiles | Steps (`path.length - 1`) | Manhattan Distance | Walk Time (`steps × 125 ms`) | Deterministic BFS Route (`src/world/path.ts`) |
|---|---|---|---|---|---|---|
| 1 | `storage → terminal` | `(4,2) → (9,2)` | **5** | 5 | **625 ms** | `(4,2)→(5,2)→(6,2)→(7,2)→(8,2)→(9,2)` |
| 2 | `terminal → storage` | `(9,2) → (4,2)` | **5** | 5 | **625 ms** | `(9,2)→(8,2)→(7,2)→(6,2)→(5,2)→(4,2)` |
| 3 | `terminal → phone` | `(9,2) → (15,2)` | **6** | 6 | **750 ms** | `(9,2)→(10,2)→(11,2)→(12,2)→(13,2)→(14,2)→(15,2)` |
| 4 | `phone → terminal` | `(15,2) → (9,2)` | **6** | 6 | **750 ms** | `(15,2)→(14,2)→(13,2)→(12,2)→(11,2)→(10,2)→(9,2)` |
| 5 | `storage → desk` | `(4,2) → (4,8)` | **6** | 6 | **750 ms** | `(4,2)→(4,3)→(4,4)→(4,5)→(4,6)→(4,7)→(4,8)` |
| 6 | `desk → storage` | `(4,8) → (4,2)` | **6** | 6 | **750 ms** | `(4,8)→(4,7)→(4,6)→(4,5)→(4,4)→(4,3)→(4,2)` |
| 7 | `phone → delivery` | `(15,2) → (18,5)` | **6** | 6 | **750 ms** | `(15,2)→(16,2)→(17,2)→(18,2)→(18,3)→(18,4)→(18,5)` |
| 8 | `delivery → phone` | `(18,5) → (15,2)` | **6** | 6 | **750 ms** | `(18,5)→(18,4)→(18,3)→(18,2)→(17,2)→(16,2)→(15,2)` |
| 9 | `storage → phone` | `(4,2) → (15,2)` | **11** | 11 | **1 375 ms** | `(4,2)→(5,2)→…→(15,2)` (straight along `y = 2`) |
| 10 | `phone → storage` | `(15,2) → (4,2)` | **11** | 11 | **1 375 ms** | `(15,2)→(14,2)→…→(4,2)` (straight along `y = 2`) |
| 11 | `terminal → desk` | `(9,2) → (4,8)` | **11** | 11 | **1 375 ms** | `(9,2)→(9,3)→(8,3)→(8,4)→(8,5)→(8,6)→(8,7)→(8,8)→(7,8)→(6,8)→(5,8)→(4,8)` |
| 12 | `desk → terminal` | `(4,8) → (9,2)` | **11** | 11 | **1 375 ms** | `(4,8)→(4,7)→(4,6)→(4,5)→(4,4)→(4,3)→(4,2)→(5,2)→(6,2)→(7,2)→(8,2)→(9,2)` |
| 13 | `terminal → delivery` | `(9,2) → (18,5)` | **12** | 12 | **1 500 ms** | `(9,2)→(10,2)→…→(18,2)→(18,3)→(18,4)→(18,5)` |
| 14 | `delivery → terminal` | `(18,5) → (9,2)` | **12** | 12 | **1 500 ms** | `(18,5)→(18,4)→(18,3)→(18,2)→(17,2)→…→(9,2)` |
| 15 | `storage → delivery` | `(4,2) → (18,5)` | **17** | 17 | **2 125 ms** | `(4,2)→(5,2)→…→(18,2)→(18,3)→(18,4)→(18,5)` |
| 16 | `delivery → storage` | `(18,5) → (4,2)` | **17** | 17 | **2 125 ms** | `(18,5)→(18,4)→(18,3)→(18,2)→(17,2)→…→(4,2)` |
| 17 | `desk → phone` | `(4,8) → (15,2)` | **17** | 17 | **2 125 ms** | `(4,8)→(4,7)→…→(4,2)→(5,2)→…→(15,2)` |
| 18 | `phone → desk` | `(15,2) → (4,8)` | **17** | 17 | **2 125 ms** | `(15,2)→(15,3)→(15,4)→(15,5)→(15,6)→(15,7)→(14,7)→…→(8,7)→(8,8)→(7,8)→(6,8)→(5,8)→(4,8)` |
| 19 | `desk → delivery` | `(4,8) → (18,5)` | **17** | 17 | **2 125 ms** | `(4,8)→(4,7)→(4,6)→(5,6)→(6,6)→(7,6)→(8,6)→(9,6)→(10,6)→(11,6)→(12,6)→(13,6)→(14,6)→(15,6)→(15,5)→(16,5)→(17,5)→(18,5)` |
| 20 | `delivery → desk` | `(18,5) → (4,8)` | **17** | 17 | **2 125 ms** | `(18,5)→(17,5)→(17,6)→(17,7)→(16,7)→…→(8,7)→(8,8)→(7,8)→(6,8)→(5,8)→(4,8)` |

### 5.3 Spec `011` AC3 & AC4 Budget Verification Summary
- **All 5 station access tiles reachable:** `true` (`isWalkable` is `true` for all 5 access tiles).
- **Every station pair `path.length - 1 === Manhattan distance`:** `true` for all 20 ordered pairs (`path.test.ts` line 34 passes unchanged).
- **Longest station-to-station BFS walk (`longest`):** **`2 125 ms`** (`17 tiles × 125 ms`), strictly `≤ MAX_WALK_MS` (`2 500 ms`, `path.test.ts` line 35 passes unchanged).
- **Level 1–3 Preset Walk-Time Simulation (`011` AC4):** Because every station-to-station `pathMs(stationPath(a, b))` is identical to `011`, every single step (`≤ 4 500 ms`) and preset total (`≤ 30 000 ms`) across all presets of `level1.json`, `level2.json`, and `level3.json` remains unchanged and within budget.

---

## 6. Implementation Handoff Notes for Codex

1. **`src/world/art.ts`:**
   - Keep `ART.counter` (`16×16`) so existing tests that check `counter` do not break; add the 15 new grids from §4 (`cooking_range`, `prep_island`, `rolling_cart`, `sink_station`, `pass_counter`, `menu_board`, `wall_clock`, `utensil_rack`, `floor_mat`, `floor_drain`, `hanging_lamp`, `steam_0`, `steam_1`, `burner_0`, `burner_1`).
2. **`src/world/actors.ts`:**
   - Export the new tile constants (`MENU_BOARD_TILES`, `CLOCK_TILE`, `UTENSIL_RACK_TILES`, `ROLLING_CART_TILES`, `SINK_TILES`, `PASS_COUNTER_TILES`, `FLOOR_MAT_TILES`, `FLOOR_DRAIN_TILES`, `HANGING_LAMP_TILES`, `STEAM_POINTS`, `BURNER_POINT`) and append the 6 blocked prop tile groups to `PROP_TILES`.
3. **`src/world/pixiWorld.ts`:**
   - In the `MAP` loop, skip drawing individual `counter` tiles for `cell === 'C'` (draw `floor_a` / `floor_b` underneath `'C'` just like stations), and place `cooking_range` (`32×32`) at `{5, 4}` and `prep_island` (`32×32`) at `{13, 4}` in `propsStations`.
   - Draw `floor_mat` and `floor_drain` in `floor` (or `floorDecor`) right after the base floor tiles so they sit beneath `propsStations`, `actors`, and `robot`.
   - Draw `rolling_cart`, `sink_station`, `pass_counter`, `menu_board`, `wall_clock`, `utensil_rack`, and the animated `burner` sprite in `propsStations`.
   - Add an `overhead` `Container` between `robot` and `overlay` (`world.addChild(floor, propsStations, actors, robot, overhead, overlay, particles)`) for the 4 `hanging_lamp` sprites and the 2 animated `steam` sprites.
   - Under `opts.reducedMotion === true`, hold `steam_0` and `burner_0` without cycling frames.
