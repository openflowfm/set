# The snapshot lifecycle

How the set gets into the app and stays current: the client, the walk, deltas, the staleness backstop, and why a write patches instead of re-reading.

## The client / hook split

`client.ts` is framework-free on purpose — it's the piece most likely to get reused
(a CLI, a stage display, a test harness).

- Requests carry an `id`; `request()` resolves with the **terminal** event for that id,
  per the `TERMINAL` map. Add a row there when you add an awaitable message.
- Non-terminal traffic (`progress`, `changed`, `status`) goes to
  `subscribe()` listeners instead.
- `error` rejects any pending request with that id.
- Auto-reconnects after 1s on close, unless we closed it ourselves. All pending
  requests reject on disconnect rather than hanging.
- `lastWireTiming` holds round-trip, parse cost and payload size for the most recent
  reply. Read it synchronously right after the `await`. This is safe because UI
  requests are serialized behind `busy`; it would need per-id storage if that changed.

`hooks/useBridge.ts` wraps it in React state, and `components/BridgeProvider.tsx` is
the only thing that calls it — once, above `App`, for the reasons under **Dev**.
Everything else reads the same object back through `useBridgeSession()`. The
separable pieces — the log
(`useLog`) and the set-owned configuration (`useDeviceState`) — are their own hooks
that it composes; the connection, the
snapshot walk and the apply/undo/moveScenes write path stay together in
`useBridge` itself because they share `guard`, the snapshot ref and the undo
entry. `guard()` wraps every operation so failures land in the log rather than
as unhandled rejections.

## The snapshot happens by itself, and usually costs nothing

`useBridge` asks for the set as soon as the LOM reports ready. **Snapshot** was the first
thing anyone pressed every time, so it was a button that existed only to be pressed; it
stays as the manual override now that the grid mostly keeps up on its own.

**Asking for the set is not the same as walking it.** The bridge holds the current set and
answers from it, so the automatic request on connect is normally free — no LOM walk, no
~8.8s of Live's main thread on a full-size set, and a second tab that opens instantly.
`fresh: true` is what forces the walk anyway, and exactly one thing sends it: the
**Snapshot** button (`refresh`).

