import { useEffect, useState, type CSSProperties } from 'react';
import {
  useOutputMeter,
  type MeterKey,
  type MeterStore,
} from '../../hooks/useMeters.ts';
import { useMixerStrip, type MixerStore } from '../../hooks/useMixer.ts';
import type { BridgeState } from '../../hooks/useBridge.ts';
import {
  METER_DB_TICKS,
  METER_MAX_DB,
  METER_MIN_DB,
  METER_UNITY_FRACTION,
  compactParameterDisplay,
  meterDecibels,
  meterFraction,
  mixerParameterFraction,
  peakDisplay,
} from '../../lib/meterScale.ts';
import { liveParam } from '../../lib/liveParam.ts';
import { useParamGesture } from '@openflow/widgets/gesture/useParamGesture.ts';
import {
  readbackTolerance,
  usePendingValue,
} from '@openflow/widgets/gesture/usePendingValue.ts';
import { ControlButton, ControlGroup } from '../Control.tsx';

interface Props {
  meterKey: MeterKey;
  label: string;
  meters: MeterStore;
  mixer: MixerStore;
  setMixer: BridgeState['setMixer'];
  hideTrackControls?: boolean;
  isGroup?: boolean;
}

/** A column-owned Live mixer strip, mounted only while that output is visible. */
export function TrackMeter({
  meterKey,
  label,
  meters,
  mixer,
  setMixer,
  hideTrackControls = false,
  isGroup = false,
}: Props) {
  const level = useOutputMeter(meters, meterKey);
  const strip = useMixerStrip(mixer, meterKey);
  const volume = strip?.volume ?? null;
  const pan = strip?.pan ?? null;
  const target: OpenFlow.MixerTarget =
    meterKey === 'master' ? { kind: 'master' } : { kind: 'track', t: meterKey };
  // Where 0 dB sits on this strip's rail. Live reports unity as the volume
  // parameter's default, and the indicator is positioned by that same
  // parameter's fraction, so taking the rail's hinge from here is what puts the
  // pointer on the 0 dB rule instead of a few percent under it.
  const unity = volume
    ? mixerParameterFraction(volume, volume.defaultValue)
    : METER_UNITY_FRACTION;
  const db = meterDecibels(level, unity);
  // `level` already is the meter's displayed 0–1 position. Treating it as
  // amplitude and applying log10 again made ordinary signals look full-scale.
  const fraction = Math.max(0, Math.min(1, level));
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    if (level > peak) setPeak(level);
  }, [level, peak]);

  // Volume and pan are two ordinary parameters dragged the ordinary way. The
  // grab, the fine modifier, double-click-to-default, the one-write-per-frame
  // limit and the arrow keys all come from `widgets/`; what stays here is
  // Live's own display text and where the strip draws things.
  const volumeParam = liveParam(volume, { min: 0, max: 1 });
  const panParam = liveParam(pan, { min: -1, max: 1 });
  const heldVolume = usePendingValue(volume?.value ?? null, {
    tolerance: readbackTolerance(volumeParam.min, volumeParam.max),
  });
  const heldPan = usePendingValue(pan?.value ?? null, {
    tolerance: readbackTolerance(panParam.min, panParam.max),
  });

  // No `onRelease`. Dropping the local value the instant a drag ends would snap
  // the control back to whatever Live last echoed and then forward again when
  // the write lands — a visible bounce on every release. The readback match
  // clears it, and the deadline covers a write that never arrives.
  const volumeGesture = useParamGesture({
    param: volumeParam,
    value: heldVolume.value ?? 0,
    disabled: !volume?.enabled,
    axis: 'vertical',
    label: `${label} volume`,
    display: volume?.display,
    onChange: (next) => {
      heldVolume.push(next);
      setMixer(target, { volume: next });
    },
  });

  const panGesture = useParamGesture({
    param: panParam,
    value: heldPan.value ?? 0,
    disabled: !pan?.enabled,
    axis: 'horizontal',
    label: `${label} pan`,
    display: pan?.display,
    onChange: (next) => {
      heldPan.push(next);
      setMixer(target, { pan: next });
    },
  });

  const track = strip?.kind === 'track' ? strip : null;
  const isMaster = meterKey === 'master';
  return (
    <td className={`meter-cell${isMaster ? ' master-cell' : ''}`}>
      <div className={`mixer-strip${isMaster ? ' master' : ''}`}>
        {/* Tracks and Master share this entire fader subtree. The outer strip
            owns only Master-specific presentation. */}
        <div className="mixer-fader">
          <div className="mixer-meter-control">
            <div
              className="volume-fader"
              title={`${label} volume · ${volume?.display || 'unavailable'}`}
              {...volumeGesture.props}
            />
            <span
              className={`volume-indicator${volume?.enabled ? '' : ' disabled'}`}
              style={{ bottom: `${volumeGesture.fraction * 100}%` }}
              aria-hidden="true"
            />
            <div className="vertical-meter">
              <div
                className="meter-well"
                role="meter"
                aria-label={`${label} output level`}
                aria-valuemin={METER_MIN_DB}
                aria-valuemax={METER_MAX_DB}
                aria-valuenow={Math.round(db)}
                aria-valuetext={level <= 0 ? 'silence' : `${db.toFixed(1)} decibels`}
                // The fill's warning zones are the rail's own scale, not a
                // second copy of it: green up to unity, red from +3 dB.
                style={
                  {
                    '--meter-unity': `${unity * 100}%`,
                    '--meter-hot': `${meterFraction(3, unity) * 100}%`,
                  } as CSSProperties
                }
              >
                <span className="meter-level" style={{ transform: `scaleY(${fraction})` }} />
                <span
                  className={`meter-peak${peak > 0 ? ' visible' : ''}`}
                  style={{ bottom: `${peak * 100}%` }}
                  aria-hidden="true"
                />
                <span className="meter-rules" aria-hidden="true">
                  {METER_DB_TICKS.map((tick) => (
                    <span
                      key={tick}
                      className={`meter-rule${tick === 0 ? ' zero' : ''}`}
                      style={{ bottom: `${meterFraction(tick, unity) * 100}%` }}
                    />
                  ))}
                </span>
              </div>
            </div>
            <div className="mixer-readouts">
              <button
                type="button"
                className="meter-peak-readout"
                title={`Reset ${label} peak level`}
                aria-label={`Peak ${peakDisplay(peak, unity)} decibels. Reset ${label} peak level`}
                onClick={() => setPeak(level)}
              >
                {peakDisplay(peak, unity)}
              </button>
              <output className="mixer-volume-readout" aria-label={`${label} volume value`}>
                {compactParameterDisplay(volume?.display)}
              </output>
            </div>
          </div>

          <div
            className={`mixer-pan${pan?.enabled ? '' : ' disabled'}`}
            title={`${label} pan · ${pan?.display || 'unavailable'} · double-click to center`}
          >
            <div className="pan-fader" {...panGesture.props} />
            <span
              aria-hidden="true"
              style={{ '--pan-position': `${panGesture.fraction * 100}%` } as CSSProperties}
            >
              {compactParameterDisplay(pan?.display)}
            </span>
          </div>

          <ControlGroup
            className={`mixer-controls${hideTrackControls ? ' mixer-controls-hidden' : ''}`}
            label={`${label} mixer controls`}
            appearance="bare"
            aria-hidden={hideTrackControls || undefined}
          >
            <ControlButton
              pressed={track?.active ?? false}
              className="mixer-button mixer-activator"
              title={`${track?.active ? 'Disable' : 'Enable'} ${label}`}
              disabled={!track}
              onClick={() => track && setMixer(target, { active: !track.active })}
            >
              {typeof meterKey === 'number' ? meterKey + 1 : ''}
            </ControlButton>
            <ControlButton
              pressed={track?.solo ?? false}
              className="mixer-button mixer-solo"
              title={`${track?.solo ? 'Unsolo' : 'Solo'} ${label}`}
              disabled={!track}
              onClick={() => track && setMixer(target, { solo: !track.solo })}
            >
              S
            </ControlButton>
            <ControlButton
              pressed={track?.armed ?? false}
              className={`mixer-button mixer-arm${isGroup ? ' group-hidden' : ''}`}
              aria-label={`${track?.armed ? 'Disarm' : 'Arm'} ${label}`}
              title={
                track?.canArm
                  ? `${track.armed ? 'Disarm' : 'Arm'} ${label}`
                  : `${label} cannot be armed`
              }
              disabled={!track?.canArm}
              onClick={() => track && setMixer(target, { armed: !track.armed })}
            >
              <span aria-hidden="true" />
            </ControlButton>
          </ControlGroup>
        </div>
      </div>
    </td>
  );
}
