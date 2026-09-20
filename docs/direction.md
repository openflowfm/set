# The design this is built toward

Where the project is headed, and the decisions that shape it. Read this before changing
how the naming convention, the library/scheme/mapping split, or derivation works — not
for routine feature work.

Beyond the set-management design below, open[flow] is intended to grow into a
programmable music production and performance system, with reusable graph devices,
customizable interfaces, songs and parts, improvisation and flexible scheduling.
The planned rendering foundation is [audio[flow]](https://github.com/openflowfm/audio),
a headless Rust library whose first consumer would be mix[flow]. Its design docs
and comparison harness live in the separate `openflow/audio` repository;
engine implementation remains paused.


MVP was set management: bulk naming and coloring, with clip and scene launching so you can
hear what you're labelling. That works — but every convention it applies still lives in
someone's head and gets re-typed per selection.

The direction is to define the conventions **outside** the current state of the set, map
the set against them once, and thereafter re-derive the mapping by reversing the naming
convention.

```
library (songs)              ─┐
scheme  (patterns, rules)    ─┼─→ desired state ──┐
mapping (scene → song, role) ─┘                   ├→ diff → apply
snapshot (what Live holds) ───────────────────────┘
                 ↑                           │
                 └──── re-derived by reversing ────┘
                       the naming convention
```

The mapping needs a human once. After the first apply the names **are** the mapping, so
they read back on every later snapshot — no stable ids anywhere, nothing to lose, and a
`.als` on the gig laptop stays fully self-describing.

### Three layers, and what each owns

| | lives | authoritative for |
|---|---|---|
| **Library** | one global file, outlives any `.als` | what a song *is* — bpm, key |
| **Scheme** | one global file | patterns and rules — how a name is spelled, what color a clip gets |
| **Mapping** | **in the set**, in scene names + device state | which scene is which song and role, plus naming defaults and color configuration |

### The decisions behind it

**Mapping is derived; facts are declared.** Which scene belongs to which song is always
read out of the set. What a song *is* belongs to the library. A song is seeded from the
set the first time it's seen; after that a set that disagrees is drift. Without that split
the scheme is a suggestion rather than a convention, and lint has nothing to say.

**The library is global and only grows.** It outlives any one `.als` — you have a library
of songs and a given set contains some of them. Derivation unions into it. Role colors
are different: they describe one set and live in that set's bridge-device state, alongside
the set's default artist.

**A song is a label, not a range** — whatever scenes carry its name, wherever they sit. A
reprise sixty scenes later is the same song for free. Boundaries are computed; a song in
two blocks is a lint line, not an error.

**Song identity is the name text, and a rename is atomic** — renaming in the library
rewrites its scenes in the same operation, because at that moment we still know which
scenes were attached.

**Patterns are configurable but must be reversible.** At most one free-text token unless a
non-whitespace literal separates them. The rules, and why ambiguity splits into fatal and
resolvable, are in [`namePattern.md` in `@openflow/core`](https://github.com/openflowfm/core/blob/main/docs/namePattern.md).

The convention this writes today is `[ROLE] @{bpm}-{key} {SONG} - {ARTIST} {TAG}` —
`[CHORUS] @128-Bm NIGHTFALL - THE AVIATORS {COVER}`. Role first so a column of scene names
reads as structure; `@` opens the facts because after it a digit can only be a tempo and a
letter can only be a key. The `-` joins them and drops with either, so `@128`, `@Bm` and
`@128-Bm` are one shape. **A convention change can't be a clean break**, since the mapping
*is* the names — so derivation reads more than one pattern and a set converts scene by
scene as it's renamed.

**The artist is a fact, not identity.** `songKey` is still the song name alone, so one
title with two artists is drift the songs list reports rather than two songs. It is also
the only place two free-text fields meet in one name, which is why `" - "` is load-bearing
and why the parsing convention is the next thing that should become configuration rather
than a constant.

**bpm is a label in the name, and only a setting when the set asks for it.** It is the one
fact that also has a home in Live — `Scene.tempo` — and writing *that* changes how the set
plays, because Live takes a scene's own tempo the moment that scene fires. The convention
used to put the bpm there and nowhere else, and it made mixing into the middle of a song
impossible: every scene of a 128 song snapped the set to 128 however fast it was already
running, so a song could only ever be entered at its own tempo.

So the name is the record, and the tempo is a **projection** of it onto the song's *first*
scene — entering the song at the top sets the tempo, mixing into its second chorus does
not. Projecting is a deliberate action rather than a side effect of renaming, and whether
a rename does it too is one flag the set stores (`DeviceState.writeSceneTempo`), off
unless asked. See [the bridge README](https://github.com/openflowfm/bridge#readme) for the `tempo_enabled`
ordering a tempo write depends on.

A song that genuinely speeds up should eventually show a bpm *range* rather than a clash.
That is a direction, not built.

**Clip color is layered rules, first match wins**, so you can reason about why a clip is
the color it is, and lint can report what matched nothing.

**Scene reordering is the one write that can damage a set.** The LOM has no scene-move API
— verified in both sources, see [`LOM.md` in the bridge](https://github.com/openflowfm/bridge/blob/main/LOM.md) — so a move is
build-then-delete, made precise rather than wholesale by `ClipSlot.duplicate_clip_to`. It
is one plan and one message however many songs moved, which is what keeps it a single
entry in Live's history. What it costs and what guards it is under *Reordering scenes* in
[the bridge README](https://github.com/openflowfm/bridge#readme).
