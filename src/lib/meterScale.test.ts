import { describe, expect, it } from 'vitest';
import {
  METER_MAX_DB,
  METER_MIN_DB,
  METER_UNITY_FRACTION,
  compactParameterDisplay,
  meterDecibels,
  meterFraction,
  peakDisplay,
} from './meterScale.ts';

describe('Live meter scale', () => {
  it('uses Live normalized values as positions instead of amplitudes', () => {
    expect(meterDecibels(0)).toBe(-60);
    expect(meterDecibels(1)).toBe(6);
  });

  it('clamps values to the visible rail', () => {
    expect(meterDecibels(-1)).toBe(-60);
    expect(meterDecibels(2)).toBe(6);
    expect(meterFraction(-90)).toBe(0);
    expect(meterFraction(12)).toBe(1);
  });

  // The bug this scale exists to fix: the volume indicator is drawn at Live's
  // own parameter fraction, so the rail's 0 dB rule has to land there too.
  it('puts 0 dB where Live puts unity', () => {
    expect(meterFraction(0)).toBe(METER_UNITY_FRACTION);
    expect(meterDecibels(METER_UNITY_FRACTION)).toBe(0);
  });

  it('hinges at unity instead of running straight through it', () => {
    // A straight -60…+6 run would have put 0 dB at 60/66 — the ~6% of rail
    // height the pointer was missing the line by.
    expect(meterFraction(0)).not.toBeCloseTo(60 / 66, 3);
    // Both ends survive the hinge.
    expect(meterFraction(METER_MIN_DB)).toBe(0);
    expect(meterFraction(METER_MAX_DB)).toBe(1);
  });

  it('takes unity from the caller so a strip can use what Live reported', () => {
    expect(meterFraction(0, 0.8)).toBeCloseTo(0.8, 10);
    expect(meterDecibels(0.8, 0.8)).toBe(0);
    // Degenerate values collapse a run, so they are hinged back into range.
    expect(Number.isFinite(meterDecibels(1, 1))).toBe(true);
    expect(Number.isFinite(meterDecibels(0.5, 0))).toBe(true);
  });

  // Every meter mark is placed from one of these two and read back by the
  // other, so a drift between them would misplace the peak line.
  it('round-trips a position through decibels and back', () => {
    for (const level of [0, 0.13, 0.5, METER_UNITY_FRACTION, 0.93, 1]) {
      expect(meterFraction(meterDecibels(level))).toBeCloseTo(level, 10);
    }
  });
});

describe('compact mixer parameter display', () => {
  it('matches the narrow Live-style fields', () => {
    expect(compactParameterDisplay('-3.80 dB')).toBe('-3');
    expect(compactParameterDisplay('-inf dB')).toBe('−∞');
    expect(compactParameterDisplay('C')).toBe('C');
  });

  it('trims the fraction rather than rounding it', () => {
    expect(compactParameterDisplay('-12.75 dB')).toBe('-12');
    expect(compactParameterDisplay('0.00 dB')).toBe('0');
    expect(compactParameterDisplay('6.00 dB')).toBe('6');
  });

  // Truncating toward zero would otherwise put a stray minus on a value that
  // rounds to unity, and `-0` is not a level.
  it('never shows negative zero', () => {
    expect(compactParameterDisplay('-0.75 dB')).toBe('0');
  });

  // The suffix is why the fraction is dropped mid-string: an end-anchored trim
  // would leave pan reading `12.5L`.
  it('keeps the pan suffix', () => {
    expect(compactParameterDisplay('50L')).toBe('50L');
    expect(compactParameterDisplay('12.5R')).toBe('12R');
  });

  // Nothing to the right of the point survives, so peak and volume agree.
  it('reads peak in whole decibels', () => {
    expect(peakDisplay(0)).toBe('−∞');
    expect(peakDisplay(1)).toBe('6');
    expect(peakDisplay(METER_UNITY_FRACTION)).toBe('0');
    // -12.75 dB on the rail: trimmed toward zero, never to -13.
    expect(peakDisplay(meterFraction(-12.75))).toBe('-12');
  });
});
