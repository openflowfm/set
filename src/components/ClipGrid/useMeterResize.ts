import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 164;
const GRID_RESERVE = 64;
const KEY_STEP = 8;
const EDGE_HIT_DEPTH = 4;

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  table: HTMLTableElement;
}

function currentHeight(table: HTMLTableElement): number {
  const raw = getComputedStyle(table).getPropertyValue('--meter-panel-h');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : DEFAULT_HEIGHT;
}

function maximumHeight(table: HTMLTableElement): number {
  const viewport = table.closest<HTMLElement>('.grid-wrap');
  return Math.floor(
    Math.max(
      MIN_HEIGHT,
      (viewport?.clientHeight ?? DEFAULT_HEIGHT) - GRID_RESERVE,
    ),
  );
}

/** Makes the meter row's existing top border resize its table-owned height. */
export function useMeterResize(
  tableRef: RefObject<HTMLTableElement | null>,
  active: boolean,
) {
  const dragRef = useRef<Drag | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_HEIGHT);
  const [dragging, setDragging] = useState(false);

  const applyHeight = useCallback((table: HTMLTableElement, requested: number) => {
    const max = maximumHeight(table);
    const next = Math.round(Math.max(MIN_HEIGHT, Math.min(max, requested)));
    table.style.setProperty('--meter-panel-h', `${next}px`);
    setHeight(next);
    setMaxHeight(max);
  }, []);

  // Optional rows add to the footer without changing the meter's height or
  // resize ceiling. Only viewport changes can clamp the resizable section.
  useEffect(() => {
    const table = tableRef.current;
    if (!active || !table) return;
    const sync = () => applyHeight(table, currentHeight(table));
    sync();
    const observer = new ResizeObserver(sync);
    const viewport = table.closest<HTMLElement>('.grid-wrap');
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, [active, applyHeight, tableRef]);

  const onPointerDown = (event: PointerEvent<HTMLTableRowElement>) => {
    if (event.button !== 0) return;
    const row = event.currentTarget;
    if (event.clientY - row.getBoundingClientRect().top > EDGE_HIT_DEPTH) return;
    const table = tableRef.current;
    if (!table) return;
    event.preventDefault();
    row.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: currentHeight(table),
      table,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLTableRowElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    applyHeight(drag.table, drag.startHeight + drag.startY - event.clientY);
  };

  const finishDrag = (event: PointerEvent<HTMLTableRowElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const table = tableRef.current;
    if (!table) return;
    const current = currentHeight(table);
    let next: number | null = null;
    if (event.key === 'ArrowUp') next = current + KEY_STEP;
    else if (event.key === 'ArrowDown') next = current - KEY_STEP;
    else if (event.key === 'PageUp') next = current + KEY_STEP * 4;
    else if (event.key === 'PageDown') next = current - KEY_STEP * 4;
    else if (event.key === 'Home') next = MIN_HEIGHT;
    else if (event.key === 'End') next = maximumHeight(table);
    if (next === null) return;
    event.preventDefault();
    applyHeight(table, next);
  };

  return {
    dragging,
    rowProps: {
      role: 'separator',
      'aria-label': 'Resize mixer',
      'aria-orientation': 'horizontal' as const,
      'aria-valuemin': MIN_HEIGHT,
      'aria-valuemax': Math.round(maxHeight),
      'aria-valuenow': height,
      'aria-valuetext': `${height} pixels high`,
      tabIndex: 0,
      title: 'Drag the top border to resize mixer',
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onLostPointerCapture: () => {
        dragRef.current = null;
        setDragging(false);
      },
      onKeyDown,
    },
  };
}
