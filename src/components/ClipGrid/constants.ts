// Values shared by the grid's three components. Colors mirror shared.css
// tokens; they're duplicated here because legibility math needs numbers.

import type { TrackShape } from '@openflow/core/songRows.ts';

/** --bg. Scene names are painted straight onto it, so legibility is measured against it. */
export const PANEL = 0x0a0a0b;

/** --rail, the song header's own background. The color band is measured on it. */
export const RAIL = 0x0e0e10;

/**
 * A song band is a block of color rather than text, so it needs far less
 * contrast than a scene name does — but Live's palette holds colors dark enough
 * to vanish entirely on `--rail`, and a band you can't see is the one thing this
 * header exists to provide.
 */
export const BAND_CONTRAST = 2.2;

/**
 * Empty clip slots inherit their track group's hue at this opacity. The dark
 * grid underneath does the darkening, so clips can keep using their full Live
 * color and remain the strongest marks in the column.
 */
export const GROUP_CELL_ALPHA = '0c';

/**
 * A group track's own slot, tinted with the first clip the group holds in that
 * scene. Stronger than an empty member cell and weaker than a real clip: it is
 * a launcher standing for clips that are themselves on screen, so it has to
 * read as present without competing with the clips it fires.
 */
export const GROUP_SLOT_ALPHA = '38';

/** Live's own encoding: the track's stop button is fired and blinking. */
export const STOP_FIRED = -2;

/** One shared empty map, so an open song's header stays memo-stable. */
export const NO_SHAPES: Map<number, TrackShape> = new Map();

/**
 * What a mark is painted for clips on scenes carrying no role.
 *
 * A neutral grey rather than the song's own color: it stands for the absence of
 * a section, and painting it the song color would make an unmapped track look
 * like it had been given one.
 */
export const UNTAGGED = 0x6e6e78;

export function isShape(s: TrackShape | undefined): s is TrackShape {
  return s !== undefined;
}
