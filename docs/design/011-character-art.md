# Design Handoff — 011: Character & World Detail Art Pass

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/011-character-art.md` only. Does **not** modify `docs/design/010-game-world.md`.  
> **Compatibility:** Drop-in replacement for `010` sprites on the same `16×16` tile grid, `320×180` logical canvas, `20×11` map (`MAP_ORIGIN = { x: 0, y: 2 }`), and 5 station rects/access tiles.  
> **Domain framing:** Interactive simulation platform for trusted autonomous purchasing (*Valio Aimo Trust Gateway*). Never frame as a restaurant management game.

---

## 1. Design Decisions & Rationale

1. **Cohesive 2–3 Tone Shading & Silhouette Readability:**  
   Every character and station keeps a crisp `1 px` deep navy outline (`o` `#0B1B33`) with top-left light highlights and bottom-right shadows so silhouettes read cleanly at `6×` (`1920×1080`) and `4×` (`1366×768`) on a projector.
2. **Expressive Autonomous Robot ("Aimo-Bot"):**  
   Redesigned with a rounded CRT-visor head, side ear-pods, expressive cyan eyes, a bobble antenna, a Valio-blue chest plate, and full directional walk cycles (`down`, `up`, `side`) plus dedicated `carry_*` variants so carrying dairy crates never clips awkwardly.
3. **Human Presence & Living Cold-Room Kitchen:**  
   Adds **Anna Virtanen** (Kitchen Manager, `16×16`) behind the Manager Desk (`{2, 7}`) with phone-reaction frames when `YELLOW` approvals ring, plus a **Delivery Courier** (`16×16`) beside an open refrigerated **Delivery Van Bay** (`16×32`), frosted-glass **Storage** showing milk cartons and cheese/butter stock, wall shelves with milk cartons, and potted kitchen plants.
4. **Strict Policy Light Isolation (Preserved from `010`):**  
   Policy colours (`G`, `B`, `Y`, `R` and their `-bg` tints `1`, `2`, `3`, `4`) remain **exclusively** for policy emotes, badges, and logs. New foliage (`v`, `q`), gold stars (`z`, `y`), skin (`h`, `j`), hair (`r`), frost (`i`), and heart coral (`x`) use distinct non-policy keys.

---

## 2. Palette (`010` Base + 9 Marked Additions)

All `24` keys from `docs/design/010-game-world.md` §2 are preserved unchanged (`o, w, f, p, g, b, d, s, t, c, m, k, u, n, G, 1, B, 2, Y, 3, R, 4, e, a`). Add the following **9 keys** to `PALETTE` in `src/world/palette.ts` (`.` = transparent):

| Key | Name | Hex | Status | Role / Usage |
|---|---|---|---|---|
| `h` | Skin Light | `#F6C8A8` | **NEW** | Manager & Courier faces, hands |
| `j` | Skin Shadow | `#D99B78` | **NEW** | Manager & Courier 2-tone skin shading |
| `r` | Espresso / Hair Dark | `#5C3A21` | **NEW** | Manager & Courier hair, coffee, deep wood shadow |
| `v` | Foliage Dark | `#166534` | **NEW** | Plant leaf shadow (decor only; never policy `G`) |
| `q` | Foliage Light | `#4ADE80` | **NEW** | Plant leaf highlight (decor only; never policy `G`) |
| `z` | Gold / Amber Mid | `#F59E0B` | **NEW** | `star_on` body, brass desk lamp, cheese/butter stock |
| `y` | Gold / Amber Highlight | `#FDE047` | **NEW** | `star_on` specular, lamp glow, `delivered` sparkle |
| `x` | Heart Coral | `#F43F5E` | **NEW** | `heart_break` particles (never policy `R` or error `e`) |
| `i` | Ice / Frost Tint | `#93C5FD` | **NEW** | Fridge glass reflection, milk carton shade, visor mid-highlight |

---

## 3. Map & Actor Placement (`20×11`, `MAP_ORIGIN = { x: 0, y: 2 }`)

The `20×11` layout and 5 station rects/access tiles from `010` §3 are **unchanged**:

