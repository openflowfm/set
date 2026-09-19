// One row's play state, flattened to a string so it can cross a memo boundary.

import type { PlayState } from '../hooks/useBridge.ts';

/**
 * One row's play state, as a single string — `|p3|f7|` — or `undefined`.
 *
 * This shape is load-bearing. `Row` is memoized, and play state changes many
 * times a second while a set is rolling, so passing the whole `PlayState` down
 * would re-render all 848 rows on every change. Flattened to a primitive, the
 * ~846 rows with nothing happening get `undefined`, memo's identity check
 * passes, and only the one or two rows that actually changed re-render.
 *
 * Tokens are delimited on both sides so `p1` can't match inside `p10`.
 */
export type RowMarks = string | undefined;

/**
 * Scene index → its marks, built by walking the *tracks*.
 *
 * The obvious direction — for each scene, scan the tracks — is 848 × trackCount
 * work on every play change, several times a second. A track contributes to at
 * most two scenes, so walking tracks instead is O(trackCount) and produces the
 * same map.
 */
export function marksByScene(play: PlayState): Map<number, string> {
  const m = new Map<number, string>();
  const add = (s: number, token: string) => m.set(s, (m.get(s) ?? '') + token);
  play.tracks.forEach((st, t) => {
    // fired === STOP_FIRED is negative and belongs to the track header, not a row.
    if (st.playing >= 0) add(st.playing, `|p${t}`);
    if (st.fired >= 0) add(st.fired, `|f${t}`);
  });
  for (const [s, v] of m) m.set(s, `${v}|`);
  return m;
}

/**
 * Every armed track, as one string — `|3|7|`, or `''` when none is armed.
 *
 * Arm is the same answer for all 848 rows, so it rides as one prop rather than
 * being folded into `marksByScene`'s per-scene strings. It's still flattened
 * for the same reason those are: `Row` is memoized, this is recomputed on every
 * play push, and a string with unchanged contents is `Object.is`-equal to the
 * last one — so a set where nobody touched an arm button re-renders nothing.
 *
 * Arming genuinely does change every row, since every empty cell in that column
 * swaps its stop button for a record button. That re-render is the point.
 */
export function armedTracks(play: PlayState): string {
  let out = '';
  play.tracks.forEach((st, t) => {
    if (st.armed) out += `|${t}`;
  });
  return out === '' ? '' : `${out}|`;
}

export function has(marks: RowMarks, token: string): boolean {
  return marks !== undefined && marks.indexOf(`|${token}|`) >= 0;
}
