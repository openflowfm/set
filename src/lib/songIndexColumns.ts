/**
 * Which fact columns the song index shows, and how wide that makes the pane.
 *
 * A browser view preference, not set-owned configuration — the same split
 * `columnWidth` sits on. Nothing here describes the set: hiding BPM says how
 * much of the left edge you want spent on a contents pane, and the answer
 * follows the screen you're on rather than the `.als` you opened. Role
 * vocabulary and allowed colors are the other case and live in the device.
 *
 * The name column is deliberately not listed. It's the pane's whole reason for
 * existing, and a toggle that can empty a list of songs of its song names is a
 * setting nobody wants to find themselves in.
 */

export const INDEX_FACTS = ['artist', 'key', 'bpm', 'type'] as const;

export type IndexFact = (typeof INDEX_FACTS)[number];

export type IndexColumns = Record<IndexFact, boolean>;

/**
 * Nominal width per column, in px.
 *
 * The pane's own width is the sum of these plus the gaps, so hiding a column
 * narrows the pane rather than handing its space to the name — which is the
 * point of being able to hide one. `name` is a `1fr` track in the grid and
 * therefore resolves to exactly this figure at the computed width; it's stated
 * here so both halves of that arithmetic come from one place.
 */
const WIDTH: Record<IndexFact | 'name', number> = {
  name: 124,
  artist: 92,
  key: 32,
  bpm: 34,
  type: 56,
};

/** Left and right padding of a row, and the gap between columns. */
const PAD = 22;
const GAP = 6;

export const DEFAULT_INDEX_COLUMNS: IndexColumns = {
  artist: true,
  key: true,
  bpm: true,
  type: true,
};

/** The visible facts, in column order. */
export function shownFacts(columns: IndexColumns): IndexFact[] {
  return INDEX_FACTS.filter((f) => columns[f]);
}

/** The grid track list for the header row and every song row. */
export function columnTemplate(columns: IndexColumns): string {
  const facts = shownFacts(columns).map((f) =>
    // The artist is free text like the name, so it takes a share of the pane
    // rather than a fixed slot — otherwise a long one is permanently clipped
    // while the fixed facts sit half empty.
    f === 'artist' ? `minmax(0, ${WIDTH.artist}fr)` : `${WIDTH[f]}px`,
  );
  return [`minmax(0, ${WIDTH.name}fr)`, ...facts].join(' ');
}

/** How wide the pane has to be to hold those columns. */
export function paneWidth(columns: IndexColumns): number {
  const facts = shownFacts(columns);
  const content = facts.reduce((sum, f) => sum + WIDTH[f], WIDTH.name);
  return PAD + content + GAP * facts.length;
}

const KEY = 'openflow.songIndexColumns';

function isColumns(v: unknown): v is IndexColumns {
  if (!v || typeof v !== 'object') return false;
  return INDEX_FACTS.every((f) => typeof (v as Record<string, unknown>)[f] === 'boolean');
}

export function loadIndexColumns(): IndexColumns {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_INDEX_COLUMNS;
    const parsed: unknown = JSON.parse(raw);
    return isColumns(parsed) ? { ...parsed } : DEFAULT_INDEX_COLUMNS;
  } catch {
    return DEFAULT_INDEX_COLUMNS;
  }
}

export function saveIndexColumns(columns: IndexColumns): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(columns));
  } catch {
    // Storage can be unavailable (private windows, embedded webviews). A pane
    // layout that doesn't persist is not worth failing a render over.
  }
}
