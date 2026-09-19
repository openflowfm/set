# The desktop app

`set/electron/main.ts`, `set/electron/preload.ts`, and — for most of what a window
actually is — [`@openflow/desktop`](https://github.com/openflowfm/desktop/blob/main/README.md).

set[flow] used to be a page the Max device served. That put 595 kB of base64 web app inside
Live's own process, and it made the session manager open whenever the device was loaded.
Both were the wrong way round: the device should bridge Live and nothing else, and a set
manager is something you open when you are working on a set — deliberately, and not during
a show.

So it is a window now. `npm start` builds the renderer, builds the shell, and launches it.

## What is in this app's `main.ts`, and what is not

Fifty lines, and they say four things: where the device is, that this app serves its own
build over a scheme, that it remembers its window and retries a dev server, and that it
updates itself.

Everything underneath — the window, the sandboxed preload, the state directory, the
navigation policy, the dev-server retry, the scheme handler, the updater — is
`@openflow/desktop`, shared with visual[flow] and with every app after it. The reasoning
for each piece lives there:
[`window.md`](https://github.com/openflowfm/desktop/blob/main/docs/window.md), [`scheme.md`](https://github.com/openflowfm/desktop/blob/main/docs/scheme.md),
[`update.md`](https://github.com/openflowfm/desktop/blob/main/docs/update.md), [`packaging.md`](https://github.com/openflowfm/desktop/blob/main/docs/packaging.md).

What stayed here is what is only true of set[flow]. The rest of this document is that.

## It is Electron, and the reasoning changed rather than being wrong before

`tools/README.md` argues at length for driving the already-installed Chrome instead of
bundling one, and that argument still holds *for the visuals rig's browser*. What changed is
that the device is no longer a web server, so there is no URL to point a browser at — the
choice is not "Chrome or Electron", it is "ship a window or ship a server". Electron is the
only one of those that leaves the device carrying nothing.

Tauri was considered and rejected, though not for the reason first written down here. The
original argument was shader portability, and it does not hold: Safari and Chrome both reach
the GPU through ANGLE onto Metal, so GLSL crossing between them is a re-test rather than a
re-validation. What does hold is that **Tauri's macOS webview is WKWebView**, and
visual[flow] draws its show *inside* the webview — so moving would put a projector in a
renderer with fewer levers and lose the anti-throttling switches it depends on. This app
would survive the move; that one would not, and one engine across both is worth more than
either. visual[flow]'s [`docs/engine.md`](https://github.com/openflowfm/visuals/blob/main/docs/engine.md)
works through the whole trade, including what would have to
change before the shell is worth revisiting.

## `set://app`, and the one-time cost of moving there

The mechanism is [`scheme.md`](https://github.com/openflowfm/desktop/blob/main/docs/scheme.md). What is set[flow]'s alone is
what the move cost: the origin used to be `http://127.0.0.1:17800`, so the first launch after
the change lost saved column widths and the song-index column choice, and ran the
allowed-colours migration once more.

There was no honest way around it. Importing from the old origin would have meant loading
the old origin, which means the server this change exists to delete.

## What crosses the context bridge

One string: where the device is. The main process is the one that read `OPENFLOW_PORT`, so
it is the one that knows, and it hands it over as a flag — `desktop/src/preload.ts` explains
why a flag rather than an environment variable.

`set/src/lib/bridgeUrl.ts` is the only reader, and it falls back to `ws://${location.host}`
when there is no preload — which is the vite dev server, unchanged, still proxying `/ws`
through to the device. That fallback is why the browser dev loop needed no changes at all.

Nothing else is exposed. The app speaks one protocol over one socket; `contextIsolation` is
only worth having if what crosses it stays this small.

## The build

`npm run electron` esbuilds `main.ts` and `preload.ts` — plus everything they
import from `@openflow/desktop` — into `electron/dist/`. The details are in
[`packaging.md`](https://github.com/openflowfm/desktop/blob/main/docs/packaging.md).

It is deliberately **not** part of `npm run build`. That script is what produces the device;
it has no business needing an Electron binary. `npm start` builds what it needs at launch,
which also means `dist` can never be stale.

## The dev loop, in this window

`npm start` is a rebuild and a relaunch, which is right for checking what ships and wrong
for the twenty edits before it. `npm run dev` opens the same shell on the vite dev
server instead of on the scheme, so an edit lands in the window that ships with Fast Refresh
intact — including the connection and the snapshot behind it, which is the whole argument in
[`dev-server.md`](dev-server.md).

`npm run watch` starts both halves together and is the one to type; `npm run dev` alone
needs a dev server already up (`npm run ui`) and starts none. The switches and the retry are [`window.md`](https://github.com/openflowfm/desktop/blob/main/docs/window.md); the port
comes from `OPENFLOW_PORT_BASE` plus this app's offset in `desktop/src/apps.ts`, so a
worktree that moved its servers takes the app with it rather than being the one thing left
behind.

Three things differ from `npm start`, all of them on purpose:

- **No bridge flag crosses the preload.** `bridgeUrl()` falls back to the origin the page
  came from, and vite's `/ws` proxy carries it — so the app reaches whatever device its dev
  server was configured for, rather than whatever this process guessed. It is also what
  makes several worktrees on one device work here exactly as they do in a browser.
- **A different `localStorage` bucket**, because `http://localhost:5173` is a different
  origin from `set://app` and storage is keyed by origin. The same split a browser already
  has: column widths set in dev are not the ones the real app opens with.
- **The title says `— dev`.**

## Packaging

`npm run pack` builds the renderer, the shell, an icon, and a `.app` plus a `.dmg`
under `release/`. Drag the `.app` into `/Applications` to install it; replace rather than
merge, since `ditto` into an existing bundle leaves an old build's files inside the new one.

The shape of the config, and what an app's own `electron-builder.yml` still has to say, is
[`packaging.md`](https://github.com/openflowfm/desktop/blob/main/docs/packaging.md). Signing and notarisation are on whenever
the credentials are present — `.github/workflows/release.yml` supplies both, and no flag
turns them on.

**What packaging is for here, and it is not distribution.** Unpackaged, every app reports
itself as *Electron*: the menu bar says it, the Dock shows Electron's icon, and ⌘-Tab cannot
tell them apart — a small thing until you are reaching for one of them mid-set. A bundle
gives each a real identifier, a real name and an icon, and only an `Info.plist` can.

Two details are worth knowing before editing this app's mark, which is what the icon is
generated from. Every tile is rasterised from the SVG at that tile's own size rather than
resampled down from one big render, so a 16-pixel icon is drawn as vector rather than
squeezed. And the mark is padded into 824 of 1024 with a transparent margin — Apple's grid
for a circular icon — because a disc drawn edge to edge overhangs every neighbour in the
Dock by 7%, which reads as a wrong icon rather than a big one. Both numbers assume the
mark's disc is 440 of a 512 viewBox; a mark drawn to other proportions wants `INSET` in
`tools/icons.ts` adjusted to match.

**A locally built bundle opens here regardless**, because quarantine is set by whatever
*downloads* a file, and a bundle you built never had one, so a copy you built and dragged
into `/Applications` double-clicks open.

Where a *missing* signature bites is a copy that travelled. That is not the usual
"unidentified developer" prompt you can right-click past: electron-builder rewrote the
bundle without re-sealing its resources, so `spctl` reads the signature as broken outright
(*code has no resources but signature indicates they must be present*). Signing is the fix;
there isn't a gesture that substitutes for it, which is why `release.yml` verifies with
`spctl` rather than trusting a green pack step.

## What has no tests, and why that is correct

Nothing under `electron/` is reachable from vitest — a main process is not something a test
runner can enter, and that is as true of `@openflow/desktop` as it is of this file. Zero
coverage there is the honest picture rather than a gap to paper over with a fake test. What
*is* testable is the one decision the renderer makes, and `bridgeUrl.test.ts` covers all
three of its cases; the registry those apps are described by is ordinary data, and
`desktop/src/apps.test.ts` covers it.
