import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useBridge } from '../hooks/useBridge.ts';
import { BridgeContext, type BridgeSession } from '../hooks/useBridgeSession.ts';

/**
 * Owns the connection to Live — above the app rather than inside it.
 *
 * `useBridge` used to be called from `App`, which put the socket, the watches
 * and the snapshot inside the one component every edit touches. React Fast
 * Refresh treats a component whose module updated two ways, and both of them
 * were charging an edit to the UI against Live's main thread:
 *
 * - **Re-render with fresh dependencies.** React deliberately ignores the
 *   previous deps of every `useMemo`, `useCallback` and `useEffect` in a
 *   component it just hot-updated, so `useMemo(() => new BridgeClient(), [])`
 *   built a *new* client, which dropped the socket, reconnected, and re-armed
 *   every watch.
 * - **Remount.** When the signature of any hook a component calls changes —
 *   its own, or one nested inside a custom hook it uses — React can't know the
 *   state still means the same thing, so it remounts instead. That drops the
 *   snapshot, and the once-per-session walk in `useBridge` fires again on the
 *   next `lomReady`.
 *
 * The second is the expensive one: a full walk is ~950ms of Live's main thread
 * with the sync modal over the screen. The first costs a reconnect and a
 * re-arm of the watches this client owns.
 *
 * It used to cost far more than that. `observe` and `watchSelection` were
 * client subscriptions too, and re-arming `observe` re-attaches the `tracks`
 * and `scenes` observers — Live calls back on attach, that callback was
 * broadcast as `changed structure`, and every connected client walked the set.
 * So editing a hook re-read forty tracks. Those two are the *device's* watches
 * now: the bridge follows Live for its own sake and a client neither claims nor
 * releases them, which is also why a reconnect no longer throws away the set
 * the bridge holds. This component still earns its place for the remount case,
 * which is the expensive one.
 *
 * Vite hands a hot update to the importers of the file that changed until it
 * reaches one that accepts it. Every hook under `hooks/`, and every module
 * under `lib/` and `core/` that isn't a component, reaches `App` that way — so
 * editing any of them was the same gesture as re-reading forty tracks.
 *
 * This component is where that stops. It's the parent of `App` and it lives in
 * a file that changes when the *bridge* changes rather than when the UI does,
 * so a hot update below it re-renders or remounts `App` while the socket, the
 * watches, the device state and the snapshot stay exactly where they were.
 *
 * Editing `useBridge.ts` or `client.ts` still reconnects, because those are
 * this file's own dependencies. That's the right bill for that edit.
 */
export function BridgeProvider({ children }: { children: ReactNode }) {
  const [showMeters, setShowMeters] = useState(false);
  const [showSends, setShowSends] = useState(false);
  const toggleMeters = useCallback(() => {
    setShowMeters((shown) => !shown);
    setShowSends(false);
  }, []);
  const toggleSends = useCallback(() => {
    setShowMeters(true);
    setShowSends((shown) => !shown);
  }, []);
  // The status displays live in the stop row, and the stop row is always drawn
  // now that the track view controls sit in it — so their watch is always on.
  const bridge = useBridge(showMeters, showSends, true);

  // `bridge` is a fresh object every render, so this memo doesn't stop anything
  // re-rendering — App re-renders when bridge state changes, exactly as it did
  // when it called `useBridge` itself. It's here to keep the context value one
  // expression rather than an object literal in the JSX.
  const session = useMemo<BridgeSession>(
    () => ({
      ...bridge,
      showMeters,
      showSends,
      toggleMeters,
      toggleSends,
    }),
    [bridge, showMeters, showSends, toggleMeters, toggleSends],
  );

  return <BridgeContext.Provider value={session}>{children}</BridgeContext.Provider>;
}
