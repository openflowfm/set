# Bulk workflows

The set-wide song controls: the running order and coloring by rule — draft, preview, one write.

## Set-wide song controls

The metadata column is headed **Songs** on the left. On the right, order, color and Add
share one Live Set group in that order. The app-only song-index and fold toggles live
together in the main header's first button group after the logo.

**That heading spans the metadata and Master columns both**, and is filled with **Live's
Master track color** the way every other column header is filled with its own track's.
Master lives outside `Song.tracks`, so the snapshot carries its RGB separately and
`inkOn()` chooses black or white text exactly as it does for ordinary track headers. The
action group stays transparent and takes that same ink choice for its icons rather than
laying a second surface over the Master color. If Master's color can't be read, the cell
keeps the neutral app surface. A fixed Master color observer updates it after a recolor in
Live without requiring a full snapshot.

One heading rather than two is what makes the two columns read as a section — Live's
Master track and the app's own facts about a scene, together at the set's left edge —
and it is also what lets the metadata column be as narrow as its rows need. A heading of
its own would have held it to the width of a label and three buttons.

Nothing in it spells out that Master is in there. The strip at the foot of that column and
the scene launchers down it say so already, and a word would only repeat them.

The running-order and coloring workflows work the same way: a draft you can push around
for free, a preview of exactly what will be written, and one button that writes it. That
shape is the point of them. Doing either through the grid is one write per song, each
with its own round trip and re-snapshot, and the waiting is what stops anyone *trying* an
arrangement.

### The running order

**Build a sort hierarchy or drag songs into the order you want, then Apply.** A hierarchy
can use Name, Tag, Key and BPM once each, in any priority order and ascending or descending:
`Tag ↑ → Key ↑ → BPM ↓ → Name ↑`. Each level only breaks ties in the level above it;
missing metadata stays at the end, and songs still tied after the last level retain their
current set order. Dragging or nudging a sorted result turns it into a manual draft and
clears the rules, so the controls never claim a hand-tuned order still came from them.

There is one row per song, however many runs it has, because a running order is written in
songs — and that has two consequences the modal has to say out loud rather than spring on
you:

- **Applying gathers a song found in more than one run.** The row says `2 runs → 1` and a
  line under the list names the songs it will collect. A reprise stops being a reprise,
  which is a real change to the set that nobody dragged.
- **A scene the pattern couldn't read isn't in the list**, so it travels with the song it
  currently sits after; above the first song it stays at the top. The alternative — pinning
  it to the index it holds now — cuts a song in half the moment the songs above it change
  length. The count is shown, per row and in total.

Everything else follows the drag in the grid. The cost is stated before it runs
(`18 scenes · 142 clips copied · 18 deleted`), the no-undo warning is permanent rather
than conditional, and applying **closes the modal and clears the selection**, because every
scene index is about to mean a different row.

It is one plan and one `move` message, not a move per song. Live's undo grouping is
per-message, a half-applied order is the worst state this app can leave a set in, and
`planSceneReorder` is what makes one plan possible — see [`core/docs/sceneMove.md`](https://github.com/openflowfm/core/blob/main/docs/sceneMove.md).

### Coloring by rule

**A song is one color**, and which color is only worth deciding across the whole set:
*by key* the bands say what will mix into what, *by bpm* they say where the set changes
gear. *rainbow* and *random* say nothing and are for when you just need a hundred songs
told apart. The rules are pure functions in core; this modal is the preview and the
allowed colors.

- **Which of Live's 70 colors a rule may use is set-owned device state.** It is stored
  beside the role vocabulary in a hidden Max parameter, so Save, Save As, presets and
  moving the `.als` carry it without a sidecar file. Eight chosen colors read
  better across a hundred songs than seventy: several of Live's are hard to tell apart at
  the size a scene row draws them. `null` means "whatever the palette holds" and is
  deliberately not the same as a list of all 70 — a Live that shipped more colors should
  hand them to someone who never chose, and not to someone who did.
- **A song the rule can't answer for is left alone**, and named. No key means no color
  here, not "the no-key color" — painting a song by a fact nobody wrote down is how a
  color stops meaning anything. A song whose scenes *disagree* about the fact counts as
  not stating it, for the same reason the header renders the clash instead of picking.
- **The count on the button is scenes, not songs.** A song already carrying its color
  writes nothing, so applying the same rule twice says `every song already carries its
  color` rather than claiming a hundred writes.
- **It stays open after applying**, unlike the reorder: the write is undoable, the scene
  indexes still mean what they meant, and trying a second rule against what the first did
  is the point of having four. The preview repaints itself off the re-snapshot.
- **`random` takes a seed, and *roll again* is a different seed** rather than a different
  function. The preview and the write have to be the same deal, and colors are dealt from
  a shuffled bag so every allowed color is used before any repeats and no two songs in a
  row match. Independent draws clump, and a clump is precisely what the band prevents.
