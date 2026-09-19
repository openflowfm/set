import { useMemo, type ReactNode } from 'react';
import { Device } from '@openflow/widgets/chrome/Device.tsx';
import { Panel, PanelColumn } from '@openflow/widgets/chrome/Panel.tsx';
import { NumberField } from '@openflow/widgets/controls/NumberField.tsx';
import { Select } from '@openflow/widgets/controls/Select.tsx';
import { Toggle } from '@openflow/widgets/controls/Toggle.tsx';
import type { Param } from '@openflow/widgets/param/param.ts';
import type { DeviceFaceProps } from '../face.ts';
import {
  ParamKnob,
  ParamNumber,
  ParamSelect,
  ParamSwitch,
  type ParamBinding,
} from '../ParamControl.tsx';
import { bindEq8 } from './bind.ts';
import './Eq8.css';

/** The analyzer's own settings, which have no range Live will tell us about. */
const REFRESH: Param = {
  kind: 'float', min: 1, max: 60, defaultValue: 60, shortName: 'Refresh',
};
const AVERAGE: Param = {
  kind: 'float', min: 0, max: 10, defaultValue: 1, shortName: 'Avg',
};

const BLOCK_SIZES = ['1024', '2048', '4096', '8192', '16384'];
const CHANNEL_MODES = ['Stereo', 'L/R', 'M/S'];

/**
 * Why four controls on this face are dead, and what would revive them.
 *
 * Live's analyzer settings — Analyze, Block, Refresh, Avg — are a property of
 * its own display and appear nowhere in the LOM, not as parameters and not as
 * device properties. There is nothing to bind them to and nothing they could
 * drive, since this face draws no spectrum.
 */
const ANALYZER_NOTE = 'Live does not expose its analyzer settings to the LOM';

/**
 * And why three more are.
 *
 * Mode, Edit and oversample are `Eq8Device` *properties* rather than
 * parameters, so they will never appear in `ChainDevice.parameters` however
 * well the name matching works. They are all `get, set, observe` — see
 * `bridge/LOM.md` — so this is a gap in what the wire carries, not in Live.
 */
const PROPERTY_NOTE = 'A device property, which the chain does not carry yet';

const NOOP = () => {};

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button type="button" className="eq8-icon" aria-label={label}>
      {children}
    </button>
  );
}

function DownIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 2v6M3.5 5.8 6 8.3l2.5-2.5M3 10h6" />
    </svg>
  );
}

/** Whether a two-state parameter is up. Unmatched reads as on, not as off. */
function switchedOn(state: OpenFlow.DeviceParameterState | null): boolean {
  if (!state) return true;
  return state.value >= (state.min + state.max) / 2;
}

/**
 * Live's EQ Eight, drawn out of [`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md)
 * and composed here rather than there.
 *
 * The parts are the library's, because a knob is a knob wherever it's mounted.
 * The arrangement of them is this device and no other: eight lanes on a shared
 * row grid, the analyzer's controls on one plate and the output's on another,
 * and a title bar carrying the preset chrome only a stock face has. Adding an
 * `Eq8` to `widgets/` would be exporting one particular device from a module
 * whose whole claim is that it knows about none of them — so it is a component
 * of this app, using the same boundary the device chain already crosses.
 *
 * **`Eq8` and not `EQEight`, deliberately.** Live names a device three ways and
 * this is the one a program uses: `class_name` is `Eq8`, `class_display_name`
 * is `EQ Eight`, and `name` is whatever the user retyped in the title bar. The
 * chain publishes the first as `ChainDevice.className`, which is what the face
 * registry keys on; the title bar below shows the third, because that is the
 * one a person reads.
 *
 * **It reads Live now, and where it can't, it shows that.** Every band control
 * is bound through [`bindEq8`](./bind.ts) and moves Live when moved. Seven are
 * not bound and are drawn dead rather than local: four analyzer settings that
 * the LOM does not expose at all, and three `Eq8Device` properties that it does
 * but this protocol doesn't carry. A control that silently did nothing when
 * dragged would be the worse of the two.
 */
