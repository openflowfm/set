import type { ReactElement } from 'react';

/**
 * What every device face is handed, and what the chain picks one by.
 *
 * **A face owns its whole shell, title bar included.** That was the open
 * question in [device faces](../../../docs/device-faces.md) and this is the
 * answer: the chain could have wrapped a faceplate in a `Device` of its own,
 * but the preset chrome in a stock device's title bar belongs to the device and
 * not to the strip it happens to be sitting in. So the chain renders a face
 * where it has one and its own shell where it doesn't, and a face renders
 * `Device` itself.
 *
 * Which means every face repeats the shell props below. That repetition is the
 * price of the title bar being the face's, and it is four props.
 */
export interface DeviceFaceProps {
  /** The shell facts: name, `is_active`, `is_collapsed`, and a rack's chains. */
  device: OpenFlow.ChainDevice;
  /**
   * Its controls, or null when nothing has read them.
   *
   * Null is the ordinary state of a folded device — a face is only asked to
   * draw its body when it is open, but it is mounted either way, so it must
   * hold together with nothing behind it.
   */
  parameters: OpenFlow.DeviceParameterState[] | null;
  /** Move one control, by its index in `parameters`. */
  onParam(p: number, value: number): void;
  /** `Device.is_active`. */
  onToggle(on: boolean): void;
  /** `Device.View.is_collapsed` — which is also what starts and stops the watch. */
  onFold(folded: boolean): void;
}

export type DeviceFace = (props: DeviceFaceProps) => ReactElement;
