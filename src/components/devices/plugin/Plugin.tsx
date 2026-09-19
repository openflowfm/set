import { useState } from 'react';
import { Device } from '@openflow/widgets/chrome/Device.tsx';
import { Select } from '@openflow/widgets/controls/Select.tsx';
import { XYPad, type PadAxis } from '@openflow/widgets/controls/XYPad.tsx';
import type { Param } from '@openflow/widgets/param/param.ts';
import { deviceParam } from '../../../lib/liveParam.ts';
import type { DeviceFaceProps } from '../face.ts';
import './Plugin.css';

const UNASSIGNED = 'none';

/** What an axis reads as before it has been pointed at anything: a position. */
const FREE_X: Param = {
  kind: 'float', min: 0, max: 100, defaultValue: 0, unit: 'percent', shortName: 'X',
};
const FREE_Y: Param = { ...FREE_X, shortName: 'Y' };

/**
 * The container Live draws around a plug-in it cannot draw itself.
 *
 * A VST or AU has its own window and Live has no way inside it, so what sits in
 * the chain is a shell holding two things: an X-Y control, and the two choosers
 * naming which of the plug-in's parameters that control moves. It is the whole
 * device, which makes it the plainest possible caller of
 * [`XYPad`](https://github.com/openflowfm/widgets/blob/main/src/controls/XYPad.tsx) — a plane with
 * nothing drawn behind it — and the reason it exists here is to be exactly that.
 *
 * **It is not in [the registry](../faces.ts), on purpose.** Two things would
 * have to be true first. A plug-in's `class_name` is almost certainly
 * `PluginDevice`, but `bridge/LOM.md` has no section for that class and nothing
 * here has read one off a real set — and registering a guess would put this
 * face in front of every plug-in in a chain, replacing `Faceplate`, which draws
 * *all* of a plug-in's controls and is the better answer until the rest is
 * true. If it confirms, this folder becomes `plugindevice/` to match the rule.
 *
 * **Which parameters the axes drive is ours, not Live's.** Live keeps that
 * assignment in the container and the protocol carries a device's parameters
 * rather than the container's own state, so these choosers pick out of the
 * plug-in's parameter list and hold the choice locally. Moving the plane does
 * move Live — those are real parameters and `onParam` is the real write. What
 * won't round-trip is the *choice*, which is why it starts at `none` rather
 * than pretending to restore what Live has.
 *
 * **An unassigned axis still moves, and that isn't the dead-slot rule being
 * broken.** A control drawn dead means a slot that expected a parameter and
 * found none — the face is wrong and has to show it. This is the other thing:
 * the axis has no target *because nobody has picked one*, which the chooser an
 * inch below says outright. Live's own container moves the same way, and a
 * plane that refused to until it was told where to point would read as broken
 * rather than as unassigned. The position it holds is its own until an
 * assignment arrives, and then the parameter's value is what it draws.
 *
 * The write goes straight out rather than through
 * [`ParamControl`](../ParamControl.tsx), so it has no local hold while the
 * readback catches up. Every other bound control in the app does have one, and
 * the fix is a `ParamPad` next to the rest of that file rather than anything
 * here.
 */
export function Plugin({ device, parameters, onParam, onToggle, onFold }: DeviceFaceProps) {
  // 0 is `none`; every other index is one past the parameter it names, so the
  // chooser and the parameter list can't drift apart as the list arrives.
  const [assigned, setAssigned] = useState<[number, number]>([0, 0]);
  const [free, setFree] = useState<[number, number]>([0, 0]);
  const names = [UNASSIGNED, ...(parameters ?? []).map((p) => p.name)];

  const axis = (at: 0 | 1): PadAxis => {
    const index = assigned[at];
    const state = index > 0 ? parameters?.[index - 1] ?? null : null;
    if (state === null) {
      return {
        param: at === 0 ? FREE_X : FREE_Y,
        value: free[at],
        onChange: (next) =>
          setFree((held) => (at === 0 ? [next, held[1]] : [held[0], next])),
      };
    }
    return {
      param: deviceParam(state),
      value: state.value,
      onChange: (next) => onParam(index - 1, next),
      display: state.display,
    };
  };

  const x = axis(0);
  const y = axis(1);

  return (
    <Device
      name={device.name}
      className="plugin-device"
      on={device.on}
      onToggle={onToggle}
      folded={device.folded}
      onFold={onFold}
      onHotSwap={() => {}}
    >
      <XYPad
        x={x}
        y={y}
        width={168}
        height={168}
        showValue={false}
        label={`${device.name} X-Y control`}
      />
      <div className="plugin-assignments">
        <Select
          items={names}
          index={assigned[0]}
          onChange={(next) => setAssigned(([, at]) => [next, at])}
          label="X axis parameter"
        />
        <Select
          items={names}
          index={assigned[1]}
          onChange={(next) => setAssigned(([at]) => [at, next])}
          label="Y axis parameter"
        />
      </div>
    </Device>
  );
}
