import type { Param } from '@openflow/widgets/param/param.ts';

/**
 * A Live parameter, read into the widget library's model of one.
 *
 * This adapter is the whole boundary. `widgets/` knows nothing about `OpenFlow`,
 * the bridge or Live — it takes a `Param` and a number — and this is where the
 * app hands it one. Anything Live-specific about a control stops here.
 *
 * There is deliberately no `unit`. Live spells its own values through
 * `DeviceParameter.str_for_value` and the app already carries that text as
 * `display`, which every widget prefers over its own formatting. A unit style
 * chosen here would be a second conversion that has to keep agreeing with
 * Live's, and eventually wouldn't.
 */

const ABSENT: Param = { kind: 'float', min: 0, max: 1, defaultValue: 0 };

export function liveParam(
  state: OpenFlow.MixerParameterState | null,
  bounds?: { min: number; max: number },
): Param {
  if (!state) return bounds ? { ...ABSENT, ...bounds } : ABSENT;
  return {
    kind: 'float',
    min: state.min,
    max: state.max,
    defaultValue: state.defaultValue,
  };
}

/**
 * A Live device parameter, read into the widget library's model of one.
 *
 * **There is deliberately no `exponent`, and that isn't an omission.** Live's
 * `DeviceParameter.value` is documented "Linear-to-GUI value between min and
 * max" — the taper is already applied on Live's side, so the number is a
 * position on the control rather than a physical quantity. An EQ band reading
 * halfway through its range *is* halfway along Live's own knob. Applying a
 * curve here would bend a value that has already been bent, and the two would
 * disagree with `display`, which is Live's own spelling of the same number.
 *
 * `kind` comes from `is_quantized` rather than from the range, because Live
 * says so directly. A two-member quantized parameter falls out as a switch
 * through `isSwitch`, which asks about the range and not about this.
 */
export function deviceParam(state: OpenFlow.DeviceParameterState): Param {
  if (state.quantized) {
    return {
      // Members make it an enum; without them it is a stepped number, which is
      // what a quantized parameter too wide to spell out comes back as.
      kind: state.items ? 'enum' : 'int',
      min: state.min,
      max: state.max,
      // Live exposes no default for a quantized parameter — see
      // `DeviceParameterState.defaultValue`. `min` is the honest stand-in: it
      // is a value the parameter certainly holds, and `isSwitch` controls draw
      // no reset affordance anyway.
      defaultValue: state.min,
      items: state.items,
      name: state.name,
    };
  }
  return {
    kind: 'float',
    min: state.min,
    max: state.max,
    defaultValue: state.defaultValue ?? state.min,
    name: state.name,
  };
}

/**
 * Whether the user may move this control.
 *
 * `DeviceParameter.state` is Live's own three-way answer: 0 active, 1
 * changeable but inaudible, 2 cannot be changed. Only the last disables — a
 * parameter that is changeable but currently does nothing audible is still the
 * user's to move, and greying it out would misreport a device that is merely
 * switched off.
 */
export function paramDisabled(state: OpenFlow.DeviceParameterState): boolean {
  return state.state === 2;
}
