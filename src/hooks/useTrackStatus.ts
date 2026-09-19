import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { trackStatus, type TrackStatus } from '@openflow/core/trackStatus.ts';
import type { BridgeState } from './useBridge.ts';

/**
 * An external store for the clip-status stream, built the same way `MeterStore`
 * is and for the same reason: frames arrive at 20 Hz, and routing them through
 * React state would re-render App and all 848 rows for a moving playhead.
 *
 * It publishes only for tracks with a mounted display, so a collapsed group
 * unsubscribes its members without a second visibility model.
 *
 * The store holds the *rendered* status rather than the raw clip, so a frame in
 * which a pie has not visibly moved wakes nothing. `trackStatus` reduces nine
 * numbers to two or three, which is what makes that comparison cheap enough to
 * do per track per frame.
 */
export class TrackStatusStore {
  private readonly statuses = new Map<number, TrackStatus | null>();
  private readonly listeners = new Map<number, Set<() => void>>();
  /** Live's song tempo; a one-shot's countdown is in beats until this applies. */
  private tempo = 120;

  update = (frame: OpenFlow.ClipStatusFrame): void => {
    if (this.listeners.size === 0) return;
    const next = new Map<number, TrackStatus | null>();
    for (const clip of frame.tracks) {
      if (!this.listeners.has(clip.t)) continue;
      next.set(clip.t, trackStatus(clip, this.tempo));
    }
    this.publish(next);
  };

  /**
   * The tempo only moves a one-shot's countdown, and it changes far more rarely
   * than the frames do — so it arrives on its own rather than riding every
   * frame. The next frame picks it up.
   */
  setTempo = (tempo: number): void => {
    this.tempo = tempo > 0 ? tempo : 120;
  };

  clear = (): void => {
    this.publish(new Map());
  };

  status = (t: number): TrackStatus | null => this.statuses.get(t) ?? null;

  subscribe = (t: number, listener: () => void): (() => void) => {
    const listeners = this.listeners.get(t) ?? new Set();
    listeners.add(listener);
    this.listeners.set(t, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      this.listeners.delete(t);
      this.statuses.delete(t);
    };
  };

  private publish(next: Map<number, TrackStatus | null>): void {
    for (const [t, listeners] of this.listeners) {
      const value = next.get(t) ?? null;
      if (same(this.statuses.get(t) ?? null, value)) continue;
      this.statuses.set(t, value);
      for (const listener of listeners) listener();
    }
  }
}

/**
 * Whether two statuses would draw the same thing.
 *
 * A loop's phase is compared at the resolution the pie is actually drawn to.
 * Live reports a position that moves every frame, and at full float precision
 * every frame would wake every playing track's display to redraw a wedge a
 * hundredth of a degree further round.
 */
function same(a: TrackStatus | null, b: TrackStatus | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'loop' && b.kind === 'loop') {
    return Math.round(a.phase * 100) === Math.round(b.phase * 100);
  }
  if (a.kind === 'oneShot' && b.kind === 'oneShot') {
    // The countdown is displayed to the second, so that is what a change is.
    return Math.ceil(a.secondsLeft) === Math.ceil(b.secondsLeft);
  }
  if (a.kind === 'recording' && b.kind === 'recording') {
    return a.bars === b.bars && a.beats === b.beats;
  }
  return false;
}

/** Subscribe one store to the bridge, without clip frames reaching React state. */
export function useTrackStatus(
  subscribeClipStatus: BridgeState['subscribeClipStatus'],
  active: boolean,
  tempo: number | undefined,
): TrackStatusStore {
  const store = useMemo(() => new TrackStatusStore(), []);

  useEffect(() => subscribeClipStatus(store.update), [store, subscribeClipStatus]);
  useEffect(() => {
    store.setTempo(tempo ?? 120);
  }, [store, tempo]);
  useEffect(() => {
    if (!active) store.clear();
  }, [active, store]);

  return store;
}

const none = () => null;

/** One track's status. Only that display re-renders when it changes. */
export function useTrackStatusOf(store: TrackStatusStore, t: number): TrackStatus | null {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(t, listener),
    [store, t],
  );
  const snapshot = useCallback(() => store.status(t), [store, t]);
  return useSyncExternalStore(subscribe, snapshot, none);
}