That is a person asking the one question held state cannot answer — whether something with
no `observe` at all has changed. **The client never decides to walk on its own**; the
staleness backstop that used to live here is the bridge's now, because deciding the set is
stale and spending Live's main thread to find out belongs to the process that owns the set
rather than to N tabs reaching the same conclusion at the same moment. Everything else — the first connect, a `changed structure`,
a write Live took only half of, a delta that didn't line up — asks without `fresh`, because
in each of those the bridge either holds a set that is current or has already dropped its
own and will walk on that very request. What the bridge does with the two cases is in
[`bridge/docs/multiple-clients.md`](https://github.com/openflowfm/bridge/blob/main/docs/multiple-clients.md).

The reply carries `cached`, which says which of the two happened.

## The songs come with it

The snapshot event carries a **`SetModel`** beside the snapshot: the songs in the set with
their facts already rendered, read out of the scene names once, in the bridge, for Push and
every browser tab at the same time. `useBridge` holds the two together as one piece of
state — a model describing a different revision than the snapshot beside it would draw song
headers over rows they don't belong to — and `useSongLayout` lays the grid out from it
without compiling a pattern.

Two things still read the names in the browser, and both are deliberate:

- **`useSongLayout`'s `derivation`.** That is the *scene* layer — each scene's parsed
  fields — which the scene-level modals work in and which the model deliberately doesn't
  carry. See `core/docs/setModel.md` for where the boundary is drawn.
- **`reconcile`, after a scene write.** A scene name *is* the mapping, so renaming four
  scenes changes the song headers above them; the copy we just patched needs a model that
  matches it, and the bridge's answer describes what Live confirmed a moment ago. Same
  function, same rules — the next snapshot or scene delta replaces it with an identical
  answer from the bridge.

## Keeping up with Live

**The bridge follows Live; the client is told.** These three are not client
subscriptions — `useBridge` sends nothing to arm them, and a tab opening or closing does
not start or stop any of them. The device holds them for as long as it is loaded, so what
it knows about the set does not depend on whether a browser is open:

| | catches | costs |
|---|---|---|
| `observe` → `changed structure` | a track or scene added, removed, reordered | a full re-walk, and it has to be — every index changed meaning |
| `watch_selection` → `delta` | **a clip moved, copied or deleted in Live**, one renamed, recolored or deleted *in place*, and a scene or track renamed, recolored or retempoed | ~11ms a track |
| staleness | what has no `observe` at all — `Clip.length`, `Track.fold_state`, another device | a full walk, at most one per `STALE_MS` |

What reaches the client is the result: `changed`, `delta` and the `SetModel` riding on it.
Coming back to the window re-asks the bridge for the set, which is a message and a payload
rather than a walk.

The middle one is the interesting one, and how it works is in
[`bridge/README.md`](https://github.com/openflowfm/bridge/blob/main/README.md) under *Following Live*: the bridge watches
Live's Session cursor — two observers, not one per slot — and re-reads the track the
cursor moved to **and the one it left**, because you have to select a clip to drag it, so
the position it left is where the clip came from.

The client's job is the merge, and it is deliberately paranoid about one thing. A `delta`
carries `prevRev`, and it is applied **only** when that equals the rev in hand; anything
else means a message was missed and the answer is `resync()`, not a retry. Applying a
delta to the wrong base would splice two revisions of the set together — the tracks in
scope from one, everything else from another — and the result would look plausible.
`canApplyDelta` and `mergeTrackDelta` are both in `core/` with tests, for the reason
everything else that merges is: a grid disagreeing with Live gives no hint which of the
two is lying.

The middle row grew: the bridge also watches the properties of whatever the cursor is
sitting on — the clip, the scene and the track — which is how an in-place rename now
arrives as a delta instead of waiting for a walk. You have to select something in Live to
edit it, so the cursor is always already on the thing being changed. A **scene** rename is
the one that matters most, because in this project the scene name *is* the mapping.

The client's half of that is one line in the `delta` case, and it uses **two** merges on
purpose. `mergeTrackDelta` replaces clips by scope; `mergeRows` upserts scene and track
rows by index. They differ because a clip can vanish from a track and a scene cannot —
the reasoning is on `mergeRows` in `core/`, and it's worth reading before anyone
"simplifies" them into one.

A delta also carries a **`model`**, but only when it moved a scene row — a rename or a
retempo is the one kind of change that can alter the songs, and re-sending the whole song
list on every clip edit is the chatty design the coarse-grained rule exists to prevent.
So the merge takes `event.model ?? held.model`, the same shape as `d.tempo ?? held.tempo`
beside it. The bridge runs this identical merge over its own copy, which is what makes the
next client's request free.

**The backstop exists for what nothing can report, and it runs in the bridge.** Some of
what a snapshot carries has no `observe` in the LOM at all — `Clip.length`, `Track.fold_state` — and another M4L
device or a remote script announces nothing either. There is no cheap way to check: any
honest fingerprint of the set needs clip content, which needs the slot scan, which is 80%
of the walk. So the only way to find out is to look, and the only question is when.

**It used to look on every window focus**, which spent ~950ms of Live's main thread per
alt-tab to answer a question that is almost always "nothing changed". Focus is a
convenient moment to ask, not a reason in itself; the trigger that matches the job is
**age**. Then it moved again, out of the browser entirely: a tab that was merely *open*
was deciding Live should spend ~2.6s, and several tabs decided it at once. `shouldWalk` is
still in [`core/`](https://github.com/openflowfm/core#readme) with tests rather than as two constants
somewhere, and it answers three things at once — `bridge.ts` is what calls it now, on a
fixed tick:

- **only a snapshot resets the clock, never a delta.** A delta proves the bridge is alive
  and following; only a walk proves *everything* is current. Were deltas to stamp it, a
  set under active editing would never re-walk — and that's the set most likely to have
  drifted somewhere no observer is watching.
- **`MIN_INTERVAL_MS` absorbs the burst.** `focus` and `visibilitychange` both fire on one
  alt-tab. They're both still listened to, because they catch different things — a hidden
  tab versus another window on the same desktop — so the floor is what makes them one walk
  instead of two.
- **holding nothing is not staleness.** With no snapshot there's nothing to distrust, and
  the first walk belongs to the device's own read when the LOM reports ready.

Two guards around the walk itself, and both were bugs before:

- **`busyRef` is set synchronously inside `guard`**, not assigned from `busy` during
  render. Render happens a tick after the call, so a render-assigned ref still read
  `false` for anything firing in the same tick as the write that set it — and a snapshot
  taken mid-`apply` reads a half-written set.
- **`resync` is single-flight, and it joins rather than drops.** Three callers are
  fire-and-forget, but `write` and the move paths *await* it because they need state they
  can trust afterwards; dropping the call would hand them a stale snapshot with nothing to
  say so. It also reports its own failures instead of throwing — the fire-and-forget
  callers sit outside `guard`, so a throw was an unhandled rejection and a walk that
  failed in silence.

The first walk fires once per *session*, guarded by a ref, and that guard is the point: a
walk that **fails** leaves `snapshot` null with `lomReady` still true, so without it the
effect would re-run and retry forever — hammering the LOM with the walk that just broke.

## A write patches the snapshot; it doesn't re-read the set

Every write used to end in a full walk, because a snapshot was the only thing that ever
set that state. Tagging four scenes with a role meant re-reading every clip in the set to
be told what we had just written, and on a real set that's the difference between a chip
that changes instantly and one that changes after a visible pause.

So `write` and `moveClips` patch the copy in hand instead. The arithmetic is in `core/` —
`applyOps`, `applySceneOps`, `applyClipMove` — because a merge that's subtly wrong shows a
grid disagreeing with Live and gives no hint which of the two is lying, and that deserves
tests rather than a hook. **The bridge patches its own held copy with the same three
functions and the same batch**, so the two stay in step without either being told.

A scene write also re-reads the mapping locally, because a scene name *is* the mapping:
rename four scenes and the headers above them are about a different song. That is the one
place the browser builds a `SetModel` for itself rather than being handed one.

**`resync()` is still there and four things still reach for it**, which is what makes
being optimistic safe:

- **A write Live didn't take in full.** `apply` answers with counts, never with *which*
  ops it skipped, so `applied === sent` is the only claim strong enough to patch from.
  Anything less and the walk is the only way to find out what actually happened.
- **A clip move that reported a failure.** `lom.ts` skips the entire delete pass if any
  copy failed, so the set holds both copies — a state the plan doesn't describe.
- **`moveScenes`, always.** It creates and deletes scenes, so every index below the edit
  means something different. That isn't a patch to the set we hold, it's a different set.
- **`addScenes`, always.** It deletes nothing, but insertion still renumbers every scene
  below the gap. The bridge coalesces eight Live observer callbacks into one structural
  change, then every client walks the finished block once.

What this gives up is the free ride: a re-walk after every write also picked up changes
*you* made in Live, so the grid quietly caught up on a track you renamed there. It no
longer does, and **Snapshot** is how you ask for that. Worth knowing when the grid and
Live disagree — the button is the answer, and it's the same button it always was.

## Snapshot timing readout

A **walk** prints a phase breakdown to the browser console — the answer to "is
this design going to scale":

```
⏱ snapshot  243 clips · 100 scenes · 1041ms end-to-end
  lom: tracks / scenes / slot scan / clip reads
  v8 → dict        JSON.stringify + Dict.parse
  node getDict     Max dict → JS object
  wire + parse     payload size
  react commit
projection to 848 scenes (×8.5, linear): ~8.8s end-to-end
```

The projection is honest because every phase is a linear scan. `TARGET_SCENES` in
`lib/snapshotTiming.ts` sets the reference size.

**A cached answer prints one line instead**, and says so:

```
⏱ snapshot 243 clips · 100 scenes · held by the bridge, no LOM walk — 34ms end-to-end
```

The table would be a lie there. `data.ms` and `timings` describe the walk the held set was
*originally* read from — the bridge re-sends them rather than zeroing them, because the
snapshot really is that walk's output and half-zeroed numbers would disagree with
themselves — so projecting full-set cost from them would attribute an old walk to a request
that cost nothing. `cached` on the event is what separates the two, and it is the only
thing that can.

The status strip's `LOM walk` and `Slot scan` tiles read the same original numbers, and
the log line says `held by the bridge, no walk` in place of the LOM time.
