import { useCallback, useMemo, useRef, useState } from 'react';
import { planClipMove, type ClipAt } from '@openflow/core/clipMove.ts';
import { parseClipKey } from '../lib/selection.ts';
import type { BridgeState } from './useBridge.ts';

/**
 * Drag clips to another place in the grid.
 *
 * The sibling of `useSceneDrag`, and deliberately a separate hook: that one
 * moves rows and renumbers the set, this one moves contents and leaves every
 * index meaning what it meant. They share a gesture and nothing else.
 *
 * A drag carries the selection when the grabbed clip is part of one, the same
 * rule the scene grip follows. The offset comes from the clip the pointer is
 * over, so the whole block travels rigidly — which is the shape
 * `planClipMove` needs.
 */
export function useClipDrag(
  snapshot: OpenFlow.Snapshot | null,
  clearSelection: () => void,
  moveClips: BridgeState['moveClips'],
) {
  /** The clips in flight. Empty between drags. */
  const [sources, setSources] = useState<readonly ClipAt[]>([]);
  /** The clip the drag was started from — the offset is measured from it. */
  const [grabbed, setGrabbed] = useState<ClipAt | null>(null);
  /** The slot the pointer is over, or null. */
  const [over, setOver] = useState<ClipAt | null>(null);

  /**
   * Whether *this* drag is the one in progress. The mirror of the same ref in
   * `useSceneDrag`: `dragover` bubbles, so a scene dragged by its number passes
   * over clip cells on the way and would otherwise drive this hook too.
   */
  const draggingRef = useRef(false);

  const onDragStart = useCallback((picked: readonly ClipAt[], from: ClipAt) => {
    draggingRef.current = true;
    setSources(picked);
    setGrabbed(from);
    setOver(null);
  }, []);

  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    setSources([]);
    setGrabbed(null);
    setOver(null);
  }, []);

  /**
   * `dragover` fires many times a second for the whole drag, so this bails out
   * unless the pointer has actually crossed into a different slot. Without it
   * every mouse move rebuilds all 848 rows' elements — the same reason
   * `useSceneDrag` compares its gap before setting it.
   */
  const onDragOver = useCallback((t: number, s: number) => {
    if (!draggingRef.current) return;
    setOver((prev) => (prev !== null && prev.t === t && prev.s === s ? prev : { t, s }));
  }, []);

  const movePlan = useMemo(() => {
    if (!snapshot || grabbed === null || over === null || sources.length === 0) return null;
    return planClipMove({
      sources,
      dt: over.t - grabbed.t,
      ds: over.s - grabbed.s,
      sceneCount: snapshot.sceneCount,
      tracks: snapshot.tracks,
      clips: snapshot.clips,
    });
  }, [snapshot, sources, grabbed, over]);

  /**
   * The plan in a ref, for the reason `useSceneDrag` keeps one: `onDrop` is a
   * prop on 848 memoized rows, and closing over `movePlan` would give it a new
   * identity every time the pointer crossed a cell.
   */
  const movePlanRef = useRef(movePlan);
  movePlanRef.current = movePlan;

  const onDrop = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const plan = movePlanRef.current;
    setSources([]);
    setGrabbed(null);
    setOver(null);
    if (!plan) return;
    // The selection addresses clips that are about to be somewhere else, and
    // some of what it names is about to be overwritten. Keeping it would leave
    // the rail offering to rename clips that no longer exist.
    clearSelection();
    void moveClips(
      { steps: plan.steps, remove: plan.remove },
      `move ${plan.clips} clip${plan.clips === 1 ? '' : 's'}`,
    );
  }, [clearSelection, moveClips]);

  /**
   * Both marks, flattened per scene into `|3|7|` strings — the same shape and
   * the same reason as `marksByScene`.
   *
   * A `Set` would be the obvious thing and is the wrong one for `landing`: it
   * is rebuilt every time the pointer crosses a cell, so as a prop it would
   * re-render all 848 rows several times a second. Per scene, the string only
   * changes for the rows that actually gained or lost a mark, and memo skips
   * the rest. `lifting` is stable per drag either way and is built the same way
   * so `Row` reads one kind of thing.
   */
  const lifting = useMemo(() => bySceneTracks(sources), [sources]);
  const landing = useMemo(
    () => bySceneTracks((movePlan?.steps ?? []).map((x) => ({ t: x.toT, s: x.toS }))),
    [movePlan],
  );

  return {
    lifting,
    landing,
    movePlan,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  };
}

/**
 * `scene -> "|t|t|"` for a list of slots, delimited on both sides so track 1
 * can't match inside track 10. `has()` from rowMarks reads these.
 */
function bySceneTracks(cells: readonly ClipAt[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const c of cells) m.set(c.s, (m.get(c.s) ?? '') + `|${c.t}`);
  for (const [s, v] of m) m.set(s, `${v}|`);
  return m;
}

/** The selection as clip addresses, for handing to a drag. */
export function clipsFromKeys(keys: ReadonlySet<string>): ClipAt[] {
  return [...keys].map(parseClipKey);
}
