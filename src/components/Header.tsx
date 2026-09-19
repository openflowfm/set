import { Pointing } from '@openflow/widgets/controls/Pointing.tsx';
import { useEffect, useRef, useState } from 'react';
import type { BridgeState } from '../hooks/useBridge.ts';
import './Header.css';
import { ControlButton, ControlField, ControlGroup, ControlSelect } from './Control.tsx';
import {
  IconIndex,
  IconMetronome,
  IconNote,
  IconMenu,
  IconPlay,
  IconRecord,
  IconStop,
  IconSync,
  IconScale,
  IconSettings,
} from './Icon.tsx';

interface Props {
  lomReady: boolean;
  busy: boolean;
  isPlaying: boolean;
  songPosition: BridgeState['songPosition'];
  transport: OpenFlow.TransportState | null;
  onTransport: (patch: OpenFlow.TransportPatch) => void;
  showIndex: boolean;
  onToggleIndex: () => void;
  songCount: number;
  collapsedCount: number;
  onCollapseAll: (all: boolean) => void;
  launch: BridgeState['launch'];
  stop: BridgeState['stop'];
  onSetConfig: () => void;
  onSnapshot: () => void;
}

const QUANTIZATION = [
  'None',
  '8 Bars',
  '4 Bars',
  '2 Bars',
  '1 Bar',
  '1/2',
  '1/2T',
  '1/4',
  '1/4T',
  '1/8',
  '1/8T',
  '1/16',
  '1/16T',
  '1/32',
] as const;

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/* Live 12.4.3's own Song.scale_name docstring list. Keep the observed value as
   an extra option below: a newer Live can add a scale without making the
   current setting disappear from this control. */
const SCALE_NAMES = [
  'Major',
  'Minor',
  'Dorian',
  'Mixolydian',
  'Lydian',
  'Phrygian',
  'Locrian',
  'Whole Tone',
  'Half-whole Dim.',
  'Whole-half Dim.',
  'Minor Blues',
  'Minor Pentatonic',
  'Major Pentatonic',
  'Harmonic Minor',
  'Harmonic Major',
  'Dorian #4',
  'Phrygian Dominant',
  'Melodic Minor',
  'Lydian Augmented',
  'Lydian Dominant',
  'Super Locrian',
  'Bhairav',
  'Hungarian Minor',
  '8-Tone Spanish',
  'Hirajoshi',
  'In-Sen',
  'Iwato',
  'Kumoi',
  'Pelog Selisir',
  'Pelog Tembung',
  'Messiaen 3',
  'Messiaen 4',
  'Messiaen 5',
  'Messiaen 6',
  'Messiaen 7',
] as const;

function tempoText(tempo: number | undefined): string {
  if (tempo === undefined) return '';
  return tempo.toFixed(2);
}

function TempoControl({
  tempo,
  disabled,
  onCommit,
}: {
  tempo: number | undefined;
  disabled: boolean;
  onCommit: (tempo: number) => void;
}) {
  const editing = useRef(false);
  const [draft, setDraft] = useState(() => tempoText(tempo));

  useEffect(() => {
    if (!editing.current) setDraft(tempoText(tempo));
  }, [tempo]);

  const reset = () => setDraft(tempoText(tempo));
  const commit = () => {
    editing.current = false;
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 20 || value > 999) {
      reset();
      return;
    }
    setDraft(tempoText(value));
    if (value !== tempo) onCommit(value);
  };

  return (
    <ControlField className="tempo-control" title="Live Set tempo — 20–999 BPM">
      <input
        type="number"
        min="20"
        max="999"
        step="0.01"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        aria-label="Live Set tempo in BPM"
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.preventDefault();
            reset();
          }
        }}
      />
      <span className="tempo-unit" aria-hidden="true">
        <IconNote />
      </span>
    </ControlField>
  );
}

/**
 * The header bar: the song display, Live's control bar, transport, set
 * configuration and Snapshot.
 *
 * How the *track columns* are drawn is not here — see `TrackViewControls`,
 * which sits in the grid's own footer beside the rows it shows and hides.
 *
 * Every icon button here carries an `aria-label` as well as a `title`. An
 * icon-only control with no accessible name is a button that exists for
 * sighted mouse users and nobody else — and the `title` is also the only place
 * the longer ones (what Snapshot re-reads) can still be said in words. The
 * quantization, root and scale pickers are the exception: a native
 * single-select is both more compact and already has the right keyboard
 * semantics.
 */
