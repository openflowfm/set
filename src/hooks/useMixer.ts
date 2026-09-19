import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BridgeState } from './useBridge.ts';
import type { MeterKey } from './useMeters.ts';
import { MixerStore, type MixerStripState } from '../lib/mixerStore.ts';

export { MixerStore };
export type { MixerStripState };

export function useMixer(
  subscribeMixer: BridgeState['subscribeMixer'],
  active: boolean,
): MixerStore {
  const store = useMemo(() => new MixerStore(), []);
  useEffect(() => subscribeMixer(store.update), [store, subscribeMixer]);
  useEffect(() => {
    if (!active) store.update(null);
  }, [active, store]);
  return store;
}

const empty = () => null;

export function useMixerStrip(store: MixerStore, key: MeterKey): MixerStripState | null {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const snapshot = useCallback(() => store.strip(key), [store, key]);
  return useSyncExternalStore(subscribe, snapshot, empty);
}
