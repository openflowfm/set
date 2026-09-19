import { useEffect } from 'react';

/**
 * Esc closes this overlay, and only this overlay.
 *
 * Capture phase with stopPropagation, ahead of the app's window listener —
 * otherwise Esc would also stop every clip in Live.
 */
export function useCloseOnEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
}
