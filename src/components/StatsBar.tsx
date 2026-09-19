import { LAUNCH_KEY } from '../lib/keys.ts';
import type { BridgeState } from '../hooks/useBridge.ts';
import { IconBug, IconGitHub } from './Icon.tsx';
import { ControlButton } from './Control.tsx';
import { Stat } from './Stat.tsx';
import './StatsBar.css';

const REPOSITORY_URL = 'https://github.com/ryangavin/better-session-view';

interface Props {
  connection: BridgeState['connection'];
  lomReady: boolean;
  snapshot: OpenFlow.Snapshot | null;
  songCount: number;
  unmappedCount: number;
  selectedCount: number;
  showLog: boolean;
  onToggleLog: () => void;
  /** Opens the songs modal — the Songs and Unmapped tiles both lead there. */
  onOpenSongs: () => void;
}

/** Bottom status: readiness, stat tiles, key hints, diagnostics and the source link. */
export function StatsBar({
  connection,
  lomReady,
  snapshot,
  songCount,
  unmappedCount,
  selectedCount,
  showLog,
  onToggleLog,
  onOpenSongs,
}: Props) {
  // Report only the first unmet dependency. The bridge device must be reachable
  // before the LOM can become ready, so the strip names the current blocker
  // rather than making the user combine two independent statuses.
  const deviceOpen = connection === 'open';
  const ready = deviceOpen && lomReady;
  const status = !deviceOpen
    ? 'waiting for device'
    : !lomReady
      ? 'waiting for lom'
      : 'ready';

  return (
    <div className="stats">
      <div
        className={`connection-status ${ready ? 'ready' : 'waiting'}`}
        role="status"
        aria-live="polite"
      >
        {status}
      </div>
      <Stat k="Tracks" v={snapshot?.trackCount} />
      <Stat k="Scenes" v={snapshot?.sceneCount} />
      <Stat k="Clips" v={snapshot?.clipCount} />
      <Stat
        k="Songs"
        v={snapshot ? songCount : undefined}
        onClick={snapshot ? onOpenSongs : undefined}
      />
      <Stat
        k="Unmapped"
        v={snapshot ? unmappedCount : undefined}
        warn={unmappedCount > 0}
        onClick={snapshot ? onOpenSongs : undefined}
      />
      <Stat k="LOM walk" v={snapshot ? `${snapshot.ms}ms` : undefined} />
      <Stat k="Slot scan" v={snapshot ? `${snapshot.timings.slots}ms` : undefined} />
      <Stat k="Selected" v={selectedCount} />
      <div className="spacer" />
      <div className="keyhint">
        <b>{LAUNCH_KEY}</b>-click / <b>{LAUNCH_KEY}</b>-↑↓ fires · <b>⇧</b> extends ·{' '}
        <b>esc</b> stops clips · <b>{LAUNCH_KEY}Z</b> undoes
      </div>
      {/* Diagnostics live with status rather than the performance controls in
          the header. The console itself renders immediately above this strip. */}
      <ControlButton
        icon
        pressed={showLog}
        className="stats-log-toggle"
        aria-label="Debug console"
        title={`${showLog ? 'Hide' : 'Show'} debug console`}
        onClick={onToggleLog}
      >
        <IconBug />
      </ControlButton>
      <a
        className="repository-link"
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="View open[flow] on GitHub"
        title="View source on GitHub"
      >
        <IconGitHub />
      </a>
    </div>
  );
}
