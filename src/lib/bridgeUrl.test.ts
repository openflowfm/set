import { afterEach, describe, expect, it, vi } from 'vitest';
import { bridgeUrl } from './bridgeUrl.ts';

/**
 * The one thing that differs between the desktop app and the dev server.
 *
 * Worth a test rather than a glance because the failure is silent in the
 * direction that matters: get it wrong in the app and the socket dials the
 * bundle's own origin, which nothing is listening on, and the panel simply says
 * "no bridge" forever with no clue why.
 */
describe('where the bridge is', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('takes the address the desktop app handed over', () => {
    vi.stubGlobal('openflow', { bridge: 'ws://127.0.0.1:17800/ws' });
    vi.stubGlobal('location', { host: 'app' });
    expect(bridgeUrl()).toBe('ws://127.0.0.1:17800/ws');
  });

  it('falls back to the origin the page came from, which is the dev proxy', () => {
    vi.stubGlobal('location', { host: 'localhost:5173' });
    expect(bridgeUrl()).toBe('ws://localhost:5173/ws');
  });

  it('treats a preload that found no address as no address', () => {
    // A flag that never arrived leaves an empty string, and dialling `ws:///ws`
    // is a worse failure than falling back.
    vi.stubGlobal('openflow', { bridge: '' });
    vi.stubGlobal('location', { host: 'localhost:5173' });
    expect(bridgeUrl()).toBe('ws://localhost:5173/ws');
  });
});
