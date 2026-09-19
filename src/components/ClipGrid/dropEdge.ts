// Which edge of a row a scene drag's drop indicator belongs on.
//
// **One gap, one line.** A gap in scene numbering is addressable from both
// sides — song A ending at 5 and song B starting at 6 are both "gap 6" — so the
// two answers here have to be written against each other rather than each
// drawing its own. They resolve toward *above*, and `below` renders only where
// nothing above can express the gap.
//
// They live here rather than beside the rows they belong to because both are
// pure functions, and a module that exports anything besides components cannot
// be hot-replaced: React Fast Refresh gives up on the whole file and reloads
// the page. `Row.tsx` and `SongHeaderRow.tsx` are the two files this refactor
// touches most, so they get to keep their reload-free edit loop.

import type { SongHeader } from '@openflow/core/songRows.ts';

/** Where the indicator sits on a row, if it's the drop target at all. */
export type DropEdge = '' | 'above' | 'below';

/**
 * Which edge of a song header the drop indicator belongs on, if either.
 *
 * Resolves toward `above` and lets `below` render only where no header begins.
 * That's the tail of the set, which is the one gap `above` can't express.
 */
export function dropEdgeFor(
  header: SongHeader,
  dropAt: number,
  headers: Map<number, SongHeader>,
): DropEdge {
  if (dropAt < 0) return '';
  if (dropAt === header.from) return 'above';
  if (dropAt === header.to + 1 && !headers.has(dropAt)) return 'below';
  return '';
}

/**
 * Which edge of a scene row the drop indicator belongs on, if either.
 *
 * The counterpart to `dropEdgeFor`, and it defers to it: a gap that starts a
 * song is drawn by that song's header, which is already sitting on that
 * boundary. Without the check both would draw a line for the same gap.
 *
 * Everything else resolves toward `above`, because gap `g` is the top of scene
 * `g`. `below` renders on the last scene alone — the end of the set is the one
 * gap no scene's top can express.
 */
export function sceneDropEdge(
  s: number,
  dropAt: number,
  lastScene: number,
  songHeaders: Map<number, SongHeader>,
): DropEdge {
  if (dropAt < 0 || songHeaders.has(dropAt)) return '';
  if (dropAt === s) return 'above';
  if (dropAt === s + 1 && s === lastScene) return 'below';
  return '';
}
