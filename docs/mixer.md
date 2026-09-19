# Mixer panel

The mixer strips and meters.

## Mixer panel

An Ableton-style stop row starts pinned beneath the visible Session columns and has its
own filled-square header toggle. Each
ordinary or group track has a stop-clips button in its own column; the pinned Master
column holds Stop All Clips, which is the same slot in the same place — Master is a column
like any other down here, and the metadata column beside it holds nothing at all, because
everything in this footer belongs to a Live output and it isn't one. The row reads `fired_slot_index = -2` back from Live, so a
pending stop lights the corresponding button rather than relying on optimistic state.
It sits at the grid bottom when the mixer is closed and moves directly above the mixer
and its resize handle when opened. The row replaces the grid's former bottom padding, so
it sits flush against the app footer rather than floating above it. Stop All no longer
appears in the header; Esc remains its keyboard equivalent, and ⌘-clicking a track header
remains a shortcut for one track.

The stop glyph sits at the left of its cell rather than centred, on the same vertical line
as the launch and stop buttons in the clip cells above it. Centring put it at an x
coordinate that moved with the column width, so no two tracks agreed on where a stop
button was.

## Track status display

Beside each track's stop button, Live's own Track Status Display: a pie filling as a
looping clip goes round, a `m:ss` countdown for a one-shot, and a red `bars.beats` count
while Live records into a slot. Nothing when the track is silent. Live's help text names
two further forms — an Arrangement miniature and an input-monitoring glyph — that this
does not implement; [`core/docs/trackStatus.md`](https://github.com/openflowfm/core/blob/main/docs/trackStatus.md) has the
reasons and owns the rules for the three that are here.

It is drawn *over* the stop button, absolutely positioned and with `pointer-events: none`,
rather than laid out beside it. Sharing the cell as a flex row would have shrunk the stop
button from the full cell to about 14px, and on stage the whole cell being one large stop
target matters more than the status having its own box.

Frames arrive at 20 Hz and never enter React state, exactly like the meters — see
`useTrackStatus.ts`, which mirrors `useMeters.ts`. Two things keep the cost down:

- the store holds the *rendered* status, not the raw clip, and compares a loop phase at
  the 1% the pie is actually drawn to. A frame where no wedge visibly moved wakes nothing.
- each display subscribes for its own track, so a moving playhead in one column redraws
  that column alone.

The watch is held only while the stop row is on screen, since that is where it draws — its
toggle *is* the subscription. See
[`bridge/docs/message-protocol.md`](https://github.com/ryangavin/better-session-view/blob/main/bridge/docs/message-protocol.md) for what the
device does with it, and why that one is polled where everything else here is observed.

The header's meter icon opens a column-aligned mixer below the grid. Every visible track
gets a full-height output meter, a draggable volume indicator beside it, resettable peak
and exact volume readouts, compact pan, Track Activator, Solo and Arm; Master gets the
same meter, volume and pan treatment in its own pinned column. A group track is a real
track, so it gets the same strip, but its Arm control is invisible while retaining its
layout slot. On other tracks Arm remains visible but disabled when Live reports
`can_be_armed = 0`. The activator is the inverse of `Track.mute`, matching Live's enabled
button rather than presenting a backwards Mute state.
Selected Solo uses Live's blue visual language; activator and Arm remain amber and red.

The adjacent sends icon opens a separate Live-style A/B/C section above the meters and
opens the mixer too if it was closed. Each row is a horizontal draggable value field backed by the
corresponding `MixerDevice.sends` parameter; double-click restores Live's reported
default. Master has no sends. The sends section takes its natural height and grows the
whole footer, so toggling it never consumes the meter's resizable height.

Live's `output_meter_*` values already represent positions on its normalized logarithmic
meter. The fill uses that position directly; applying `log10` again makes a half-height
reading appear nearly full. The rail runs from -60 to +6 dB, with 6 dB rules and
green/amber/red zones. Rules are clipped to the meter well; they never paint into the
control gutter, and the brighter 2px 0 dB rule anchors the scale.

That scale hinges at unity rather than running straight from -60 to +6. Live puts unity
at 0.85 of the volume parameter's range and the volume indicator is drawn at that
parameter's own fraction, so a straight run — whose 0 dB falls at 60/66 — left the
pointer about 6% of the rail's height above the line it points at. `meterScale.ts` takes
the hinge as an argument and `TrackMeter` passes the fraction Live reports for that
strip's `default_value`, so the 0 dB rule, the green/amber boundary and the pointer are
three drawings of one number instead of three constants that have to agree. Both ends of
the rail survive the hinge; a single run could hold the -60 floor or the 0 dB anchor but
not both, and anchoring 0 dB on one run ending at +6 would lift the floor to -34 dB. The peak field holds
the highest position until clicked. Volume and pan
labels come from `DeviceParameter.str_for_value`, so their compact text is Live's own
rather than a second conversion maintained by the client. Double-clicking either draggable
control restores its reported `default_value`. Master and ordinary tracks render the same
56px fader subtree, so the rail, peak/volume fields and pan cannot acquire separate sizing.
Master's cell is the same width as theirs too, now that it owns a track-width column
rather than sitting in a metadata column three times too wide for it — a strip centered in
all that space read as a different kind of thing from the row of strips beside it, which
it isn't. Its track-switch stack stays in the shared layout but is invisible, so its pan
remains aligned with every other strip. The unused area has no label that could overlap the meter rail.

The optional stop, sends and meter sections are one sticky `<tfoot>`, so table layout
stacks them without independently calculated offsets. Every join uses the grid's same 2px
border; the border immediately above the meters is also their resize handle, with the
cursor providing its hover affordance. Only the meter section changes height, from a
164px minimum; the 220px
default leaves room for a useful volume range and the four offset controls. The output
rail stays 8px in exceptionally tight viewport-fit modes and grows smoothly to 16px as a
roomier column admits a 56px strip; it stops at that width instead of consuming all the
air in an 8-track view. The Activator, Solo, Arm, peak, volume and pan controls use a
26px-wide column at every track width; their heights grow by the same proportion as their
widths. The controls occupy the meter's lower-left side instead of
shortening it, matching Live's compact mixer-strip geometry.

Mixer observation exists only while the panel is open, and the one-observer-per-track-per-
return send layer exists only while its own toggle is on. Output peaks remain in the 30 Hz
`MeterStore`; control readback uses a separate `MixerStore`, and both are external stores
so one changing strip does not render `App` or every scene. The LOM seeds a complete
`MixerState`, then updates a cached strip from each property callback and coalesces pushes
to one per display frame. It does not re-read every track under parameter automation.

## The three faders are widgets/'s gesture, not this module's

Volume, pan and every send are ordinary parameters dragged the ordinary way, and the way
is [`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md)'s: `useParamGesture` for the drag and
`usePendingValue` for the hold. `lib/liveParam.ts` turns an `OpenFlow.MixerParameterState` into
a `Param` and is the entire boundary — nothing about Live crosses it.

They used to be three `<input type="range">` elements, which was wrong in a way that's
easy to miss: **a native range input jumps to the click, and Live grabs.** On the 26px pan
field that left about four reachable values. Two of the three also carried their own copy
of the local-value-until-readback dance, with its own epsilon and its own timeout.

What the strip still owns is where things are drawn, and Live's own text. The fader
elements are invisible overlays positioned by this module's CSS; the gesture only supplies
behavior and `aria-value*`. Volume, pan and send labels still come from
`DeviceParameter.str_for_value`, which every widget prefers over its own formatting — so
`liveParam` deliberately declares no unit style, and there is still exactly one place a
decibel is spelled.

Input is limited to one `setMixer` patch per animation frame — by the gesture now, so
`TrackSends` no longer coalesces across a column — and stays optimistic until Live's
observed value catches up. The local value is *not* dropped when a drag ends: doing so
would snap the control back to Live's last echo and then forward again when the write
lands, a visible bounce on every release. `DeviceParameter.is_enabled = 0` disables the
indicator rather than pretending a mapped, automated or otherwise unavailable parameter
can be written. Mixer writes do not participate in this app's clip/scene undo.

Because the surfaces are `role="slider"` elements rather than form fields, the arrow keys
now adjust a focused fader at the parameter's own step size — something the range inputs
never did well. The gesture stops propagation on the keys it handles, which is what keeps
`useGridKeyboard`'s window listener from also moving the active cell; `isTypingInto`
covers real inputs only and would not have caught these.