| Actor / Decor | Tile `{x, y}` | Logical Px `{x, y}` | Notes |
|---|---|---|---|
| **Robot (`ROBOT_START`)** | `{9, 2}` | `{144, 34}` | Walks walkable `.` tiles (`16×16`) |
| **Kitchen Manager** | `{2, 7}` | `{32, 114}` | Behind Manager Desk (`{1,8,3,2}`), facing down; does not block `{4,8}` |
| **Delivery Courier** | `{18, 6}` | `{288, 98}` | Beside Delivery Van Bay (`{19,5,1,2}`), below robot access `{18,5}` |
| **Wall Shelf (Milk)** | `{5, 0}`, `{6, 0}`, `{12, 0}`, `{13, 0}` | `{80,2}`, `{96,2}`, `{192,2}`, `{208,2}` | Optional `#` wall variant (`wall_shelf`) |
| **Potted Plant** | `{18, 1}`, `{18, 9}` | `{288,18}`, `{288,146}` | Decorative corner accents (blocked) |
| **Spare Crate Stack** | `{0, 6}` (or `{1, 3}`) | `{16, 50}` | Optional corner prop near Storage |

---

## 4. Robot Agent (`16×16`) — Full Frame Sets

### 4.1 `idle` (2 frames)

`idle_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
....obb..bbo....
....ooo..ooo....
```

`idle_1`:
```text
.......oo.......
......owwo......
.......oo.......
................
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
....obb..bbo....
....ooo..ooo....
```

### 4.2 `walk_down` (4 frames)

`walk_down_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oo.owwbbwwo.co.
....ooccccoo.oo.
...obbo..obbo...
...ooo....ooo...
```

`walk_down_1`:
```text
................
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
....obbo..obbo..
....ooo....ooo..
```

`walk_down_2`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.oo.
.oo.ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_down_3`:
```text
................
.......oo.......
......owwo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
..obbo..obbo....
..ooo....ooo....
```

### 4.3 `walk_up` (4 frames, back view with battery pack)

`walk_up_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..occffffffcco..
..oocbbbbbbcoo..
.owwcbssssbcwwo.
.oo.occccccoco..
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_up_1`:
```text
................
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..oocbbbbbbcoo..
.owwcbssssbcwwo.
.oc.occcccco.co.
.oo.ooccccoo.oo.
....obbo..obbo..
....ooo....ooo..
```

`walk_up_2`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..occffffffcco..
..oocbbbbbbcoo..
.owwcbssssbcwwo.
.oc.occcccco.oo.
.oo.ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_up_3`:
```text
................
.......oo.......
......owwo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..oocbbbbbbcoo..
.owwcbssssbcwwo.
.oc.occcccco.co.
.oo.ooccccoo.oo.
..obbo..obbo....
..ooo....ooo....
```

### 4.4 `walk_side` (4 frames, facing right; mirror horizontally for left)

`walk_side_0`:
```text
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...occffffffco..
...oocccccccoo..
..owwbbbbbbwwo..
..owwoccccwooo..
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_side_1`:
```text
................
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...oocccccccoo..
..owwbbbbbbwwo..
...ooccccccoo...
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

`walk_side_2`:
```text
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...occffffffco..
...oocccccccoo..
..owwbbbbbbwwo..
..ooowccccwwoo..
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`walk_side_3`:
```text
................
......oo........
.....owwo.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...oocccccccoo..
..owwbbbbbbwwo..
...ooccccccoo...
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

### 4.5 `work` (2 frames)

`work_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswwbbwwsdwo.
.owdbssbbssbdwo.
.owwddddddddwwo.
..occffffffcco..
.oooccccccccooo.
oww.wbbbbbbw.wwo
oo..owwbbwwo..oo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

