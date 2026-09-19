# Track groups

How Live’s group tracks collapse into columns and what a folded group shows.

## Track groups

**A group track is a column, like it is in Live.** It's a real track with real clip
slots, and firing its slot fires every clip the group holds in that scene. Collapsing
hides its *members*, not the group — so the column is there either way, and there is no
separate "stands in for its members" column kind.

**A group is a real track, so its header behaves like every other one:** clicking it
opens that group's own [device chain](device-chain.md) and selects it in Live. ⌘-click
stops the group — the same gesture as any track header, and on a group Live's
`stop_all_clips` takes the members with it.

That leaves folding to the ⊙ chevron alone, which is a real loss and worth naming: the
whole header used to be the fold target, and that is what made folding tolerable on a
40-column grid. It went because a group having devices is not negotiable — it is a track —
and one header cannot mean two things on a plain click. Live puts the fold on the chevron
for the same reason. The chevron is padded wider than its glyph so it stays hittable at
the narrowest column width, and ⌘-clicking it deliberately does *not* fold: the modifier
belongs to the header, so the event is left to bubble and stops the group instead.

The group's cell carries a launcher and a count — how many of its tracks have a clip in
that scene — tinted with the first of those clips, which is the color Live paints the
slot. The count is the one thing a collapsed group hides that nothing else on screen
answers. Plain click fires it, which is the second exception to the ⌘-to-fire rule after
the scene button, and for the same reason: there is nothing in a group slot to select,
so there's no selection for the modifier to protect.

**Every track header is filled with that track's own Live color**, group tracks
included, and grouping reads as a colored rule along the top of the columns in a run,
capped where the run starts. Both halves are load-bearing and the fills are the half
that took two tries: with only the group's color painted, a group read as a track
sitting *beside* its members rather than containing them. The band says how far the
group reaches; the fills underneath say these are tracks. `inkOn` picks the label's
black or white per swatch, because Live's palette runs from near-black to near-white
and no single text color survives it.

The rule used to be a header row of spanning cells carrying the group's name; a group
track carries its own name now, so that row was repeating a word the column already had.
Nesting falls out of it — a group inside another opens its own run, in its own color.

The band is deliberately heavy — 5px, and on the top edge only — because a group and its
tracks are usually near-neighbours in Live's palette, a green group over light-green
tracks, and a hairline rule lost that argument every time. It briefly closed at the
bottom too, to bracket the run; that reads as the group's color leaking down the sides
of every track rather than as one bar over all of them. The header grew to fit rather
than the label shrinking; 9px uppercase mono is already the floor. `--band-w`,
`--label-h` and `--header-h` are written as one calculation in `ClipGrid.css`, and the
padding that produces the height is written from the same variables, so the two can't
drift.

A group track also wears **Live's circled chevron**, pinned to the right edge of the
header the way Live places it, with the name reading from the left. The ring is the part
that matters: a plain chevron reads as an ordinary disclosure arrow, and the badge is
what makes group tracks findable at a glance down the header row. Pinning it also holds
it at one position per column rather than letting it drift with the length of the name.

The label takes the slack (`flex: 1`) rather than the line using `space-between`, so it
is both the thing that grows and the thing that shrinks — a long group name ellipsises
against the badge instead of shoving it out of the cell.

**The band is one unbroken bar**, the way Live draws it, which means crossing the 2px
`border-spacing` gaps between headers. An inset shadow stops at the cell edge, so each
column in a run reaches back over the gap to its left with a pseudo-element.

Reaching *left* is what makes that work without knowing where a run ends. Sibling cells
paint in document order, so the later cell's bridge lands on the shared gutter after the
earlier cell's `--bg` plug has covered it; reaching right would be painted over. The
right end of a run then needs no rule at all — whatever follows is either unbanded or
starts its own run, and neither reaches back. That's the whole job of `startsBand`, and
why there's no `endsBand` to go with it.

It costs the `th` its `overflow: hidden` (the bridge has to escape the cell), so clipping
moved onto `.th-label` inside a flex `.th-line` — the only thing that ever needed it.

**Under the band, a member's header is held off it by the gutter.** When a group and its
tracks are near-neighbours in the palette, the band and the fill below meet as one field
of green and the bar stops reading as a bar. What separates them is the same 2px of
background that separates every other pair of cells in the grid — no new border and no
shadow, just `--gutter`, drawn by hand here because it falls *inside* a cell rather than
between two.

The group's own column never gets it, and that's the whole point of the rule: its band
is the top of its own header, in its own color, so the group track reads as one
continuous shape whose header extends across everything it holds. A nested group is a
group here too — it keeps its shape over its own run.

`--gutter` is named rather than written as `2px` in nine places. It's the grid's one
separator: no cell in the body has a border, so anything that needs to divide two things
is this gap at this width. `border-spacing` produces it between cells, the header's plug
shadows paint into it, and the band's gutter draws it.

**Play state on a header is a bar down the left edge, not the text color** — the same
language the clip cells use for the same fact. Once the header carries the track's own
fill, a green *word* on a green track says nothing, and overriding the label color
throws away the contrast `inkOn` just chose.

The layout lives in [`core/src/trackColumns.ts`](https://github.com/openflowfm/core/blob/main/docs/trackColumns.md) and what a group
slot shows in [`core/src/groupSlot.ts`](https://github.com/openflowfm/core/blob/main/docs/groupSlot.md), both with tests — nesting,
ancestry and "which clip is first" are exactly the kind of logic that breaks quietly.

**None of this costs the snapshot anything.** The LOM does expose group slots directly
(`ClipSlot.controls_other_clips` and the slot's own `color`), but only per slot, which
is trackCount × sceneCount reads for something the clips already answer. Firing is the
one thing that goes to Live, and it needs no new message: `launch` addresses a *slot*,
not a clip, so a group slot fires over the path that was already there.

**Folding writes back to Live** (`setFold` → `fold_state`), so the grid and the Session
view agree and a fold survives the next snapshot. The write is fire-and-forget: the
columns move before Live is told, because waiting a round trip to redraw a fold you just
clicked is the one thing that would feel slow.

**Which group is folded is read off the snapshot, and `setFold` patches the track row it
writes.** Writing back is not on its own enough to make that safe, and believing it was
is what left the grid disagreeing with Live: `fold_state` has no `observe`, so nothing
ever told the row we hold that it had moved, and the folded set used to be *mirrored*
into its own state and re-seeded on every snapshot. A write reconciles into a new
snapshot object, so any write at all — tagging a scene from the role menu is the one
that found it — re-seeded from track rows last read before the fold and quietly reopened
the group while Live kept it shut. Patching the row at the point of the write leaves one
copy of the answer, and the grid derives from it.

Selection is deliberately left alone when a group collapses: hidden clips stay
selected and still apply. Collapsing is about what you're looking at, not what you've
picked — but it does mean the `Selected` count can exceed what's on screen. A group
column is never selectable and the arrow keys step over it, for the same reason its
slots can't be named or colored: there is no clip there.
