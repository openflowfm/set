import { describe, expect, it, vi } from 'vitest';
import { ChainStore, deviceKey } from './chainStore.ts';

const param = (over: Partial<OpenFlow.DeviceParameterState> = {}): OpenFlow.DeviceParameterState => ({
  name: 'Freq',
  value: 100,
  min: 20,
  max: 20000,
  defaultValue: 167,
  quantized: false,
  display: '100 Hz',
  state: 0,
  ...over,
});

const state = (
  parameters: OpenFlow.DeviceParameterState[] | undefined,
  path: number[] = [],
): OpenFlow.ChainState => ({
  chains: [
    {
      t: 1,
      path,
      devices: [{ name: 'EQ Eight', className: 'Eq8', on: true, folded: false, parameters }],
    },
  ],
});

const KEY = deviceKey(1, [], 0);

describe('deviceKey', () => {
  it("separates a track's run from a rack chain at the same index", () => {
    expect(deviceKey(1, [], 0)).not.toBe(deviceKey(1, [0, 0], 0));
  });

  it('separates the same run on different tracks', () => {
    expect(deviceKey(1, [2, 0], 3)).not.toBe(deviceKey(2, [2, 0], 3));
  });
});

describe('update', () => {
  it('holds the parameters of an open device', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    expect(store.parameters(KEY)).toHaveLength(1);
  });

  it('holds nothing for a device with no parameters', () => {
    const store = new ChainStore();
    store.update(state(undefined));
    expect(store.parameters(KEY)).toBeNull();
  });

  it('drops a device that folded, rather than keeping stale values', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    store.update(state(undefined));
    expect(store.parameters(KEY)).toBeNull();
  });

  it('drops everything when the LOM goes away', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    store.update(null);
    expect(store.parameters(KEY)).toBeNull();
  });

  it('keeps the same array identity when nothing moved', () => {
    // useSyncExternalStore compares by reference; a fresh array every read tears.
    const store = new ChainStore();
    store.update(state([param()]));
    const first = store.parameters(KEY);
    store.update(state([param()]));
    expect(store.parameters(KEY)).toBe(first);
  });

  it('replaces the array when a value moved', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    const first = store.parameters(KEY);
    store.update(state([param({ value: 200, display: '200 Hz' })]));
    expect(store.parameters(KEY)).not.toBe(first);
  });

  it('notices a changed enum member list', () => {
    const store = new ChainStore();
    store.update(state([param({ quantized: true, items: ['Low cut', 'Bell'] })]));
    const first = store.parameters(KEY);
    store.update(state([param({ quantized: true, items: ['Low cut', 'Notch'] })]));
    expect(store.parameters(KEY)).not.toBe(first);
  });

  it('wakes only the device that changed', () => {
    const store = new ChainStore();
    const mine = vi.fn();
    const other = vi.fn();
    store.subscribe(KEY, mine);
    store.subscribe(deviceKey(1, [], 5), other);
    store.update(state([param()]));
    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});

describe('apply', () => {
  it('patches one value and leaves the rest', () => {
    const store = new ChainStore();
    store.update(state([param(), param({ name: 'Gain', value: 0, display: '0.0 dB' })]));
    store.apply([{ t: 1, path: [], i: 0, p: 1, value: 3, display: '3.0 dB' }]);
    const held = store.parameters(KEY)!;
    expect(held[1].value).toBe(3);
    expect(held[1].display).toBe('3.0 dB');
    expect(held[0].value).toBe(100);
  });

  it('keeps the descriptor fields a change does not carry', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    store.apply([{ t: 1, path: [], i: 0, p: 0, value: 500, display: '500 Hz' }]);
    expect(store.parameters(KEY)![0]).toMatchObject({
      name: 'Freq',
      min: 20,
      max: 20000,
      defaultValue: 167,
    });
  });

  it('copies once however many parameters on one device moved', () => {
    const store = new ChainStore();
    store.update(state([param(), param({ name: 'Gain' })]));
    const wake = vi.fn();
    store.subscribe(KEY, wake);
    store.apply([
      { t: 1, path: [], i: 0, p: 0, value: 1, display: '1' },
      { t: 1, path: [], i: 0, p: 1, value: 2, display: '2' },
    ]);
    expect(wake).toHaveBeenCalledTimes(1);
    expect(store.parameters(KEY)!.map((p) => p.value)).toEqual([1, 2]);
  });

  it('ignores a device it holds nothing for', () => {
    // The bridge broadcasts the union, so changes arrive for other clients' runs.
    const store = new ChainStore();
    store.update(state([param()]));
    expect(() =>
      store.apply([{ t: 9, path: [], i: 0, p: 0, value: 1, display: '1' }]),
    ).not.toThrow();
    expect(store.parameters(KEY)![0].value).toBe(100);
  });

  it('ignores a parameter index past the end', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    const first = store.parameters(KEY);
    store.apply([{ t: 1, path: [], i: 0, p: 7, value: 1, display: '1' }]);
    expect(store.parameters(KEY)).toBe(first);
  });

  it('does not wake anyone when the value is already what arrived', () => {
    const store = new ChainStore();
    store.update(state([param()]));
    const wake = vi.fn();
    store.subscribe(KEY, wake);
    store.apply([{ t: 1, path: [], i: 0, p: 0, value: 100, display: '100 Hz' }]);
    expect(wake).not.toHaveBeenCalled();
  });

  it('addresses a rack chain separately from the track run', () => {
    const store = new ChainStore();
    store.update(state([param()], [0, 1]));
    store.apply([{ t: 1, path: [0, 1], i: 0, p: 0, value: 42, display: '42' }]);
    expect(store.parameters(deviceKey(1, [0, 1], 0))![0].value).toBe(42);
    expect(store.parameters(KEY)).toBeNull();
  });
});

describe('subscribe', () => {
  it('stops waking a listener once it unsubscribes', () => {
    const store = new ChainStore();
    const wake = vi.fn();
    const off = store.subscribe(KEY, wake);
    off();
    store.update(state([param()]));
    expect(wake).not.toHaveBeenCalled();
  });
});
