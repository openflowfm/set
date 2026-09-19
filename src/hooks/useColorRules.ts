import { useCallback, useMemo } from 'react';
import { songKey, type Derivation } from '@openflow/core/derive.ts';
import { songFacts } from '@openflow/core/songRows.ts';
import type { SongColorInput } from '@openflow/core/colorRules.ts';
import { sceneColorOps, type SceneFields } from '@openflow/core/roles.ts';
import { resolveAllowed } from '../lib/allowedColors.ts';
import type { BridgeState } from './useBridge.ts';

interface Args {
  derivation: Derivation;
  palette: number[];
  storedColors: number[] | null;
  setStoredColors: (next: number[] | null) => void;
  scenesForOps: SceneFields[];
  applyScenes: BridgeState['applyScenes'];
}

/**
 * Coloring every song from a rule — the bulk counterpart to `useSongColor`,
 * which paints the songs you have selected with a swatch you pressed.
 *
 * The rules themselves are `core/src/colorRules.ts`; this is the part that
 * can't be pure: which colors this device stores for the set, what the set
 * currently states, and turning the answer into scene writes.
 */
export function useColorRules({
  derivation,
  palette,
  storedColors,
  setStoredColors,
  scenesForOps,
  applyScenes,
}: Args) {
  const allowed = useMemo(
    () => resolveAllowed(storedColors, palette.length),
    [storedColors, palette.length],
  );

  /**
   * What each song states, for a rule to key on.
   *
   * **A disagreement reads as no answer at all.** A song whose scenes say both
   * `128` and `130` has no bpm this can color by, and picking the first would
   * paint the set from a fact the songs themselves don't agree on — which is
   * the drift `observed` exists to surface rather than launder.
   */
  const songs = useMemo<SongColorInput[]>(
    () =>
      derivation.songs.map((song) => {
        const facts = songFacts(song);
        const bpm = Number(facts.bpm);
        return {
          songKey: songKey(song.name),
          key: song.observed.key.length === 1 ? song.observed.key[0]! : '',
          bpm: Number.isFinite(bpm) && facts.bpm !== '' ? bpm : null,
        };
      }),
    [derivation],
  );

  /**
   * Write the plan: every scene of every song the rule answered for.
   *
   * Song-scoped like every other color write here — a song is one color, so a
   * reprise sixty scenes away is painted with the rest of it. `sceneColorOps`
   * drops the scenes already carrying that color, so applying the same rule
   * twice writes nothing the second time and says so.
   */
  const recolorSongs = useCallback(
    (colors: ReadonlyMap<string, number>) => {
      const ops: OpenFlow.SceneOp[] = [];
      for (const song of derivation.songs) {
        const index = colors.get(songKey(song.name));
        if (index === undefined) continue;
        const rgb = palette[index];
        // No RGB means no write: a scene's color goes to Live as RGB, and
        // inventing one would paint something nobody chose.
        if (rgb === undefined) continue;
        ops.push(...sceneColorOps(scenesForOps, song.scenes, index, rgb));
      }
      void applyScenes(ops, 'recolor songs');
    },
    [applyScenes, derivation, palette, scenesForOps],
  );

  return { allowed, setAllowed: setStoredColors, songs, recolorSongs };
}
