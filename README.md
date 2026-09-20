# set[flow]

The session manager of **open[flow]**: the clip grid, the mixer and the device chain,
in React 19 + Vite.

The directory is `set/` and the package is `@openflow/set`, because the module manages
the **Live Set** — the same noun `SetModel`, `SetState` and `SetGrid` already use.
`set[flow]` is what the app calls itself; the paths are what the compiler calls it.

It runs as a **desktop app** — `npm start` — and builds to `dist`, which the app
serves from a scheme of its own. It talks to the Session Bridge — the Max for Live
device in [openflowfm/bridge](https://github.com/openflowfm/bridge) — over WebSocket.

## Where the reasoning lives

Each area has one doc under [`docs/`](docs/). **Read the row you need, not the set.** Every
doc is self-contained, so the index below is meant to be enough to pick one and stop.

| doc | read it before touching | source |
|---|---|---|
| [snapshot lifecycle](docs/snapshot-lifecycle.md) | the connection, the walk, deltas, staleness, or anything that writes | `lib/client.ts`, `hooks/useBridge.ts`, `useBridgeSession.ts`, `useLog.ts`, `useDeviceState.ts`, `useSnapshotLookups.ts`, `lib/snapshotTiming.ts`, `components/BridgeProvider.tsx`, `SyncModal.tsx` |
| [the grid](docs/grid.md) | the clip table, selection, the active cell, column widths, the song index, the status strip | `components/ClipGrid/*`, `SongIndex.tsx`, `StatsBar.tsx`, `Stat.tsx`, `hooks/useGridSelection.ts`, `useGridKeyboard.ts`, `useViewportColumnWidth.ts`, `lib/selection.ts`, `keys.ts`, `columnWidth.ts`, `songIndexColumns.ts` |
| [songs and folding](docs/songs.md) | song blocks, the header row, folded shapes, the mapping read back | `components/ClipGrid/SongHeaderRow.tsx`, `SongsModal.tsx`, `NewSongModal.tsx`, `hooks/useSongLayout.ts`, `lib/rowMarks.ts` |
| [scenes and roles](docs/scenes-and-roles.md) | the rail, the title fields, the role vocabulary, the role menu | `components/ScenePanel.tsx`, `Rail.tsx`, `Inspector.tsx`, `RoleMenu.tsx`, `SetConfigModal.tsx`, `TagChip.tsx`, `hooks/useSceneTitles.ts`, `useRoleAssignment.ts`, `useVocabulary.ts`, `useClipInspector.ts`, `useRailAndLog.ts` |
| [color](docs/color.md) | swatches, song color, scene color, the palette | `components/SwatchGrid.tsx`, `ColorSelect.tsx`, `hooks/useSongColor.ts`, `useColorRules.ts`, `lib/allowedColors.ts` |
| [moving scenes and clips](docs/moving.md) | either drag grip, the move plan, the drop indicator | `hooks/useSceneDrag.ts`, `useClipDrag.ts` |
| [bulk workflows](docs/bulk-workflows.md) | the running order or coloring by rule | `components/ReorderModal.tsx`, `RecolorModal.tsx`, `BulkWorkflow.css` |
| [the header](docs/header.md) | the Live control bar, transport state, glyphs | `components/Header.tsx`, `Icon.tsx`, `Control.tsx` |
| [mixer panel](docs/mixer.md) | meters, faders, sends, the stop row | `components/ClipGrid/TrackMeter.tsx`, `TrackSends.tsx`, `useMeterResize.ts`, `hooks/useMixer.ts`, `useMeters.ts`, `lib/mixerStore.ts`, `meterScale.ts`, `liveParam.ts` |
| [the device chain](docs/device-chain.md) | the footer showing a track's devices, what is watched, where a faceplate reads its controls, and how a write gets back | `components/DeviceChain.tsx`, `hooks/useDeviceChain.ts`, `lib/chainStore.ts`, `liveParam.ts` |
| [device faces](docs/device-faces.md) | a stock device drawn as a faceplate, how a control is bound to Live, and why the arrangement is the app's while the parts are `widgets/`'s | `components/devices/*` |
| [track groups](docs/track-groups.md) | group columns and collapsing | `hooks/useTrackColumns.ts` |
| [undo](docs/undo.md) | the undo entry, or any new write path | `hooks/useBridge.ts` |
| [performance notes](docs/performance.md) | **anything that reaches a memoized row** — props on `Row`, `SongHeaderRow`, or callbacks from `App` | `components/ClipGrid/Row.tsx`, `SongHeaderRow.tsx`, `App.tsx` |
| [layout and CSS](docs/layout-and-css.md) | any stylesheet, a token, or a `z-index` | `src/shared.css`, `App.css`, `components/Control.css` |
| [dev server](docs/dev-server.md) | the dev loop, HMR, the provider/App boundary, or either bench's port | `src/main.tsx`, `components/BridgeProvider.tsx`, `vite.config.ts`, `vite.bench.config.ts` |
| [the desktop app](docs/desktop.md) | the window, the custom scheme, where state lives, how the renderer learns the bridge's address | `electron/main.ts`, `electron/preload.ts`, `src/lib/bridgeUrl.ts`, `tools/electron.ts` |
| [direction](docs/direction.md) | **the naming convention, the library/scheme/mapping split, or how derivation works** — not routine feature work | `@openflow/core`'s `namePattern.ts`, `derive.ts` |

Cross-cutting: **performance notes governs every component under `ClipGrid/`** regardless
of which feature you came for — a prop that changes identity per render re-renders 848 rows.

The matching domain logic is in [`core/`](../core/README.md); it has its own index.

## Files

```
index.html            vite entry
vite.config.ts        build target + dev proxy
vite.bench.config.ts  the device bench's server — dev only, never built
bench/                the device bench: every face, fed a fixture, with no Live
src/main.tsx          root — wraps App in the bridge provider
src/App.tsx           the composition root — hooks in dependency order, wiring
src/shared.css        design tokens, global reset, shared fields and primitives
src/App.css           app shell, empty state and log
src/components/       a folder per component — see below; the flat pairs are the backlog
  *.css               component styles, imported by the component that owns them
  BridgeProvider.tsx  owns the connection, above App — see docs/dev-server.md
  Control.tsx         shared button, group, select and grouped-field primitives
  ClipGrid/
    ClipGrid.tsx      scenes × tracks — colgroup, sticky header, group bands, the tbody
    Row.tsx           one scene's row, memoized
    SongHeaderRow.tsx a song block's header row, memoized
    constants.ts      surfaces, contrast ratios, shared empties
    dropEdge.ts       which edge of a row a scene drag's drop line lands on
    TrackStatus.tsx   Live's Track Status Display, over the stop button
    TrackMeter.tsx    a track's meter column — level, fader and its controls
    TrackSends.tsx    one track column in the naturally sized sends section
    useMeterResize.ts makes the meter row's top border resize its height
  Header.tsx          Live control bar, Arrangement position, playback, view controls
  Icon.tsx            compact-control glyphs, as inline SVG
  DeviceChain.tsx     the selected track's devices, as widgets/ shells and faces
  devices/
    face.ts           what every face is handed, and what the chain picks one by
    faces.ts          class_name -> face; everything else gets Faceplate
    ParamControl.tsx  one Live parameter bound to one widget — the whole seam
    Faceplate.tsx     the plain face: every control a device reports, in order
    eq8/
      Eq8.tsx         Live's EQ Eight as a faceplate, composed from widgets/ controls
      bind.ts         which of the device's parameters is which band's control
    plugin/
      Plugin.tsx      the container Live draws around a plug-in: one X-Y control
  StatsBar.tsx        bottom status — readiness, stat tiles, key hints + log toggle
  Stat.tsx            one tile
  Rail.tsx            the rail's chrome; App nests the panels inside it
  SongIndex.tsx       browser-style left pane; song facts + jump navigation
  ScenePanel.tsx      song/tag/bpm/key fields, the role picker, song color
  Inspector.tsx       rename pattern, clip color, role→color, apply
  ColorSelect.tsx     current color closed, the palette in a popover open
  SwatchGrid.tsx      the palette as clickable swatches, shared by every picker
  RoleMenu.tsx        the picker that hangs off a scene's role chip
  SetConfigModal.tsx  set-owned naming defaults + role definitions
  SongsModal.tsx      what the app read back out of the set — read-only
  ReorderModal.tsx    the running order — drag songs, apply once
  NewSongModal.tsx    plan and create a new song's scenes
  SyncModal.tsx       blocking feedback while the snapshot behind the grid is replaced
  TagChip.tsx         the outlined song-tag pill — song headers and the reorder modal
  RecolorModal.tsx    coloring every song from a rule
src/hooks/            one hook per file
  useBridge.ts        React face of the client; composes the two below
  useBridgeSession.ts the context App reads it back out of
  useLog.ts           the shared say sink
  useDeviceState.ts   default artist, roles + allowed colors stored in the Live device
  useDeviceChain.ts   the runs the footer is looking at, and what comes back
  useSnapshotLookups.ts  the lookup Maps every other hook reads
  useTrackColumns.ts  rendered column order + group collapsing
  useViewportColumnWidth.ts  Auto and 8/16-bank widths from the grid viewport
  useSongLayout.ts    derivation, song folding, folded-header shapes
  useGridSelection.ts both selections + the active cell (and its ref)
  useGridKeyboard.ts  the window keydown effect
  useSceneDrag.ts     drag state + the move plan (and its ref), for both grips
  useClipDrag.ts      the same, for dragging clips between slots
  useRailAndLog.ts    rail/log visibility, error-opens-the-log
  useSceneTitles.ts   TitlePatch, rename + tempo ops
  useSongColor.ts     song-scoped coloring
  useColorRules.ts    the allowed colors, and coloring every song from a rule
  useVocabulary.ts    merged vocabulary, in-use keys, roleColors
  useRoleAssignment.ts  role writes + the floating menu's state
  useClipInspector.ts clip color + rename pattern
  useMeters.ts        the high-frequency meter stream, as an external store
  useMixer.ts         mixer strip state over that store
  useCloseOnEscape.ts / useMenuKeyboard.ts     generic overlay behavior
                      (where a panel floats and how it goes away is
                       widgets' Popup — see chrome/Popup.tsx)
src/lib/
  client.ts           typed WebSocket client, framework-free
  selection.ts        clip addressing + selection set
  keys.ts             the launch modifier, and who owns a keystroke
  columnWidth.ts      fixed + viewport grid widths, arithmetic and persistence
  songIndexColumns.ts which index columns are shown, and how wide that makes it
  allowedColors.ts    one-time migration from the old localStorage setting
  rowMarks.ts         play state flattened to memo-safe strings
  snapshotTiming.ts   the console phase breakdown + error text
  mixerStore.ts       the external store behind the meters and the mixer
  chainStore.ts       the same, per device, behind a faceplate's controls
  meterScale.ts       dB range, ticks, and Live's normalised meter position
  liveParam.ts        a Live parameter read into widgets/'s model of one
```

## A folder per component

A component is the component, its stylesheet, and any parts only it uses — so it should be
one thing to open, move or delete. New ones therefore take a folder. `ClipGrid/` always
was one; `devices/eq8/` is the first of the rest, and every flat `*.tsx` + `*.css` pair in
the tree above is a conversion that hasn't happened yet rather than a second convention.

**A device face is named for Live's `class_name`.** The folder, the file, the export and
`ChainDevice.className` all say `Eq8`, which is what `faces.ts` matches on to pick a face;
`EQ Eight` is `class_display_name` and stays a string in the title bar rather than becoming
an identifier. See [device faces](docs/device-faces.md).

## The one dependency pointing out of the app

`set/` reaches into [`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md) for the controls a DAW is made of —
today just the drag and the local-value hold behind the mixer's volume, pan and sends.
That direction is one-way: **nothing in `widgets/` may import from here.** `liveParam.ts`
is the whole boundary, and everything Live-specific about a control stops there.

Pure helpers under `src/lib/` can have colocated Vitest coverage. `npm test` runs those
alongside the core suite without requiring a browser or Live.