export function Header({
  lomReady,
  busy,
  isPlaying,
  songPosition,
  transport,
  onTransport,
  showIndex,
  onToggleIndex,
  songCount,
  collapsedCount,
  onCollapseAll,
  launch,
  stop,
  onSetConfig,
  onSnapshot,
}: Props) {
  const allFolded = songCount > 0 && collapsedCount >= songCount;
  const positionParts = songPosition
    ? [songPosition.bar, songPosition.beat, songPosition.sixteenth]
    : ['–', '–', '–'];
  const positionLabel = songPosition
    ? `Arrangement position: bar ${songPosition.bar}, beat ${songPosition.beat}, ` +
      `sixteenth ${songPosition.sixteenth}`
    : 'Arrangement position unavailable';

  return (
    <header>
      <div className="header-section header-left">
        <img className="brand-logo" src="/logo-white.png" alt="open[flow]" />
        <ControlGroup className="view-controls" label="Song display" surface="filled">
          <ControlButton
            icon
            pressed={showIndex}
            aria-controls="song-index"
            aria-label="Song index"
            title={`${showIndex ? 'Hide' : 'Show'} song index`}
            onClick={onToggleIndex}
          >
            <IconIndex />
          </ControlButton>
          <ControlButton
            icon
            pressed={allFolded}
            disabled={songCount === 0}
            aria-label={allFolded ? 'Unfold songs' : 'Fold songs'}
            title={
              allFolded ? 'Unfold every song' : 'Fold every song down to its header row'
            }
            onClick={() => onCollapseAll(collapsedCount < songCount)}
          >
            <IconMenu />
          </ControlButton>
        </ControlGroup>
        <ControlGroup className="live-controls" label="Live control bar" appearance="bare">
          <ControlGroup
            className="tempo-group"
            label="Tempo, metronome, and clip launch quantization"
            surface="filled"
          >
            <TempoControl
              tempo={transport?.tempo}
              disabled={!lomReady || transport === null}
              onCommit={(tempo) => onTransport({ tempo })}
            />
            <ControlButton
              icon
              pressed={transport?.metronome ?? false}
              aria-label="Metronome"
              title={`${transport?.metronome ? 'Disable' : 'Enable'} Live's metronome`}
              disabled={!lomReady || transport === null}
              onClick={() => onTransport({ metronome: !transport?.metronome })}
            >
              <IconMetronome />
            </ControlButton>
            <ControlSelect
              containerClassName="quantization-picker"
              value={transport?.clipTriggerQuantization ?? ''}
              disabled={!lomReady || transport === null}
              aria-label="Global clip launch quantization"
              title="Live's global clip launch quantization"
              onChange={(e) =>
                onTransport({ clipTriggerQuantization: Number(e.currentTarget.value) })
              }
            >
              {transport === null && <option value="">–</option>}
              {QUANTIZATION.map((label, value) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </ControlSelect>
          </ControlGroup>
          <ControlGroup className="scale-group" label="Current scale" surface="filled">
            <ControlButton
              icon
              pressed={transport?.scaleMode ?? false}
              aria-label="Scale mode"
              title="Toggle Scale Mode for Live's current or selected clips"
              disabled={!lomReady || transport === null}
              onClick={() => onTransport({ scaleMode: !transport?.scaleMode })}
            >
              <IconScale />
            </ControlButton>
            <ControlSelect
              containerClassName="root-picker"
              value={transport?.rootNote ?? ''}
              disabled={!lomReady || transport === null}
              aria-label="Current scale root note"
              title="Root note for Live's current or selected clips"
              onChange={(e) => onTransport({ rootNote: Number(e.currentTarget.value) })}
            >
              {transport === null && <option value="">–</option>}
              {ROOT_NOTES.map((note, value) => (
                <option key={note} value={value}>
                  {note}
                </option>
              ))}
            </ControlSelect>
            <ControlSelect
              containerClassName="scale-picker"
              value={transport?.scaleName ?? ''}
              disabled={!lomReady || transport === null}
              aria-label="Current scale name"
              title={
                transport?.scaleName
                  ? `${transport.scaleName} — Live's current or selected clips`
                  : 'Scale name for Live\'s current or selected clips'
              }
              onChange={(e) => onTransport({ scaleName: e.currentTarget.value })}
            >
              {(transport === null || transport.scaleName === '') && <option value="">–</option>}
              {transport?.scaleName &&
                !SCALE_NAMES.includes(transport.scaleName as (typeof SCALE_NAMES)[number]) && (
                  <option value={transport.scaleName}>{transport.scaleName}</option>
                )}
              {SCALE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </ControlSelect>
          </ControlGroup>
        </ControlGroup>
      </div>

      <div className="header-section header-center">
        <div className="transport">
          <div className="arrangement-position" role="timer" aria-label={positionLabel}>
            <span aria-hidden="true">
              {positionParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="position-separator">.</span>}
                  <span className="position-field">{part}</span>
                </span>
              ))}
            </span>
          </div>
          <ControlGroup className="playback" label="Transport" surface="filled">
            <ControlButton
              icon
              className={isPlaying ? 'rolling' : undefined}
              title="Start the song (Space)"
              aria-label="Start the song"
              disabled={!lomReady}
              onClick={() => launch({ kind: 'song' })}
            >
              <IconPlay />
            </ControlButton>
            <ControlButton
              icon
              title="Stop the song (Space)"
              aria-label="Stop the song"
              disabled={!lomReady}
              onClick={() => stop({ kind: 'song' })}
            >
              <IconStop />
            </ControlButton>
            <ControlButton
              icon
              pressed={transport?.recordMode ?? false}
              aria-label="Arrangement Record"
              title={`${transport?.recordMode ? 'Disarm' : 'Arm'} Live's Arrangement Record`}
              disabled={!lomReady || transport === null}
              onClick={() => onTransport({ recordMode: !transport?.recordMode })}
            >
              <IconRecord />
            </ControlButton>
          </ControlGroup>
        </div>
      </div>

      <div className="header-section header-right">
        <Pointing />
        <ControlButton
          icon
          aria-label="Set configuration"
          title="Set configuration — naming defaults and roles"
          onClick={onSetConfig}
          disabled={busy}
        >
          <IconSettings />
        </ControlButton>
        <ControlButton
          icon
          intent="primary"
          aria-label="Snapshot"
          title="Snapshot — re-walk the set"
          onClick={onSnapshot}
          disabled={!lomReady || busy}
        >
          <IconSync />
        </ControlButton>
      </div>
    </header>
  );
}
