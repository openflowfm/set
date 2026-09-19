import { useCallback, useState } from 'react';
import { format } from '@openflow/widgets/param/format.ts';
import { deviceParam } from '../src/lib/liveParam.ts';
import { EQ8_BANDS } from '../src/components/devices/eq8/bind.ts';
import type { DeviceFaceProps } from '../src/components/devices/face.ts';

/**
 * A device that behaves like Live without being Live.
 *
 * A face reads `ChainDevice` and a list of `DeviceParameterState`, so a bench
 * that wants to show one has to produce both. What it must not do is let a
 * control move locally: the whole point of the parameter tier is that a widget
 * shows what came *back*, so a move here writes the fixture and the face
 * re-reads it, exactly as a move in the app writes Live and waits.
 *
 * **The names are a guess, and the same guess `bind.test.ts` pins.** Nothing in
 * this project has read an EQ Eight's parameter list off a running device. If
 * the bench shows a slot drawn dead, that is the matcher telling the truth
 * about these names — which is worth more than a fixture built to flatter it.
 */

interface Spec {
  name: string;
  min: number;
  max: number;
  value: number;
  items?: string[];
}

function state(spec: Spec): OpenFlow.DeviceParameterState {
  const quantized = spec.items !== undefined;
  const base: OpenFlow.DeviceParameterState = {
    name: spec.name,
    value: spec.value,
    min: spec.min,
    max: spec.max,
    quantized,
    display: '',
    state: 0,
  };
  if (!quantized) base.defaultValue = spec.value;
  if (spec.items) base.items = spec.items;
  return { ...base, display: format(deviceParam(base), spec.value) };
}

const FILTER_TYPES = ['Low Cut', 'Low Shelf', 'Bell', 'Notch', 'High Shelf', 'High Cut'];

const EQ8_SHAPE: Spec[] = (() => {
  const specs: Spec[] = [{ name: 'Device On', min: 0, max: 1, value: 1, items: ['Off', 'On'] }];
  const frequencies = [167, 200, 1290, 2610, 100, 10000, 5000, 18000];
  const gains = [0, 0, -7.81, 3.6, 0, 0, 0, 0];
  const qs = [1.37, 0.71, 0.93, 0.71, 0.71, 0.71, 0.71, 0.71];
  const types = [0, 2, 2, 3, 2, 2, 2, 5];
  for (let band = 1; band <= EQ8_BANDS; band++) {
    const at = band - 1;
    specs.push(
      { name: `${band} Filter On A`, min: 0, max: 1, value: band <= 4 ? 1 : 0, items: ['Off', 'On'] },
      { name: `${band} Frequency A`, min: 20, max: 20000, value: frequencies[at] },
      { name: `${band} Gain A`, min: -15, max: 15, value: gains[at] },
      { name: `${band} Resonance A`, min: 0.1, max: 18, value: qs[at] },
      { name: `${band} Filter Type A`, min: 0, max: 5, value: types[at], items: FILTER_TYPES },
    );
  }
  specs.push(
    { name: 'Scale', min: 0, max: 200, value: 100 },
    { name: 'Output Gain', min: -12, max: 12, value: 0 },
    { name: 'Adaptive Q', min: 0, max: 1, value: 1, items: ['Off', 'On'] },
  );
  return specs;
})();

const PLUGIN_SHAPE: Spec[] = [
  { name: 'Cutoff', min: 20, max: 20000, value: 900 },
  { name: 'Resonance', min: 0, max: 100, value: 25 },
  { name: 'Drive', min: 0, max: 100, value: 40 },
  { name: 'Mix', min: 0, max: 100, value: 100 },
];

export const DEVICE_SHAPES = { eq8: EQ8_SHAPE, plugin: PLUGIN_SHAPE };

export function useFakeDevice(
  className: string,
  name: string,
  shape: Spec[],
): DeviceFaceProps {
  const [device, setDevice] = useState<OpenFlow.ChainDevice>({
    name,
    className,
    on: true,
    folded: false,
  });
  const [parameters, setParameters] = useState(() => shape.map(state));

  const onParam = useCallback((at: number, value: number) => {
    setParameters((held) =>
      held.map((parameter, index) => {
        if (index !== at) return parameter;
        const moved = { ...parameter, value };
        return { ...moved, display: format(deviceParam(moved), value) };
      }),
    );
  }, []);

  const onToggle = useCallback((on: boolean) => setDevice((d) => ({ ...d, on })), []);
  const onFold = useCallback((folded: boolean) => setDevice((d) => ({ ...d, folded })), []);

  return { device, parameters, onParam, onToggle, onFold };
}
