import type { MeterKey } from '../hooks/useMeters.ts';

export type MixerStripState =
  | ({ kind: 'track' } & OpenFlow.MixerTrackState)
  | {
      kind: 'master';
      volume: OpenFlow.MixerParameterState | null;
      pan: OpenFlow.MixerParameterState | null;
    };

function sameParameter(
  a: OpenFlow.MixerParameterState | null,
  b: OpenFlow.MixerParameterState | null,
): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.value === b.value &&
      a.min === b.min &&
      a.max === b.max &&
      a.defaultValue === b.defaultValue &&
      a.display === b.display &&
      a.enabled === b.enabled)
  );
}

function sameStrip(a: MixerStripState | null, b: MixerStripState): boolean {
  if (
    !a || a.kind !== b.kind ||
    !sameParameter(a.volume, b.volume) ||
    !sameParameter(a.pan, b.pan)
  ) return false;
  if (a.kind === 'master' || b.kind === 'master') return true;
  return (
    a.t === b.t &&
    a.active === b.active &&
    a.solo === b.solo &&
    a.armed === b.armed &&
    a.canArm === b.canArm &&
    a.sends.length === b.sends.length &&
    a.sends.every((parameter, index) => sameParameter(parameter, b.sends[index] ?? null))
  );
}

/** Per-strip external store: one automated parameter never re-renders the grid. */
export class MixerStore {
  private readonly strips = new Map<MeterKey, MixerStripState>();
  private readonly listeners = new Map<MeterKey, Set<() => void>>();

  update = (state: OpenFlow.MixerState | null): void => {
    const incoming = new Map<MeterKey, MixerStripState>();
    if (state) {
      incoming.set('master', {
        kind: 'master',
        volume: state.masterVolume,
        pan: state.masterPan,
      });
      for (const track of state.tracks) {
        incoming.set(track.t, { kind: 'track', ...track });
      }
    }
    const keys = new Set<MeterKey>([...this.strips.keys(), ...incoming.keys()]);
    for (const key of keys) {
      const next = incoming.get(key) ?? null;
      const current = this.strip(key);
      if (next ? sameStrip(current, next) : current === null) continue;
      if (next) this.strips.set(key, next);
      else this.strips.delete(key);
      for (const listener of this.listeners.get(key) ?? []) listener();
    }
  };

  strip = (key: MeterKey): MixerStripState | null => this.strips.get(key) ?? null;

  subscribe = (key: MeterKey, listener: () => void): (() => void) => {
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      this.listeners.delete(key);
    };
  };
}
