import type { DeviceFace } from './face.ts';
import { Eq8 } from './eq8/Eq8.tsx';

/**
 * Which devices the app has drawn a face for.
 *
 * Keyed on `Device.class_name`, which the chain publishes as
 * `ChainDevice.className` — never on `name`, which is whatever the user typed
 * in the title bar, and never on `class_display_name`, which is `EQ Eight` and
 * is for reading rather than matching. That is why the folder, the file, the
 * export and the key here are all the same string: a registry entry should be
 * one word repeated, with nothing in it to get wrong.
 *
 * Everything absent from this table gets [`Faceplate`](./Faceplate.tsx), which
 * draws whatever controls the device reports in whatever order it reports them.
 * That is not a degraded mode — it is the honest one, and it is what nearly
 * every device in a set will use.
 */
const FACES: Readonly<Record<string, DeviceFace>> = {
  Eq8,
};

export function faceFor(className: string): DeviceFace | undefined {
  return FACES[className];
}
