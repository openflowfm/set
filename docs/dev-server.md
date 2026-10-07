# Dev server and hot reload

Running the dev server, and what a hot update costs — why BridgeProvider sits above App.

## Dev

```sh
npm run dev        # its dev server and its window, one command — the one to type
npm run watch      # the same, by its older name
npm run ui         # the dev server alone, for a browser
npm run bench      # the device bench, with no connection at all
npm start          # the desktop app, on the built output — see docs/desktop.md
```

**No dev port is fixed or assumed.** Many projects and worktrees run side by side, and a
number like vite's 5173 is one somebody else is already on. Every dev server here takes
`PORT` when a launcher picked one (`.claude/launch.json`, with `autoPort`), and otherwise
port `0`, so the OS hands out a free one; vite prints where it landed. `strictPort` is on
only when a port was named — whoever named it is going to dial it.

Use the URL vite prints for the dev loop — in a browser, or in `npm run dev`, which is the
same page inside the window that ships. Vite proxies `/ws` through to the device, so you
get HMR with React Fast Refresh — and, more to the point, a loaded snapshot that survives
your edits. A walk is ~950ms of Live's main thread; an edit to a CSS variable must not
spend it.

`npm run dev` runs vite inside `tools/app.ts`, reads the port it bound off the socket, and
starts the window with `OPENFLOW_DEV_URL` and `OPENFLOW_SET_UI_PORT` set to it. Closing the
window takes vite down with it. With `OPENFLOW_DEV_URL` already set it starts no server and
opens onto that one — a second window onto a running `npm run ui`. The window retries until
the page answers rather than leaving a connection error. What it changes and what it
deliberately doesn't — the bridge URL, the `localStorage` bucket, the title — is in
[`desktop.md`](desktop.md).

### What a hot update costs

`BridgeProvider` is what makes that true, and it earns its place by being the parent
of `App` rather than something inside it. Fast Refresh does one of two things to a
component whose module updated, and with the connection inside `App` both of them
were re-reading the whole set:

- **Re-render with fresh dependencies.** React ignores the previous deps of every
  `useMemo`, `useCallback` and `useEffect` in a component it just hot-updated, so
  `useMemo(() => new BridgeClient(), [])` built a new client — dropping the socket,
  reconnecting, and re-arming every watch this client owns. That used to include
  `observe`, which re-attaches the `tracks` and `scenes` observers; an observer
  calls back on attach, that was broadcast as `changed structure`, and **every**
  connected client walked the set. So editing a hook re-read forty tracks. The
  device owns those two watches now and a reconnect cannot disturb them, which
  makes this the cheap case rather than the expensive one.
- **Remount.** Fast Refresh compares a signature built from the hooks a component
  calls, *including the hooks nested inside every custom hook it uses* — `App`'s is
  computed over fifteen of them. Change any one and the signatures differ, React
  can't assume the state still means the same thing, and it remounts. That drops
  the snapshot, and the once-per-session walk fires again on the next `lomReady`.

Vite hands an update to the importers of the changed file until one accepts it.
Nothing under `hooks/`, `lib/` or `core/` is a Fast Refresh boundary — only files
whose every export is a component are — so all of them land on `App`. Splitting the
provider out puts that whole blast radius *below* the socket: edit a hook and `App`
remounts against the snapshot the provider is still holding, with no wire traffic
at all.

So the bill for an edit is now the honest one:

| edited | costs |
|---|---|
| a `.css` file | a style swap, nothing else |
| a component under `components/` | that subtree re-renders |
| a hook, `lib/`, `core/`, `App.tsx` | `App` re-renders or remounts; the connection and snapshot survive |
| `useBridge.ts`, `useBridgeSession.ts`, `client.ts` | a reconnect and a walk — you edited the bridge |
| `main.tsx`, `vite.config.ts` | a full page reload |

One thing that still walks and isn't HMR: the staleness backstop. It runs in the
**bridge** now, on a fixed tick, so editing for five minutes no longer means the
next click into the browser spends Live's main thread — coming back to the window
just re-asks for the set, which is a payload. See `core/src/backstop.ts` for the
policy and `bridge.ts`'s `backstopTick` for the caller.

Environment variables, all optional:

| var | default | for |
|---|---|---|
| `PORT` | unset — a free port | the port a launcher picked, for the app's dev server or the device bench |
| `OPENFLOW_SET_UI_PORT` | `PORT`, else a free port | this app's dev server alone; set by `npm run dev` for the window, which keys its dev profile by it |
| `OPENFLOW_BRIDGE` | `http://127.0.0.1:17800` | pointing at a device other than the local one |
| `OPENFLOW_DEV` | unset | read by the **app**, not by vite: open on the dev server instead of the bundle |
| `OPENFLOW_DEV_URL` | set by `npm run dev` | the address the window opens onto; set it yourself to open onto a server already running |

The rule is `desktop/src/apps.ts`'s `uiPort()`, read by the app and by its vite config
alike — see [`desktop/docs/registry.md`](https://github.com/openflowfm/desktop/blob/main/docs/registry.md).
The bridge's `17800` is not a dev port: it is the device's, and other machines dial it.

The device bench needs nothing from the dev server, so it takes `PORT` or a free port of
its own. The Widgets bench lives in [Widgets](https://github.com/openflowfm/widgets) — run
`npm ci` and `npm run dev` there; this repository's dev stack starts only the device bench.
See its [bench guide](https://github.com/openflowfm/widgets/blob/main/docs/bench.md).

The device bench is `set/bench/`, served by `set/vite.bench.config.ts`. It draws the faces
with the app's palette and no connection at all — no provider, no client, no socket — so
it is the one dev server that says nothing about whether the bridge is up.

Several dev servers can share one device — they all proxy to the same bridge, and
`bridgeUrl()` falls back to `location.host` when nothing has told it otherwise, so nothing
needs telling which port it's on. That's the multi-client path, so see
[`bridge/README.md`](https://github.com/openflowfm/bridge/blob/main/README.md) for what the bridge does and doesn't yet
guarantee when more than one client is connected.

**:17800 is not a URL any more.** The device serves no page — it answers a browser with one
sentence and nothing else. To test what actually ships, run `npm start`, which builds the
same output the dev server compiles and opens it in the desktop app; the address only ever
appears now as the thing that app dials. The `reload` event the device used to push when its
`public/` folder changed went with the folder, so there is one path here rather than two,
and in dev Vite's HMR was always the one that won.

**Nothing loads from a CDN.** No external fonts, scripts, or stylesheets. This
eventually runs on stage, where there may be no network. Vite bundles everything;
keep it that way.
