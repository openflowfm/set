import { useCallback, useMemo } from 'react';
import { buildColumns } from '@openflow/core/trackColumns.ts';
import type { BridgeState } from './useBridge.ts';

/**
 * The rendered column order, and which track groups are folded.
 *
 * Columns live here rather than in ClipGrid because keyboard movement needs
 * them too: stepping left or right walks the rendered column order, so a
 * folded group's members have to be invisible to the arrow keys as well as to
 * the eye.
 */
export function useTrackColumns(snapshot: OpenFlow.Snapshot | null, setFold: BridgeState['setFold']) {
  /**
   * Read out of the snapshot, never mirrored into state beside it.
   *
   * **Live owns this, unlike a folded song** — that one is ours, keyed by song
   * name, and never leaves the browser. A group's fold state is `fold_state`
   * on a real track, so a copy here is a second answer to a question the
   * snapshot already answers, and it was the answer that lost: the copy was
   * re-seeded on every snapshot, and a write reconciles into a *new* snapshot
   * object, so tagging one scene discarded every fold made since the last walk
   * while Live went on holding those groups shut.
   */
  const collapsed = useMemo<ReadonlySet<number>>(
    () =>
      new Set((snapshot?.tracks ?? []).filter((t) => t.isGroup && t.isFolded).map((t) => t.i)),
    [snapshot],
  );

  const columns = useMemo(
    () => (snapshot ? buildColumns(snapshot.tracks, collapsed) : []),
    [snapshot, collapsed],
  );

  /**
   * Just the visible *non-group* track indexes, which is all the movement and
   * selection helpers need. A group column is deliberately absent: its slots
   * hold no clip, so there is nothing there to select, name or color, and the
   * arrow keys step over it the way they step over a folded group's members.
   */
  const trackColumns = useMemo(
    () => columns.flatMap((c) => (c.kind === 'track' ? [c.track.i] : [])),
    [columns],
  );

  // One call, and it does both halves: `setFold` tells Live and patches the
  // track row we hold, which is what redraws these columns. Still no round
  // trip — waiting one to redraw a fold you just clicked is the one place that
  // would feel slow — and if Live rejects it the next walk puts it back.
  const onToggleGroup = useCallback(
    (trackIndex: number) => setFold(trackIndex, !collapsed.has(trackIndex)),
    [collapsed, setFold],
  );

  return { columns, trackColumns, onToggleGroup };
}
