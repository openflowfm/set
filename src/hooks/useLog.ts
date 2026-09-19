import { useCallback, useRef, useState } from 'react';

export interface LogLine {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'error';
}

/** The shared log sink — every hook that reports takes one of these. */
export type Say = (text: string, kind?: LogLine['kind']) => void;

/**
 * The footer log. `say` prepends — newest first, capped at 60 lines — and is
 * the one piece nearly everything in useBridge shares, which is why it's the
 * first hook useBridge calls.
 */
export function useLog() {
  const logId = useRef(0);
  const [log, setLog] = useState<LogLine[]>([]);

  const say: Say = useCallback((text, kind = 'info') => {
    setLog((prev) => [{ id: ++logId.current, text, kind }, ...prev].slice(0, 60));
  }, []);

  return { log, say };
}
