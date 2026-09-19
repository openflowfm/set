import { useCallback, useMemo, useRef, useState } from 'react';
import { planSceneMove } from '@openflow/core/sceneMove.ts';
import type { BridgeState } from './useBridge.ts';

/**
 * Drag scenes somewhere else in the set. One gesture, two grips.
 *
 * A song header grabs the whole run under it; a scene's own number grabs that
 * scene, or the whole selection when it's part of one. Both end up here as a
 * list of scene indexes, because that's all `planSceneMove` has ever wanted —
 * it takes any set, contiguous or not, and a destination gap.
 *
 * **A header drag moves one block, not one song.** A song is a label rather
 * than a range, so it can appear in several runs, and each run has its own
 * header — dragging the header for "part 2 of 2" has to move the part you
 * grabbed. Gathering both runs is a thing `planSceneMove` supports and a thing
 * you can do by dragging one next to the other; doing it as a silent side
 * effect of grabbing one header would move sixty scenes nobody pointed at.
 *
 * This is the only gesture in the app that can destroy work — see
 * core/src/sceneMove.ts. Everything the grid does otherwise is either a view
 * change or a write our own undo reverses.
 */
export function useSceneDrag(
  snapshot: OpenFlow.Snapshot | null,
  clearSelection: () => void,
  moveScenes: BridgeState['moveScenes'],
) {
  /** The scenes being dragged, ascending. Empty between drags. */
  const [sources, setSources] = useState<readonly number[]>([]);
  /** Where they would land, as a gap in the current scene numbering. */
  const [dropAt, setDropAt] = useState<number | null>(null);

  /**
   * Whether *this* drag is the one in progress.
   *
   * `dragover` bubbles, and a clip dragged across the grid passes over the rows
   * on its way — so without this, a clip drag would drive the scene drop
   * indicator too. A ref rather than state because the handler below must keep
   * one identity: it is a prop on 848 memoized rows.
   */
  const draggingRef = useRef(false);

  const onDragStart = useCallback((picked: readonly number[]) => {
    draggingRef.current = true;
    // Sorted here rather than at each grip: the plan reads them in order, and a
    // selection arrives in whatever order it was clicked.
    setSources([...picked].sort((a, b) => a - b));
    setDropAt(null);
  }, []);

  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    setSources([]);
    setDropAt(null);
  }, []);

  /**
   * `dragover` fires continuously — many times a second, for the whole drag.
   *
   * The identity bail-out is what makes that affordable: the gap only changes
   * when the pointer crosses a boundary, and returning `prev` unchanged lets
   * React skip the render entirely. Without it every mouse move would rebuild
   * all 848 rows' elements.
   */
  const onDragOver = useCallback((from: number, to: number, below: boolean) => {
    if (!draggingRef.current) return;
    const gap = below ? to + 1 : from;
    setDropAt((prev) => (prev === gap ? prev : gap));
  }, []);

  const movePlan = useMemo(() => {
    if (!snapshot || sources.length === 0 || dropAt === null) return null;
    return planSceneMove({
      sceneCount: snapshot.sceneCount,
      sources,
      dest: dropAt,
      clips: snapshot.clips,
      tracks: snapshot.tracks,
    });
  }, [snapshot, sources, dropAt]);

  /**
   * The plan also lives in a ref, and this is not a micro-optimisation.
   *
   * `onDrop` is a prop on the memoized `SongHeaderRow` and on every `Row`.
   * Closing over `movePlan` would give it a new identity every time the drop
   * gap changes — which is every time the pointer crosses a row — and re-render
   * all hundred headers mid-drag. Same reason `active` and `play.isPlaying` are
   * held in refs; see the note on `Row` in set/README.md.
   */
  const movePlanRef = useRef(movePlan);
  movePlanRef.current = movePlan;

  const onDrop = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const plan = movePlanRef.current;
    // Clear first. The move re-snapshots, and leaving a drop indicator pointing
    // at a scene index that no longer means the same thing is worse than a
    // frame of nothing.
    setSources([]);
    setDropAt(null);
    if (!plan) return;
    // Selection is addressed by (track, scene), and every one of those indexes
    // is about to mean a different row. Keeping it would leave the rail offering
    // to rename scenes the user never picked.
    clearSelection();
    void moveScenes(plan, `move ${plan.scenes} scene${plan.scenes === 1 ? '' : 's'}`);
  }, [clearSelection, moveScenes]);

  /**
   * The same scenes as a set, for "is this row one of them?".
   *
   * Its identity turns over when the drag starts and ends and at no other time
   * — in particular not when `dropAt` moves, which is many times a second. That
   * is what lets it be handed to 848 memoized rows without re-rendering them
   * every time the pointer crosses a boundary.
   */
  const dragScenes = useMemo(() => new Set(sources), [sources]);

  return {
    /**
     * First scene being dragged, or -1. A primitive, so it can reach the
     * memoized song headers without re-rendering them on every pointer move.
     */
    dragFrom: sources[0] ?? -1,
    dragScenes,
    dropAt,
    movePlan,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  };
}
