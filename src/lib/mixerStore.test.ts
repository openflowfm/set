import { describe, expect, it, vi } from 'vitest';
import { MixerStore } from './mixerStore.ts';

const parameter = (value: number): OpenFlow.MixerParameterState => ({
  value,
  min: 0,
  max: 1,
  defaultValue: 0,
  display: `${value}`,
  enabled: true,
});

const state = (sendValue: number, sendCount = 1): OpenFlow.MixerState => ({
  sendCount,
  masterVolume: parameter(0.8),
  masterPan: parameter(0.5),
  tracks: [
    {
      t: 0,
      active: true,
      solo: false,
      armed: false,
      canArm: true,
      volume: parameter(0.7),
      pan: parameter(0.5),
      sends: Array.from({ length: sendCount }, (_, index) =>
        parameter(index === 0 ? sendValue : 0),
      ),
    },
  ],
});

describe('MixerStore sends', () => {
  it('notifies only the track whose send readback changed', () => {
    const store = new MixerStore();
    const trackListener = vi.fn();
    const masterListener = vi.fn();
    store.subscribe(0, trackListener);
    store.subscribe('master', masterListener);

    store.update(state(0.2));
    trackListener.mockClear();
    masterListener.mockClear();
    store.update(state(0.4));

    expect(trackListener).toHaveBeenCalledOnce();
    expect(masterListener).not.toHaveBeenCalled();
    expect(store.strip(0)).toMatchObject({ kind: 'track', sends: [{ value: 0.4 }] });
  });

  it('does not shorten or redraw Master when the send-row count changes', () => {
    const store = new MixerStore();
    const trackListener = vi.fn();
    const masterListener = vi.fn();
    store.subscribe(0, trackListener);
    store.subscribe('master', masterListener);
    store.update(state(0.2));
    trackListener.mockClear();
    masterListener.mockClear();

    store.update(state(0.2, 2));

    expect(trackListener).toHaveBeenCalledOnce();
    expect(masterListener).not.toHaveBeenCalled();
    expect(store.strip('master')).toMatchObject({ kind: 'master' });
  });
});
