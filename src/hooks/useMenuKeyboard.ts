import { useEffect, useState } from 'react';

/**
 * Roving cursor for a positioned menu: ↑↓ move it, Enter picks it, Esc closes.
 *
 * Every key handled here is a key the grid also handles — Esc stops clips, the
 * arrows move the active cell — so each one is swallowed while the menu is up.
 * Capture phase, ahead of the app's window listener.
 */
export function useMenuKeyboard({
  itemCount,
  initialCursor,
  onEnter,
  onClose,
}: {
  /** How many items the cursor can rest on. */
  itemCount: number;
  /** Where the cursor starts; -1 for nowhere. Read once, on mount. */
  initialCursor: number;
  /** Enter pressed with the cursor here — may be -1 when it never landed. */
  onEnter: (cursor: number) => void;
  onClose: () => void;
}): [number, (cursor: number) => void] {
  const [cursor, setCursor] = useState(initialCursor);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.stopPropagation();
        e.preventDefault();
        const down = e.key === 'ArrowDown';
        setCursor((c) => {
          if (c < 0) return down ? 0 : itemCount - 1;
          return (c + (down ? 1 : -1) + itemCount) % itemCount;
        });
        return;
      }
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        onEnter(cursor);
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cursor, itemCount, onClose, onEnter]);

  return [cursor, setCursor];
}
