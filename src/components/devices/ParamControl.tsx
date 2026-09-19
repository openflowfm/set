import { type ReactNode } from 'react';
import { Knob } from '@openflow/widgets/controls/Knob.tsx';
import { NumberField } from '@openflow/widgets/controls/NumberField.tsx';
import { Select } from '@openflow/widgets/controls/Select.tsx';
import { Toggle } from '@openflow/widgets/controls/Toggle.tsx';
import { isSwitch, type Param } from '@openflow/widgets/param/param.ts';
import type { FillOrigin } from '@openflow/widgets/controls/fill.ts';
import {
  readbackTolerance,
  usePendingValue,
} from '@openflow/widgets/gesture/usePendingValue.ts';
import { deviceParam, paramDisabled } from '../../lib/liveParam.ts';
import './devices.css';

/**
 * One Live control, bound to one widget. The seam every faceplate goes through.
 *
 * A face's job is arrangement: which control sits where, and what it's called.
 * Everything *else* about wiring a control to Live is the same wherever it is
 * drawn — read the range out of the parameter, hold the dragged value until the
 * readback agrees, prefer Live's own spelling over any formatter, refuse the
 * gesture when Live says the parameter can't move — so it is here rather than
 * in each face. See [device faces](../../../docs/device-faces.md).
 *
 * **A slot may find nothing, and that has to show.** A face matches its
 * controls against parameter *names*, and Live's names are Live's — a device
 * that spells one differently, or a Live version that renames one, leaves a
 * slot with no parameter behind it. Every control here accepts `null` and draws
 * itself plainly dead rather than disappearing, because a face that quietly
 * drops the control it couldn't find is a face that looks correct and isn't.
 */

/** What a slot is given: the control Live reports, and where to send a move. */
export interface ParamBinding {
  /** Null when this face's slot matched no parameter on the device. */
  state: OpenFlow.DeviceParameterState | null;
  onChange(value: number): void;
}

export interface ParamProps {
  binding: ParamBinding;
  /** Caption. Defaults to Live's own name for the parameter. */
  name?: string;
  label?: string;
  /**
   * Forced dead by the face, on top of whatever Live says.
   *
   * For a control the *device* has switched out of play — an EQ band that is
   * off — which Live dims without reporting anything about the parameter
   * behind it. Never a way to soften a slot that matched nothing: that case is
   * already dead and marked.
   */
  disabled?: boolean;
  className?: string;
  title?: string;
}

/** A stand-in range, so an unmatched slot still has a control to draw. */
const ABSENT: Param = { kind: 'float', min: 0, max: 1, defaultValue: 0 };

interface Bound {
  param: Param;
  value: number;
  display: string | undefined;
  disabled: boolean;
  className: string;
  title: string | undefined;
  write(next: number): void;
}

/**
 * The whole binding, in one hook so no face has to remember the parts.
 *
 * `usePendingValue` is the part that isn't obvious. Live owns the value, so a
 * dragged control has two of them — the one under the pointer and the one that
 * has come back — and drawing only the second makes every knob lag a round
 * trip. The local one is held until Live's agrees, or until its deadline, which
 * is what recovers a write Live clamped or refused outright.
 */
function useBound(props: ParamProps): Bound {
  const { binding, className, title } = props;
  const state = binding.state;
  const param = state ? deviceParam(state) : ABSENT;
  const held = usePendingValue(state ? state.value : null, {
    tolerance: readbackTolerance(param.min, param.max),
  });

  const missing = !state;
  const classes = ['device-param'];
  if (missing) classes.push('device-param-missing');
  if (className) classes.push(className);

  return {
    param,
    value: held.value ?? param.defaultValue,
    display: state?.display,
    disabled: props.disabled || !state || paramDisabled(state),
    className: classes.join(' '),
    title: missing
      ? `${props.name ?? 'This control'} — no parameter of that name on the device`
      : title ?? `${state.name} · ${state.display}`,
    write(next: number) {
      if (missing) return;
      held.push(next);
      binding.onChange(next);
    },
  };
}

