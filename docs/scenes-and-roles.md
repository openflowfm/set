# Scenes: titles and roles

The rail’s scene panel, the four title fields and their touched-field rule, the role vocabulary, and the role menu on a chip.

## Scenes: title and role

The rail is `<aside>` (`Rail.tsx`), holding `ScenePanel` above `Inspector` — scenes first,
because naming a song and tagging its roles is the pass you make before touching
individual clips, and the swatch grid below is the fallback for everything a role
doesn't cover.

A scene name is `[ROLE] @{bpm}-{key} {SONG} - {ARTIST} {TAG}` —
`[CHORUS] @128-Bm NIGHTFALL - THE AVIATORS {COVER}`. Artist, tag, bpm and key are all
optional; `COVER`, `ORIGINAL` and `JAM` are tag suggestions rather than a fixed
vocabulary. The `-` joining bpm and key drops with either of them, so `@128`, `@Bm` and
`@128-Bm` are one shape. The panel edits all five pieces and they **commit differently, on
purpose**: a role writes on click, a title edit and the tempo projection each have their
own button. See below for why.

**Role and facts first, name next, song tag last.** Live's own scene column is narrow, so
the performance metadata stays visible while the app-only tag truncates first; here it
doesn't, because the grid lifts every field into its own presentation. Why the facts have distinct delimiters is in
[`core/docs/sceneTitle.md`](https://github.com/openflowfm/core/blob/main/docs/sceneTitle.md).

**BPM and key lead the rendered metadata**, both read from the name and shown without the
storage-only `@`. A scene whose name states no bpm falls back to its own `Scene.tempo`,
which is the migration path for a set written before the bpm went back in the name — the
same fallback `useSceneTitles` uses to prefill the field. Both use the same fixed-width,
right-aligned slots as song headers, and the scene number keeps a fixed width beside them,
so every kind of fact reads as one vertical column down the grid. The song name is not
repeated on each scene: the header already owns it, and every child scene necessarily
belongs to that same song.

**The role is not in that column at all.** It has one of its own — the Master column,
where Live keeps the scene launchers — and its cell *is* the role: the color paints the
cell edge to edge exactly as a clip's color paints its own, with the ▶ recessed on top of
it in the same 14px strip a clip launcher uses. A role is what that scene is, in the same
sense a clip is what a track plays there, so it reads as a column of slots with something
in them rather than as an annotation hanging off a strip of numbers.

An inset pill on a dark cell was the same information in the wrong shape. It read as a
label about the row; the cell reads as a thing the row contains.

**The song tag is on the header and nowhere else.** It classifies the *song*, so every
scene of a song carries the same one by construction — a column of identical pills spends
grid width restating what the header already says once, and a fact repeated on every row
stops being read at all. The header keeps the inverted pill: transparent fill, outline and
text in the song's own color, so `COVER` / `ORIGINAL` reads as song metadata rather than
as a second role. The role chip stays the solid structural marker, and it stays on the
row, because that one really does differ from scene to scene.

The scene's own color left with it. That color reached the grid only as the pill's ink,
and the song's color is on the header already — as the wash and the bar down its left
edge — with `mixed color` there for the one case worth seeing, which is a scene that
disagrees with the song it belongs to.

- **One width for every role.** `[JAM1]` weighs the same as `[PRACTICE]`, which it does.
  Longer names ellipsis and the tooltip spells them out.
- **That width is its column's**, so it moves with the S/M/L/Auto/8/16 setting exactly as
  a clip does. It had a constant of its own once, sized to nine characters, which is what
  a chip parked at the end of a metadata strip needs; a column asks a different question,
  and the answer has to be the same one the clips beside it are giving.
- **A scene with no role says `NONE`** on the app's ordinary cell surface — the same
  ground an empty clip slot takes, which is what an untagged scene is. Its launcher goes
  bare and dim with it, like an empty slot's button, because there is no color under it to
  recess into. Not dashed: a dashed cell already means something else here, a role that
  exists and has no color.
- **The label is a `<button>`**, real role and `NONE` alike — it opens the role menu
  below. That means undoing the global button rule in `td.scene-role .role-chip`, and it
  means an untagged scene is one click from a role rather than a trip to the rail. The
  menu's own clear-this item still reads `no role`, because there it is an action rather
  than a state.
- **The launcher strip stays cell, not button**, so there is somewhere on a colored scene
  to click that still means "select" — exactly as there is on a clip. `stopPropagation` on
  the label is what keeps opening the menu from also being a selection, and the metadata
  column is the roomy half of the select target, which is the right way round: selecting
  is the frequent gesture, changing a role is the deliberate one.

An existing set named the old way (`Nightfall 128 Bm [chorus]`) still shows its songs —
derivation reads both conventions, and any rename converts a scene. See *Reading more
than one convention* in [`core/docs/namePattern.md`](https://github.com/openflowfm/core/blob/main/docs/namePattern.md#reading-more-than-one-convention).

### The title fields

Four fields, and the rule is **a field you leave alone stays as it is on each scene; a
field you clear is cleared.** That's what makes "select two songs, set one shared key"
work without flattening their different names. It can't come from the value alone —
blank means "these scenes disagree" on arrival and "delete this part" once you've
deleted it — so `useSceneTitles` holds a `TitlePatch` of which fields have been
*touched*, reset whenever the selection changes. The preview line is what makes the rule legible; keep it.

All five prefill from `commonTitle` — **the name is the record** — and BPM falls back
per scene to `Scene.tempo` for a set that hasn't been renamed yet. A mixed field shows a
`mixed` placeholder rather than one scene's answer. Tag, BPM and key are validated inline,
and all three now block **Rename**, because all three are written into the name.

That fallback is also offered as a *pending* patch, exactly like the default artist: when
every selected scene's name states no bpm but they all carry the same `Scene.tempo`, the
field arrives filled and the rename writes it. Showing 128 in a field the rename would
then drop is the one thing the preview line exists to prevent.

**The tempo projection is song-scoped, not selection-scoped** — the same rule as the color
swatch. `songTempoOps` writes each touched song's first scene and clears the rest of that
song, reprise included; with the field untouched each song uses its own stated bpm, so
selecting the whole set and pressing once is what converts it.

### Roles

The gesture is **click a scene name, click a role, click Color clips.** The role is
written to the front of the scene's own name as `[ROLE]` (see
[`core/docs/roles.md`](https://github.com/openflowfm/core/blob/main/docs/roles.md) for why the set is the storage), and the grid shows
the title with the tag lifted out into a colored chip — so Live holds
`[CHORUS] @Bm NIGHTFALL {COVER}` and we render `Bm · CHORUS · COVER` beneath the song header.

**Clicking a role writes immediately, which only looks like it breaks the rule above.**
That rule exists because a rename overwrites a name you can no longer see. A role tag is
additive — it goes on the front, the rest of the name is untouched — and the result is
visible as a chip the moment it lands. There's nothing to preview. A *title* edit does
overwrite, which is why that half keeps its preview and its button.

### The role menu

Clicking a chip in the grid — a role or the `no role` placeholder — opens `RoleMenu` on
it. The rail can do this already; this exists anyway because tagging is a
scene-at-a-time pass down the grid, and routing every one through the rail means picking
the row, looking away, and coming back. Here the chip you're reading is the chip you
press. It writes on click, like the rail's chips and for the same reason.

- **Scope is the chip's own scene, unless that scene is already in the scene selection**
  — then it's the whole selection, because that's the pass you're in the middle of.
  Worked out at render from the selection as it stands, not captured when the menu opens.
  The header says the count out loud either way, so it's never inferred from the chip.
- **`onRoleMenu` is identity-stable and the menu renders in `App`,** not in `Row`.
  Opening a menu must not re-render 848 memoized rows — same rule as `active` and the
  drag plan. The chip passes its own bounding box up, because it's the only thing that
  knows where it landed.
- **Positioned against the viewport**, measured in `useLayoutEffect`, flipping above the
  chip near the bottom of the window. It closes on scroll and resize (capture phase — a
  scroll inside `.grid-wrap` doesn't bubble) rather than drifting off the row it points at.
- **The backdrop is a transparent full-screen div**, not a document click listener: it
  eats the dismissing click, so closing the menu can't also fire a scene or move the
  selection. Esc and the arrows are swallowed in capture phase, ahead of `App`'s window
  listener — otherwise Esc would also stop every clip in Live.
- **Manage roles… opens `SetConfigModal`**, which is why that modal is owned by `App`
  rather than by the rail: the header and two contextual role controls reach it, and the
  rail can be shut.

**Scene selection is separate state from clip selection**, and can't be derived from it: a
scene with no clips contributes no cells and still needs to be assignable a role. It's set
only by the scene-name column and cleared by a clip click, so "which scenes am I about to
tag" is never a guess. Selected scene rows get an amber left edge.

**Color clips uses each scene's own role**, so one press works across a selection spanning
several roles. It's the only thing role color writes: scene rows carry the *song's* color,
and painting them per role would break the band — see *A song is one color* above.

The vocabulary comes from the device state saved in the `.als`, unioned with every role
actually tagged in the set (`mergeVocabulary`). A role typed straight into Live shows up in the manager uncolored
rather than being invisible until it mysteriously colors nothing. Deleting a role only
forgets its color — the scenes keep their tags, so it reappears uncolored, and the manager
says so.

One wart worth knowing: **undo can't take a scene color back off.** Live has no writable
"no color", so a scene that had none can't be restored to none. `useBridge` logs a line
saying so rather than letting the undo button promise more than it delivers.

`roleColors` is memoized in `useVocabulary` because it reaches the memoized `Row`; a
fresh Map per render would re-render all 848 scenes. It changes only when the
vocabulary or palette does, which is rare.

### Set configuration and the default artist

The gear in the header opens `SetConfigModal`: one set-owned form for the default artist
and the role definitions with their clip colors. The existing **Manage…** role entry
points open the same modal rather than maintaining a second vocabulary editor. Saving
writes one `saveSetConfig` request, so the default and definitions shown together are the
revision persisted together.

The default artist is a **seed, not an authoritative song fact**. New Song starts with it;
the rail offers it as a pending patch only when every selected scene has a blank artist.
A real or mixed artist always wins, and deleting the pending seed is an explicit empty
patch, so it does not spring back. **Use default** is the deliberate shortcut for a
selection that already says something else. Every path still waits for Rename before it
touches a scene name.

**Save & fill N songs** is the set-wide counterpart. `planDefaultArtist` fills all scenes
of an artistless song and blank scenes of a song already stating the default. A blank in a
song that names a different or conflicting artist is reported and left alone; filling it
would create a disagreement. Unmapped scenes are outside the plan because the naming
convention cannot express an artist without a song. The resulting scene batch is one
ordinary, undoable rename and preserves roles, keys and song tags through `titleOps`.
