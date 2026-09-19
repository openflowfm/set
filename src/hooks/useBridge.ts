import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BridgeClient, type ConnectionState } from '../lib/client.ts';
import { applyOps, inverseOps } from '@openflow/core/ops.ts';
import {
  applySceneOps,
  countUnrevertableColors,
  inverseSceneOps,
  sceneFields,
} from '@openflow/core/roles.ts';
import type { SceneMovePlan } from '@openflow/core/sceneMove.ts';
import { canApplyDelta, mergeRows, mergeTrackDelta } from '@openflow/core/snapshotDelta.ts';
import { applyClipMove, type ClipMovePlan } from '@openflow/core/clipMove.ts';
import { LIVE_PALETTE } from '@openflow/core/livePalette.ts';
import { derive } from '@openflow/core/derive.ts';
import { SCENE_PATTERNS } from '@openflow/core/namePattern.ts';
import { buildSetModel } from '@openflow/core/setModel.ts';
import { errText, reportSnapshotTiming } from '../lib/snapshotTiming.ts';
import { useLog, type LogLine } from './useLog.ts';
import { useDeviceState } from './useDeviceState.ts';

/**
 * The part of a plan that goes on the wire. `SceneMovePlan` also carries counts
 * and final positions, which are for the UI to talk about and nothing the bridge
 * needs to be told.
 */
type MovePlanFor = Pick<SceneMovePlan, 'create' | 'steps' | 'remove'>;

/** The same split for a clip drag: the counts stay behind for the UI. */
type ClipMovePlanFor = Pick<ClipMovePlan, 'steps' | 'remove'>;

/**
 * The shared busy/error wrapper — every write path runs inside one of these,
 * so failures land in the log rather than as unhandled rejections.
 */
export type Guard = (label: string, fn: () => Promise<void>) => Promise<void>;

/**
 * What Live is playing. `tracks` is empty until the first `playState` arrives,
 * so `playingIn`/`firedIn` answer "nothing" rather than throwing while the
 * observers are still being installed.
 */
export interface PlayState {
  isPlaying: boolean;
  tracks: OpenFlow.TrackPlayState[];
}

const NOT_PLAYING: PlayState = { isPlaying: false, tracks: [] };

export interface SongPosition {
  bar: number;
  beat: number;
  sixteenth: number;
}

export type MeterListener = (frame: OpenFlow.MeterFrame) => void;
export type ClipStatusListener = (frame: OpenFlow.ClipStatusFrame) => void;
export type MixerListener = (state: OpenFlow.MixerState | null) => void;

/** Null when the LOM went away and every observer behind the chains with it. */
export type ChainListener = (state: OpenFlow.ChainState | null) => void;

export type ChainValueListener = (changes: readonly OpenFlow.ChainValueChange[]) => void;

/** One write, of either kind or both. Empty arrays rather than optionals so
 *  every count in here is `ops.length + sceneOps.length` with no branching. */
interface Batch {
  ops: OpenFlow.ApplyOp[];
  sceneOps: OpenFlow.SceneOp[];
}

/**
 * The set in hand: what Live holds, and what this app reads it as.
 *
 * One piece of state rather than two, because a model that describes a
 * different revision of the set than the snapshot beside it would draw song
 * headers over rows they don't belong to. They are always replaced together.
 */
interface HeldSet {
  snapshot: OpenFlow.Snapshot;
  model: OpenFlow.SetModel;
}

