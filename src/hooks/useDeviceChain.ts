import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { BridgeState } from './useBridge.ts';
import { ChainStore, deviceKey } from '../lib/chainStore.ts';

/**
 * Which track's device chain the footer is showing, and what's in it.
 *
 * **A watch, not a read**, and that inverts what this hook used to be. It once
 * fetched a track's whole chain on demand — every rack, every chain, every
 * nested device in one answer — because a watch could only be armed per *kind*,
 * and this one needs a target. Now that a watch can carry one, the footer
 * declares what it is looking at and the bridge keeps it current.
 *
 * So the hook's job is to say what is **visible**, which is a smaller thing than
 * what exists:
 *
 * - the shown track's own device run, always;
 * - for every rack in a run that is open, the one chain it is showing;
 * - and recursively into that, because a rack inside a chain is the same case.
 *
 * A folded rack contributes nothing. A rack's other seven chains contribute
 * nothing. That is the entire point — following a closed rack's contents is
 * ~120 LOM observers for something nobody is looking at.
 *
 * The tree therefore fills in a level per round trip: subscribing to the track
 * run reveals which of its devices are racks, which adds their open chains to
 * the next declaration. On a local socket that is invisible, and it is what
 * keeps the client from ever having to know a rack's shape before asking.
 */

/** Address of a *run* — even length. `[]` is the track's own device list. */
function runKey(path: readonly number[]): string {
  return path.join('.');
}

/** Address of a *device* — odd length, so it can't collide with a run. */
function devicePathKey(path: readonly number[], index: number): string {
  return [...path, index].join('.');
}

/**
 * Everything on screen, as subscriptions.
 *
 * Walks what we already hold rather than what exists in Live, because those are
 * the same thing here: a run we haven't subscribed to has no devices to walk,
 * so the recursion stops exactly where the client's knowledge does.
 */
function visibleRuns(
  t: number,
  chains: readonly OpenFlow.WatchedChain[],
  chainAt: Readonly<Record<string, number>>,
): OpenFlow.ChainWatch[] {
  const known = new Map(chains.filter((c) => c.t === t).map((c) => [runKey(c.path), c]));
  const subs: OpenFlow.ChainWatch[] = [];

  const descend = (path: number[]) => {
    const run = known.get(runKey(path));
    const devices = run?.devices;

    // **`open` is fold state**, and nothing else needed inventing. A device
    // drawn shut has no face to fill, and Live already tracks which of them are
    // shut — so folding one in Live drops its forty observers, which is exactly
    // the behaviour we would have built a second concept to get.
    const open: number[] = [];
    devices?.forEach((device, i) => {
      if (!device.folded) open.push(i);
    });

    // Declared even before its contents are known: that first declaration is
    // what makes them arrive, with `open` empty until they do.
    subs.push({ t, path, open });
    if (!devices) return;

    devices.forEach((device, i) => {
      const count = device.chains?.length ?? 0;
      // A rack drawn shut is showing nothing, so nothing inside it is watched.
      if (count === 0 || device.folded) return;
      const chosen = Math.min(chainAt[devicePathKey(path, i)] ?? 0, count - 1);
      descend([...path, i, chosen]);
    });
  };

  descend([]);
  return subs;
}

export interface DeviceChainState {
  /** The track being shown, or null when the footer is closed. */
  track: number | null;
  /** The shown track's own device run. Empty until the first push lands. */
  devices: OpenFlow.ChainDevice[];
  /** Nothing has arrived for the shown track yet. */
  loading: boolean;
  /** The track no longer resolves in Live. Distinct from "no devices". */
  failed: boolean;
  /** One rack's chain devices, or undefined while its subscription is in flight. */
  runAt: (path: readonly number[]) => OpenFlow.ChainDevice[] | null | undefined;
  /**
   * Where a faceplate reads its controls from.
   *
   * Outside React state on purpose — a knob moving in Live pushes at gesture
   * rate, and routing that through the composition root would re-render the
   * grid with it. Read one device's worth with `useDeviceParameters`.
   */
  store: ChainStore;
  /** Which chain a rack is showing. */
  chainAt: (path: readonly number[], index: number) => number;
  onChain: (path: readonly number[], index: number, chain: number) => void;
  /**
   * Write one device in the shown track: its activator, its fold, one control.
   *
   * **Unfolding is how a face gets its controls.** `open` is derived from fold
   * state, so this one write is both "show me this device" and "start watching
   * it" — there is no separate subscribe, and there is nothing to leak if the
   * user closes the tab mid-gesture.
   */
  onDevice: (path: readonly number[], index: number, patch: OpenFlow.DevicePatch) => void;
  onSelectTrack: (t: number) => void;
  onClose: () => void;
}

