# The device chain

The selected track's devices, along the bottom of the window. `components/DeviceChain.tsx`,
`hooks/useDeviceChain.ts`.

**Unverified against Live.** The watch is in `lom.ts`, which has no automated coverage —
see [what's confirmed and what isn't](#whats-confirmed-and-what-isnt) at the end.

## What it shows, and what it deliberately doesn't

Click a track header and its chain opens below the grid: every device as a shell — its
name, its activator, its fold triangle — and a rack additionally as its macro face, its
chain list and the selected chain's own devices, recursively.

**An open device shows its controls.** The face registered for its `class_name` if the app
has drawn one, and otherwise `Faceplate`, which lays out every control the device reports
in the order Live reports them. Both are the app's, not `widgets/`'s — see
[device faces](device-faces.md) for where that boundary runs and how a control is bound to
a parameter.

**A folded device shows nothing, and costs nothing.** That is one fact said twice: `open`
in the watch is derived from fold state, so the triangle in the title bar *is* the
subscription. Folding a device drops its ~40 parameter reads and its ~40 observers;
unfolding one is what asks for them. Nothing else in the app asks for a device's controls,
because there is nothing else to ask with.

**There is no refresh button.** There was one, and it existed only because the chain was
read on demand: a device added in Live stayed invisible until something asked again, and
the button was that ask. The run's own membership is watched now, so it has nothing left
to do.

## It is the first thing in the app drawn out of widgets/

The mixer's faders proved the gesture crossed the boundary; this is the first component to
use the chrome. It matters because the boundary is the point of that module:
[`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md) imports no protocol, no bridge and nothing that knows
Live exists, and everything Live-shaped stops in `DeviceChain.tsx`.

The adapting turns out to be three lines, because a shell is a small thing — `name`, `on`,
`folded`, and a rack's chain names. `liveParam.ts` is the same boundary for parameters and
is the file that grows when knobs land.

**Which chain a rack is showing lives in the hook**, and it used to be `RackShell`'s own
`useState` on the reasoning that nothing over the wire depended on it. That half stopped
being true. The chain a rack is showing is exactly what decides whether its devices are
watched, so it is now part of what the footer declares — and the thing that declares it
has to hold it. It resets when the track changes because a different track's runs are
addressed by paths that mean something else entirely.

A device has **no id on the wire.** Its address is its position in the run, the same
bargain clips make with `(track, scene)`. Keys pair the index with the name so that
swapping one device for another at the same slot remounts rather than reusing a shell.

## A watch with a target, and what it does not follow

`Track.devices` was always observable. What stopped this being a watch was the bridge:
every watch is refcounted **per kind** across clients, in one `Set<WebSocket>` each, and
this one has to be refcounted per kind *and per target* — two clients looking at two
different tracks both want it on, and neither may release the other's.

That now exists. The footer declares every run it is looking at, the bridge unions those
across clients ([`core/docs/chainWatch.md`](https://github.com/openflowfm/core/blob/main/docs/chainWatch.md)), and `lom.ts`
follows the union. **A device added, renamed, deactivated or folded in Live now appears
here without anyone asking**, which is what the refresh button used to stand in for.

### It watches what is visible, which is less than what exists

The subscription is per **run** — a track's device list, or one chain inside a rack. Not
per track, and deliberately not recursive:

- the shown track's own run, always;
- for each rack in a run that is **open**, the one chain it is showing;
- and into that, because a rack inside a chain is the same case again.

A folded rack contributes nothing. A rack's other seven chains contribute nothing. That is
the whole economy: an eight-chain rack of five devices each is ~120 LOM observers, and
following one nobody has opened would spend all of them on something off screen.

It costs a round trip per level. Subscribing to the track run is what reveals which of its
devices are racks, which is what puts their open chains in the next declaration. On a local
socket that is invisible, and it means the client never has to know a rack's shape before
it can ask about it.

**A rack therefore reports its chains as names only.** `RackChain.devices` is absent until
that chain is itself subscribed to — absent and `[]` mean different things here, "nobody is
looking in here" against "this chain is genuinely bare", and a client that drew the empty
case for the first would show every unopened rack as containing nothing.

### Two guards keep the rebuild from eating Live

Observers here are path-addressed, so a device inserted into a run re-points every one
after it — which is why any change rebuilds rather than patches. Two things stop that being
ruinous, and both were learned the hard way:

**A re-entrancy flag.** Constructing a `LiveAPI` fires its callback synchronously, and this
tier's callbacks infer nothing from their arguments — any callback means "re-read
everything". So attaching an observer scheduled the rebuild that was attaching it, and the
rebuild attached again: a 60ms loop constructing up to four hundred `LiveAPI` objects a
turn, on the thread that draws Live. It froze Ableton. `chainAttaching` makes the watch
deaf to its own attach and detach.

**A shape guard.** `chainShapeKey` describes what the observers point *at* — whether each
run resolves, its devices by **id**, which are open, and how many controls each open one
has — and an unchanged key skips the rebuild entirely. It deliberately excludes names,
activators and fold state, because those are what the observers *report*: renaming a device
fires `onChainChange` and moves no observer, and tearing down four hundred of them to
re-attach them to the same objects is the definition of work for nothing. Same guard
`rebuildCursorObservers` makes, one tier down.

### The declaration, not a subscribe/unsubscribe pair

The footer sends everything it is looking at, every time any of it changes. There is no
`off`. An empty list is how it stops, a dropped socket says the same thing, and no message
this client can send releases a run another client is holding.

It is keyed on the declaration's **content** rather than its identity, because every push
rebuilds the list and almost none of them change what is being watched. The bridge drops
an unchanged union anyway — it has to, since telling `lom.ts` rebuilds every observer it
holds — but a message per push is the wrong shape to establish before parameters make it a
message per knob turn.

## The parameter tier

A device's controls ride the same subscription, gated on `ChainWatch.open`.

**`open` is fold state, and nothing new had to be invented for it.** A device drawn shut
has no face to fill, and Live already tracks which ones are shut — so `visibleRuns`
derives `open` from `!device.folded`, and folding a device in Live drops its ~40
observers. A rack counts as open too, and its parameters are its macros.

### Read once, observe one thing

Everything about a control except `value`, `display` and `state` is fixed for as long as
the device exists. So the whole descriptor — name, range, default, quantization, members —
is read when the device opens and travels with `ChainDevice.parameters`; after that, one
observer per control on `value` alone.

`state` is observable and deliberately isn't watched. It moves when a parameter becomes
macro-controlled or automation is armed, which is roughly never mid-set, and watching it
would double the budget of the most expensive tier here. It rides the structural re-read
instead, so a control greys out on the next chain change rather than instantly.

That is the difference between ~40 observers for an open EQ Eight and ~280 LOM reads every
time anything moved.

**"Read once" is a cache, and for a while it wasn't one.** `sendChainState` rebuilds the
whole published state on every structural change, and it was calling the full descriptor
read each time — so renaming one device re-read every control on every open device in the
run *and* re-spelled every enum's members, which is a `str_for_value` call per member. One
open EQ Eight came to roughly 800 LOM operations per push, on the thread that draws Live,
for a change that moved nothing.

`paramShapes` holds descriptors keyed by the device's LOM id **and** its control count —
the id alone is wrong for a plugin whose parameter list changes underneath it, the count
alone is wrong for a device swapped for another with as many controls. A push then costs
two `get`s and one `call` per control instead of nine-plus and a call per member.

Two details in that are deliberate:

- **Entries survive an observer rebuild.** Opening a fourth device must not re-read the
  three already open, and that is exactly the gesture that hurt. They are evicted by not
  being used instead: each push keeps only what it touched, so folding a device shut drops
  its descriptor along with everything else it was costing.
- **A rack is never cached.** Not for cost — a rack has a handful of macros where an EQ has
  ninety — but because its chain selector spells its members as the *chain names*, so
  renaming a chain changes an enum's text without changing its parameter count. Re-reading
  the one device whose members are genuinely dynamic beats a cache key that can't tell.

### The parameter list is index-aligned, and has to be

`p` on the wire is the LOM's own index: it is what a value observer reports and what
`set_device` writes against. A parameter that fails to resolve therefore travels as a dead
entry rather than being dropped — dropping it would slide every control after it onto the
wrong parameter, silently, and only on the devices where one failed.

### The members of an enum come from `str_for_value`, not `value_items`

`DeviceParameter.value_items` looks like the obvious source and is a trap: it arrives as
Max atoms, so a member whose name holds a space — `Low cut` — comes back as two of them.
The list reads correctly when joined and is the wrong *length*, which is precisely what an
enum indexes by.

`str_for_value(min + k)` per member has no such ambiguity. It costs n calls instead of one,
once, when the device opens, and it is the same function every other readout in this
project already trusts. See [`LOM.md`](https://github.com/openflowfm/bridge/blob/main/LOM.md) under `DeviceParameter`.

### Values land in a store, not in React state

`chainValues` is a stream of `(t, path, i, p, value, display)` at gesture rate, batched one
message a frame. It goes to [`lib/chainStore.ts`](../src/lib/chainStore.ts), subscribed
**per device**, so a knob moving on the EQ wakes the EQ and neither the chain around it nor
the grid above it. Same arrangement as the meters and the mixer, for the same reason.

`useDeviceParameters(store, t, path, index)` is what a faceplate reads. Null means folded,
unwatched, or not read yet — a face draws its shell and waits rather than inventing
controls.

The store preserves array identity when nothing moved, which is a requirement rather than a
nicety: `useSyncExternalStore` compares snapshots by reference and tears if the getter
returns a fresh array every call.

### What it still cannot follow

A parameter's `state` between structural re-reads, per above. And Live exposes **no taper**
for a device parameter, which is why [`liveParam.ts`](../src/lib/liveParam.ts) sets no
`exponent`: `DeviceParameter.value` is documented "Linear-to-GUI", so the curve is already
applied on Live's side and the number is a position on the control rather than a physical
quantity. Bending it here would bend it twice and disagree with `display`.

## Writing back

`setDevice` carries all three of a device's writes in one message — `on`, `folded`, and one
control by index — because they are one operation on one thing and the protocol is
coarse-grained by rule. `{ target: { t, path, i }, patch }`, where the target is the same
`(t, path)` a `ChainWatch` uses plus a position in that run. There is no device id on the
wire to use instead, and inventing one would mean the bridge keeping a copy of the set's
device tree, which is what the watch model exists to avoid.

**Nothing replies.** Every field is already observed by whoever is watching the run —
`is_active` and `is_collapsed` on the shell, `value` on each control — so the
acknowledgement is the next `chainState` or `chainValues`. That is a better answer than
confirming a `set()` was called, and it is the *same* answer another client's write
produces, which a reply would not be.

Three consequences worth knowing:

- **The bridge validates shape, not existence.** It checks that the address is an even path
  of non-negative integers and stops there; whether it resolves is `lom.ts`'s to answer,
  because only that side can. A parameter's range is checked there too, against the
  parameter's own `min` and `max`.
- **`state === 2` is refused on both sides.** `paramDisabled` won't let the gesture start,
  and `set_device` refuses it again — the client's copy of `state` is only as fresh as the
  last structural re-read.
- **`on` and `folded` nudge a re-read; a control never does.** An unchanged write may not
  notify, and a shell has no deadline to recover from that the way a dragged control has
  `usePendingValue`'s. Nudging on every control write instead would rebuild every observer
  in the watch sixteen times a second during a drag.

## Selecting a track selects it in Live too

A plain click on a track header sends `selectTrack`, which writes `Song.View.selected_track`
— the same bargain [`selectScene`](songs.md) makes for the Song Index. Live's own device
view shows the selected track's chain, so without the write, this footer and Live's would
be two answers to the same question.

**Group headers too**, because a group is a real track with devices of its own. That cost
the grid its whole-header fold target — folding is now the ⊙ chevron alone. See
[track groups](track-groups.md) for what that traded away and why it wasn't a choice.

The modifier-click that stops a track is untouched and can't collide: one is a view, the
other is playback, and the modifier is the one every launch surface in the grid already
uses to mean stop.

The selected header is marked by a 2px rule along its bottom edge — the edge nearest the
strip it opened — in `currentColor`, which reuses the ink `inkOn` already picked to read
against that track's own Live color. It's an inset shadow, so the `live` and `stopping`
gradients keep the `background-image` channel to themselves.

**It's a border, and that matters.** A group's band, the gutter that holds a member's
header off that band, and the plugs that fill the `border-spacing` between headers are all
`box-shadow` layers on this same element, and `box-shadow` does not compose across rules —
the winning declaration replaces the whole stack. Marking the header with another shadow
therefore erased the band, and the selected track visibly rose out of its group. A border
is a different property, so it can't collide with any of that.

The transparent border is held on **every** track header and only recoloured on the
selected one, so clicking changes a colour rather than the layout; a border applied only
when selected would grow the whole header row by 2px on every click. The background paints
under it, so unselected it simply shows the track's own fill.

**The fill is deliberately left alone**, and that's the whole reason this works on a group.
Every header carries its own Live color, and a group reads as *containing* its tracks
because it shares that fill with them; tinting or lifting the selected one makes the group
float off the run it heads. A mark on one edge has no such relationship to break, so group
and ordinary headers need no case for either.

The bridge observes `selected_track` for its own delta detection (see
[`bridge/docs/following-live.md`](https://github.com/openflowfm/bridge/blob/main/docs/following-live.md)), so this write is
seen by the cursor watcher and re-reads that track. That's the intended behavior of that
watcher and costs one track read, but it does mean clicking headers is not free.

## Where it sits

Below `main` rather than inside it, so the strip spans the window the way Live's device
view does — under the rail as well as the grid — rather than becoming one more column in
that flex row. `#root` is a flex column, so it stacks above the log and the stats bar.

The strip stays mounted while a read is in flight instead of being replaced by a spinner.
The chain that's there is almost always the chain that's still there, and swapping it for a
message makes every re-read look like the devices went away.

## What's confirmed and what isn't

**Confirmed with Live open:** the subscription path works end to end. Clicking a track
header declares a run, `watch_chains` installs against it, and the shells come back and
draw. Also confirmed the hard way: the rebuild loop above was real, and it froze Ableton
within seconds of a device being opened. Treat any new callback in this tier as guilty
until it is proved not to re-enter the rebuild. That covers the parts with the most ways to be wrong — the union reaching `lom.ts`,
`chainRunPath` resolving, `readWatchedRun` answering, and `chainDevice` accepting a rack
whose chains carry no devices.

It typechecks, builds, and the device is unchanged at 51 boxes — the messages need no
patcher change, because anything the `route` doesn't match falls through to `lom.js`.

**Not confirmed. Loading is not following, and every one of these is the second half:**

- that the observers *fire* — a device added, renamed or deactivated in Live updating the
  strip on its own. Nothing here has been watched changing, only appearing;
- that `Device.View.is_collapsed` observes the way the page says. It is documented
  `get, set, observe`, and this project's own LOM table said `get, set` until the device
  classes were un-trimmed, so it has been wrong here once already;
- that a rack's `chains` observer fires when a chain is added or renamed;
- that opening a rack chain subscribes and fills — the round-trip-per-level expansion;
- **the entire parameter tier.** Nothing has read a `DeviceParameter` off a real device:
  not the descriptor read, not `str_for_value` spelling an enum's members, not the value
  observers firing, not `state` answering 0/1/2. `npm run dev:diag -- param` in better-session-view reads this
  device's own parameters and is the closest thing to a probe that already exists;
- **every write in `set_device`**, which is all three of them. That `is_active` and
  `is_collapsed` accept a write at all, that a parameter's `value` does, that Live's
  readback comes back through the observers rather than needing a nudge, and that the
  round trip is quick enough for a knob to feel attached to the pointer;
- **that unfolding a device from the app arms its parameters.** It is two round trips by
  design — the fold lands, the re-read reports it, the declaration changes, the watch
  re-arms — and nothing has watched that sequence complete;
- **the EQ Eight's parameter names**, which `eq8/bind.ts` matches on and which have never
  been read off a device. A miss draws the control dead rather than dropping it, so the
  failure is visible; the plain faceplate on the same device shows the real names;
- that `CHAIN_DEBOUNCE_MS` is long enough for Live to finish rearranging a rack before the
  re-read, and short enough not to feel laggy. It is a guess;
- **that opening a track with several devices already unfolded doesn't hitch Live.**
  `readWatchedRun` reads every open device's parameters in one tick — ~7 properties per
  control, so five open devices is on the order of 1,400 LOM calls at once, on the same
  thread that draws Live. It is bounded (`DEVICE_COUNT_MAX`, `PARAM_COUNT_MAX`) but it is
  not *chunked*, and the snapshot walk needed chunking for less. If clicking a track header
  stutters, this is where it is, and `snapshotStep`'s pattern is the fix;
- that writing `Song.View.selected_track` by id reveals the track the way writing
  `selected_scene` reveals a scene.

The failure modes stay visible rather than silent: a device that doesn't resolve is
skipped, a chain list that raises logs to the Max window and reads as empty, and a
malformed payload is rejected whole by `chainDevice` in `bridge.ts` rather than
half-drawn. An empty footer on a track with devices means the watch failed; it does not
mean the track is empty, because a track that has genuinely gone answers `null` and the
strip says "unavailable".

One new failure mode worth knowing: the observer count is capped at
`CHAIN_OBSERVER_MAX`, and hitting it posts to the Max window and leaves the shells past
that point not updating. It is a runaway stop for a malformed set, not a limit anyone
should reach — 400 observers is ~130 devices on screen at once.
