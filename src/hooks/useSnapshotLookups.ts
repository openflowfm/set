import { useCallback, useMemo } from 'react';
import { sceneFields } from '@openflow/core/roles.ts';
import { clipKey } from '../lib/selection.ts';

/**
 * Lookup tables over the snapshot — Maps, not `.find()`. Block selection can
 * hand op assembly thousands of cells at once, and a linear scan per cell makes
 * that O(n²), which is enough to lock the tab up on a real set.
 *
 * Built once here and passed everywhere (ClipGrid included) rather than rebuilt
 * per consumer. These Maps reach the memoized `Row`, so each keeps a
 * snapshot-scoped identity — a fresh Map per render would re-render all 848
 * scenes.
 */
export function useSnapshotLookups(snapshot: OpenFlow.Snapshot | null) {
  const clips = useMemo(
    () => new Map(snapshot?.clips.map((c) => [clipKey(c.t, c.s), c]) ?? []),
    [snapshot],
  );
  const trackNames = useMemo(
    () => new Map(snapshot?.tracks.map((t) => [t.i, t.name]) ?? []),
    [snapshot],
  );
  const sceneNames = useMemo(
    () => new Map(snapshot?.scenes.map((s) => [s.i, s.name]) ?? []),
    [snapshot],
  );
  const isOccupied = useCallback(
    (c: { t: number; s: number }) => clips.has(clipKey(c.t, c.s)),
    [clips],
  );

  /** The scenes in the shape scene-op assembly wants — see core/src/roles.ts. */
  const scenesForOps = useMemo(() => sceneFields(snapshot?.scenes ?? []), [snapshot]);

  const clipsByScene = useMemo(() => {
    const m = new Map<number, OpenFlow.Clip[]>();
    for (const c of snapshot?.clips ?? []) {
      const list = m.get(c.s);
      if (list) list.push(c);
      else m.set(c.s, [c]);
    }
    return m;
  }, [snapshot]);

  return { clips, trackNames, sceneNames, isOccupied, scenesForOps, clipsByScene };
}
