import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BridgeState } from './useBridge.ts';

export type MeterKey = number | 'master';

/**
 * A tiny external store for the high-frequency meter stream.
 *
 * It retains and publishes values only for keys with a mounted meter.
 * That makes visibility the filter: collapsing a group removes its descendant
 * columns, which unsubscribes those tracks without a second visibility model.
 */
export class MeterStore {
  private readonly levels = new Map<MeterKey, number>();
  private readonly listeners = new Map<MeterKey, Set<() => void>>();

  update = (frame: OpenFlow.MeterFrame): void => {
    if (this.listeners.size === 0) return;
    const levels = new Map<MeterKey, number>();
    if (this.listeners.has('master')) levels.set('master', frame.master);
    for (const meter of frame.tracks) {
      if (this.listeners.has(meter.t)) levels.set(meter.t, meter.level);
    }
    for (const [key, listeners] of this.listeners) {
      const raw = levels.get(key) ?? 0;
      const next = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
      if (this.level(key) === next) continue;
      this.levels.set(key, next);
      for (const listener of listeners) listener();
    }
  };

  clear = (): void => {
    for (const [key, listeners] of this.listeners) {
      if (this.level(key) === 0) continue;
      this.levels.set(key, 0);
      for (const listener of listeners) listener();
    }
  };

  level = (key: MeterKey): number => this.levels.get(key) ?? 0;

  subscribe = (key: MeterKey, listener: () => void): (() => void) => {
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      this.listeners.delete(key);
      this.levels.delete(key);
    };
  };
}

/** Subscribe one store to the bridge without putting meter frames in React state. */
export function useMeters(
  subscribeMeters: BridgeState['subscribeMeters'],
  active: boolean,
): MeterStore {
  const store = useMemo(() => new MeterStore(), []);

  useEffect(() => subscribeMeters(store.update), [store, subscribeMeters]);
  useEffect(() => {
    if (!active) store.clear();
  }, [active, store]);

  return store;
}

const zero = () => 0;

/** The current level for one rendered output. Only that component re-renders. */
export function useOutputMeter(store: MeterStore, key: MeterKey): number {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const snapshot = useCallback(() => store.level(key), [store, key]);
  return useSyncExternalStore(subscribe, snapshot, zero);
}
