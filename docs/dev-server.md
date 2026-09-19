# Dev server and hot reload

Running the dev server, and what a hot update costs — why BridgeProvider sits above App.

## Dev

```sh
npm run watch      # its dev server and its window, one command — the one to type
npm run ui         # the dev server alone, against a device someone else is running
npm run dev        # the window alone, pointed at a dev server that is already up
npm run bench      # the device bench, with no connection at all
npm start          # the desktop app, on the built output — see docs/desktop.md
```

Use **<http://localhost:5173>** for the dev loop — in a browser, or in `npm run dev`,
which is the same page inside the window that ships. Vite proxies `/ws` through to the
device, so you get HMR with React Fast Refresh — and, more to the point, a loaded snapshot
that survives your edits. A walk is ~950ms of Live's main thread; an edit to a CSS
variable must not spend it.

`dev:set` starts both and takes both down together. `dev:set-app` needs a dev server
already running and does not start one; it retries until one answers rather than leaving a
window on a connection error, which is what makes it safe to run against `npm run dev`. What it changes and what it
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
| `OPENFLOW_PORT_BASE` | `5173` | **every** dev server counts from this — one per worktree |
| `OPENFLOW_SET_UI_PORT` | from `OPENFLOW_PORT_BASE` | moving this one app without moving the base; every app has the same variable under its own name |
| `OPENFLOW_BENCH_PORT` | `OPENFLOW_PORT_BASE` + 100 | used in the separate Widgets checkout to override its bench port |
| `OPENFLOW_DEVICE_BENCH_PORT` | `OPENFLOW_PORT_BASE` + 200 | the same, for the device bench |
| `OPENFLOW_BRIDGE` | `http://127.0.0.1:17800` | pointing at a device other than the local one |
| `OPENFLOW_DEV` | unset | read by the **app**, not by vite: open on the dev server instead of the bundle |
| `OPENFLOW_DEV_URL` | from `OPENFLOW_PORT_BASE` | the same, at an address this could not have worked out |

The offsets themselves are `desktop/src/apps.ts` now, read by the app and by its vite config
alike — see [`desktop/docs/registry.md`](https://github.com/openflowfm/desktop/blob/main/docs/registry.md).

`strictPort` is on, so a port collision fails loudly instead of drifting to the next
free one. That's deliberate: assign the port, don't discover it.

The device bench uses base + 200. The independent Widgets bench retains base + 100
when launched in its own checkout with the same environment. Offsets use hundreds
because worktree base ports are picked adjacently. Run `npm ci` and `npm run dev`
in [Widgets](https://github.com/openflowfm/widgets); this repository's dev stack
starts only the device bench. See its [bench guide](https://github.com/openflowfm/widgets/blob/main/docs/bench.md).

The device bench is `set/bench/`, served by `set/vite.bench.config.ts`. It draws the faces
with the app's palette and no connection at all — no provider, no client, no socket — so
it is the one dev server that says nothing about whether the bridge is up.

Several dev servers can share one device — they all proxy to the same bridge, and
`bridgeUrl()` falls back to `location.host` when nothing has told it otherwise, so nothing
needs telling which port it's on. That's the multi-client path, so see
[`bridge/README.md`](https://github.com/ryangavin/better-session-view/blob/main/bridge/README.md) for what the bridge does and doesn't yet
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
