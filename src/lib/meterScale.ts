export const METER_MIN_DB = -60;
export const METER_MAX_DB = 6;
export const METER_DB_TICKS = [
  0, -6, -12, -18, -24, -30, -36, -42, -48, -54,
] as const;

/**
 * Where 0 dB sits on the rail, as a fraction of its height.
 *
 * Live puts unity at `0.85` of its volume parameter's range, and the volume
 * indicator is drawn at that parameter's own fraction — so unity is 85% up the
 * rail whatever this file believes. A single straight run from -60 to +6 dB
 * puts its 0 dB rule at 60/66 instead, and the pointer missed the line it was
 * pointing at by about 6% of the meter's height.
 *
 * This is the fallback. `TrackMeter` passes the fraction Live actually reports
 * for the strip's own `default_value`, which is what keeps the rule and the
 * pointer at the same height by construction rather than by two constants
 * agreeing.
 */
export const METER_UNITY_FRACTION = 0.85;

/** Unity comes from Live at runtime, and both runs collapse at 0 or 1. */
function hinge(unity: number): number {
  if (!Number.isFinite(unity)) return METER_UNITY_FRACTION;
  return Math.max(0.01, Math.min(0.99, unity));
}

/**
 * Live reports the normalized position of its own logarithmic meter scale.
 *
 * Two straight runs rather than one, hinged at unity: the rail keeps its -60 dB
 * floor and +6 dB ceiling while 0 dB lands where Live puts it. One run can hold
 * any two of those three and never all three — anchoring 0 dB on a single run
 * that ends at +6 would lift the floor to -34 dB and throw away the quiet half
 * of the meter.
 */
export function meterDecibels(
  level: number,
  unity: number = METER_UNITY_FRACTION,
): number {
  const at = hinge(unity);
  const fraction = Math.max(0, Math.min(1, level));
  return fraction <= at
    ? METER_MIN_DB - (fraction / at) * METER_MIN_DB
    : ((fraction - at) / (1 - at)) * METER_MAX_DB;
}

export function meterFraction(
  db: number,
  unity: number = METER_UNITY_FRACTION,
): number {
  const at = hinge(unity);
  if (!Number.isFinite(db)) return 0;
  if (db <= METER_MIN_DB) return 0;
  if (db >= METER_MAX_DB) return 1;
  return db <= 0
    ? at * ((db - METER_MIN_DB) / -METER_MIN_DB)
    : at + (1 - at) * (db / METER_MAX_DB);
}

export function mixerParameterFraction(
  parameter: OpenFlow.MixerParameterState | null,
  value: number,
): number {
  if (!parameter) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (value - parameter.min) /
        Math.max(parameter.max - parameter.min, Number.EPSILON),
    ),
  );
}

/** Whole decibels for the mixer's narrow fields: `-12.75 dB` reads `-12`.
 *
 * Live sends two decimals, which is six characters — wider than the 26px box
 * the control column fixes these fields at, so the digits used to spill over
 * the meter beside them. A tenth of a decibel is not a reading anyone takes
 * off a strip at a glance anyway; the exact value stays one hover away in the
 * field's `title`. Trimming rather than rounding keeps this a string operation,
 * so a readout can never disagree with the number Live itself is showing.
 *
 * The fractional part is dropped wherever it appears rather than at the end of
 * the string, since pan reads `50L` and would otherwise keep its decimals.
 */
export function compactParameterDisplay(display: string | undefined): string {
  if (!display) return '—';
  return display
    .replace(/\s*dB$/i, '')
    .replace(/^-inf(?:inity)?$/i, '−∞')
    .replace(/(-?\d+)\.\d+/, '$1')
    .replace(/^-0$/, '0');
}

export function peakDisplay(
  level: number,
  unity: number = METER_UNITY_FRACTION,
): string {
  if (level <= 0) return '−∞';
  // `Math.trunc` to match `compactParameterDisplay`, so peak and volume never
  // read a decibel apart on the same signal. `String(-0)` is already `'0'`.
  return String(Math.trunc(meterDecibels(level, unity)));
}