`work_1`:
```text
.......oo.......
......owwo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdbssbbssbdwo.
.owdswwbbwwsdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
oow.wbbbbbbw.woo
ow..owwbbwwo..wo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

### 4.6 `wait` (2 frames)

`wait_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbbisdwo.
.owdswibbbisdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
....obb..bbo....
....ooo..ooo....
```

`wait_1`:
```text
.......oo.......
......oibo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdbbsswibbdwo.
.owdbbsswibbdwo.
.owwddddddddwwo.
..occffffffcco..
..ooccccccccoo..
.owwbbbbbbbbwwo.
.oc.owwbbwwo.co.
.oo.ooccccoo.oo.
....obb...bbo...
....ooo...ooo...
```

### 4.7 `blocked` (1 frame)

`blocked_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswdbbwdswwo.
.owdwssbbsswdwo.
.owwddddddddwwo.
.oooccffffccooo.
owwooccccccccooo
oww.wbbbbbbbwwo.
oo..owwbbwwo.co.
....ooccccoo.oo.
....obb..bbo....
....ooo..ooo....
```

### 4.8 Carry-Box Variants & Dairy Crate (`box` 8×8)

**`box` (8×8, drawn at `(x + 4, y + 5)` when `carry === true`):**
```text
oooooooo
owwwwwwc
owbbbbwc
owwiiwwc
ouuuuuun
ouunnunn
onnnnnno
oooooooo
```

**`carry_idle` (2 frames, arms raised to cradle `box`):**

`carry_idle_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

`carry_idle_1`:
```text
.......oo.......
......owwo......
.......oo.......
................
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
....obb..bbo....
....ooo..ooo....
```

**`carry_walk_down` (4 frames):**

`carry_walk_down_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_down_1`:
```text
................
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
....obbo..obbo..
....ooo....ooo..
```

`carry_walk_down_2`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
..occffffffcco..
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_down_3`:
```text
................
.......oo.......
......owwo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwddddddddwwo.
.owdswibbiwsdwo.
.owdswibbiwsdwo.
.owwddddddddwwo.
.oooccccccccooo.
oww.wbbbbbbw.wwo
ooo.owwbbwwo.ooo
....ooccccoo....
..obbo..obbo....
..ooo....ooo....
```

**`carry_walk_up` (4 frames):**

`carry_walk_up_0`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..occffffffcco..
.ooocbbbbbbcooo.
oww.cbssssbc.wwo
ooo.occccccc.ooo
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_up_1`:
```text
................
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
.ooocbbbbbbcooo.
oww.cbssssbc.wwo
ooo.occccccc.ooo
....ooccccoo....
....obbo..obbo..
....ooo....ooo..
```

`carry_walk_up_2`:
```text
.......oo.......
......osso......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
..occffffffcco..
.ooocbbbbbbcooo.
oww.cbssssbc.wwo
ooo.occccccc.ooo
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_up_3`:
```text
................
.......oo.......
......owwo......
.......oo.......
...oooooooooo...
..owwwffffwwwo..
.owwffffffffwwo.
.owfccccccccfwo.
.owfccccccccfwo.
.owwffffffffwwo.
.ooocbbbbbbcooo.
oww.cbssssbc.wwo
ooo.occccccc.ooo
....ooccccoo....
..obbo..obbo....
..ooo....ooo....
```

**`carry_walk_side` (4 frames, facing right; mirror horizontally for left; `box` drawn at `(x + 7, y + 5)` when facing right or `(x + 1, y + 5)` when mirrored left):**

