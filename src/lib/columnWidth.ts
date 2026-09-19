// Column widths for the grid.
//
// Live's LOM exposes no Session View column widths — `Track.View` is only
// selected_device / device_insert_mode / is_collapsed (arranger, not session),
// and the real widths live in the .als, which this project never parses. So
// they're ours to choose.
//
// One setting drives every track column rather than per-column dragging. The
// pixel presets are predictable; the viewport layouts divide the available
// grid width among either all rendered tracks, one 8-track hardware bank, or
// two banks. It moves the track columns only — the scene name is the row's
// label, and a setting about how many tracks fit shouldn't cost you the thing
// you read the rows by.

export type ColumnWidthPreset = 'm' | 'l';
export type ViewportColumnWidth = 'auto' | '8' | '16';
export type ColumnWidth = ColumnWidthPreset | ViewportColumnWidth;

/** In presentation order — the header control renders straight from this. */
export const COLUMN_WIDTHS: readonly ColumnWidth[] = [
  'm',
  'l',
  'auto',
  '8',
  '16',
] as const;

export const DEFAULT_COLUMN_WIDTH: ColumnWidth = 'm';

/**
 * The scene metadata column, px. Fixed, not a preset.
 *
 * The setting is about how many *tracks* fit on screen, and a scene number is
 * the same three digits whatever the answer is. Its fixed width is also what
 * keeps the scene-number, BPM and key slots on one vertical line in every mode,
 * and what the song headers align their own facts against.
 *
 * **Sized by its rows and nothing else**: 10px of lead, a 26px number, a 26px
 * bpm and a 28px key, plus 8px at the tail, is 98px. The rest is air before the
 * Master column.
 *
 * It was half as wide again while it had its own heading to fit — a label and
 * three buttons need 158px, and a column whose header doesn't fit is a column
 * lying about its width. The heading spans this column and Master together now,
 * which is what let this shrink to what a row actually needs.
 */
export const META_COL_W = 108;

export interface ColumnMetrics {
  /** One track column, px. */
  col: number;
}

// `m` is the narrow width the grid shipped with. Narrower fixed columns make
// both clip names and mixer controls unusable, so the fixed presets begin here.
const METRICS: Record<ColumnWidthPreset, ColumnMetrics> = {
  m: { col: 74 },
  l: { col: 116 },
};

export function metricsFor(w: ColumnWidthPreset): ColumnMetrics {
  return METRICS[w];
}

/**
 * Total table width for `n` track columns, px. `table-layout: fixed` needs this
 * stated explicitly — see the note in ClipGrid/ClipGrid.tsx.
 *
 * The Master column is a track column in every way that costs width, so `n`
 * tracks means `n + 1` columns of `col` beside the fixed metadata one.
 * border-spacing sits between every column *and* at both table edges, so
 * `n + 2` columns means `n + 3` gaps.
 */
export function tableWidth(
  w: ColumnWidthPreset,
  trackCount: number,
  spacing = 2,
): number {
  const m = metricsFor(w);
  return META_COL_W + (trackCount + 1) * m.col + (trackCount + 3) * spacing;
}

export interface ViewportColumnLayout {
  /** Width shared by every rendered track column. */
  col: number;
  /** Exact width of the full table, including columns beyond the viewport bank. */
  table: number;
}

export function isViewportColumnWidth(w: ColumnWidth): w is ViewportColumnWidth {
  return w === 'auto' || w === '8' || w === '16';
}

/**
 * Lay track columns out against the available grid viewport.
 *
 * Auto shares the width among the rendered tracks and stops at Narrow's 74px
 * readability floor. The 8/16 modes instead size one or two hardware banks
 * exactly; any tracks beyond that bank make the full table scroll.
 *
 * **The Master column takes a track's share without being one of the eight.**
 * A bank mode is sizing the tracks a controller reaches, and Master isn't one
 * of them — but it is the same width as one, so the space is divided by
 * `target + 1` while the bank still counts `target`.
 */
export function viewportColumnLayout(
  mode: ViewportColumnWidth,
  trackCount: number,
  availableWidth: number,
  spacing = 2,
): ViewportColumnLayout {
  const count = Math.max(0, Math.floor(trackCount));
  if (count === 0) return { col: METRICS.m.col, table: tableWidth('m', 0, spacing) };

  const target = mode === 'auto' ? count : Number(mode);
  const targetGutters = (target + 3) * spacing;
  const trackSpace = Math.max(0, availableWidth - META_COL_W - targetGutters);
  const fitted = trackSpace / (target + 1);
  const col = mode === 'auto' ? Math.max(METRICS.m.col, fitted) : Math.max(1, fitted);
  return {
    col,
    table: META_COL_W + (count + 1) * col + (count + 3) * spacing,
  };
}

const KEY = 'openflow.columnWidth';

export function loadColumnWidth(): ColumnWidth {
  try {
    const v = localStorage.getItem(KEY);
    // Small was removed once the mixer controls outgrew a useful 44px track.
    // Preserve existing browser preferences by moving it to Narrow.
    if (v === 's') return 'm';
    return isColumnWidth(v) ? v : DEFAULT_COLUMN_WIDTH;
  } catch {
    return DEFAULT_COLUMN_WIDTH;
  }
}

export function saveColumnWidth(w: ColumnWidth): void {
  try {
    localStorage.setItem(KEY, w);
  } catch {
    // Storage can be unavailable (private windows, embedded webviews). A width
    // that doesn't persist is not worth failing a render over.
  }
}

function isColumnWidth(v: unknown): v is ColumnWidth {
  return (
    v === 'm' || v === 'l' || v === 'auto' || v === '8' || v === '16'
  );
}
