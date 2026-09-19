import { useCallback, useMemo } from 'react';
import { sceneColorOps, type SceneFields } from '@openflow/core/roles.ts';
import {
  scenesOfSongs,
  songsOfScenes,
  type Derivation,
} from '@openflow/core/derive.ts';
import type { BridgeState } from './useBridge.ts';

interface Args {
  derivation: Derivation;
  /** The selected scenes, ascending — see useGridSelection. */
  sceneList: number[];
  snapshot: OpenFlow.Snapshot | null;
  palette: number[];
  scenesForOps: SceneFields[];
  applyScenes: BridgeState['applyScenes'];
}

/**
 * **A song is one color.** Coloring is therefore song-scoped rather than
 * selection-scoped: touch any scene of Nightfall and the swatch writes all
 * twelve, reprise included. That's the whole value of the color — a solid
 * block in Live's own session view is what you navigate a 100-song set by,
 * and a per-scene brush is exactly what puts holes in it.
 *
 * A selected scene the pattern couldn't read has no song to widen to, so it
 * takes the color alone. The alternative is a swatch that silently does
 * nothing on the scenes a mapping pass hasn't reached yet.
 */
export function useSongColor({
  derivation,
  sceneList,
  snapshot,
  palette,
  scenesForOps,
  applyScenes,
}: Args) {
  const songColorScenes = useMemo(
    () => scenesOfSongs(derivation, sceneList),
    [derivation, sceneList],
  );

  /**
   * What a swatch is about to repaint, in words.
   *
   * Named where it can be, because the song is the unit: "all 12 scenes of
   * NIGHTFALL" is checkable at a glance in a way "12 scenes" isn't. Scenes the
   * pattern couldn't read have no song to name and are counted separately
   * rather than folded into a song's total, which would overstate it.
   */
  const songColorLabel = useMemo(() => {
    const songs = songsOfScenes(derivation, sceneList);
    const loose = songColorScenes.length - songs.reduce((n, s) => n + s.scenes.length, 0);
    const named =
      songs.length === 0
        ? ''
        : songs.length <= 2
          ? songs.map((s) => s.name).join(' and ')
          : `${songs.length} songs`;
    const rest = loose === 0 ? '' : `${loose} unmapped scene${loose === 1 ? '' : 's'}`;
    return [named, rest].filter(Boolean).join(' + ');
  }, [derivation, sceneList, songColorScenes]);

  /** The palette slot those scenes already share, or -1 when they don't. */
  const songColorIndex = useMemo(() => {
    const first = songColorScenes[0];
    if (first === undefined) return -1;
    const shared = snapshot?.scenes[first]?.colorIndex ?? -1;
    return songColorScenes.every((s) => snapshot?.scenes[s]?.colorIndex === shared)
      ? shared
      : -1;
  }, [snapshot, songColorScenes]);

  const onSongColor = useCallback(
    (index: number) => {
      const rgb = palette[index];
      // No RGB means no write: a scene's color can only be written as RGB, and
      // inventing one would paint something we didn't choose.
      if (rgb === undefined) return;
      void applyScenes(
        sceneColorOps(scenesForOps, songColorScenes, index, rgb),
        'song color',
      );
    },
    [applyScenes, palette, scenesForOps, songColorScenes],
  );

  return {
    songColorCount: songColorScenes.length,
    songColorLabel,
    songColorIndex,
    onSongColor,
  };
}