`carry_walk_side_0`:
```text
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...occffffffco..
...oocccccccoo..
..owwbbbbbbwwwo.
...oocccccwwwoo.
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_side_1`:
```text
................
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...oocccccccoo..
..owwbbbbbbwwwo.
...oocccccwwwoo.
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

`carry_walk_side_2`:
```text
......oo........
.....osso.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...occffffffco..
...oocccccccoo..
..owwbbbbbbwwwo.
...oocccccwwwoo.
....ooccccoo....
...obbo..obbo...
...ooo....ooo...
```

`carry_walk_side_3`:
```text
................
......oo........
.....owwo.......
......oo........
...oooooooooo...
..owwwffffwwwo..
..owwddddddddwo.
..owdbbswibswwo.
..owdbbswibswwo.
..owwddddddddwo.
...oocccccccoo..
..owwbbbbbbwwwo.
...oocccccwwwoo.
....ooccccoo....
.....obbbbo.....
.....oooooo.....
```

### 4.9 4 Projector-Readable Emotes (`8×8`, at `(x + 4, y - 10)`)

- **`calm` (GREEN `G`/`1`/`w`, rounded badge + checkmark ✓):**
```text
.oooooo.
o1GGGGGo
oG1GGwGo
oGGGwGGo
oGwGwGGo
oGGwGGGo
oGGGGGG1
.oooooo.
```

- **`info` (BLUE `B`/`2`/`w`, square badge + `"i"`):**
```text
.oooooo.
o2BwBBBo
oBBBBBB2
oBBwBBBo
oBBwBBBo
oBBwBBBo
oBBBBBB2
.oooooo.
```

- **`puzzled` (YELLOW `Y`/`3`/`o`, warning triangle + `"?"`):**
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

- **`stop` (RED `R`/`4`/`w`, raised palm halt silhouette):**
```text
.oooooo.
o4RwRwRo
oRwRwRwo
oRwRwRwo
oRwwwwRo
oRwwwwwo
oRRwwwRo
.oooooo.
```

---

## 5. Kitchen Manager (`16×16`) — Anna Virtanen at `{2, 7}`

Drawn at logical `{32, 114}` behind the Manager Desk (`{16, 130, 48, 32}`).

**`manager_idle` (2 frames, 2 fps / 500 ms):**

`manager_idle_0`:
```text
.....oooooo.....
....orrrrrro....
...orrrrrrrro...
...orhhhhhhro...
...ohohhhhojo...
...ohhhhhhhjo...
....ojhhhhjo....
...oooooooooo...
..owwbbbbbbwwo..
..owwbbbbbbwwo..
..owwddddddwwo..
..ohowwwwwwoho..
..o.obbbbbbo.o..
....obbbbbbo....
....ooo..ooo....
................
```

`manager_idle_1`:
```text
................
.....oooooo.....
....orrrrrro....
...orrrrrrrro...
...orhhhhhhro...
...ohohhhhojo...
...ohhhhhhhjo...
....ojhhhhjo....
...oooooooooo...
..owwbbbbbbwwo..
..owwbbbbbbwwo..
..owwddddddwwo..
..ohowwwwwwoho..
....obbbbbbo....
....ooo..ooo....
................
```

**`manager_phone` (2 frames, 4 fps / 250 ms — reacting to `YELLOW` approval):**

`manager_phone_0`:
```text
.....oooooo.....
....orrrrrro....
...orrrrrrrro...
..oorhhhhhhro...
..otohohhhhojo..
..otohhhhhhhjo..
..otohjhhhhjo...
..ooooooooooo...
.ohowbbbbbbwwo..
.o.owbbbbbbwwo..
...owddddddwwo..
....owwwwwwoho..
....obbbbbbo.o..
....obbbbbbo....
....ooo..ooo....
................
```

`manager_phone_1`:
```text
.....oooooo.....
....orrrrrro....
...orrrrrrrro...
.ooorhhhhhhro...
.otohohhhhojo...
.otohhhhhhhjo...
.otohjhhhhjo....
.oooooooooooo...
.ohowbbbbbbwwo..
....owbbbbbbwwo.
....owddddddwwo.
....owwwwwwoho..
....obbbbbbo.o..
....obbbbbbo....
....ooo..ooo....
................
```

---

## 6. Delivery Courier (`16×16` at `{18, 6}`)

Drawn at logical `{288, 98}`, immediately below the robot's `{18, 5}` delivery access tile.

**`courier_idle` (2 frames, 2 fps / 500 ms):**

`courier_idle_0`:
```text
....ooooooo.....
...obbbbbddo....
..oobbbbbbbo....
...ohhhhhhjo....
...ohohhhoho....
...ohhhhhhjo....
....ojjjjjo.....
...oooooooooo...
..obbbbbbbbbbo..
..obbbwwwwbbbo..
..obbbbbbbbbbo..
..ohobbbbbboho..
....oddddddo....
....okk..kko....
....ooo..ooo....
................
```

`courier_idle_1`:
```text
................
....ooooooo.....
...obbbbbddo....
..oobbbbbbbo....
...ohhhhhhjo....
...ohohhhoho....
...ohhhhhhjo....
....ojjjjjo.....
...oooooooooo...
..obbbbbbbbbbo..
..obbbwwwwbbbo..
..obbbbbbbbbbo..
..ohobbbbbboho..
....oddddddo....
....okk..kko....
....ooo..ooo....
```

**`courier_deliver` (2 frames, 4 fps / 250 ms — handing over crate):**

`courier_deliver_0`:
```text
....ooooooo.....
...obbbbbddo....
..oobbbbbbbo....
...ohhhhhhjo....
...ohohhhoho....
...ohhhhhhjo....
....ojjjjjo.....
...oooooooooo...
.ooobbbbbbbbbo..
ohwobbbwwwbbbo..
oooobbbbbbbbbo..
....obbbbbboho..
....oddddddo....
....okk..kko....
....ooo..ooo....
................
```

`courier_deliver_1`:
```text
....ooooooo.....
...obbbbbddo....
..oobbbbbbbo....
...ohhhhhhjo....
...ohohhhoho....
...ohhhhhhjo....
....ojjjjjo.....
...oooooooooo...
ooobbbbbbbbbbo..
hwobbbbwwwbbbo..
ooobbbbbbbbbbo..
....obbbbbboho..
....oddddddo....
....okk..kko....
....ooo..ooo....
................
```

---

## 7. Richer Stations & Environment Tiles

### 7.1 Environment & Decor Tiles (`16×16`)

**`floor_a` (16×16)**
```text
pffffffffffffffg
pffffffffffffffg
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
wppppppppppppppg
wppppppppppppppg
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

