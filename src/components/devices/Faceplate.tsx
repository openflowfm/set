import { ParamControl } from './ParamControl.tsx';
import './devices.css';

/**
 * The face a device gets when the app hasn't drawn it one.
 *
 * Every control the device reports, in the order Live reports them, each drawn
 * as whichever widget its own shape calls for. No arrangement, no grouping, no
 * knowledge of what the device is — which is exactly what makes it right for
 * every device at once, and only roughly right for any of them.
 *
 * **It earns its place twice over.** It is the fallback that keeps a chain
 * useful when there is no bespoke face, which is every device but one. And it
 * is the only thing in the app that shows a parameter list *as Live spells it*,
 * captions and all — so it is where the names a face has to match get read off
 * a real device, and where a face that stopped matching them shows up.
 *
 * The order is Live's own, which puts the device's on/off switch first on stock
 * devices. It is drawn like any other control rather than hidden as a duplicate
 * of the shell's activator: skipping a parameter on the strength of its
 * position is a rule that holds until the device it doesn't.
 */
export function Faceplate({
  parameters,
  onParam,
}: {
  parameters: OpenFlow.DeviceParameterState[] | null;
  onParam(p: number, value: number): void;
}) {
  if (!parameters) return <div className="device-plate device-plate-waiting">opening…</div>;
  if (parameters.length === 0) {
    return <div className="device-plate device-plate-waiting">no controls</div>;
  }

  return (
    <div className="device-plate">
      {parameters.map((state, p) => (
        <ParamControl
          key={`${p}:${state.name}`}
          name={state.name}
          binding={{ state, onChange: (value) => onParam(p, value) }}
        />
      ))}
    </div>
  );
}
