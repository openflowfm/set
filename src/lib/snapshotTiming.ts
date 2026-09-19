// The snapshot phase breakdown printed to the browser console, and the
// error-text helper the log lines share. Pure functions — no React.

import type { WireTiming } from './client.ts';

/** Scenes in the full-size set we're actually building for. */
export const TARGET_SCENES = 848;

/**
 * Writes the phase breakdown to the browser console. Every phase of the walk is
 * a linear scan, so a projection to full-set size is a fair extrapolation — and
 * it's the number that decides whether snapshotting needs a progress bar.
 *
 * **A cached answer gets one line instead**, because there is no walk to break
 * into phases: the bridge held the set and Live did nothing at all. Printing
 * the table would project full-set cost from a walk that happened minutes ago
 * and attribute it to this request, which is the opposite of what the readout
 * is for.
 */
export function reportSnapshotTiming(
  e: OpenFlow.EventOf<'snapshot'>,
  wire: WireTiming | null,
  commitMs: number,
): void {
  const { data, dictMs, hostMs } = e;
  if (e.cached) {
    console.debug(
      `⏱ snapshot ${data.clipCount} clips · ${data.sceneCount} scenes · ` +
        `held by the bridge, no LOM walk — ` +
        `${Math.round((wire ? wire.totalMs : 0) + commitMs)}ms end-to-end ` +
        `(${Math.round(commitMs)}ms of it React)`,
    );
    return;
  }
  const t = data.timings;
  // `t.elapsed` is the LOM span, not `data.ms`: the walk chunks, so `data.ms`
  // counts only the ticks it was working and understates the wait by whatever
  // it gave back to Live.
  const total = wire ? wire.totalMs + commitMs : t.elapsed;
  const yielded = Math.max(0, t.elapsed - (t.tracks + t.scenes + t.slots + t.clips));
  const scale = data.sceneCount > 0 ? TARGET_SCENES / data.sceneCount : 1;

  const row = (ms: number, note: string) => ({
    ms: Math.round(ms * 10) / 10,
    'share': total > 0 ? `${Math.round((ms / total) * 100)}%` : '—',
    note,
  });

  console.groupCollapsed(
    `%c⏱ snapshot%c ${data.clipCount} clips · ${data.sceneCount} scenes · ` +
      `${Math.round(total)}ms end-to-end` +
      (t.restarts > 0 ? ` · ${t.restarts} restarts` : ''),
    'color:#f0b23c;font-weight:600',
    'color:inherit',
  );
  console.table({
    'lom: tracks': row(t.tracks, `${data.trackCount} tracks`),
    'lom: scenes': row(t.scenes, `${data.sceneCount} scenes`),
    'lom: slot scan': row(t.slots, `${t.slotsScanned} slots probed`),
    'lom: clip reads': row(t.clips, `${data.clipCount} clips`),
    'lom: yielded': row(yielded, 'given back to Live between chunks'),
    'v8 → dict': row(dictMs, 'JSON.stringify + Dict.parse'),
    'node getDict': row(hostMs, 'Max dict → JS object'),
    'wire + parse': row(
      wire ? Math.max(0, wire.totalMs - t.elapsed - dictMs - hostMs) : 0,
      wire ? `${(wire.bytes / 1024).toFixed(0)} kB payload` : 'unmeasured',
    ),
    'react commit': row(commitMs, `${data.sceneCount} rows`),
  });
  console.debug(
    `projection to ${TARGET_SCENES} scenes (×${scale.toFixed(1)}, linear): ` +
      `~${((total * scale) / 1000).toFixed(1)}s end-to-end`,
  );
  console.groupEnd();
}

/**
 * A non-empty description of a thrown value. `||` rather than `??`: an Error with
 * an empty message logs as "color: " and says nothing at all.
 */
export function errText(e: unknown): string {
  const m = (e as Error)?.message;
  if (typeof m === 'string' && m !== '') return m;
  const s = String(e);
  return s && s !== 'undefined' && s !== 'null' && s !== '[object Object]'
    ? s
    : 'failed with no message — check the Max window';
}