**`wall` (16×16, tiled backsplash + stainless trim)**
```text
oooooooooooooooo
oddddddddddddddo
obbbbbbbbbbbbbbo
otttttgtttttttto
otttttttttttttto
otttgtttttttgppo
otttttttttttttto
otttttgtttttttto
otttttttttttttto
oddddddddddddddo
owwwwwwwwwwwwwwo
occcccccccccccco
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
oooooooooooooooo
```

**`wall_shelf` (16×16, wall shelf with milk cartons & dairy jars)**
```text
oooooooooooooooo
oddddddddddddddo
otttowwoooowwoto
otttowbowwobwoto
otttowbowwobwoto
otttowwowwowwoto
otttuuuuuuuuuuto
otttnnnnnnnnnnto
otttttgtttttttto
oddddddddddddddo
owwwwwwwwwwwwwwo
occcccccccccccco
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
oooooooooooooooo
```

**`counter` (16×16, brushed stainless steel)**
```text
oooooooooooooooo
owwwwwwwwwwwwwwo
occcccccccccccco
ocwcccccccccccmo
occcccccccccccmo
occcccccccccccmo
occcccccccccccmo
occcccccccccccmo
occcccccccccccmo
occcccccccccccmo
ommmmmmmmmmmmmmo
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
oooooooooooooooo
```

**`plant` (16×16, potted kitchen herb/ficus)**
```text
.....oo..oo.....
....oqvooqvo....
...oqqvoqqqqo...
..oqvvqoqqvvqo..
..ovvvvoqvvvvqo.
...ovvvoovvvvo..
....ooovvoooo...
...oooooooooo...
...ouuuuuuuuo...
...ounnnnnnuo...
....onnnnnno....
....onnnnnno....
.....oooooo.....
................
................
................
```

**`crate_stack` (16×16, spare dairy crates)**
```text
..oooooooooooo..
..owwwwwwwwwwc..
..owbbwwwbbwwc..
..owwwwwwwwwwc..
..oooooooooooo..
.oooooooooooooo.
.ouuuuuuuuuuuun.
.ouuwwuuuuwwuun.
.onnnnnnnnnnnno.
.onnnnnnnnnnnno.
.oooooooooooooo.
................
................
................
................
................
```

### 7.2 Richer Station Sprites (Exact `010` Dimensions)