export interface BridgeState {
  connection: ConnectionState;
  lomReady: boolean;
  snapshot: OpenFlow.Snapshot | null;
  /**
   * The songs in the set, as the bridge read them — always describing the
   * `snapshot` beside it. Null until the first one arrives.
   *
   * Nothing draws a song by reading a scene name; the mapping is read once, in
   * the bridge, for Push and every browser tab together. See
   * `core/docs/setModel.md`, and `reconcile` for the single exception.
   */
  model: OpenFlow.SetModel | null;
  palette: number[];
  /** Set-owned configuration restored from the device's Stored Only parameter. */
  defaultArtist: string;
  roles: OpenFlow.Role[];
  allowedColors: number[] | null;
  /**
   * Whether a bpm write also sets `Scene.tempo` on the song's first scene.
   *
   * Off unless the set says otherwise: the bpm is a label and changes nothing
   * about playback, and turning this on makes a rename alter how the set plays.
   */
  writeSceneTempo: boolean;
  play: PlayState;
  /** Live's observed control-bar settings. Null until the watch reports. */
  transport: OpenFlow.TransportState | null;
  /** Live's arrangement position, or null until its observer has reported. */
  songPosition: SongPosition | null;
  progress: { done: number; total: number } | null;
  log: LogLine[];
  busy: boolean;
  /** True only while the UI is re-reading the set, not during other writes. */
  syncing: boolean;
  /** 1 when the last write can be reversed, 0 otherwise. */
  undoDepth: number;
  refresh: () => Promise<void>;
  apply: (ops: OpenFlow.ApplyOp[], label?: string) => Promise<void>;
  /** Scene-addressed writes — role tags and scene colors. */
  applyScenes: (sceneOps: OpenFlow.SceneOp[], label?: string) => Promise<void>;
  /** Insert and configure blank scenes. Additive, but structural: indexes shift. */
  addScenes: (addition: OpenFlow.SceneAddition, label?: string) => Promise<void>;
  /**
   * Reorder scenes. **The one write with no undo of ours** — it creates and
   * deletes scenes, and a snapshot can't rebuild a deleted one. Clears the undo
   * entry rather than arming it.
   */
  moveScenes: (plan: MovePlanFor, label: string) => Promise<void>;
  /**
   * Move clips around the grid. **Also has no undo of ours** — it overwrites
   * whatever was at the target, and a snapshot can't rebuild an overwritten
   * clip any more than it can a deleted scene. Clears the undo entry.
   */
  moveClips: (plan: ClipMovePlanFor, label: string) => Promise<void>;
  /**
   * Replace the set's naming defaults and role definitions as one form.
   *
   * `writeSceneTempo` is optional and **omitted means "not saying"**, not
   * "false" — so a caller that doesn't know about the flag can't turn it off by
   * saving the rest of the form.
   */
  saveSetConfig: (
    defaultArtist: string,
    roles: OpenFlow.Role[],
    writeSceneTempo?: boolean,
  ) => Promise<void>;
  setAllowedColors: (colors: number[] | null) => void;
  undo: () => Promise<void>;
  /** Fire something. No await: the answer you want is `play` changing. */
  launch: (target: OpenFlow.LaunchTarget) => void;
  stop: (target: OpenFlow.StopTarget) => void;
  /** Write a related subset of Live's control-bar state in one operation. */
  setTransport: (patch: OpenFlow.TransportPatch) => void;
  /** Write one mixer strip. Its observed readback updates the panel. */
  setMixer: (target: OpenFlow.MixerTarget, patch: OpenFlow.MixerPatch) => void;
  /**
   * Write one device: its activator, its fold state, or one of its controls.
   *
   * Fire-and-forget, and the readback is the watch. Unfolding is the same
   * gesture as subscribing to a device's controls — `open` is derived from
   * fold state — so this is how a face gets its parameters at all.
   */
  setDevice: (target: OpenFlow.DeviceTarget, patch: OpenFlow.DevicePatch) => void;
  /**
   * Fold or unfold a group track in Live. No await, and no reply — the grid
   * has already moved its own columns. See `setFold` in the protocol.
   */
  setFold: (t: number, folded: boolean) => void;
  /** Select and reveal one exact scene in Live's Session View. */
  selectScene: (s: number) => void;
  /**
   * Select one exact track in Live, so its own device view shows the chain the
   * footer is showing. Fire-and-forget, like `selectScene`.
   */
  selectTrack: (t: number) => void;
  /**
   * Declare every device run this client is looking at, whole.
   *
   * Not a subscribe/unsubscribe pair: the bridge unions these across clients,
   * so an empty list is how you stop and a dropped socket says the same thing.
   * See [`core/src/chainWatch.ts`](../../../core/docs/chainWatch.md).
   */
  watchChains: (subs: OpenFlow.ChainWatch[]) => void;
  /** The watched runs, pushed whenever anything in one of them changes. */
  subscribeChains: (listener: ChainListener) => () => void;
  /**
   * Controls that moved, at gesture rate. Kept off App state for the reason the
   * meters are: one automated knob would re-render everything under `App`.
   */
  subscribeChainValues: (listener: ChainValueListener) => () => void;
  /**
   * Listen to the high-frequency meter stream without putting it in the
   * composition root's state and re-rendering the entire grid every frame.
   */
  subscribeMeters: (listener: MeterListener) => () => void;
  /** Mixer state bypasses App state so automated faders redraw one strip. */
  subscribeMixer: (listener: MixerListener) => () => void;
  /**
   * The playing clip in each track, for the stop row's status displays. Same
   * arrangement as the meters and for the same reason: a playhead moving at
   * 20 Hz through App state would re-render every row in the grid.
   */
  subscribeClipStatus: (listener: ClipStatusListener) => () => void;
}

/**
 * The React face of the bridge. The separable pieces live in their own hooks —
 * useLog and useDeviceState — and this composes them with the parts
 * that are one cohesive unit: the connection, the snapshot walk, and the
 * apply/undo/moveScenes write path, which all share `guard`, the snapshot ref
 * and the undo entry.
 *
 * **Called once, from `BridgeProvider`, and nowhere else.** It opens a socket
 * and installs observers in Live, so a second caller is a second connection;
 * and the component that calls it is the component a hot update reconnects.
 * Read it through `useBridgeSession()` instead — see BridgeProvider for what
 * calling it from `App` used to cost.
 */
