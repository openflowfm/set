import { memo } from 'react';
import {
  formatBarsBeats,
  formatSecondsLeft,
  type TrackStatus,
} from '@openflow/core/trackStatus.ts';
import { useTrackStatusOf, type TrackStatusStore } from '../../hooks/useTrackStatus.ts';

/** Diameter of the loop pie, in the SVG's own units and in px — drawn 1:1. */
const PIE = 10;
const R = PIE / 2;

/**
 * The wedge for one loop phase, swept clockwise from twelve o'clock.
 *
 * A filled pie rather than a ring, which is what Live draws and what survives
 * being 10px across: at this size a ring's stroke is the whole shape and its
 * two ends are a pixel apart at every phase but the first and last.
 */
function wedge(phase: number): string {
  const angle = Math.max(0, Math.min(1, phase)) * 2 * Math.PI;
  const x = R + R * Math.sin(angle);
  const y = R - R * Math.cos(angle);
  const largeArc = phase > 0.5 ? 1 : 0;
  return `M ${R} ${R} L ${R} 0 A ${R} ${R} 0 ${largeArc} 1 ${x} ${y} Z`;
}

function label(status: TrackStatus): string {
  if (status.kind === 'loop') return `${Math.round(status.phase * 100)}% through the loop`;
  if (status.kind === 'oneShot') return `${formatSecondsLeft(status.secondsLeft)} left`;
  return `recording — ${formatBarsBeats(status.bars, status.beats)}`;
}

function Mark({ status }: { status: TrackStatus }) {
  if (status.kind === 'loop') {
    // A full turn is the same shape as a standstill in arc terms, so it draws
    // as a plain disc instead of an arc that has closed on its own start.
    const full = status.phase >= 1;
    return (
      <svg className="track-status-pie" width={PIE} height={PIE} viewBox={`0 0 ${PIE} ${PIE}`}>
        <circle className="track-status-pie-ring" cx={R} cy={R} r={R - 0.5} />
        {full ? (
          <circle className="track-status-pie-fill" cx={R} cy={R} r={R} />
        ) : (
          <path className="track-status-pie-fill" d={wedge(status.phase)} />
        )}
      </svg>
    );
  }
  if (status.kind === 'oneShot') {
    return <span className="track-status-time">{formatSecondsLeft(status.secondsLeft)}</span>;
  }
  return (
    <span className="track-status-time recording">
      {formatBarsBeats(status.bars, status.beats)}
    </span>
  );
}

/**
 * Live's Track Status Display, in the stop row beside each track's stop button.
 *
 * Three of Live's five forms: the loop pie, a one-shot's countdown and a
 * recording's length. The other two — a miniature of the track's Arrangement
 * clips, and the input-monitoring glyph — need state this app doesn't read, so
 * a track in either of those conditions shows nothing rather than a wrong
 * reading of the clip it is playing.
 *
 * Subscribed per track, so a playhead moving in one column redraws that column
 * and nothing else. It draws over the stop button rather than beside it and
 * takes no pointer events, so the whole cell stays one large stop target — the
 * thing you reach for on stage — while still showing what the track is doing.
 */
export const TrackStatusDisplay = memo(function TrackStatusDisplay({
  store,
  t,
}: {
  store: TrackStatusStore;
  t: number;
}) {
  const status = useTrackStatusOf(store, t);
  if (!status) return null;
  return (
    <span className="track-status" title={label(status)}>
      <Mark status={status} />
    </span>
  );
});
