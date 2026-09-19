# Color

Why a song is one color, why swatches write on click while names do not, scene colors, and the embedded Live palette.

## Color writes on click, naming doesn't

The asymmetry in the Inspector is deliberate. A color is instantly legible in the grid and
picking a different one costs nothing, so the swatch *is* the action — click it and it's
written. A name overwrites something you can no longer see, so it keeps its preview and an
explicit **Rename N** button.

The fast path this buys is the one the app exists for: **click a scene name, click a
swatch.** Selecting a scene name selects every clip in that row, so those two clicks
recolor a whole scene.

Both paths filter out writes that would change nothing — `colorOps` and the `nameOps` memo.
Recoloring a scene where 22 of 30 clips are already that color writes 8, and the progress
bar says 8. A count that includes no-op writes is a lie about how much work is happening.

## A song is one color

Coloring is **song-scoped, not selection-scoped**. Touch any scene of Nightfall and a
swatch writes all twelve, reprise included — `scenesOfSongs` widens the selection before
the ops are built. The panel says which songs and how many scenes before you press
anything, because the write reaches rows you may not be able to see.

That's a deliberate loss of flexibility. A solid block of color in Live's own session view
is what a 100-song set is navigated by, and a per-scene brush is precisely what puts holes
in it. Two things follow:

- **Roles color clips only.** The old *Paint scenes* button gave each scene its role's
  color, which stripes a song into as many colors as it has sections. Role color still
  reaches clips, where it reads as structure *inside* the band instead of breaking it.
- **A half-painted song shows as a fault, not as a color.** `derive` observes
  `colorIndex` per song the way it observes bpm and key, and **-1 is a value there, not an
  omission** — a song where some scenes are colored and some aren't reports two
  observations. The header then says `mixed color` rather than picking one, and
  `disagreements()` lists it for lint.

The song's color rides on the header as a solid left bar plus a wash across the whole row,
so a fully folded set is a column of bands. The wash **halves outside the first cell**:
the cell holding the title is the song, the track cells are what's inside it, and a folded
row reads faster when the two are told apart by weight than by a border. It also stops the
section marks competing with a field of color behind them. Three separate things want that row's edges,
so they get one property each and never negotiate: the **bar** is a `::before`, the
**wash** is `background`, and the **collapsed and drop-target indicators** are
`box-shadow`. A border is out because it would change the row's height, which the sticky
header arithmetic depends on.

The bar hangs off whichever element carries the song's identity — the pinned lead cell of
a folded header, or the pinned line inside an open header's single spanning cell. Beside
the name in both cases, rather than at an edge the name may have scrolled away from.

That split is newer than it looks. The bar and the indicators used to share `box-shadow`
and `background-image` by turns, at equal specificity, resolved by source order — folded
edge, then song color, then drop line — with a comment warning that raising any of them
with a `:not()` would silently take the drop indicator off folded rows. A folded header is
several cells wide now, which broke that arrangement and forced the better one.

Live's palette holds colors dark enough to vanish on `--rail`, so the band goes through
`legibleOn` at a low ratio (2.2). It's a block of color rather than text, so it needs far
less contrast than a scene name — but a band you can't see is the whole thing failing.

## Scene colors

Scene names render in the scene's Live color. Two things make that work:

- **`colorIndex` of -1 means no color at all**, which is not palette slot 0. Live
  documents `Scene.color_index` as "Can be None for no color"; an uncolored scene keeps
  the default dim treatment rather than being painted slot 0's color.
- **`legibleOn()` guarantees the name stays readable.** Live's palette contains colors
  far too dark to read on `--bg`, so the color is blended toward white only as far as a
  4.5:1 contrast ratio demands. Hue survives; pure black lifts to grey rather than
  vanishing.

## Palette

`LIVE_PALETTE` in `core/src/livePalette.ts` is the 70-color table the app renders. It is
part of the UI bundle, available before the first snapshot, and never mutates a set to
discover stable product data. The old LOM sweep remains a developer-only diagnostic for
checking the table after an Ableton update; no user-facing path calls it.

The default artist, role vocabulary and allowed subset are authored state, so
`useDeviceState` receives them from the bridge device's hidden Stored Only parameter.
Older `bsv.json`/`roles.json` values and any `bsv.allowedColors` list visible to the
current browser origin are imported once when that parameter is empty.
