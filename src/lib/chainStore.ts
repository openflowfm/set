/**
 * Device parameter values, held outside React.
 *
 * The same arrangement the meters and the mixer already use, for the same
 * reason: a value that moves at gesture rate must not travel through the
 * composition root's state. One automated knob would re-render the footer, the
 * grid and everything else that hangs off `App` sixty times a second.
 *
 * Subscription is **per device**, so turning one knob wakes one faceplate. That
 * granularity is why the key carries the whole address — a device is
 * `(track, run, index)` and nothing shorter identifies one, since a rack chain
 * has its own indexes starting at zero.
 *
 * Structure arrives through `update` and values through `apply`, and the split
 * is the wire's: `chainState` says what the controls *are*, `chainValues` says
 * where they are now. Both land here so a faceplate reads one thing.
 */

export type DeviceKey = string;

export function deviceKey(t: number, path: readonly number[], i: number): DeviceKey {
  return `${t}:${path.join('.')}:${i}`;
}

function sameParameter(
  a: OpenFlow.DeviceParameterState,
  b: OpenFlow.DeviceParameterState,
): boolean {
  return (
    a.value === b.value &&
    a.display === b.display &&
    a.state === b.state &&
    a.name === b.name &&
    a.min === b.min &&
    a.max === b.max &&
    a.defaultValue === b.defaultValue &&
    a.quantized === b.quantized &&
    (a.items === b.items ||
      (!!a.items && !!b.items &&
        a.items.length === b.items.length &&
        a.items.every((item, i) => item === b.items![i])))
  );
}

function sameParameters(
  a: readonly OpenFlow.DeviceParameterState[] | null,
  b: readonly OpenFlow.DeviceParameterState[] | null,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((parameter, i) => sameParameter(parameter, b[i]));
}

export class ChainStore {
  private readonly devices = new Map<DeviceKey, OpenFlow.DeviceParameterState[]>();
  private readonly listeners = new Map<DeviceKey, Set<() => void>>();

  /**
   * Reseed from a structural push.
   *
   * **Identity is preserved where nothing moved**, which is not an optimisation
   * — `useSyncExternalStore` compares snapshots by reference and tears if a
   * getter returns a fresh array every call. A device whose parameters are
   * unchanged must hand back the very array it handed back last time.
   *
   * A device that has lost its `parameters` was folded, or its run stopped being
   * watched. It is dropped rather than kept, because holding values nothing is
   * updating is how a knob ends up showing a number from ten minutes ago.
   */
  update = (state: OpenFlow.ChainState | null): void => {
    const incoming = new Map<DeviceKey, OpenFlow.DeviceParameterState[]>();
    for (const chain of state?.chains ?? []) {
      for (const [i, device] of (chain.devices ?? []).entries()) {
        if (device.parameters) {
          incoming.set(deviceKey(chain.t, chain.path, i), device.parameters);
        }
      }
    }
    for (const key of new Set([...this.devices.keys(), ...incoming.keys()])) {
      const next = incoming.get(key) ?? null;
      const held = this.devices.get(key) ?? null;
      if (sameParameters(held, next)) continue;
      if (next) this.devices.set(key, next);
      else this.devices.delete(key);
      this.wake(key);
    }
  };

  /**
   * Patch the values that moved.
   *
   * A change naming a device we hold nothing for is dropped, not buffered. It
   * means the run is being watched by some *other* client — the bridge unions
   * subscriptions and broadcasts the result, so a client sees changes for
   * devices it never asked about, and inventing a parameter list from a single
   * value would be worse than ignoring it.
   *
   * A change naming a parameter index past the end is dropped the same way: the
   * device was re-read into a different shape and a corrected frame is already
   * on its way.
   */
  apply = (changes: readonly OpenFlow.ChainValueChange[]): void => {
    const touched = new Set<DeviceKey>();
    for (const change of changes) {
      const key = deviceKey(change.t, change.path, change.i);
      const held = this.devices.get(key);
      const parameter = held?.[change.p];
      if (!held || !parameter) continue;
      if (parameter.value === change.value && parameter.display === change.display) continue;
      const next = touched.has(key) ? held : held.slice();
      next[change.p] = { ...parameter, value: change.value, display: change.display };
      this.devices.set(key, next);
      touched.add(key);
    }
    for (const key of touched) this.wake(key);
  };

  parameters = (key: DeviceKey): OpenFlow.DeviceParameterState[] | null =>
    this.devices.get(key) ?? null;

  subscribe = (key: DeviceKey, listener: () => void): (() => void) => {
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      this.listeners.delete(key);
    };
  };

  private wake(key: DeviceKey): void {
    for (const listener of this.listeners.get(key) ?? []) listener();
  }
}
