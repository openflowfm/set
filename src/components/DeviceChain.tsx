import { Chain } from '@openflow/widgets/chrome/Chain.tsx';
import { Device } from '@openflow/widgets/chrome/Device.tsx';
import { Rack } from '@openflow/widgets/chrome/Rack.tsx';
import { ControlButton } from './Control.tsx';
import { Faceplate } from './devices/Faceplate.tsx';
import { faceFor } from './devices/faces.ts';
import type { DeviceFaceProps } from './devices/face.ts';
import { useDeviceParameters } from '../hooks/useDeviceChain.ts';
import type { ChainStore } from '../lib/chainStore.ts';
import './DeviceChain.css';

/**
 * The selected track's device chain, along the bottom of the window.
 *
 * This is the first thing in the app drawn out of [`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md)
 * rather than its own components, and the boundary holds the way the mixer's
 * faders proved it could: `widgets/` takes a name and two booleans, and knows
 * nothing about `OpenFlow`, the bridge, or Live. The adapting is all here and in
 * [`devices/`](./devices/), which is where a device's controls become widgets.
 *
 * **Faces, not just shells.** A device the app has drawn a face for renders it;
 * everything else gets `Faceplate`, which lays out whatever controls the device
 * reports. Both only when the device is open — a folded one is a title bar with
 * nothing behind it, and nothing behind it is being watched either.
 *
 * **The fold triangle is the subscription.** `open` in the chain watch is
 * derived from fold state, so unfolding a device here is what makes the bridge
 * read and observe its ~40 parameters, and folding it is what drops them. That
 * is the whole economy of the parameter tier expressed as one triangle, and it
 * is why this component writes fold rather than keeping it locally: a fold that
 * didn't reach Live would be a fold that changed nothing about the cost.
 */
export interface DeviceChainProps {
  /** The track being shown. Its index addresses every device in the strip. */
  t: number;
  /** Its name, for the strip's own label. */
  name: string;
  devices: OpenFlow.ChainDevice[];
  loading: boolean;
  failed: boolean;
  /** A nested run's devices, or undefined while its subscription is in flight. */
  runAt(path: readonly number[]): OpenFlow.ChainDevice[] | null | undefined;
  chainAt(path: readonly number[], index: number): number;
  onChain(path: readonly number[], index: number, chain: number): void;
  /** Where a face's controls read from — outside React, at gesture rate. */
  store: ChainStore;
  onDevice(path: readonly number[], index: number, patch: OpenFlow.DevicePatch): void;
  onClose(): void;
}

/** What every shell needs to address itself and reach the run below it. */
interface ShellContext {
  /** The track, which every device address starts from. */
  t: DeviceChainProps['t'];
  /** The run this device sits in. */
  path: readonly number[];
  runAt: DeviceChainProps['runAt'];
  chainAt: DeviceChainProps['chainAt'];
  onChain: DeviceChainProps['onChain'];
  store: DeviceChainProps['store'];
  onDevice: DeviceChainProps['onDevice'];
}

/**
 * The three writes a device shell offers, bound to one device's address.
 *
 * Assembled in one place because a rack and an ordinary device need the same
 * three, and because a face is handed them as a unit — `DeviceFaceProps` is the
 * contract, and building half of it in two components is how the two drift.
 */
function writesFor(
  context: ShellContext,
  index: number,
): Pick<DeviceFaceProps, 'onParam' | 'onToggle' | 'onFold'> {
  return {
    onParam: (p, value) => context.onDevice(context.path, index, { param: { p, value } }),
    onToggle: (on) => context.onDevice(context.path, index, { on }),
    onFold: (folded) => context.onDevice(context.path, index, { folded }),
  };
}

/**
 * A rack, and the chain it currently has selected.
 *
 * **Which chain is showing used to be this component's own state**, on the
 * reasoning that it was a view choice inside one rack and nothing over the wire
 * depended on it. The second half stopped being true: the chain a rack is
 * showing is exactly what decides whether its devices are watched, so the
 * choice now lives in the hook, which is the thing that declares it.
 *
 * A chain's devices arrive as a subscription of their own rather than nested in
 * this device's payload, so `runAt` may answer `undefined` for a beat after the
 * rack opens. That reads as "opening" rather than "empty", because a rack that
 * is genuinely bare answers `[]`.
 *
 * A rack's parameters are its macros, so they go in the pane Live puts them in
 * rather than into a face of their own.
 */