export function Eq8({ device, parameters, onParam, onToggle, onFold }: DeviceFaceProps) {
  const binding = useMemo(() => bindEq8(parameters), [parameters]);

  // Rebuilt per render rather than memoised: a binding closes over `onParam`
  // and an index, both of which are cheap, and forty memo entries to save forty
  // object literals is the kind of caching that costs more than it saves.
  const slot = (index: number | null): ParamBinding => ({
    state: index === null ? null : parameters?.[index] ?? null,
    onChange: (value) => {
      if (index !== null) onParam(index, value);
    },
  });

  return (
    <Device
      name={device.name}
      className="eq8-device"
      on={device.on}
      onToggle={onToggle}
      folded={device.folded}
      onFold={onFold}
      headerStart={<IconButton label="Load preset"><DownIcon /></IconButton>}
      headerAfterName={<span className="eq8-status" aria-label="Control surface focus">◆</span>}
      headerEnd={
        <>
          <IconButton label="Hot-swap"><span className="eq8-swap">↗</span></IconButton>
          <IconButton label="Save preset"><span className="eq8-save" /></IconButton>
          <IconButton label="More options"><span className="eq8-more">•••</span></IconButton>
        </>
      }
    >
      <Panel rows={3} gap={2} className="eq8-panel">
        <PanelColumn className="eq8-side eq8-left">
          <div className="eq8-side-content">
            <Toggle on onChange={NOOP} disabled name="Analyze" title={ANALYZER_NOTE}>
              On
            </Toggle>
            <Select
              items={BLOCK_SIZES}
              index={3}
              onChange={NOOP}
              disabled
              name="Block"
              title={ANALYZER_NOTE}
            />
            <NumberField
              param={REFRESH}
              value={60}
              onChange={NOOP}
              disabled
              display="60.00"
              title={ANALYZER_NOTE}
            />
            <NumberField
              param={AVERAGE}
              value={1}
              onChange={NOOP}
              disabled
              display="1.00"
              title={ANALYZER_NOTE}
            />
          </div>
        </PanelColumn>

        {binding.bands.map((band, index) => {
          const on = switchedOn(slot(band.on).state);
          return (
            <PanelColumn
              key={index}
              className={`eq8-band${on ? ' eq8-band-on' : ''}`}
            >
              <ParamKnob
                binding={slot(band.frequency)}
                name="Freq"
                label={`Band ${index + 1} frequency`}
                disabled={!on}
              />
              <ParamKnob
                binding={slot(band.gain)}
                name="Gain"
                label={`Band ${index + 1} gain`}
                disabled={!on}
              />
              <div className="eq8-band-bottom">
                <ParamNumber
                  binding={slot(band.q)}
                  name="Q"
                  label={`Band ${index + 1} Q`}
                  disabled={!on}
                />
                <ParamSelect
                  binding={slot(band.filterType)}
                  label={`Band ${index + 1} filter type`}
                  disabled={!on}
                />
                <div className="eq8-band-switch">
                  <ParamSwitch binding={slot(band.on)} label={`Band ${index + 1}`} />
                  <span>{index + 1}</span>
                </div>
              </div>
            </PanelColumn>
          );
        })}

        <PanelColumn className="eq8-side eq8-right">
          <div className="eq8-side-content">
            <div className="eq8-side-section">
              <div className="eq8-view-buttons">
                <IconButton label="Headphone audition"><span>◉</span></IconButton>
                <IconButton label="Spectrum view"><span className="eq8-bars">▥</span></IconButton>
              </div>
              <Select
                items={CHANNEL_MODES}
                index={0}
                onChange={NOOP}
                disabled
                name="Mode"
                title={PROPERTY_NOTE}
              />
            </div>
            <div className="eq8-side-section">
              <Toggle on onChange={NOOP} disabled name="Edit" title={PROPERTY_NOTE}>
                L
              </Toggle>
              <ParamSwitch binding={slot(binding.adaptiveQ)} name="Adapt. Q">
                {switchedOn(slot(binding.adaptiveQ).state) ? 'On' : 'Off'}
              </ParamSwitch>
            </div>
            <div className="eq8-side-section">
              <ParamNumber binding={slot(binding.scale)} name="Scale" />
              <ParamNumber binding={slot(binding.output)} name="Output" />
            </div>
          </div>
        </PanelColumn>
      </Panel>
    </Device>
  );
}
