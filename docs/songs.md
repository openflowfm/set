# Songs, headers and folding

Song blocks, the header row and what it carries folded, working on a whole song, and how the mapping reads back.

## Working on a whole song

Clicking a **song title** in a header selects every scene of that song, across all its
blocks, and unfolds it first — offering to rename eighteen rows you can't see is exactly
the kind of write the pending-changes idea exists to prevent. The rest of the header row
folds; only the title selects, because folding is the frequent navigation gesture and
"work on this song" is the deliberate one.

From there the rail does the three things at song scale:

- **Rename** — the song/artist/tag/bpm/key fields, which prefill from what the song
  already agrees on. The bpm is part of the name now, and writing it changes nothing about
  playback — unless the set has turned on **Song start tempo** in set configuration, in
  which case Rename also does what the button below does. That is an opt-in stored in the
  set (`DeviceState.writeSceneTempo`) and off by default, because a rename that quietly
  changes how the set plays should be a decision someone made rather than the default.
  When it is on, the two travel as **one batch** — `mergeSceneOps` in `core/` folds them,
  since the song's first scene is usually in both lists and writing it twice would undo in
  halves and break the `applied === total` check a patched snapshot depends on. The
  panel's hint says so, and the log line names it.
- **Apply tempo to song start** — writes Live's own `Scene.tempo` on the song's **first**
  scene and clears it off every other scene of the song. It is deliberately *not* part of
  Rename: everything else in the panel changes what a scene is called; this changes what
  the set does, since Live takes a scene's tempo the moment it fires. Folding it into a
  rename would make a naming pass silently alter playback.

  First scene only is the point rather than an economy. With the tempo on every scene, a
  128 song could only ever be *entered* at 128 — dropping into its second chorus while the
  set ran at 124 snapped everything. One scene carries it; the rest follow whatever is
  playing. The clearing half is also how a set written the every-scene way converts, song
  by song, which is why the button reads `tempoScenes` rather than only writing one scene.

  With the bpm field empty the button becomes **Clear tempo on N scenes** — the way back
  out. With more than one song selected it becomes **Apply tempo to N song starts**, and
  each song uses its own stated bpm unless the field says otherwise.
- **Song color** — a swatch grid that paints the scene rows themselves, so a song becomes
  a band of color in Live's own session view. Writes on click, like the clip swatches.

The **hamburger in the first button group after the logo** folds or unfolds every song at
once. It shares that app-only display group with the song-index toggle.

## Song headers, and folding

Each song block gets a **header row of its own** above its first scene, which is what
actually segments the grid. It carries **no border at all**. It began as a 1px light rule
along the top, which is how you draw a bevel — and once a folded header became several
cells the table's 2px `border-spacing` chopped that highlight into a segment over each one,
so the row read as raised tiles. Repainting the rule in the page's own color fixed the
bevel but left the header in a 5px gutter where every other gap in the grid is 2px, and one
axis spaced differently from the other is its own kind of depth cue. So the separator is
`border-spacing` and nothing else: every gutter in the table, both axes, is the same 2px.
What sets a header apart is its own surface — `--rail` against the clip cells' lighter
fill, the song's wash, and the bar down its left edge. **Surfaces, not edges.**
Clicking one folds the song to just that header. A hundred songs fold to a hundred rows,
which is the point: the hamburger beside the logo turns the whole set into
a table of contents. The songs modal exposes the same operation as **Collapse all**.

Three things about it are load-bearing:

- **Folding is keyed by song, not by scene index**, so it survives a re-snapshot. Writes
  patch the snapshot now rather than re-walking, but a re-snapshot still happens — every
  scene move, and every write Live didn't take in full — and a fold state that reset then
  would make the grid useless during a mapping pass. **Unlike collapsing a track group,
  this never writes to Live** — a song is ours and Live has no idea what one is, where a
  group's fold state is `fold_state` on a real track. That's why this one is state and
  the other is read straight off the snapshot; see `useTrackColumns`.
