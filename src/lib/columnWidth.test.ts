import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLUMN_WIDTHS,
  loadColumnWidth,
  META_COL_W,
  tableWidth,
  viewportColumnLayout,
} from './columnWidth.ts';

describe('column widths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers only the usable fixed presets', () => {
    expect(COLUMN_WIDTHS).toEqual(['m', 'l', 'auto', '8', '16']);
  });

  it('uses Narrow as the Auto readability floor', () => {
    expect(viewportColumnLayout('auto', 40, 1100).col).toBe(74);
  });

  // The Master column costs a track's width without being one of the eight a
  // bank mode is sizing, so the arithmetic divides by nine and counts eight.
  it('fits a bank of eight tracks and the Master column in the viewport', () => {
    const { col } = viewportColumnLayout('8', 40, 1100);
    expect(META_COL_W + 9 * col + 11 * 2).toBeCloseTo(1100);
  });

  it('states a table wide enough for every track and the Master column', () => {
    expect(tableWidth('m', 3)).toBe(META_COL_W + 4 * 74 + 6 * 2);
  });

  it('migrates the removed Small preference to Narrow', () => {
    vi.stubGlobal('localStorage', { getItem: () => 's' });
    expect(loadColumnWidth()).toBe('m');
  });
});