**`storage` — Cold-Room Double-Door Fridge with Visible Milk & Cheese Stock (`48×32`)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
oddddddddddddddddddddddddddddddddddddddddddddddo
obbbbbbbbbbbbbbbbbbossossossobbbbbbbbbbbbbbbbbbo
oooooooooooooooooooooooooooooooooooooooooooooooo
occccccccccccccccccccccoocccccccccccccccccccccco
ocwiiiiiiiiiiiiiiiiiiicoociiiiiiiiiiiiiiiiiiiwco
ocwiowwoowwooozzzoiiiicoociiiowwoowwooozzzoiiwco
ocwiowbowwbowozyzoiiiicoociiiowbowwbowozyzoiiwco
ocwiowbowwbowozzzoiiiicoociiiowbowwbowozzzoiiwco
ocwiowwoowwooooooooooicoociiiooooooooooooooiowco
ocwicccccccccccccccccicoociccccccccccccccccciwco
ocwiowwooozzzoowwoiiiicoociiiozzzoowwoowwoiiiwco
ocwiowbooozyzoowboiiiicoociiiozyzoowboowboiiiwco
ocwiowbooozzzoowboiiiicoociiiozzzoowboowboiiiwco
ocwiowwoooooooowwoiiiicoociiioooooowwoowwoiiiwco
ocwiiiiiiiiiiiiiiiiiiicoociiiiiiiiiiiiiiiiiiiwco
occccccccccccccccccccccoocccccccccccccccccccccco
owwwwwwwwwwwwwwwwwwwcccoowwwwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
owwwwwwwwwwwwwwwwwwwbscoowsbwwwwwwwwwwwwwwwwccco
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

