import { useLayoutEffect, type RefObject } from 'react';
import {
  viewportColumnLayout,
  type ViewportColumnWidth,
} from '../lib/columnWidth.ts';

function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const left = Number.parseFloat(style.paddingLeft) || 0;
  const right = Number.parseFloat(style.paddingRight) || 0;
  return Math.max(0, element.clientWidth - left - right);
}

/**
 * Fit viewport-based widths without putting resize measurements in React state.
 *
 * The observer writes the table's existing width variable directly, so opening
 * the rail or resizing the browser does not re-render every scene row.
 */
export function useViewportColumnWidth(
  tableRef: RefObject<HTMLTableElement | null>,
  mode: ViewportColumnWidth | null,
  trackCount: number,
): void {
  useLayoutEffect(() => {
    if (mode === null) return;
    const table = tableRef.current;
    const viewport = table?.parentElement;
    if (!table || !viewport) return;

    const fit = () => {
      const layout = viewportColumnLayout(mode, trackCount, contentWidth(viewport));
      table.style.setProperty('--col-w', `${layout.col}px`);
      table.style.width = `${layout.table}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [mode, tableRef, trackCount]);
}