export function useBridge(
  watchMeters = false,
  watchSends = false,
  watchStatus = false,
): BridgeState {
  const client = useMemo(() => new BridgeClient(), []);
  const { log, say } = useLog();

  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lomReady, setLomReady] = useState(false);
  const [set, setSet] = useState<HeldSet | null>(null);
  const snapshot = set?.snapshot ?? null;
  const [play, setPlay] = useState<PlayState>(NOT_PLAYING);
  const [transport, setTransportState] = useState<OpenFlow.TransportState | null>(null);
  const [songPosition, setSongPosition] = useState<SongPosition | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Both of these are refs rather than dependencies so the socket subscription
  // can be established once. Making it depend on either identity would tear the
  // listener down and rebuild it — and with it every meter subscription — each
  // time a snapshot arrived, which is exactly when it must not.
  const setRef = useRef<HeldSet | null>(null);
  const resyncRef = useRef<((fresh?: boolean) => Promise<void>) | null>(null);
  /**
   * Read by the backstop, which must not walk the set on top of a write.
   *
   * Set **synchronously inside `guard`**, not assigned from `busy` during
   * render. Rendering happens a tick later than the call, so a render-assigned
   * ref still reads false for anything that fires in the same tick as the write
   * that set it — which is the whole class of bug this guard exists to prevent.
   */
  const busyRef = useRef(false);
  /** The walk in flight, if there is one. Null between walks. */
  const walkRef = useRef<Promise<void> | null>(null);

  const guard: Guard = useCallback(
    async (label, fn) => {
      busyRef.current = true;
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        say(`${label}: ${errText(e)}`, 'error');
      } finally {
        busyRef.current = false;
        setBusy(false);
        setProgress(null);
      }
    },
    [say],
  );

  const palette = useMemo<number[]>(() => Array.from(LIVE_PALETTE), []);
  const {
    defaultArtist,
    roles,
    allowedColors,
    writeSceneTempo,
    adoptDeviceState,
    saveSetConfig,
    setAllowedColors,
  } = useDeviceState(client, guard, say);

  /**
   * A snapshot is the read half shared by manual refreshes and post-write
   * reconciliation. Keep it distinct from `busy`: writes already have local
   * feedback, while this is the operation that needs to cover stale content.
   */
  const whileSyncing = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSyncing(true);
    setProgress({ done: 0, total: 100 });
    try {
      return await fn();
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    const off = client.subscribe((event) => {
      switch (event.type) {
        case 'status':
          setConnection(client.state);
          setLomReady(event.lomReady);
          // A dropped socket says nothing about what Live is doing, but we stop
          // hearing about it — so show nothing rather than a frozen last frame.
          if (!event.lomReady) {
            setPlay(NOT_PLAYING);
            setSongPosition(null);
            setTransportState(null);
          }
          break;
        case 'playState':
          setPlay({ isPlaying: event.isPlaying, tracks: event.tracks });
          break;
        // The output meters and the stop row's status displays subscribe to
        // these streams directly. Putting 20–30 Hz frames in this hook's state
        // would re-render App and the whole grid.
        case 'meterLevels':
        case 'clipStatus':
        case 'mixerState':
          break;
        case 'songPosition':
          setSongPosition({
            bar: event.bar,
            beat: event.beat,
            sixteenth: event.sixteenth,
          });
          break;
        case 'transportState':
          setTransportState(event.state);
          break;
        case 'progress':
          setProgress({ done: event.done, total: event.total });
          break;
        // Structural: a track or scene was added, removed or reordered, so
        // every index means something different now. Nothing can be patched —
        // re-walk. `moved` and the write kinds are our own doing and already
        // reconciled locally, so re-walking for those would be a second full
        // read of a set we just wrote.
        case 'changed':
          say(`Live set changed (${event.kind})`);
          if (event.kind === 'structure') void resyncRef.current?.();
          break;
        // A partial re-read from Live. `prevRev` is the guard: a delta rewrites
        // only its own scope, so applying one to any state but the exact one it
        // was computed against would splice two different revisions of the set
        // together. A mismatch means a message was missed, and the answer to
        // that is a full walk, not a retry.
        case 'delta': {
          const held = setRef.current;
          if (!held) break;
          const s = held.snapshot;
          if (!canApplyDelta(s.rev, event.data.prevRev)) {
            say('missed an update from Live — re-reading the set', 'info');
            void resyncRef.current?.();
            break;
          }
          const d = event.data;
          const clips = mergeTrackDelta(s.clips, d.clipScope, d.clips);
          // Rows upsert by index; clips replace by scope. The two merges differ
          // because a clip can vanish from a track and a scene cannot — see
          // `mergeRows` in core/ for the argument, which is worth reading before
          // "simplifying" them into one.
          setSet({
            snapshot: {
              ...s,
              rev: d.rev,
              clips,
              clipCount: clips.length,
              scenes: mergeRows(s.scenes, d.sceneRows ?? []),
              tracks: mergeRows(s.tracks, d.trackRows ?? []),
              tempo: d.tempo ?? s.tempo,
              masterColor: d.masterColor === undefined ? s.masterColor : d.masterColor,
            },
            // Present only when the delta moved a scene row, because nothing
            // else can change the mapping. Same shape as `d.tempo` above, and
            // on the event rather than in `data` because the snapshot is what
            // Live holds and the model is what we read it as.
            model: event.model ?? held.model,
          });
          break;
        }
        case 'deviceState':
          adoptDeviceState(event.state);
          break;
        case 'error':
          say(event.message || 'bridge reported an error with no message', 'error');
          break;
      }
    });
    client.connect();
    return () => {
      off();
      client.close();
    };
  }, [adoptDeviceState, client, say]);

  // Play-state observers are installed per track, so a set that gained or lost
  // one leaves them stale — re-arm on every snapshot rather than only once.
  // Keyed on trackCount and not the snapshot object because `apply` re-snapshots
  // and would otherwise tear down 80 observers after every rename.
  const trackCount = snapshot?.trackCount;
  useEffect(() => {
    if (!lomReady || trackCount === undefined) return;
    client.send({ type: 'watchPlay', on: true });
    return () => client.send({ type: 'watchPlay', on: false });
  }, [client, lomReady, trackCount]);

  // Meter levels and mixer controls are more expensive and only useful while
  // their footer is visible. Like play state, their observer lists are
  // track-addressed and must be rebuilt when a snapshot discovers a different
  // track count.
  useEffect(() => {
    if (!lomReady || trackCount === undefined || !watchMeters) return;
    client.send({ type: 'watchMeters', on: true });
    return () => client.send({ type: 'watchMeters', on: false });
  }, [client, lomReady, trackCount, watchMeters]);

  // The status displays read clip properties, which nothing else here does.
  // They cost only while the stop row they draw in is on screen, and the read
  // loop walks the set by track, so a new track count has to rebuild it.
  useEffect(() => {
    if (!lomReady || trackCount === undefined || !watchStatus) return;
    client.send({ type: 'watchStatus', on: true });
    return () => client.send({ type: 'watchStatus', on: false });
  }, [client, lomReady, trackCount, watchStatus]);

  // Each displayed return adds one DeviceParameter observer per set track. Keep
  // those out of Live entirely until the neighboring sends toggle is on.
  useEffect(() => {
    if (!lomReady || trackCount === undefined || !watchSends) return;
    client.send({ type: 'watchSends', on: true });
    return () => client.send({ type: 'watchSends', on: false });
  }, [client, lomReady, trackCount, watchSends]);

  // Live's control-bar state is a viewport concern — nothing off screen needs
  // it — so it stays refcounted against this client like the meters do.
  //
  // `observe` and `watchSelection` are deliberately **not** here. Following the
  // set's structure and the Session cursor is how the *bridge* keeps the copy it
  // holds current, so it does that for itself from the moment the LOM is ready,
  // for as long as the device is loaded. A client subscribing to them made the
  // device's knowledge of the set depend on whether a browser happened to be
  // open, and re-armed the LOM observers on every connect — which announced
  // itself as a structural change and threw the held set away. See
  // `bridge/docs/multiple-clients.md`.
  useEffect(() => {
    if (!lomReady) return;
    client.send({ type: 'watchTransport', on: true });
    return () => client.send({ type: 'watchTransport', on: false });
  }, [client, lomReady]);

  // Coming back to the window asks the bridge for the set again. That is a
  // message and a payload — no walk — so it costs Live nothing and covers the
  // case where this tab sat in the background through changes it missed.
  //
  // **The staleness backstop is not here any more.** Deciding that the set has
  // gone stale, and spending Live's main thread to find out, belongs to the
  // thing that owns the set — one process that knows when it last looked, not N
  // tabs each with their own clock reaching the same conclusion at the same
  // moment. `shouldWalk` still exists and still has its tests; `bridge.ts` is
  // what calls it now.
  useEffect(() => {
    if (!lomReady) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      // Never re-read on top of a write. It reconciles on its own, and a read
      // taken mid-`apply` would show a half-written set.
      if (busyRef.current) return;
      void resyncRef.current?.();
    };
    // Both, because they catch different things — `visibilitychange` covers a
    // minimised or hidden tab, `focus` covers switching windows on the same
    // desktop.
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [lomReady]);

  const subscribeMeters = useCallback(
    (listener: MeterListener) =>
      client.subscribe((event) => {
        if (event.type === 'meterLevels') listener(event.frame);
        // A frozen level looks live. Clear it as soon as the source disappears.
        if (event.type === 'status' && !event.lomReady) {
          listener({ master: 0, tracks: [] });
        }
      }),
    [client],
  );

  const subscribeClipStatus = useCallback(
    (listener: ClipStatusListener) =>
      client.subscribe((event) => {
        if (event.type === 'clipStatus') listener(event.frame);
        // A held pie or a frozen countdown reads as a clip still playing. Empty
        // the frame the moment the source goes away, same as the meters.
        if (event.type === 'status' && !event.lomReady) listener({ tracks: [] });
      }),
    [client],
  );

  const watchChains = useCallback(
    (subs: OpenFlow.ChainWatch[]) => client.send({ type: 'watchChains', subs }),
    [client],
  );

  const subscribeChains = useCallback(
    (listener: ChainListener) =>
      client.subscribe((event) => {
        if (event.type === 'chainState') listener(event.state);
        // The device reloaded, so every observer behind this is gone and what
        // we hold describes runs nobody is watching. Say so rather than leaving
        // a stale chain on screen looking live.
        if (event.type === 'status' && !event.lomReady) listener(null);
      }),
    [client],
  );

  const subscribeChainValues = useCallback(
    (listener: ChainValueListener) =>
      client.subscribe((event) => {
        if (event.type === 'chainValues') listener(event.changes);
      }),
    [client],
  );

  const subscribeMixer = useCallback(
    (listener: MixerListener) =>
      client.subscribe((event) => {
        if (event.type === 'mixerState') listener(event.state);
        if (event.type === 'status' && !event.lomReady) listener(null);
      }),
    [client],
  );

  const launch = useCallback(
    (target: OpenFlow.LaunchTarget) => client.send({ type: 'launch', target }),
    [client],
  );

  const stop = useCallback(
    (target: OpenFlow.StopTarget) => client.send({ type: 'stop', target }),
    [client],
  );

  const setTransport = useCallback(
    (patch: OpenFlow.TransportPatch) => client.send({ type: 'setTransport', patch }),
    [client],
  );

  const setMixer = useCallback(
    (target: OpenFlow.MixerTarget, patch: OpenFlow.MixerPatch) =>
      client.send({ type: 'setMixer', target, patch }),
    [client],
  );

  const setDevice = useCallback(
    (target: OpenFlow.DeviceTarget, patch: OpenFlow.DevicePatch) =>
      client.send({ type: 'setDevice', target, patch }),
    [client],
  );

  /**
   * Told, not asked — so nothing comes back to correct the row we hold, and
   * `Track.fold_state` has no `observe` in the LOM for anything else to report
   * it either. Patch it here or it keeps whatever the last walk read.
   *
   * That staleness is not cosmetic: `reconcile` rebuilds the snapshot around
   * the tracks it already has, and the grid's columns are read out of those.
   * Left unpatched, the next write of any kind — tagging a scene from the role
   * menu, say — hands the grid a snapshot that still says "unfolded" and
   * silently reopens a group Live is holding shut.
   */
  const setFold = useCallback(
    (t: number, folded: boolean) => {
      client.send({ type: 'setFold', t, folded });
      const held = setRef.current;
      if (!held) return;
      const s = held.snapshot;
      // Tracks only, so the songs are untouched.
      const next = {
        ...held,
        snapshot: {
          ...s,
          tracks: s.tracks.map((tr) => (tr.i === t ? { ...tr, isFolded: folded } : tr)),
        },
      };
      // The ref as well as the state: `write` reconciles against the ref, and a
      // write in the same tick as the fold would otherwise reconcile away from
      // the copy React has not committed yet.
      setRef.current = next;
      setSet(next);
    },
    [client],
  );

  const selectScene = useCallback(
    (s: number) => client.send({ type: 'selectScene', s }),
    [client],
  );

  const selectTrack = useCallback(
    (t: number) => client.send({ type: 'selectTrack', t }),
    [client],
  );


  /**
   * Ask for the whole set, and report what it cost.
   *
   * `fresh` is the difference between "give me the set" and "go and look".
   * The bridge holds the current set and answers the first for free; only
   * something no observer reports — `Clip.length`, `Track.fold_state`, another
   * device entirely — is worth making Live walk every clip slot it has.
   */
  const walk = useCallback(
    (fresh: boolean) =>
      guard('snapshot', async () => {
        await whileSyncing(async () => {
          const e = await client.request({ type: 'snapshot', fresh });
          const wire = client.lastWireTiming;
          const commitStart = performance.now();
          setSet({ snapshot: e.data, model: e.model });
          // Queued after React's commit, so it captures render cost too.
          requestAnimationFrame(() => {
            reportSnapshotTiming(e, wire, performance.now() - commitStart);
          });
          say(
            `snapshot — ${e.data.clipCount} clips · ` +
              (e.cached ? 'held by the bridge, no walk' : `${e.data.ms}ms lom`) +
              (wire ? ` · ${Math.round(wire.totalMs)}ms end-to-end` : ''),
            'ok',
          );
        });
      }),
    [client, guard, say, whileSyncing],
  );

  const refresh = useCallback(() => walk(true), [walk]);

  /** Tried once this session — a failed walk must not become a retry loop. */
  const autoWalkedRef = useRef(false);

  /**
   * Walk the set as soon as there is something to walk.
   *
   * Pressing **Snapshot** was the first thing anyone did every time, so it was
   * a button that existed only to be pressed. It stays, for re-walking after a
   * change made in Live.
   *
   * Fires once per *session*, not once per readiness, and the ref is what makes
   * that true. `snapshot === null` alone covers the happy path, but a walk that
   * **fails** leaves it null with `lomReady` still true, so this effect would
   * re-run and try again forever — hammering the LOM with the walk that just
   * broke. One attempt, then the failure stands and the button is right there.
   *
   * **Not `fresh`**, and that is the point of the whole arrangement: a tab that
   * joins a running bridge is answered from the set it already holds, so
   * opening a second one costs Live nothing at all.
   */
  useEffect(() => {
    if (!lomReady || autoWalkedRef.current || snapshot !== null) return;
    autoWalkedRef.current = true;
    void walk(false);
  }, [lomReady, snapshot, walk]);

  // One level of undo, captured from the snapshot rather than from Live. LOM
  // writes don't participate in Live's own history, so ⌘Z in Live will not bring
  // a rename back — this is the only way back there is. Deliberately one level:
  // a stack would need to survive the re-snapshot after every write, and a stale
  // entry that quietly restores the wrong thing is worse than no stack.
  setRef.current = set;
  const [undoDepth, setUndoDepth] = useState(0);
  const undoRef = useRef<{ batch: Batch; label: string } | null>(null);

  const size = (b: Batch) => b.ops.length + b.sceneOps.length;

  // Refs, not deps, for both of these: `write` is handed down to memoized
  // components, and an identity that changes when the palette arrives would
  // re-render the grid for a value it only reads inside an await.
  const paletteRef = useRef<number[]>([]);
  paletteRef.current = palette;

  /**
   * Ask the bridge for the set again. The honest answer to any write.
   *
   * **Not `fresh` by default**, which is what makes it cheap now. Every caller
   * here reaches for it because *this client's* copy can no longer be patched —
   * a delta that didn't line up, a write Live took only half of, a restructure —
   * and in each of those the bridge either holds a set that is current or has
   * dropped its own and will walk on this very request. Asking Live to walk on
   * top of that would spend ~950ms to be told what the bridge already knows.
   *
   * The staleness backstop passes `true`, because it is asking the one question
   * held state cannot answer: whether something with no observer at all has
   * changed underneath both of us.
   */
  const resync = useCallback((fresh = false): Promise<void> => {
    // **Join, don't drop.** Three of the callers are fire-and-forget and would
    // be happy either way, but `write` and the move paths *await* this because
    // they need state they can trust afterwards — dropping the call would hand
    // them back a stale snapshot with no indication anything was skipped.
    if (walkRef.current) return walkRef.current;
    const run = async () => {
      try {
        await whileSyncing(async () => {
          const s = await client.request({ type: 'snapshot', fresh });
          setSet({ snapshot: s.data, model: s.model });
        });
      } catch (e) {
        // Reported here rather than thrown. Three callers reach this as a bare
        // `void resyncRef.current?.()` — outside `guard`, outside any `catch` —
        // so a throw was an unhandled rejection and a walk that failed silently.
        // Labelled `snapshot` rather than borrowing the caller's label, because
        // "apply failed" would be a lie about which half broke.
        say(`snapshot: ${errText(e)}`, 'error');
      }
    };
    // `.finally` always defers, so the assignment below wins the race even if
    // `run()` were to settle without ever suspending.
    const p = run().finally(() => {
      walkRef.current = null;
    });
    walkRef.current = p;
    return p;
  }, [client, say, whileSyncing]);
  resyncRef.current = resync;

  /**
   * The snapshot as it reads once `batch` has landed, or `null` when we can't
   * work it out and the set has to be re-read instead.
   *
   * Every write used to be followed by a full walk, because a snapshot was the
   * only thing that ever set this state. That's a lot of Live to re-read in
   * order to learn that four scenes are now called what we just named them.
   *
   * `null` for the cases where the arithmetic would be guessing:
   *
   * - **Nothing to update yet.** No snapshot means no local copy to patch.
   * - **A color slot we have no RGB for.** A clip's color goes to Live as an
   *   index but is drawn from RGB, so an unresolvable slot would leave the grid
   *   showing the old color against the new index. The palette is derived
   *   before the first walk, so this is close to unreachable.
   *
   * The caller adds the one that matters most: Live has to have taken *every*
   * op. It answers with counts and not with which ops it skipped, so a partial
   * write can't be reproduced here and doesn't try to be.
   *
   * **A scene write re-reads the mapping**, because a scene name *is* the
   * mapping: rename four scenes and the song headers above them are about a
   * different song. This is the one place the client reads the names itself
   * rather than being told — the bridge's model describes what Live confirmed,
   * and this describes an edit we have only just made to our own copy. Same
   * function over the same rules, so the next snapshot or scene delta replaces
   * it with an identical answer from the bridge.
   */
  const reconcile = useCallback((batch: Batch): HeldSet | null => {
    const held = setRef.current;
    if (!held) return null;
    const s = held.snapshot;
    const rgb = paletteRef.current;
    for (const op of batch.ops) {
      if (op.colorIndex !== undefined && rgb[op.colorIndex] === undefined) return null;
    }
    const scenes = applySceneOps(s.scenes, batch.sceneOps);
    return {
      snapshot: {
        ...s,
        clips: applyOps(s.clips, batch.ops, (i) => rgb[i]),
        scenes,
      },
      model:
        batch.sceneOps.length === 0
          ? held.model
          : buildSetModel(derive(scenes, SCENE_PATTERNS), s.rev),
    };
  }, []);

  const write = useCallback(
    (batch: Batch, label: string, reverse: { batch: Batch; label: string } | null) =>
      guard(label, async () => {
        const sent = batch.ops.length + batch.sceneOps.length;
        if (sent === 0) {
          say(`${label} — nothing to write`, 'ok');
          return;
        }
        const e = await client.request({
          type: 'apply',
          ops: batch.ops,
          sceneOps: batch.sceneOps,
        });
        undoRef.current = reverse;
        setUndoDepth(reverse && size(reverse.batch) > 0 ? 1 : 0);
        // Report what we sent alongside what Live did with it. "0 written of 1
        // sent" is a very different bug from "0 written of 0 sent", and without
        // the sent count the two look identical.
        const short = e.applied + e.skipped < sent;
        say(
          `${label} — ${e.applied} written, ${e.skipped} skipped of ${sent} sent` +
            ` in ${e.lomMs}ms`,
          short ? 'error' : 'ok',
        );
        // Everything landed, so we already know what the set says — patch the
        // copy in hand rather than walking Live to be told what we just wrote.
        // Anything less than everything and we don't know *which* op missed, so
        // the walk is the only way to find out.
        const next = e.applied === sent ? reconcile(batch) : null;
        if (next) setSet(next);
        else await resync();
      }),
    [client, guard, reconcile, resync, say],
  );

  const apply = useCallback(
    (ops: OpenFlow.ApplyOp[], label = 'apply') => {
      const before = setRef.current?.snapshot.clips ?? [];
      const back = inverseOps(before, ops);
      return write({ ops, sceneOps: [] }, label, {
        batch: { ops: back, sceneOps: [] },
        label: `undo ${label}`,
      });
    },
    [write],
  );

  const applyScenes = useCallback(
    (sceneOps: OpenFlow.SceneOp[], label = 'scenes') => {
      const before = sceneFields(setRef.current?.snapshot.scenes ?? []);
      const back = inverseSceneOps(before, sceneOps);
      // Live gives us no way to write "no color", so a scene that had none
      // can't be put back to having none — inverseSceneOps drops that revert
      // rather than painting slot 0 over it. Say so instead of letting the undo
      // button quietly promise more than it delivers.
      const stuck = countUnrevertableColors(before, sceneOps);
      if (stuck > 0) {
        say(
          `${label} — ${stuck} scene${stuck > 1 ? 's' : ''} had no color; Live has ` +
            `no writable "no color", so undo can't take it back off`,
          'info',
        );
      }
      return write({ ops: [], sceneOps }, label, {
        batch: { ops: [], sceneOps: back },
        label: `undo ${label}`,
      });
    },
    [say, write],
  );

  /**
   * Add scenes without touching the delete-capable reorder path.
   *
   * This still clears our undo entry: inserting above an old operation shifts
   * every scene address it captured. Live's grouped history is the only safe
   * reversal because our snapshots deliberately cannot delete scenes.
   */
  const addScenes = useCallback(
    (addition: OpenFlow.SceneAddition, label = 'add scenes') =>
      guard(label, async () => {
        undoRef.current = null;
        setUndoDepth(0);

        const e = await client.request({ type: 'addScenes', addition });
        if (e.failed > 0 || e.configured !== e.created) {
          say(
            `${label} — ${e.created} created, ${e.configured} configured, ` +
              `${e.failed} failed. Check the new rows and the Max window.`,
            'error',
          );
        } else {
          say(
            `${label} — ${e.created} scenes inserted at ${e.from + 1}–${e.to + 1} ` +
              `in ${e.lomMs}ms`,
            'ok',
          );
        }
        say(
          e.undoStep
            ? "the addition is one step in Live's own undo history — ⌘Z in Live, not here"
            : 'Live would not group the addition for undo; our ⌘Z does not delete scenes',
          e.undoStep ? 'info' : 'error',
        );

        // The bridge broadcasts one structural change after the whole run is
        // configured. That drives the re-read for this and every other client.
      }),
    [client, guard, say],
  );

  /**
   * Reorder scenes.
   *
   * **Deliberately not routed through `write`**, and the difference is the whole
   * point. `write` captures a reverse batch and arms the undo button; there is
   * no reverse batch for this. `inverseOps` reads "before" out of the snapshot,
   * which works because a snapshot holds every clip's name and color — it holds
   * nothing that can rebuild a deleted scene's clips.
   *
   * So this **clears** the undo entry rather than replacing it. Leaving the
   * previous one armed would offer a ⌘Z that writes clip names against scene
   * indexes that no longer mean what they meant when it was captured, which is
   * a worse outcome than having no undo at all.
   *
   * The way back is Live's own history, if `begin_undo_step` took — which is
   * unverified, so the log line says which of the two happened rather than
   * assuming.
   */
  const moveScenes = useCallback(
    (plan: MovePlanFor, label: string) =>
      guard(label, async () => {
        undoRef.current = null;
        setUndoDepth(0);

        const e = await client.request({
          type: 'move',
          plan: { create: plan.create, steps: plan.steps, remove: plan.remove },
        });

        if (e.failed > 0) {
          // The originals were kept — lom.ts stops before the delete pass if any
          // copy failed. Say that plainly: the set now holds both copies, and
          // that's a mess the user has to resolve, not something to paper over.
          say(
            `${label} — ${e.failed} operation${e.failed > 1 ? 's' : ''} failed, so the ` +
              `originals were NOT deleted. The set now holds both copies; check the ` +
              `Max window and tidy up in Live.`,
            'error',
          );
        } else {
          say(
            `${label} — ${e.removed} scene${e.removed === 1 ? '' : 's'} moved, ` +
              `${e.copied} clip${e.copied === 1 ? '' : 's'} copied in ${e.lomMs}ms`,
            'ok',
          );
        }
        say(
          e.undoStep
            ? 'this move is one step in Live\'s own undo history — ⌘Z in Live, not here'
            : 'Live would not group this move for undo, so there is no way back — ' +
              'our ⌘Z cannot rebuild deleted scenes',
          e.undoStep ? 'info' : 'error',
        );

        // Creating and deleting scenes renumbers everything below them, so this
        // isn't a patch to the set we hold — it's a different set with different
        // indexes, and only a walk can describe it.
        //
        // The walk is no longer requested here. The bridge broadcasts one
        // structural change once the whole move has landed, and that drives the
        // re-read for this client and every other one — the same arrangement
        // `addScenes` uses. Asking here as well would walk twice: once now, and
        // once more when the broadcast arrived a moment later.
      }),
    [client, guard, say],
  );

  /**
   * The clip-drag counterpart to `moveScenes`, and it makes the same bargain
   * with undo for a slightly different reason. A scene move can't be reversed
   * because a snapshot can't rebuild a deleted scene's clips; a clip move can't
   * be reversed because it **overwrites**, and what was at the target is gone.
   * Moving the clips back would restore their positions and not the casualties.
   *
   * So this clears the undo entry too. Live's own history is the way back, if
   * `begin_undo_step` took — which is unverified, so the log says which.
   */
  const moveClips = useCallback(
    (plan: ClipMovePlanFor, label: string) =>
      guard(label, async () => {
        undoRef.current = null;
        setUndoDepth(0);

        const e = await client.request({
          type: 'moveClips',
          plan: { steps: plan.steps, remove: plan.remove },
        });

        if (e.failed > 0) {
          // lom.ts skips the whole delete pass if any copy failed, so the
          // originals are all still there and the set holds both copies.
          say(
            `${label} — ${e.failed} operation${e.failed > 1 ? 's' : ''} failed, so ` +
              `nothing was deleted. The originals are all still where they were; ` +
              `check the Max window and tidy up in Live.`,
            'error',
          );
        } else {
          say(
            `${label} — ${e.copied} clip${e.copied === 1 ? '' : 's'} copied, ` +
              `${e.removed} cleared in ${e.lomMs}ms`,
            'ok',
          );
        }
        say(
          e.undoStep
            ? "this move is one step in Live's own undo history — ⌘Z in Live, not here"
            : 'Live would not group this move for undo, so there is no way back — ' +
              'our ⌘Z cannot restore an overwritten clip',
          e.undoStep ? 'info' : 'error',
        );

        // Unlike a scene move this renumbers nothing — every index still means
        // what it meant, so the plan alone says where every clip ended up. A
        // failure doesn't: `lom.ts` skips the whole delete pass, and what that
        // leaves behind is a set we'd be describing from a plan it didn't run.
        const held = setRef.current;
        if (e.failed === 0 && held) {
          // Slots only: no scene name moved, so the songs are what they were.
          const clips = applyClipMove(held.snapshot.clips, plan);
          setSet({
            ...held,
            snapshot: { ...held.snapshot, clips, clipCount: clips.length },
          });
        } else {
          await resync();
        }
      }),
    [client, guard, resync, say],
  );

  const undo = useCallback(() => {
    const u = undoRef.current;
    if (!u || size(u.batch) === 0) return Promise.resolve();
    // No redo: the entry is consumed either way, so a failed undo can't be
    // replayed into a half-reverted state on a second press.
    undoRef.current = null;
    setUndoDepth(0);
    return write(u.batch, u.label, null);
  }, [write]);

  return {
    connection,
    lomReady,
    snapshot,
    model: set?.model ?? null,
    palette,
    defaultArtist,
    roles,
    allowedColors,
    writeSceneTempo,
    play,
    transport,
    songPosition,
    progress,
    log,
    busy,
    syncing,
    undoDepth,
    refresh,
    apply,
    applyScenes,
    addScenes,
    moveScenes,
    moveClips,
    saveSetConfig,
    setAllowedColors,
    undo,
    launch,
    stop,
    setTransport,
    setMixer,
    setDevice,
    setFold,
    selectScene,
    selectTrack,
    subscribeMeters,
    subscribeMixer,
    watchChains,
    subscribeChains,
    subscribeChainValues,
    subscribeClipStatus,
  };
}
