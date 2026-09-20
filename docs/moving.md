# Moving scenes and clips

The two drag grips, the move plan, the drop indicator and its cost line, and why this is the one gesture with no undo.

## Rearranging songs and scenes

**Drag a song header to move that whole run of scenes**, or **a scene by its number to
move that scene**. An amber line shows where it lands, and on a header the line carries
the cost — `10 scenes · 84 clips copied · 10 deleted`.

One gesture, two grips, and one plan underneath: `planSceneMove` has always taken a set
of scene indexes and a destination gap, and a set of one is a scene. Nothing in `core/`
or the bridge changed to add the second grip.

**The scene number is the grip, not the row.** The row already means "select" and ⇧
already means "extend", so making the whole row the handle would have one gesture
stealing from the other. The number is inert, holds a fixed x down the column, and is
the one part of a row that names the thing being changed. Clicking it still selects — a
drag and a click are different gestures.

**Dragging a scene that's part of a selection moves the whole selection**, including a
non-contiguous one, which the planner already supported. Dragging a scene outside the
selection moves just that scene. App decides which, reading the selection through a ref
so the callback keeps one identity: it's a prop on 848 memoized rows, and rebuilding it
on every selection change would re-render all of them for a value only the drag reads.

This is the only gesture in the app that can destroy work, and four decisions follow from
that:

- **A drag moves one block, not one song.** A song is a label rather than a range, so it
  can appear in several runs, each with its own header — dragging "part 2 of 2" moves the
  part you grabbed. Gathering both runs is something `planSceneMove` supports and
  something you can do by dragging one next to the other; doing it as a side effect of
  grabbing one header would move sixty scenes nobody pointed at.
- **The cost is on the drop line, not in the log.** There's no undo for this on our side,
  so what's about to happen has to be readable while the mouse button is still down. A log
  line afterwards is too late to be a decision.
- **Dropping a song back where it already is does nothing at all** — `planSceneMove`
  returns `null` rather than an empty plan, and the indicator doesn't draw. That's how most
  drags end, and the cheapest way to never delete a scene by accident is to not run.
- **The drop clears the selection and the undo entry.** Every `(track, scene)` address
  just came to mean a different row, so keeping either would leave the rail offering to
  rename scenes you never picked.

A folded song is draggable, which is the point of folding: **Fold songs**, then reorder a
hundred-song set as a table of contents.

Two things in here are load-bearing for performance, and they're the same trap as `Row`:

- **`onSongDrop` reads the plan from a ref.** Closing over it would give the callback a new
  identity every time the drop gap changes — every time the pointer crosses a boundary —
  and re-render all hundred headers mid-drag.
- **`dragover` sets state through an identity bail-out.** It fires continuously for the
  whole drag; returning `prev` unchanged when the gap hasn't moved lets React skip the
  render entirely.

The drop edge is resolved *toward `above`*, because a gap between two adjacent songs is
addressable from both sides — a song ending at scene 5 and the next starting at 6 are both
"gap 6". `below` therefore only renders where no header begins, which is the tail of the
set and the one gap `above` can't express.

What it costs in Live, and the four passes it runs, is in
[`bridge/README.md`](https://github.com/openflowfm/bridge/blob/main/README.md) under *Reordering scenes*. **It is unverified
against a real set.**

## Dragging clips

**Drag a clip to move it**, or drag one that's part of a selection to move the whole
block. The clips you picked up dim; the slots they'd land on take a dashed amber
outline — the same amber as selection and the scene drop line, because the grid has one
color for "what your gesture is about to act on".

**It overwrites, like Live.** The outline is drawn over whatever is already in the target,
including the clip about to be replaced, which is why it's an outline and not a fill.

The ordering, the refusals and what gets cleared afterwards all live in
[`core/src/clipMove.ts`](https://github.com/openflowfm/core/blob/main/docs/clipMove.md). Two things belong here:

- **An invalid drop draws nothing and does nothing.** `planClipMove` returns `null` for
  the whole drag if any clip would land off the grid, on a group track, or on a track of
  the other type — so a bad drop has no indicator to follow and no plan to run.
- **The two drags don't talk to each other.** `dragover` bubbles, so a clip crossing the
  grid passes over the rows and a scene crossing it passes over the cells. Each hook
  holds a `draggingRef` and ignores events that aren't its own; without it, dragging a
  clip would drive the scene drop indicator at the same time.

`lifting` and `landing` reach the rows as `|3|7|` strings per scene, the same shape as
`RowMarks` and for the same reason. `landing` is rebuilt every time the pointer crosses a
cell, so as a `Set` prop it would re-render all 848 rows several times a second; per
scene, only the rows that gained or lost a mark change.
