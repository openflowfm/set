import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  moveActive,
  type ActiveCell,
  type Direction,
} from '@openflow/core/gridRange.ts';
import { isLaunchModified, isTypingInto } from '../lib/keys.ts';
import type { BridgeState } from './useBridge.ts';

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface Args {
  /** Visible scene indexes — see useSongLayout. */
  rows: number[];
  trackColumns: number[];
  /** The active cell's ref shadow, shared with useGridSelection — see goActive. */
  activeRef: RefObject<ActiveCell | null>;
  goActive: (next: ActiveCell | null) => void;
  isPlaying: boolean;
  launch: BridgeState['launch'];
  stop: BridgeState['stop'];
  undo: BridgeState['undo'];
  selectAllScenes: () => void;
}

/**
 * The window-level keyboard handling: arrows move the active cell, ⌘ makes a
 * sound, Space is transport, Esc stops clips, ⌘A selects every scene, and ⌘Z
 * undoes.
 */
export function useGridKeyboard({
  rows,
  trackColumns,
  activeRef,
  goActive,
  isPlaying,
  launch,
  stop,
  undo,
  selectAllScenes,
}: Args): void {
  // Space reads play state through a ref for the same reason the active cell
  // has one: it changes several times a second, and putting it in the effect's
  // dependency array would re-bind the key listener on every change.
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const fireActive = useCallback(
    (at: ActiveCell) => {
      if (at.on === 'scene') launch({ kind: 'scene', s: at.s });
      else launch({ kind: 'clip', t: at.t, s: at.s });
    },
    [launch],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingInto(e.target)) return;

      // This must remain available when every song is collapsed and there are
      // no visible rows; selecting all unfolds them before making the pick.
      if ((e.key === 'a' || e.key === 'A') && isLaunchModified(e)) {
        e.preventDefault();
        selectAllScenes();
        return;
      }

      // Preserve the existing grid-shortcut behavior when there is no row to
      // act on. Select-all above is the exception because it creates rows.
      if (rows.length === 0) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        stop({ kind: 'clips' });
        return;
      }
      // Live's own binding, and the one everybody has in muscle memory.
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlayingRef.current) stop({ kind: 'song' });
        else launch({ kind: 'song' });
        return;
      }

      const from = activeRef.current;
      const d = ARROWS[e.key];
      if (d) {
        e.preventDefault(); // or the grid scrolls as well as moving
        // With nothing active yet, the first arrow press places the cell rather
        // than moving it — otherwise ↓ from nowhere skips scene 1. The first
        // *visible* scene, since scene 0 may be inside a folded song.
        const next = from === null
          ? ({ on: 'scene', s: rows[0]! } as ActiveCell)
          : moveActive(trackColumns, rows, from, d);
        goActive(next);
        // ⌘ + arrow is the sweep: one keystroke for "next thing, and let me
        // hear it". Unmodified arrows stay silent, per the rule.
        if (isLaunchModified(e)) fireActive(next);
        return;
      }

      if (e.key === 'Enter' && isLaunchModified(e) && from) {
        e.preventDefault();
        fireActive(from);
        return;
      }

      // ⌘Z is not a grid gesture, so it doesn't fight the "⌘ makes a sound" rule
      // — and it's the only undo there is, since LOM writes never reach Live's
      // own history. Guarded by isTypingInto above, so the rename field keeps its
      // own undo.
      if ((e.key === 'z' || e.key === 'Z') && isLaunchModified(e)) {
        e.preventDefault();
        void undo();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeRef, fireActive, goActive, launch, rows, selectAllScenes, stop, trackColumns, undo]);
}
