# Device faces

A stock Live device drawn as a faceplate rather than a title bar.
`components/devices/`, and `eq8/` inside it.

The device chain mounts one per open device: the face registered for its `class_name` if
the app has drawn one, and `Faceplate` — every control the device reports, in order —
if it hasn't. Both write back, so a knob moved here moves in Live and a knob moved in Live
moves here. What is *not* connected is [listed at the end](#what-is-still-unbound), and
every bit of it is drawn dead on the face rather than left to look live.

## Why the face is the app's, and the parts aren't

[`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md) holds the parts a faceplate is made of: a knob, a
value box, a switch, a `Device` shell, a `Panel`'s aligned lanes. It holds them because a
knob is a knob wherever it's mounted, and the module's whole claim is that it has never
heard of Live.

A face is the other thing. Eight lanes on a shared row grid, an analyzer's controls on one
plate and the output's on another, preset chrome in the title bar — that arrangement is one
particular device and no other, and it is only right to the extent that it matches what
Ableton drew. Putting `Eq8` in `widgets/` would export exactly the knowledge that module
refuses to carry, and the bench would then be a page that has to be right about Live.

So the boundary runs between the parts and the arrangement, and the app composes. It is the
same crossing [the device chain](device-chain.md) already makes for shells, one tier in:
that footer takes a name and two booleans and draws chrome, and this takes a parameter and a
number and draws a control.

## How a control reaches Live

`ParamControl.tsx` is the whole seam, and everything in it is the same wherever a control
is drawn — which is why no face repeats any of it:

- the range, the kind and the members come off the parameter through `deviceParam` in
  [`lib/liveParam.ts`](../src/lib/liveParam.ts);
- the printed reading is Live's own `str_for_value`, carried as `display`, which every
  widget prefers over its own formatter — that optional-and-authoritative rule in
  [the parameter model](https://github.com/openflowfm/widgets/blob/main/docs/param-model.md) was built for exactly this;
- a dragged value is held over the reported one by `usePendingValue` until Live's agrees
  or its deadline passes, so a knob doesn't lag a round trip and doesn't lie about a write
  Live clamped;
- and a move goes out as `setDevice`, whose acknowledgement is the next value push rather
  than a reply. See [the device chain](device-chain.md#writing-back).

A face therefore only decides *arrangement*: which widget, where, captioned what. It picks
one of `ParamKnob`, `ParamNumber`, `ParamSelect` or `ParamSwitch` explicitly, because which
control Ableton used is part of what the face is copying and can't be inferred from a
range. `ParamControl` does infer it, and that is what `Faceplate` is built from.

**A slot may match nothing, and it shows.** A face joins its layout to a flat parameter
list by *name* — there is no id, and a position in the list is a fact about one Live
version. Every control accepts `null` and draws itself plainly dead, with a title saying
which name it went looking for. A face that silently dropped the control it couldn't find
would be a face that looks correct and isn't.

## Which parameter is which, for the EQ Eight

[`eq8/bind.ts`](../src/components/devices/eq8/bind.ts) does that join, and it is matched
**loosely on purpose**: a band's controls are found by band number plus a keyword, not by
an exact table. Live's names have not been read off a real device in this project, and an
exact table would turn one renamed control into forty dead ones.

Two orderings in there are load-bearing and have tests: `frequency` is claimed before `q`,
because `Frequency` contains a q, and `filter type` before `filter on`, because a claimed
parameter is out of the running and otherwise the wrong one takes the slot. `Resonance`
contains an `on`, which is why the patterns are anchored to word boundaries rather than
being substrings.

**The A channel wins.** In L/R and M/S modes an EQ Eight has two sets of bands, `… A` and
`… B`, and the join takes whichever comes first. Choosing between them needs
`Eq8Device.edit_mode` — a device property, not a parameter.

## The plain faceplate is not a degraded mode

`Faceplate` draws every control a device reports, in Live's own order, each as whichever
widget its shape calls for. It is what nearly every device in a set will use, since the
registry holds one face.

It also earns its place a second way: it is the only thing in the app that shows a
parameter list **as Live spells it**, captions and all. So it is where the names a face has
to match get read off a real device, and where a face that stopped matching them shows up.
Open any device in the footer and its parameters are on screen with their real names.

## The plug-in container, and why it is not in the registry

`devices/plugin/Plugin.tsx` is the other face here, and it exists because it is the
smallest real device Live has: a plug-in has its own window that Live cannot draw inside,
so the container is one X-Y control and two choosers naming which of the plug-in's
parameters that control moves. Nothing else. That makes it the plainest caller of
[`XYPad`](https://github.com/openflowfm/widgets/blob/main/src/controls/XYPad.tsx) — a plane with no artwork behind it.

It is deliberately absent from [`faces.ts`](../src/components/devices/faces.ts), and would
need two things to earn a place. A plug-in's `class_name` is almost certainly
`PluginDevice`, but `bridge/LOM.md` has no section for that class and nothing here has read
one off a real set; registering a guess would put this face in front of every plug-in in
every chain, *replacing* `Faceplate`, which draws all of a plug-in's controls and is the
better answer. And the axis assignment doesn't round-trip: Live keeps it in the container
and the protocol carries a device's parameters rather than the container's own state, so
the choosers here hold the choice locally and start at `none`. Moving the plane is a real
write; remembering what it was pointed at is not yet possible.

## The device bench

`npm run bench`, on the UI's port + 200. It draws every face in this folder with the
app's palette and **no connection at all** — no provider, no client, no socket.

That works because a face takes a `ChainDevice` and a list of parameters and nothing else,
so [`set/bench/fixtures.ts`](../bench/fixtures.ts) can answer like a device without being
one. It holds the parameters in state, so a control that moves writes the fixture and the
face re-reads it — the same round trip a control makes through Live, which is the part
worth rehearsing. A face that only *looked* right with values it owned would hide exactly
the bug that matters.

It is a separate page from [the widget bench](https://github.com/openflowfm/widgets/blob/main/docs/bench.md) because it has
to be: a face is composed here out of `widgets/`, and that bench may import `widgets/src`
and nothing else. The split is the same one the modules have — parts there, arrangements
here — and the practical gain is that a face can be seen in states a real set won't
readily produce, including a device whose parameter names don't match and whose slots
therefore draw dead.

## The geometry, which is the part that took the iterations

Three kinds of plate sit on one `Panel`: eight identical band lanes, and a side plate at
either end. They read as one device only if their margins agree, and the two ways they can
disagree are worth writing down, because both were wrong at some point.

**Widths come from one gutter.** `Eq8.css` names `--eq8-gutter` once — the distance from
a plate's edge to the controls inside it — and every plate's width follows from a control
width plus two of them, with the plate's padding a pixel short of the gutter because the
border is inside `border-box`. The controls take their widths from the same tokens, through
`--wdg-number-width` and friends set on the plate. Passing each control a `width` prop
instead is what the file used to do, and it spreads one piece of geometry across a dozen
call sites where a plate and its contents drift a pixel or two apart — which is exactly how
the outer plates stopped matching the lanes.

**Row heights belong to the lanes.** Each track is its lane group's height plus the same
margin, so a lane's three sections sit evenly however tall the group is; the bottom one
holding a value box, a filter menu and the band switch is genuinely taller than a knob, and
the row is taller to match. A side plate holds unrelated groups and fewer of them, so it
does *not* ride that grid — it spaces its own groups over the plate's full height. Making it
share the lanes' tracks is what left the output plate's last pair stranded in the middle of
a row sized for something else. Their captions never had to meet the lanes' alignment lines.

Two consequences worth knowing before adjusting anything:

- **The analyzer plate is airier than the output plate**, because it holds four controls
  where the other holds six. Its spacing is even, but it is even at ~14px where the output
  plate's is ~3px. That is a content difference and CSS can't close it — the fix, if it ever
  wants one, is a fifth and sixth control on that side.
- **Band selection is not drawn**, and that one is only waiting. Live marks the band its
  display has focused, and `Eq8Device.View.selected_band` is settable *and* observable, so
  it can be kept in step both ways — see [`bridge/LOM.md`](https://github.com/openflowfm/bridge/blob/main/LOM.md). Nothing on
  the wire carries it today, which is why the face has no notion of it.

Colours come from the app through the token bridge: every `--wdg-*` token resolves to a
`shared.css` token with its own fallback, which is what lets a control drawn from these
parts sit on a page with no palette around it at all. See
[layout and CSS](layout-and-css.md#widget-tokens) — and note the direction, because
`shared.css` never defines a `--wdg-*` token.

## What is still unbound

Seven controls on the EQ Eight's face are drawn **disabled**, with a title saying why. That
is deliberate: a control that moves and does nothing is worse than one that plainly can't,
and the point of drawing them at all is that the gap stays visible.

1. **The analyzer's four** — Analyze, Block, Refresh, Avg. Live exposes none of them to the
   LOM, as parameters or as properties, and this face draws no spectrum for them to drive.
   They would need something to be for before they could be bound.
2. **Mode and Edit** — `Eq8Device.global_mode` and `edit_mode`, which are device
   *properties* rather than parameters and so will never appear in `ChainDevice.parameters`
   however well the name matching works. Both are `get, set, observe` — see
   [`bridge/LOM.md`](https://github.com/openflowfm/bridge/blob/main/LOM.md) — so the gap is in what the wire carries. Closing
   it means a per-class properties tier alongside the parameter one: which properties a
   class publishes, read on open and observed like a value. `oversample` is the third of
   these and the face doesn't draw it at all.
3. **Band selection**, still. `Eq8Device.View.selected_band` is settable and observable and
   would ride the same tier.

And the standing one, which no amount of code here settles:

**None of this has been read off a real device.** Not the parameter names `bind.ts` matches
on, not `str_for_value` spelling a filter type's members, not `state` answering 0/1/2, not a
`value` observer firing during a drag. The plain faceplate is the fastest way to check the
first of those — open any device in the footer and its controls are on screen with Live's
own names on them. `npm run dev:diag -- param` in better-session-view reads this device's own parameters and is the
closest thing to a probe that already exists.