function RackShell({
  device,
  index,
  context,
}: {
  device: OpenFlow.ChainDevice;
  index: number;
  context: ShellContext;
}) {
  const parameters = useDeviceParameters(context.store, context.t, context.path, index);
  const writes = writesFor(context, index);
  const chains = device.chains ?? [];
  const at = Math.min(context.chainAt(context.path, index), Math.max(0, chains.length - 1));
  const inner = [...context.path, index, at];
  const devices = context.runAt(inner);

  return (
    <Rack
      name={device.name}
      on={device.on}
      onToggle={writes.onToggle}
      folded={device.folded}
      onFold={writes.onFold}
      macros={
        device.folded ? undefined : (
          <Faceplate parameters={parameters} onParam={writes.onParam} />
        )
      }
      chains={chains.map((c) => c.name)}
      chainAt={at}
      onChain={(chain) => context.onChain(context.path, index, chain)}
    >
      <Chain
        placeholder={devices === undefined ? 'Opening…' : 'No devices in this chain'}
      >
        {(devices ?? []).map((nested, i) => (
          <DeviceShell
            key={`${i}:${nested.name}`}
            device={nested}
            index={i}
            context={{ ...context, path: inner }}
          />
        ))}
      </Chain>
    </Rack>
  );
}

/**
 * An ordinary device: its face if the app has drawn one, a plain plate if not.
 *
 * A face owns its whole shell, title bar included — see
 * [`face.ts`](./devices/face.ts) for why — so this either renders the face and
 * nothing else, or builds the shell itself and puts `Faceplate` inside it.
 */
function PlainShell({
  device,
  index,
  context,
}: {
  device: OpenFlow.ChainDevice;
  index: number;
  context: ShellContext;
}) {
  const parameters = useDeviceParameters(context.store, context.t, context.path, index);
  const Face = faceFor(device.className);
  const writes = writesFor(context, index);

  if (Face) return <Face device={device} parameters={parameters} {...writes} />;
  return (
    <Device
      name={device.name}
      on={device.on}
      onToggle={writes.onToggle}
      folded={device.folded}
      onFold={writes.onFold}
      title={`${device.name} · ${device.className}`}
    >
      <Faceplate parameters={parameters} onParam={writes.onParam} />
    </Device>
  );
}

/**
 * One device: a rack if it has chains, an ordinary shell otherwise.
 *
 * A device has no id on the wire — its address is its position in the run, the
 * same bargain clips make with `(track, scene)` — so the key pairs the index
 * with the name. Position alone would keep a shell mounted when a device is
 * swapped for another at the same slot.
 */
function DeviceShell({
  device,
  index,
  context,
}: {
  device: OpenFlow.ChainDevice;
  index: number;
  context: ShellContext;
}) {
  if (device.chains) return <RackShell device={device} index={index} context={context} />;
  return <PlainShell device={device} index={index} context={context} />;
}

export function DeviceChain({
  t,
  name,
  devices,
  loading,
  failed,
  runAt,
  chainAt,
  onChain,
  store,
  onDevice,
  onClose,
}: DeviceChainProps) {
  const context: ShellContext = { t, path: [], runAt, chainAt, onChain, store, onDevice };

  return (
    <section className="device-chain" aria-label={`${name} devices`}>
      <div className="device-chain-head">
        <span className="device-chain-track">{name}</span>
        <span className="device-chain-count">
          {loading
            ? 'opening…'
            : failed
              ? 'unavailable'
              : `${devices.length} device${devices.length === 1 ? '' : 's'}`}
        </span>
        <div className="spacer" />
        <ControlButton
          icon
          aria-label="Close the device chain"
          title="Close — clicking a track header reopens it"
          onClick={onClose}
        >
          ×
        </ControlButton>
      </div>

      {/* The strip stays mounted through a change rather than being replaced by
          a spinner: the chain that's there is almost always the chain that's
          still there, and swapping it for a message makes every update look
          like the devices went away. */}
      <div className="device-chain-run">
        <Chain
          placeholder={
            failed ? 'This track is no longer in the set' : 'No devices on this track'
          }
        >
          {devices.map((device, i) => (
            <DeviceShell key={`${i}:${device.name}`} device={device} index={i} context={context} />
          ))}
        </Chain>
      </div>
    </section>
  );
}
