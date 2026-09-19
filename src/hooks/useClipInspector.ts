import { useCallback, useMemo, useState } from 'react';
import { colorOps } from '@openflow/core/ops.ts';
import { DEFAULT_CLIP_PATTERN, render } from '@openflow/core/pattern.ts';
import { roleIn } from '@openflow/core/roles.ts';
import { titleOf } from '@openflow/core/sceneTitle.ts';
import { clipKey, parseClipKey } from '../lib/selection.ts';
import type { BridgeState } from './useBridge.ts';

interface Args {
  selected: ReadonlySet<string>;
  clips: Map<string, OpenFlow.Clip>;
  trackNames: Map<number, string>;
  sceneNames: Map<number, string>;
  snapshot: OpenFlow.Snapshot | null;
  apply: BridgeState['apply'];
}

/**
 * The clip inspector: color swatches and the rename pattern.
 *
 * Color writes immediately on click, naming does not, and the asymmetry is
 * deliberate. A color is instantly legible in the grid and reapplying a
 * different one costs nothing, so a swatch may as well be the action. A name
 * overwrites something you can't see any more, so it keeps its preview and an
 * explicit commit. Both are undoable — see useBridge.
 */
export function useClipInspector({
  selected,
  clips,
  trackNames,
  sceneNames,
  snapshot,
  apply,
}: Args) {
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [pattern, setPattern] = useState(DEFAULT_CLIP_PATTERN);

  // Token values for one clip. `{role}` comes from the clip's own scene, so the
  // rename pattern picks it up for free once the scene is tagged. `{song}`
  // lands with segmentation; until then it resolves to nothing, which render()
  // drops cleanly.
  const valuesFor = useCallback(
    (t: number, s: number, n: number) => {
      const scene = sceneNames.get(s) ?? '';
      const title = titleOf(scene);
      return {
        track: trackNames.get(t),
        scene,
        role: roleIn(scene) ?? undefined,
        song: title.song || undefined,
        artist: title.artist || undefined,
        tag: title.tag || undefined,
        bpm: title.bpm || undefined,
        key: title.key || undefined,
        name: clips.get(clipKey(t, s))?.name,
        n,
      };
    },
    [clips, sceneNames, trackNames],
  );

  const selectedCells = useMemo(
    () => [...selected].map((key) => parseClipKey(key)),
    [selected],
  );

  const onColor = useCallback(
    (index: number) => {
      setChosenIndex(index);
      if (!snapshot || selectedCells.length === 0) return;
      void apply(colorOps(snapshot.clips, selectedCells, index), 'color');
    },
    [apply, selectedCells, snapshot],
  );

  const nameOps = useMemo<OpenFlow.ApplyOp[]>(() => {
    if (!pattern.trim()) return [];
    return selectedCells
      .map(({ t, s }, i) => ({ t, s, name: render(pattern, valuesFor(t, s, i + 1)) }))
      // Renaming a clip to what it is already called is a write Live has to make
      // and a number the progress bar has to report, for no visible effect.
      .filter((op) => op.name !== clips.get(clipKey(op.t, op.s))?.name);
  }, [clips, pattern, selectedCells, valuesFor]);

  const onRename = useCallback(
    () => void apply(nameOps, 'rename'),
    [apply, nameOps],
  );

  const preview = useMemo(() => {
    if (!pattern.trim() || selected.size === 0) return null;
    const { t, s } = parseClipKey([...selected][0]!);
    return render(pattern, valuesFor(t, s, 1));
  }, [pattern, selected, valuesFor]);

  return {
    chosenIndex,
    pattern,
    setPattern,
    onColor,
    renameCount: nameOps.length,
    onRename,
    preview,
  };
}
