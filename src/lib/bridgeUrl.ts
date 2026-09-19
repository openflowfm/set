import { WS_PATH } from '@openflow/protocol/index.ts';

/**
 * Where the bridge is, decided once and in one place.
 *
 * The app is served two completely different ways and the answer differs:
 *
 * - **In the desktop app** the page comes off a custom scheme, so `location`
 *   describes the bundle rather than anything on the network. The main process
 *   knows the device's port — it is the one that read `OPENFLOW_PORT` — and
 *   hands it over through the preload.
 * - **On the vite dev server** there is no preload at all, so this falls back to
 *   the origin the page came from and vite's `/ws` proxy carries it to the
 *   device. That is exactly what it did before this function existed, which is
 *   the point: several worktrees each proxying to one device keeps working
 *   without any of them being told which port they landed on.
 *
 * `||` rather than `??`: a preload that ran but found no flag hands over an
 * empty string, and an empty string is not an address.
 */
export function bridgeUrl(): string {
  const named = (globalThis as { openflow?: { bridge?: string } }).openflow?.bridge;
  return named || `ws://${location.host}${WS_PATH}`;
}
