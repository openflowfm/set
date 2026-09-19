# Performance notes

Memoization rules and identity-stability traps. Read this before touching anything that reaches a memoized row.

## Performance notes

**Two sticky header rows, and they pin where they already are.** The rule is that a
stuck offset must equal the row's *flow* position, or the header changes height the
moment you scroll — which it did, by 4px. `border-spacing: 2px` applies at the table's
top edge as well as between rows, so measured down from the scroll box the group row
sits at 2 and the track-name row at `--group-h + 4`. Pinning them at `0` and
`var(--group-h)` swallowed both gaps. They now pin at `2px` and
`calc(var(--group-h) + 4px)`, so nothing moves at all.

That leaves two 2px bands of `border-spacing` inside the header for body rows to show
through, plus the side gutters between cells. Both are plugged by flat `box-shadow`
copies in `--bg` — a `0 0 0 2px` ring on the group row, and one either side on the
track-name row. Same color the gaps already were, so nothing looks different at rest.

The track-name row carries a **drop shadow** in the same list, last so the opaque plugs
paint over it — the header has to read as sitting *over* the grid rather than as another
row of it, the same job the footer's does pointing the other way. Each cell casts its
own; at a 14px blur two neighbours' falloff meets across a 2px gutter at slightly less
than one cell's centre, which is invisible. A hard-edged shadow would have striped the
grid once per column.

`--group-h` must still equal the group row's *rendered* height exactly. A table cell
treats `height` as a minimum, so nothing in that row may add to it — no vertical
padding, no inner element, and `line-height` plus the 1px rule fill the box. It was
1.5px off when an inner bordered span was doing the underline. **Measure after changing
it.** `.grid-wrap` carries no `padding-top`: the header pins 2px below it and the ring
covers exactly that, so padding there is a band where scrolled clip cells show through.

The sticky header row's calculated height is **36px** — 5px group band + 2px gutter + 2px
label clearance + the main toolbar's 22px control height + 5px bottom padding. The
metadata header's Songs label and its song-action buttons share that 22px term, so
`--header-h` and the row's actual height stay together.

**Rows are `memo`ized.** `ClipGrid` renders `sceneCount` rows × non-group tracks —
around 6,800 cells at full size. Memoizing the row is what keeps toggling one cell
from re-rendering all 848 scenes. Without it this is *slower* than the vanilla
`innerHTML` version it replaced. Don't pass fresh object or array props into `Row`.

**No virtualization yet.** Mounting all rows is acceptable at current sizes. If it
stops being acceptable, `@tanstack/react-virtual` on the row list is the contained
fix — but measure first; the console breakdown reports `react commit` separately for
exactly this reason.

**Selection is a `Set` of `"t:s"` keys** held in `useGridSelection`. `selection.ts`
owns the encoding. Clips have no stable LOM id, so `(track, scene)` is the addressing within a
session.

**Play state must not reach `Row` as an object.** It changes several times a second while
the set is rolling, and the whole `PlayState` as a prop would re-render all 848 rows on
every change. `marksByScene` reduces it to one short string per *affected* scene — the
~846 rows with nothing happening get `undefined`, memo's identity check passes, and only
the one or two rows that changed re-render. Tokens are delimited (`|p3|`) so `p1` can't
match inside `p10`. That map is also built by walking the **tracks**, not the scenes: a
track contributes to at most two rows, so it's `O(trackCount)` rather than
`848 × trackCount` per change.

**Arm rides the same push and crosses the same way.** `armedTracks` flattens it to one
`|3|7|` string for the whole grid rather than a per-row token, because arm is a track
property and every row's answer is identical. It's rebuilt on every play push and that
costs nothing: a string with unchanged contents is `Object.is`-equal to the last one, so
`Row`'s memo passes. When somebody *does* arm a track, all 848 rows re-render — correctly,
since every empty cell in that column swaps its stop button for a record button.

**The active cell lives in a ref as well as in state**, and this is not a micro-optimisation.
`onClip` is a prop on the memoized `Row`; if it closed over `active` it would get a new
identity on every arrow press and re-render the entire grid. `goActive` writes the ref and
the state together, so two keystrokes in one frame can't both read a stale value. The same
applies to `play.isPlaying`, which Space reads. **Don't put either in a dependency array of
anything that reaches `Row`.**

**Auto-scroll reads the DOM** — `querySelector('[data-active="1"]')` — rather than
threading a ref down, for the same reason: a fresh ref callback per render is a fresh prop.

**Lookups are `Map`s, not `.find()`.** Block selection can hand op assembly
thousands of cells at once, and a linear scan of the clip list per cell makes that O(n²),
which is enough to lock the tab up on a real set. The `clips` map is built once in
`useSnapshotLookups` and passed everywhere — `ClipGrid` included — rather than rebuilt
per consumer.