- **`rows` replaces `sceneCount` everywhere movement or selection happens.**
  `useSongLayout` computes it from `songRows`, and `App` threads it into
  `moveActive` and `cellsInBlock` exactly as it threads `trackColumns`. Without that, `⌘↓` walks into folded scenes and fires
  them — see [`core/docs/songRows.md`](https://github.com/openflowfm/core/blob/main/docs/songRows.md).
- **`SongHeaderRow` is memoized on primitives**, for the same reason `Row` is. There can
  be a hundred of them and they must not all re-render because one song folded.

A song in more than one block says `part 2 of 2` rather than being silently merged, and
a song whose scenes disagree about a fact shows the clash in amber. Both are the grid
telling you something the library will later have to arbitrate.

### One shape, split where every other row is

```
  ▾ NIGHTFALL  THE AVIATORS   │                                            │
    128  Bm  {COVER}             │          (the band, open)                  │

  ▸ GLASS TUNNEL  SUN & STEEL   │  ■■  │      │ ■■■■ │  ■                     │
    124  F#m  {JAM}  2/2         └ the sections each track plays ───────────┘
  └─ metadata + Master ───────┘
```

**The header splits at the Master section's edge, the same place every other row
splits.** One cell over the metadata and Master columns holds the song's identity; the
track region beside it is one band when the song is open and one tile per track column
when it's folded. That boundary running unbroken from the heading down through the footer
is what makes the two left columns read as a section rather than as two columns that
happen to be adjacent.

It spanned the entire table for a while, on the reasoning that a header segments the grid
so nothing should sit beside it. What that actually did was erase the section's edge on
every header row — the one row in the grid where you most want to see where the clips
begin.

**Open and folded are laid out identically.** A header shouldn't move when a song folds,
and there is no longer a reason for it to: folded, the Master column has no roles to show,
so the identity has the same width either way.

**The identity is two lines**, because the segment is narrower than a song name. They
split by what the fields *are* rather than by importance:

- **The top line is the free text** — the song name, and the artist beside it when the set
  names one. They can take space off each other, and the artist gives way three times as
  fast, because the name is what a list of these is read by. Both ellipsis.
- **The bottom line is everything of fixed width** — bpm and key in the same slots the
  scene rows use, so a song's bpm sits directly above its scenes' and a column of headers
  lines up; then the tag, then `2/2` where a song appears in more than one run.
- **Both fit the row's existing height**, 14 and 14 inside 36, so a folded set is no
  taller for having two lines.

Putting the artist on the bottom line with the facts was the obvious arrangement and the
wrong one: between the key and the tag it had about 26px, which renders `THE …` and
nothing else. A field that can only show its first word is worse than one that isn't there.

- **Every slot keeps its width whether or not the song fills it.** A song that states
  neither fact shows `---` and `--` rather than a gap: an empty slot reads as a rendering
  fault, where a dash says the set never named one — which is a thing to go and fix.
  Dimmer than any real value, and it stays dim under a clash, because nothing said is not
  the same as two scenes disagreeing.
- **The lead slot matches the scene number below it.** The collapse icon sits on the
  scene-number guide, so the caret, the numbers and the facts are three columns down the
  whole grid. BPM comes before key to keep the numeric tempo column on the outside, and
  both are right-aligned: `94` and `128` are the same fact at different widths.
- **No scene count.** A set built to a house length says the same number a hundred times,
  and the block's size is legible from the rows it spans anyway. It survives as the fill
  tiles' denominator and in their tooltips.
- **`mixed color` and the drop note live in the track region**, not beside the name. Both
  are things you have to *act* on rather than facts about the song, and the band has room
  for the drop note, which is the only warning before the one write no undo of ours can
  reverse. Folded, they take the tile region for as long as they're there.
- **Only the folded shape can carry tiles**, because only real cells land under the
  columns they describe.

**Flex lives on a wrapper `div`, never on the `td`.** `display: flex` on a table cell
stops it being a table cell and takes the grid's fixed layout down with it.

### One row, not two

The content strip used to be a **second table row** under the header. It isn't, because it
never needed to be: a folded header's lead cell has room for the name *and* the shape, and
the track columns to its right were empty. Merging them halved the height of a folded set.
That is a different thing from the identity's two text lines, which live inside the one
row and inside its existing height.

What survived from that merge:

- **The left edge is a `::before`.** A folded header is several cells wide, so a background
  gradient would repeat the bar at the left of every tile and a `box-shadow` would draw it
  down the whole row. That turned out to be a simplification: the bar used to be a
  background layer and a box-shadow taking turns, with a comment warning that source order
  was load-bearing and a stray `:not()` would silently take the drop line off folded rows.
  Now the bar owns `::before`, the wash owns `background`, and the drop indicators own
  `box-shadow` — three jobs, three properties, no ordering.

### The height budget, and two rules that need their order

`SongHeaderRow.css` explains nothing about itself — none of the grid's stylesheets do —
so the parts of it that aren't self-evident live here.

**Every header is 36px**, and that number is a floor rather than a preference: it's what a
folded row needs for its miniature scene sequence. A collapsed set is a list of nothing
else, so a row that grew a line for some songs would cost both density and a straight edge
to read down. Both text lines have to fit inside that floor, which is why their heights
are *stated* instead of left to the font: `--song-name-line` at 14px over
`--song-meta-line` at 14px is exactly the 36px row less its 4px of padding top and bottom.
`--song-text-h` caps the pair at that same sum, so a font that renders taller than its line
box — or a third line added here later — clips rather than reopening every row in the set.
The tag chip is what sets the second line at 14 rather than 10: it is 12px of text inside a
1px outline, and a line too short for it would push the row open.

**Two of the facts rules tie on specificity and are resolved by source order.** `.facts
.key` dims itself, so `.facts.clash .key` has to come after it or a disagreement would
never turn amber. And `.bpm.none` has to come after `.clash` in turn, or a song stating no
bpm beside a key its scenes disagree about would be painted as though the bpm disagreed
too. Nothing said is not the same as two scenes saying different things.

### What a folded song holds, track by track

Each track column of a folded header carries **one small square per section that track
plays** — the sparkle pad marked chorus and jam, the trance pad marked practice, intro,
ending. Folded, a song otherwise tells you what it's *called*; this tells you what's *in*
it, and at which point of the song, which is the question you're actually asking when
you're choosing what to blend into next.

It replaced a density bar — one bar per column, opacity by how much of the song that track
covered. That answered "is this track used", which turned out to be the smaller half of
the question, and it could never answer the other half.

It works because the marks are **in the track columns**, not merely near them, and the
track-name row is sticky: scroll a fully-folded set and every mark still has its track
named above it. `blockTrackRoles` in core does the counting; `useSongLayout`
memoizes it against the *songs*, not against `collapsedSongs`, so folding one
song doesn't rebuild the map and hand all hundred headers a new prop. It reads the clips,
which is why it stays in the browser rather than riding along on the bridge's `SetModel` —
see [`core/docs/setModel.md`](https://github.com/openflowfm/core/blob/main/docs/setModel.md).

- **Color only, names on the cell's tooltip.** A hundred folded songs are a page of color
  signatures, and at that density a word per role is what turns a table of contents into a
  wall of text. The vocabulary's colors are already doing the naming — that's what they're
  for. Named chips still belong beside a *scene* name, where there's one role and room to
  spell it.
- **Dimmed to 60%, up to 90% on row hover.** These are a signature to recognise, not a
  label to read, and at full strength a row of saturated palette colors shouts louder than
  the song name beside it.
- **Deduped, in first-appearance order, and never numbered.** `VERSE CHORUS VERSE CHORUS`
  is the arrangement, not the shape. The per-role scene count is in the tooltip, where
  reading it is a decision rather than a tax on every glance.
- **Clips on untagged scenes get a neutral grey mark**, not nothing. A set mid-mapping is
  mostly untagged, and a track used only there still has to read as used or the header
  lies about what the song holds. Grey rather than the song's own color, so an unmapped
  track can't look like it was given a section.
- **Centred in the column**, matching the track name in the sticky row above, so a column
  of marks reads as belonging to it. An empty column draws nothing at all: an absence
  answers faster than a faint presence does.
- **9px, square, 2px apart, 2px corners** — the grid's own spacing, so a folded row reads
  as one language of tiles left to right. An uncolored role is hollow rather than dashed:
  at 9px a dashed edge is mush.
- **A folded track group shows the union of its members**, via `mergeShapes`, and counts
  in tracks rather than scenes — "3 of 5 used" — the same stand-in a folded clip cell
  already shows, because the column stands for several tracks.

There is no aggregate run of marks beside the song title. Once each track says which
sections it plays, a second copy of the same vocabulary next to the name is the crowding
without the information — and dropping it gives the name the rest of the lead cell.

## Songs, and the mapping read back

The **Songs** and **Unmapped** tiles in the status strip are derived, not stored — every
snapshot re-reads the scene names through the scene pattern and works out which song each
scene belongs to (see [`core/docs/derive.md`](https://github.com/openflowfm/core/blob/main/docs/derive.md)). Clicking either opens
`SongsModal`, and clicking a song there selects its scenes.

**The modal is read-only on purpose.** Its job is to answer "does derivation work on a
real set" before anything is built on top of it, and it can't give a misleading answer if
it has nothing to write with.

Two things it deliberately does not smooth over. A song whose scenes **disagree** about a
fact shows every value in amber rather than picking one — the library arbitrates that
later, and showing one value as though it were the answer is how drift hides. And a song
found in **more than one block** gets a flag rather than an error, because a song is a
label rather than a range: two blocks is a reprise, or it's two different songs sharing a
name, and only you know which.

The current scene pattern and three compatibility patterns are compiled once at module scope in
`useSongLayout`. The `!` is safe there and nowhere else — tests in
`namePattern.test.ts` hold those constants down. They become editable when the scheme
file lands.
