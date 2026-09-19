/**
 * Which of the EQ Eight's parameters is which.
 *
 * A face draws band 4's frequency knob in a fixed place; Live hands over a flat
 * list of controls. Something has to join the two, and the only join available
 * is the parameter's **name** — there is no id, and its position in the list is
 * a fact about one Live version rather than about the device.
 *
 * **Matched loosely, on purpose.** Live's own names have not been read off a
 * real device in this project — see the unverified note in
 * [device faces](../../../../docs/device-faces.md) — and an exact table would
 * turn one renamed control into forty dead ones. So a band's controls are found
 * by band number plus a keyword, and a slot that matches nothing comes back
 * null and is drawn plainly dead rather than dropped. Every assumption this
 * file makes is therefore visible on the face itself.
 *
 * **The A channel wins.** In L/R and M/S modes an EQ Eight has two sets of
 * bands, `… A` and `… B`, and this takes whichever comes first — which is A, in
 * Live's ordering. Drawing B needs `Eq8Device.edit_mode`, a device *property*
 * rather than a parameter, and nothing on the wire carries one yet.
 */

/** Where one band's five controls sit in the device's parameter list. */
export interface Eq8Band {
  on: number | null;
  frequency: number | null;
  gain: number | null;
  q: number | null;
  filterType: number | null;
}

export interface Eq8Binding {
  /** Always eight, however few of them matched. */
  bands: Eq8Band[];
  scale: number | null;
  output: number | null;
  adaptiveQ: number | null;
}

export const EQ8_BANDS = 8;

/**
 * Ordered by how specific each pattern is, because they are claimed in turn and
 * a claimed parameter is out of the running. `frequency` before `q` is the one
 * that matters: `\bq\b` is narrow enough not to reach inside "Frequency", but
 * ordering it after costs nothing and survives a pattern being loosened later.
 */
const BAND_SLOTS: ReadonlyArray<readonly [keyof Eq8Band, RegExp]> = [
  ['filterType', /filter\s*type|\btype\b/],
  ['on', /filter\s*on|\bon\b/],
  ['frequency', /\bfreq/],
  ['gain', /\bgain\b/],
  ['q', /\bresonance\b|\bq\b/],
];

const WHOLE_SLOTS: ReadonlyArray<readonly [keyof Omit<Eq8Binding, 'bands'>, RegExp]> = [
  ['scale', /\bscale\b/],
  ['output', /\boutput\b/],
  ['adaptiveQ', /\badaptive\b/],
];

/** `1 Frequency A` and `Band 1 Frequency` both name band one. */
function bandOf(name: string): number | null {
  const leading = /^\s*(\d+)\b/.exec(name);
  if (leading) return Number(leading[1]);
  const labelled = /\bband\s*(\d+)\b/.exec(name);
  return labelled ? Number(labelled[1]) : null;
}

function emptyBand(): Eq8Band {
  return { on: null, frequency: null, gain: null, q: null, filterType: null };
}

export function bindEq8(
  parameters: readonly OpenFlow.DeviceParameterState[] | null,
): Eq8Binding {
  const bands: Eq8Band[] = [];
  for (let i = 0; i < EQ8_BANDS; i++) bands.push(emptyBand());
  const binding: Eq8Binding = { bands, scale: null, output: null, adaptiveQ: null };
  if (!parameters) return binding;

  // Bucketed by band first, so a keyword can only ever claim within its own
  // band — otherwise band 2's gain is a candidate for band 1's gain slot the
  // moment band 1 doesn't have one.
  const perBand: number[][] = bands.map(() => []);
  const whole: number[] = [];
  parameters.forEach((parameter, index) => {
    const name = parameter.name.toLowerCase();
    const band = bandOf(name);
    if (band !== null && band >= 1 && band <= EQ8_BANDS) perBand[band - 1].push(index);
    else whole.push(index);
  });

  for (let b = 0; b < EQ8_BANDS; b++) {
    const available = perBand[b].slice();
    for (const [slot, pattern] of BAND_SLOTS) {
      const at = available.findIndex((index) =>
        pattern.test(parameters[index].name.toLowerCase()),
      );
      if (at === -1) continue;
      bands[b][slot] = available[at];
      available.splice(at, 1);
    }
  }

  const available = whole.slice();
  for (const [slot, pattern] of WHOLE_SLOTS) {
    const at = available.findIndex((index) =>
      pattern.test(parameters[index].name.toLowerCase()),
    );
    if (at === -1) continue;
    binding[slot] = available[at];
    available.splice(at, 1);
  }

  return binding;
}