/**
 * The printed caption, and only ever the face's own.
 *
 * It deliberately does **not** fall back to Live's parameter name. A face
 * copies Ableton's layout, where a band's frequency knob is captioned `Freq`
 * and the parameter behind it is called `3 Frequency A` — printing the second
 * where the first belongs would blow out a plate sized for four characters.
 * `Knob` and `NumberField` still fall back to the `Param`'s own name when
 * handed nothing, which is what the plain faceplate wants; the controls here
 * that read no `Param` get nothing, which is what a face wants.
 */
function captionOf(props: ParamProps): string | undefined {
  return props.name;
}

export function ParamKnob(props: ParamProps & { origin?: FillOrigin; showValue?: boolean }) {
  const bound = useBound(props);
  return (
    <Knob
      param={bound.param}
      value={bound.value}
      onChange={bound.write}
      display={bound.display}
      disabled={bound.disabled}
      name={captionOf(props)}
      label={props.label}
      origin={props.origin}
      showValue={props.showValue}
      className={bound.className}
      title={bound.title}
    />
  );
}

export function ParamNumber(props: ParamProps & { showFill?: boolean }) {
  const bound = useBound(props);
  return (
    <NumberField
      param={bound.param}
      value={bound.value}
      onChange={bound.write}
      display={bound.display}
      disabled={bound.disabled}
      name={captionOf(props)}
      label={props.label}
      showFill={props.showFill}
      className={bound.className}
      title={bound.title}
    />
  );
}

/**
 * An enum, drawn as a menu.
 *
 * The value is an index **offset from `min`**, not the value itself. Live's
 * quantized parameters do start at zero in practice, but the protocol carries
 * a min and a max for every one of them, and reading the index straight off
 * `value` is the kind of assumption that holds until the device that breaks it.
 *
 * With no members to show — a quantized parameter too wide to spell out, or a
 * slot that matched nothing — the menu holds the current reading and can't be
 * opened. A `Select` with an empty list would be an invisible control.
 */
export function ParamSelect(props: ParamProps) {
  const bound = useBound(props);
  const items = bound.param.items;
  if (!items || items.length === 0) {
    return (
      <Select
        items={[bound.display || '—']}
        index={0}
        onChange={() => {}}
        disabled
        name={captionOf(props)}
        label={props.label}
        className={bound.className}
        title={bound.title}
      />
    );
  }
  return (
    <Select
      items={items}
      index={Math.round(bound.value - bound.param.min)}
      onChange={(next) => bound.write(bound.param.min + next)}
      disabled={bound.disabled}
      name={captionOf(props)}
      label={props.label}
      className={bound.className}
      title={bound.title}
    />
  );
}

/**
 * A two-state parameter, drawn as a switch.
 *
 * Live models a device's switches as ordinary parameters with a range of one,
 * so the two ends are `min` and `max` rather than 0 and 1, and "on" is the
 * upper end. `children` is what the switch prints — a face usually wants its
 * own word there rather than Live's spelling of a number.
 */
export function ParamSwitch(props: ParamProps & { children?: ReactNode }) {
  const bound = useBound(props);
  const { min, max } = bound.param;
  const on = bound.value >= (min + max) / 2;
  return (
    <Toggle
      on={on}
      onChange={(next) => bound.write(next ? max : min)}
      disabled={bound.disabled}
      name={captionOf(props)}
      label={props.label ?? props.binding.state?.name}
      className={bound.className}
      title={bound.title}
    >
      {props.children}
    </Toggle>
  );
}

/**
 * Whichever control this parameter's own shape calls for.
 *
 * Used where nothing has decided the arrangement — the plain faceplate a device
 * gets when the app has drawn no face for it. A face that *has* been drawn
 * names its widgets itself, because which control Ableton used is part of what
 * the face is copying and can't be inferred from a range.
 */
export function ParamControl(props: ParamProps) {
  const state = props.binding.state;
  const param = state ? deviceParam(state) : ABSENT;
  if (isSwitch(param)) return <ParamSwitch {...props}>{state?.display}</ParamSwitch>;
  if (param.kind === 'enum') return <ParamSelect {...props} />;
  return <ParamKnob {...props} />;
}