export function useDeviceChain({
  lomReady,
  selectTrack,
  watchChains,
  subscribeChains,
  subscribeChainValues,
  setDevice,
}: {
  lomReady: boolean;
  selectTrack: BridgeState['selectTrack'];
  watchChains: BridgeState['watchChains'];
  subscribeChains: BridgeState['subscribeChains'];
  subscribeChainValues: BridgeState['subscribeChainValues'];
  setDevice: BridgeState['setDevice'];
}): DeviceChainState {
  const [track, setTrack] = useState<number | null>(null);
  const [state, setState] = useState<OpenFlow.ChainState | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const store = useMemo(() => new ChainStore(), []);

  useEffect(
    () =>
      subscribeChains((next) => {
        // Both, from one push. The structure goes to React because the shells
        // are drawn from it; the parameters go to the store because they are
        // not, and because the value stream that follows has to land somewhere
        // it can be patched into.
        setState(next);
        store.update(next);
      }),
    [subscribeChains, store],
  );

  useEffect(() => subscribeChainValues(store.apply), [subscribeChainValues, store]);

  const subs = useMemo(
    () => (track === null ? [] : visibleRuns(track, state?.chains ?? [], chosen)),
    [track, state, chosen],
  );

  // Keyed on the declaration's *content*, not its identity. Every push rebuilds
  // `subs`, and almost none of them change what is being watched — re-sending
  // an identical one is harmless (the bridge drops it) but it is a message per
  // knob turn once parameters land, which is the shape to avoid before it is a
  // problem rather than after.
  const declaration = JSON.stringify(subs);
  useEffect(() => {
    if (!lomReady) return;
    watchChains(JSON.parse(declaration) as OpenFlow.ChainWatch[]);
  }, [lomReady, watchChains, declaration]);

  const byRun = useMemo(() => {
    const map = new Map<string, OpenFlow.ChainDevice[] | null>();
    for (const chain of state?.chains ?? []) {
      if (track !== null && chain.t === track) map.set(runKey(chain.path), chain.devices);
    }
    return map;
  }, [state, track]);

  const runAt = useCallback(
    (path: readonly number[]) => byRun.get(runKey(path)),
    [byRun],
  );

  const chainAt = useCallback(
    (path: readonly number[], index: number) => chosen[devicePathKey(path, index)] ?? 0,
    [chosen],
  );

  const onChain = useCallback((path: readonly number[], index: number, chain: number) => {
    setChosen((held) => ({ ...held, [devicePathKey(path, index)]: chain }));
  }, []);

  const onDevice = useCallback(
    (path: readonly number[], index: number, patch: OpenFlow.DevicePatch) => {
      // Addressed against the track this hook is showing, so a caller can name
      // a device with the run-relative address it was already drawn with.
      if (track === null) return;
      setDevice({ t: track, path: [...path], i: index }, patch);
    },
    [track, setDevice],
  );

  const onSelectTrack = useCallback(
    (t: number) => {
      setTrack((shown) => {
        // A different track's runs are addressed by paths that mean something
        // else entirely, so held chain picks can't carry over.
        if (shown !== t) setChosen({});
        return t;
      });
      selectTrack(t);
    },
    [selectTrack],
  );

  const onClose = useCallback(() => {
    setTrack(null);
    setChosen({});
  }, []);

  const run = byRun.get(runKey([]));
  return {
    track,
    devices: run ?? [],
    // `undefined` is "nothing has arrived", `null` is "Live says it's gone".
    loading: track !== null && run === undefined,
    failed: run === null,
    runAt,
    store,
    chainAt,
    onChain,
    onDevice,
    onSelectTrack,
    onClose,
  };
}

/**
 * One device's controls, as a faceplate reads them.
 *
 * Subscribed per device, so a knob moving on the EQ wakes the EQ and nothing
 * else — not the chain around it, and not the grid above it. Null means the
 * device is folded, not watched, or has not been read yet; a face draws its
 * shell and waits rather than inventing controls.
 */
export function useDeviceParameters(
  store: ChainStore,
  t: number,
  path: readonly number[],
  index: number,
): OpenFlow.DeviceParameterState[] | null {
  const key = deviceKey(t, path, index);
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const snapshot = useCallback(() => store.parameters(key), [store, key]);
  return useSyncExternalStore(subscribe, snapshot, alwaysNull);
}

const alwaysNull = () => null;
