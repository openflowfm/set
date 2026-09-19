# The header

The Live control bar this app mirrors, the transport state it holds, and the inline-SVG glyph rules.

## The header is Live state plus glyphs

The left side mirrors the Live Control Bar state this app needs while performing: Set BPM,
metronome, global clip-trigger quantization, and the complete Current Scale trio (Scale
Mode, root note and scale name). `useBridge` holds one `TransportState`; seven fixed LOM
observers push it as a unit, and the UI sends one partial `TransportPatch` for any gesture.
The next observed readback is the acknowledgement, so a Live write that silently fails
cannot leave the header claiming the attempted value.

Tempo, metronome and global clip-trigger quantization share one segmented pulse control;
the quantization segment changes when clips take that pulse. Scale Mode, root note and
scale name form a second three-segment control for its musical key. Button groups provide
the logical separation; the header uses no standalone divider between them.

Live's Current Scale controls are not a bulk edit of every clip. They reflect the current
or selected clips and apply to that selection, which is why the controls and tooltips say
“current scale” rather than “Set key.” The built-in scale list comes from Live 12.4.3's own
`Song.scale_name` docstring; an observed name that a newer Live adds is retained as an
extra option instead of disappearing.

The center keeps Live's bars, beats and sixteenths immediately left of transport play,
stop and record, in Live's own order. Stop All Clips belongs to the Session grid's Master
stop slot instead of this global transport group. The right side carries the compact width
select, mixer and sends toggles, and Snapshot.

Record is `Song.record_mode` — Live's Arrangement Record button, not Session Overdub or
Session Record. It travels in `TransportState` with the rest of the control bar and is
drawn with the transport because that is where Live puts it. It is a toggle, so it lights
from the observed value rather than from the click, and its light is red: Live's own color
for it, and the playback group already reads state in color with the green rolling play
button. Nothing else in this app writes `record_mode`, so an armed take is only ever the
user's doing.
Three equal flex regions keep that middle group at the header's true center,
independent of how much chrome the left and right sides contain. The left region clips
first on a narrow window. Every control shares `--ctl-h`; the bar is `--ctl-h + 13px`,
with 6px of air above and below plus its 1px bottom border.

- **`Icon.tsx` is inline SVG**, not an icon font and not a Unicode character. A font is out
  because nothing loads from a CDN. A character is out because ▶, ⏹ and 🐛 render at
  whatever size, weight and baseline the user's installed fonts decide, and the emoji ones
  arrive in full color at a size nothing asked for. Drawing in `currentColor` means the
  button's hover, `:disabled` and `.on` states reach the glyph for free.
- **Every icon button carries an `aria-label` as well as a `title`.** An icon-only control
  with no accessible name is a button for sighted mouse users and nobody else, and the
  `title` is now the only place longer meanings — what the Master stop slot spares, that
  Snapshot re-walks the whole set — can still be said in words.
- **The metadata column's controls reuse the same primitive, size and glyph set as the
  main header**: 26×22px buttons with 14px icons. The grid header's calculated height
  grows around them with equal space above and below, keeping the song actions, the Songs
  label and every track heading on the same vertical center. The **Songs** heading is 16px
  while ordinary track headings remain 9px.
  Order, color and Add share one right-aligned group in that order. Their titles say what
  each control does.
- **Fold, metronome, Scale Mode and Arrangement Record keep one glyph and light instead of
  swapping.** Their glyph identifies the control; the light says the observed Live state is
  on — amber everywhere except the transport, where record follows Live and lights red.
- **The empty state shows the glyph, not the word.** It used to say *hit **Snapshot***, and
  pointing at a label that no longer exists is worse than no instruction.

## Pointing for screenshots

The shared `@openflow/widgets/controls/Pointing.tsx` pointer button sits with the
header's settings/utility controls (beside Debug and Settings in mix). It lights while
active; **Clear** appears alongside it and resets annotation letters to A. It works
identically in the browser harness and packaged Electron app. No hotkeys, native menu,
preload integration, audio state, or application subscriptions are involved. Each
clicked control receives a letter and colored outline while its normal action still
runs. The pointing controls themselves are excluded. Turning off or unmounting clears
the marks. The DOM engine and control behavior are owned and tested by Widgets.