**`terminal` — Order Terminal with Scanline Screen & Receipt Slip (`48×16`)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccttttttttttttttttttttccccccccccccco
occccccccccccctbddddddddddddddddbtccccccccccccco
occccccccccccctbdsssssswwwwwsssdbtccooowwwwcccco
occccccccccccctbddddddddddddddddbtccowwwwwwwccco
occctttttttccctbdwwwwwwsssssssddbtccowwkkkwwccco
occcwwwwwwwccctbddddddddddddddddbtccowwwwwwwccco
occctttttttccctbdssssssbbbbbbssdbtcccdddddddccco
occccccccccccctbddddddddddddddddbtcccsssssssccco
occcccccccccccttttttttttttttttttttcccdddddddccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooooooooooooooooooo
```

**`phone` — Phone Station with Coiled Cord & Ring Lamp (`32×16`)**
```text
oooooooooooooooooooooooooooooooo
owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo
occcccccccccccccccccccccccccccco
occccccccttbbbbbbbbbbttcccccccco
occccccccttttttttttttttcccccccco
occcooocccbbbbbbbbbbbbcccwwwwwco
occosssoccbbssssssssbbcccwkkkwco
occcooocccbbbbbbbbbbbbcccwwwwwco
occcctccccbbwbwbwbwbsbccccccccco
occccttttccbbbbbbbbbbbccccccccco
occcccccccccccccccccccccccccccco
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
ommmmmmmmmmmmmmmmmmmmmmmmmmmmmmo
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooo
```

**`delivery` — Open Refrigerated Delivery Van Bay & Dock Threshold (`16×32`)**
```text
oooooooooooooooo
oooooooooooooooo
occcccccccccccco
ommmmmmmmmmmmmmo
obbbbbbbbbbbbbbo
obbbddddddddbbbo
obbdiiiiiiiiidbo
obbdifffffffidbo
obbdifwwwwwfidbo
obbdifwbbbwfidbo
obbdifwwwwwfidbo
obbdifffffwfidbo
obbdifwwwwffidbo
obbdifwbbwffidbo
obbdifwwwwffidbo
obbdifffffffidbo
obbdiiiiiiiiidbo
obbbddddddddbbbo
obbbbbbbbbbbbbbo
ommmmmmmmmmmmmmo
ozzozzozzozzozzo
ozzozzozzozzozzo
okkkkkkkkkkkkkko
okkkkkkkkkkkkkko
occcccccccccccco
ommmmmmmmmmmmmmo
obbbbbbbbbbbbbbo
occcccccccccccco
ommmmmmmmmmmmmmo
okkkkkkkkkkkkkko
oooooooooooooooo
oooooooooooooooo
```

**`desk` — Manager Desk with Valtakirja, Stamp Pad, Lamp & Coffee (`48×32`)**
```text
oooooooooooooooooooooooooooooooooooooooooooooooo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuooooouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuoooouuuo
ouuozzzzyouuuuuuuuuuuuuuuuuuuuuuuuuuuuuoowwouuuo
ouuozzzzyouuuuuuuuuuuuuuuuuuuuuuuuuuuuuowrrouuuo
ouuuooooouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuoooouuuo
ouuuuuunnnnmmmmmmnnnnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunwkkkkkkkkwwnuuuuuuuuuuoooooooouuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuobbbbbbouuuuuuuuuo
ouuuuuunwkkkkkkkkwwnuuuuuuuuuuobssssbouuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuobssssbouuuuuuuuuo
ouuuuuunwkkkkkkkkwwnuuuuuuuuuuobssssbouuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuobbbbbbouuuuuuuuuo
ouuuuuunwkkkkkkkkwwnuuuuuuuuuuoooooooouuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunwwwwbbwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunwwwwbbwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunwwwwwwwwwwwwnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuunnnnnnnnnnnnnnuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
ouuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuo
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno
orrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrro
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
okkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
oooooooooooooooooooooooooooooooooooooooooooooooo
```

---

## 8. Particles & Stars

### 8.1 Particle Sprites

- **`particle_stamp` (`4×4` ink puff + `2×2` motes, colours `b`, `s`, `w`, `g`):**
```text
.bb.
bssb
bssb
.bb.
```
  Spawn **10 particles** from `desk` stamp pad (`{46, 140}` logical) in a radial upward arc; shrink to `2×2` at 50% lifetime (`600 ms`).

- **`particle_delivered` (`5×5` sparkle, 2 frames alternating every `125 ms`, colours `y`, `z`, `w`, `s`, `G`):**

  `sparkle_0` (`5×5`):
```text
..y..
..w..
ywzwy
..w..
..y..
```
  `sparkle_1` (`5×5`):
```text
y...y
.w.w.
..z..
.w.w.
y...y
```
  Spawn **12 particles** (alternating `sparkle_0`/`sparkle_1` and `2×2` `s`/`G`/`y` motes) from `delivery` (`{308, 98}` logical) in a celebratory fountain burst (`750 ms`).

- **`particle_heart_break` (when `YELLOW` approval consumes 1 heart, `650 ms`):**

  `heart_full` (`8×8`, HUD/burst reference):
```text
.oo..oo.
oxxroxxo
oxxxxxxo
oxxxxxxo
.oxxxxo.
..oxxo..
...oo...
........
```
  `heart_left` (`4×8`, drifts left-down):
```text
.oo.
oxxr
oxxx
oxxx
.oxx
..ox
...o
....
```
  `heart_right` (`4×8`, drifts right-down):
```text
.oo.
oxxo
xxxo
xxxo
xxo.
xo..
o...
....
```

### 8.2 Rating Stars (`12×12`, Result & Replay Comparison)

**`star_on` (12×12, gold):**
```text
.....oo.....
....oyzo....
....ozzo....
.oooizziooo.
oyyyyyzzzzzo
.oyyyzzzzzo.
..oyzzzzzo..
..ozzzzzzo..
.ozzzoozzzo.
.ozzo..ozzo.
.ooo....ooo.
............
```

**`star_off` (12×12, muted slate):**
```text
.....oo.....
....ocmo....
....ommo....
.ooocmmmooo.
occcccmmmmmo
.occcmmmmmo.
..ocmmmmmo..
..ommmmmmo..
.ommmoommmo.
.ommo..ommo.
.ooo....ooo.
............
```

---

## 9. Preview & Animation Timing Reference

| Sprite / Set | Size | Frames | Rate / Timing | Loop | Anchor / Behaviour | Reduced Motion |
|---|---|---|---|---|---|---|
| `robot.idle` | `16×16` | 2 (`idle_0..1`) | `2 fps` (`500 ms`) | Loop | Access tile `{x, y}`; subtle 1 px chest/antenna breath | Hold `idle_0` |
| `robot.walk_down` | `16×16` | 4 (`0..3`) | `8 fps` (`125 ms`) | Loop | Used when `dy > 0` and `\|dy\| >= \|dx\|` | Jump to dest, `idle_0` |
| `robot.walk_up` | `16×16` | 4 (`0..3`) | `8 fps` (`125 ms`) | Loop | Used when `dy < 0` and `\|dy\| >= \|dx\|` | Jump to dest, `idle_0` |
| `robot.walk_side` | `16×16` | 4 (`0..3`) | `8 fps` (`125 ms`) | Loop | Facing right when `dx > 0`; `scale.x = -1` when `dx < 0` | Jump to dest, `idle_0` |
| `robot.work` | `16×16` | 2 (`work_0..1`) | `4 fps` (`250 ms`) | Loop | Active at `storage` / `terminal` | Hold `work_0` |
| `robot.wait` | `16×16` | 2 (`wait_0..1`) | `2 fps` (`500 ms`) | Loop | Waiting at `phone` during `YELLOW` approval | Hold `wait_0` |
| `robot.blocked` | `16×16` | 1 (`blocked_0`) | Static | — | `RED` gateway block | Static `blocked_0` |
| `robot.carry_*` | `16×16` | Same as above | Same as above | Loop | Used when `carry === true`; `box` (`8×8`) drawn at `(x+4, y+5)` (or `(x+7, y+5)` right / `(x+1, y+5)` left) | Hold frame `_0` + `box` |
| `emotes` (`calm`, `info`, `puzzled`, `stop`) | `8×8` | 1 each | Static | — | Drawn at `(x + 4, y - 10)` above head, below speech bubble (`y - 12`) | Static |
| `manager.idle` | `16×16` | 2 (`0..1`) | `2 fps` (`500 ms`) | Loop | Tile `{2, 7}` (`{32, 114}`) behind Manager Desk | Hold `manager_idle_0` |
| `manager.phone` | `16×16` | 2 (`0..1`) | `4 fps` (`250 ms`) | Loop | Active while `YELLOW` approval is pending | Hold `manager_phone_0` |
| `courier.idle` | `16×16` | 2 (`0..1`) | `2 fps` (`500 ms`) | Loop | Tile `{18, 6}` (`{288, 98}`) beside Delivery Bay | Hold `courier_idle_0` |
| `courier.deliver` | `16×16` | 2 (`0..1`) | `4 fps` (`250 ms`) | One-shot (`600 ms`) | Plays when robot reaches `delivery` (`201` order) | Hold `courier_deliver_0` |
| `particle_stamp` | `4×4` / `2×2` | 10 motes | `600 ms` total | One-shot | Radial upward arc from desk stamp pad | Skipped |
| `particle_delivered` | `5×5` / `2×2` | 2-frame sparkle, 12 motes | `750 ms` (`125 ms` toggle) | One-shot | Fountain burst at Delivery Entrance | Skipped |
| `particle_heart_break` | `4×8` halves | 2 halves | `650 ms` | One-shot | Split-and-drop when `YELLOW` card costs 1 heart | Skipped |
| `star_on` / `star_off` | `12×12` | 1 each | Static | — | Used in Result & Replay Comparison panels | Static |

---

## 10. Open Questions / Assumptions for Implementation

- **Grid width verification:** All `16×16`, `48×32`, `48×16`, `32×16`, `16×32`, `8×8`, `12×12`, `5×5`, `4×8`, and `4×4` grids use exact row lengths and only the `24` `010` palette keys + `9` new keys (`h, j, r, v, q, z, y, x, i`) + `.` transparent.
- **No external assets:** All art is own pixel art for `src/world/art.ts` (`CC0 / Own`); zero external sprite packs or logos.
