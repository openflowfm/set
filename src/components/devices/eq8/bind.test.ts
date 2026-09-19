import { describe, expect, it } from 'vitest';
import { bindEq8, EQ8_BANDS } from './bind.ts';

const param = (name: string): OpenFlow.DeviceParameterState => ({
  name,
  value: 0,
  min: 0,
  max: 1,
  quantized: false,
  display: '0',
  state: 0,
});

const named = (...names: string[]) => names.map(param);

/**
 * What Live is *expected* to call these — not what it has been observed to.
 * Nothing in this project has read an EQ Eight's parameter list off a running
 * device, so these tests pin the matcher's behaviour rather than Live's naming:
 * they say "given names of this shape, the join lands here", which is the part
 * that can be wrong in a way a test can catch.
 */
function liveNames(): string[] {
  const names = ['Device On'];
  for (const channel of ['A', 'B']) {
    for (let band = 1; band <= EQ8_BANDS; band++) {
      names.push(
        `${band} Filter On ${channel}`,
        `${band} Frequency ${channel}`,
        `${band} Gain ${channel}`,
        `${band} Resonance ${channel}`,
        `${band} Filter Type ${channel}`,
      );
    }
  }
  names.push('Scale', 'Output Gain', 'Adaptive Q');
  return names;
}

describe('bindEq8', () => {
  it('always answers with eight bands', () => {
    expect(bindEq8(null).bands).toHaveLength(EQ8_BANDS);
    expect(bindEq8([]).bands).toHaveLength(EQ8_BANDS);
  });

  it('leaves every slot null when there are no parameters', () => {
    const binding = bindEq8(null);
    expect(binding.bands[0]).toEqual({
      on: null,
      frequency: null,
      gain: null,
      q: null,
      filterType: null,
    });
    expect(binding.scale).toBeNull();
    expect(binding.output).toBeNull();
    expect(binding.adaptiveQ).toBeNull();
  });

  it('joins the whole of a plausible Live parameter list', () => {
    const names = liveNames();
    const binding = bindEq8(named(...names));

    for (let band = 0; band < EQ8_BANDS; band++) {
      const slots = binding.bands[band];
      expect(names[slots.on!]).toBe(`${band + 1} Filter On A`);
      expect(names[slots.frequency!]).toBe(`${band + 1} Frequency A`);
      expect(names[slots.gain!]).toBe(`${band + 1} Gain A`);
      expect(names[slots.q!]).toBe(`${band + 1} Resonance A`);
      expect(names[slots.filterType!]).toBe(`${band + 1} Filter Type A`);
    }
    expect(names[binding.scale!]).toBe('Scale');
    expect(names[binding.output!]).toBe('Output Gain');
    expect(names[binding.adaptiveQ!]).toBe('Adaptive Q');
  });

  it('takes the A channel, which is the one Live lists first', () => {
    const names = ['1 Gain B', '1 Gain A'];
    // Ordering is the list's, not a preference for the letter: whichever
    // arrives first claims the slot.
    expect(names[bindEq8(named(...names)).bands[0].gain!]).toBe('1 Gain B');
  });

  it('reads a band number written either way round', () => {
    const binding = bindEq8(named('Band 3 Frequency', '3 Gain'));
    expect(binding.bands[2].frequency).toBe(0);
    expect(binding.bands[2].gain).toBe(1);
  });

  it('does not let one band claim another band\'s control', () => {
    const binding = bindEq8(named('2 Gain A'));
    expect(binding.bands[0].gain).toBeNull();
    expect(binding.bands[1].gain).toBe(0);
  });

  it('keeps Frequency out of the Q slot', () => {
    // `\bq\b` must not reach inside "Frequency", which contains a q.
    const binding = bindEq8(named('1 Frequency A'));
    expect(binding.bands[0].frequency).toBe(0);
    expect(binding.bands[0].q).toBeNull();
  });

  it('keeps Resonance out of the on slot', () => {
    // `\bon\b` must not reach inside "Resonance", which contains an on.
    const binding = bindEq8(named('1 Resonance A'));
    expect(binding.bands[0].q).toBe(0);
    expect(binding.bands[0].on).toBeNull();
  });

  it('does not confuse a band control with a device-wide one', () => {
    const binding = bindEq8(named('1 Gain A', 'Output Gain'));
    expect(binding.bands[0].gain).toBe(0);
    expect(binding.output).toBe(1);
  });

  it('claims each parameter once, so Filter Type does not take Filter On', () => {
    const binding = bindEq8(named('1 Filter On A', '1 Filter Type A'));
    expect(binding.bands[0].on).toBe(0);
    expect(binding.bands[0].filterType).toBe(1);
  });

  it('leaves a slot null rather than guessing when its control is absent', () => {
    const binding = bindEq8(named('1 Frequency A', '1 Gain A'));
    expect(binding.bands[0].frequency).toBe(0);
    expect(binding.bands[0].gain).toBe(1);
    expect(binding.bands[0].on).toBeNull();
    expect(binding.bands[0].q).toBeNull();
    expect(binding.bands[0].filterType).toBeNull();
  });

  it('ignores a band number outside the eight', () => {
    expect(() => bindEq8(named('9 Gain A', '0 Gain A'))).not.toThrow();
    const binding = bindEq8(named('9 Gain A'));
    for (const band of binding.bands) expect(band.gain).toBeNull();
  });

  it('matches whatever case the names arrive in', () => {
    const binding = bindEq8(named('1 FREQUENCY A', 'scale'));
    expect(binding.bands[0].frequency).toBe(0);
    expect(binding.scale).toBe(1);
  });
});
