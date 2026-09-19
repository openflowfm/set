import type { CSSProperties } from 'react';
import type { BridgeState } from '../../hooks/useBridge.ts';
import { useMixerStrip, type MixerStore } from '../../hooks/useMixer.ts';
import { compactParameterDisplay } from '../../lib/meterScale.ts';
import { liveParam } from '../../lib/liveParam.ts';
import { useParamGesture } from '@openflow/widgets/gesture/useParamGesture.ts';
import {
  readbackTolerance,
  usePendingValue,
} from '@openflow/widgets/gesture/usePendingValue.ts';

function sendName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function SendControl({
  parameter,
  index,
  trackLabel,
  onChange,
}: {
  parameter: OpenFlow.MixerParameterState | null;
  index: number;
  trackLabel: string;
  onChange: (index: number, value: number) => void;
}) {
  const name = sendName(index);
  const param = liveParam(parameter, { min: 0, max: 1 });
  const held = usePendingValue(parameter?.value ?? null, {
    tolerance: readbackTolerance(param.min, param.max),
  });
  const gesture = useParamGesture({
    param,
    value: held.value ?? 0,
    disabled: !parameter?.enabled,
    axis: 'horizontal',
    label: `${trackLabel} send ${name}`,
    display: parameter?.display,
    onChange: (next) => {
      held.push(next);
      onChange(index, next);
    },
  });

  return (
    <div
      className={`mixer-send${parameter?.enabled ? '' : ' disabled'}`}
      title={`${trackLabel} send ${name} · ${parameter?.display || 'unavailable'} · double-click to reset`}
    >
      <span className="mixer-send-label" aria-hidden="true">{name}</span>
      <span
        className="mixer-send-value"
        style={{ '--send-position': `${gesture.fraction * 100}%` } as CSSProperties}
      >
        <span className="send-fader" {...gesture.props} />
        <output aria-label={`${trackLabel} send ${name} value`}>
          {compactParameterDisplay(parameter?.display)}
        </output>
      </span>
    </div>
  );
}

/** One track column in the naturally sized sends section above the resizable mixer. */
export function TrackSends({
  trackIndex,
  label,
  mixer,
  setMixer,
}: {
  trackIndex: number;
  label: string;
  mixer: MixerStore;
  setMixer: BridgeState['setMixer'];
}) {
  const strip = useMixerStrip(mixer, trackIndex);
  const track = strip?.kind === 'track' ? strip : null;

  return (
    <td className="sends-cell">
      <div className="mixer-sends">
        {Array.from({ length: track?.sends.length ?? 0 }, (_, index) => (
          <SendControl
            key={index}
            parameter={track?.sends[index] ?? null}
            index={index}
            trackLabel={label}
            // Each control already limits itself to one write per frame, and
            // only one of them can be under the pointer, so the column no
            // longer needs a coalescing pass of its own.
            onChange={(at, value) =>
              setMixer({ kind: 'track', t: trackIndex }, { send: { index: at, value } })
            }
          />
        ))}
      </div>
    </td>
  );
}
