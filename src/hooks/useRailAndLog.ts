import { useCallback, useState } from 'react';

/**
 * The rail, and the log, both start closed.
 *
 * Neither is the thing you came for. The grid is, and on a 40-track set every
 * pixel the rail isn't using is a track column you can see. The rail opens the
 * moment you pick something to work on, which is the only time it has anything
 * to say — see `openRail`.
 */
export function useRailAndLog() {
  const [showRail, setShowRail] = useState(false);
  // Deliberately ephemeral: a refresh always closes diagnostics, and no bridge
  // event or log line may open them. The footer toggle below is the only writer.
  const [showLog, setShowLog] = useState(false);

  /**
   * Open the rail because a selection gesture just happened.
   *
   * Called from the three places that mean "I want to work on this" — a clip, a
   * scene name, a song — rather than from an effect on the selection itself. An
   * effect would also fire when a selection is *cleared*, and reopening the rail
   * on the click that emptied it is the opposite of what closing it asked for.
   */
  const openRail = useCallback(() => setShowRail(true), []);

  /**
   * Close the chrome, and only the chrome. Closing the rail also drops the
   * selection, but the selection isn't owned here — `App` composes the two
   * into `closeRail`.
   */
  const hideRail = useCallback(() => setShowRail(false), []);

  const toggleLog = useCallback(() => setShowLog((v) => !v), []);

  return { showRail, openRail, hideRail, showLog, toggleLog };
}
