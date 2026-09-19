import './SyncModal.css';

interface Props {
  progress: { done: number; total: number } | null;
}

/** Blocking feedback while the snapshot behind the grid is being replaced. */
export function SyncModal({ progress }: Props) {
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 100;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const status =
    percent === 0
      ? 'Preparing sync…'
      : percent < 10
        ? 'Reading tracks…'
        : percent < 20
          ? 'Reading scenes…'
          : percent < 80
            ? 'Scanning clip slots…'
            : percent < 99
              ? 'Reading clips…'
              : 'Updating session view…';

  return (
    <div className="viewport-overlay modal-back sync-back">
      <div
        className="modal sync-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        aria-describedby="sync-status"
      >
        <div className="modal-h" id="sync-title">
          Syncing Live set
        </div>
        <div className="sync-row" id="sync-status">
          <span aria-live="polite">{status}</span>
          <span className="sync-percent">{percent}%</span>
        </div>
        <progress
          className="sync-progress"
          max={total}
          value={done}
          aria-label="Sync progress"
        >
          {percent}%
        </progress>
      </div>
    </div>
  );
}
