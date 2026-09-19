import { useMemo, useState, type FormEvent } from 'react';
import type { Derivation } from '@openflow/core/derive.ts';
import {
  NEW_SONG_SCENES,
  newSongProblems,
  planNewSong,
  type NewSongDraft,
  type NewSongField,
} from '@openflow/core/newSong.ts';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.ts';
import { ColorSelect } from './ColorSelect.tsx';
import { ControlButton, ControlSelect } from './Control.tsx';
import './NewSongModal.css';

interface Props {
  derivation: Derivation;
  sceneCount: number;
  palette: number[];
  defaultArtist: string;
  busy: boolean;
  onAdd: (addition: OpenFlow.SceneAddition) => void;
  onClose: () => void;
}

/** A gap between existing rows, described in terms of the song above it. */
interface Placement {
  at: number;
  label: string;
}

function placementsFor(derivation: Derivation, sceneCount: number): Placement[] {
  if (sceneCount === 0) return [{ at: 0, label: 'Empty set' }];
  const out: Placement[] = [{ at: 0, label: 'Beginning of set' }];
  const blocks = derivation.songs
    .flatMap((song) =>
      song.blocks.map((block, i) => ({
        song: song.name,
        block,
        part: i + 1,
        parts: song.blocks.length,
      })),
    )
    .sort((a, b) => a.block.to - b.block.to);
  const seen = new Set<number>([0, sceneCount]);
  for (const { song, block, part, parts } of blocks) {
    const at = block.to + 1;
    if (seen.has(at)) continue;
    seen.add(at);
    out.push({
      at,
      label: `After ${song}${parts > 1 ? ` — part ${part}` : ''}`,
    });
  }
  out.push({ at: sceneCount, label: 'End of set' });
  return out;
}

/** Quick scaffold: eight empty scenes carrying one new song's shared facts. */
export function NewSongModal({
  derivation,
  sceneCount,
  palette,
  defaultArtist,
  busy,
  onAdd,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<NewSongDraft>({
    at: sceneCount,
    name: '',
    artist: defaultArtist,
    key: '',
    bpm: '',
    colorIndex: null,
  });
  useCloseOnEscape(onClose);

  const placements = useMemo(
    () => placementsFor(derivation, sceneCount),
    [derivation, sceneCount],
  );
  const existing = useMemo(() => derivation.songs.map((song) => song.name), [derivation]);
  const problems = newSongProblems(draft, sceneCount, palette, existing);
  const bad = new Set<NewSongField>(problems.map((problem) => problem.field));
  const edit = (patch: Partial<NewSongDraft>) => setDraft((before) => ({ ...before, ...patch }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const addition = planNewSong(draft, sceneCount, palette, existing);
    if (addition) onAdd(addition);
  };

  return (
    <div className="viewport-overlay modal-back" onClick={onClose}>
      <form
        className="modal new-song-modal"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-h">New song — {NEW_SONG_SCENES} scenes</div>
        <div className="hint">
          Inserts eight empty scenes with one shared name. Artist, key, BPM and color are
          optional; roles can be assigned to the individual scenes afterwards.
        </div>

        <label className={`new-song-field${bad.has('name') ? ' bad' : ''}`}>
          <span>Name</span>
          <input
            autoFocus
            type="text"
            value={draft.name}
            placeholder="Nightfall"
            spellCheck={false}
            onChange={(e) => edit({ name: e.target.value })}
          />
        </label>

        <label className={`new-song-field${bad.has('artist') ? ' bad' : ''}`}>
          <span>Artist</span>
          <input
            type="text"
            value={draft.artist}
            placeholder="The Aviators"
            spellCheck={false}
            onChange={(e) => edit({ artist: e.target.value })}
          />
        </label>

        <div className="new-song-facts">
          <label className={`new-song-field${bad.has('key') ? ' bad' : ''}`}>
            <span>Key</span>
            <input
              type="text"
              value={draft.key}
              placeholder="Bm"
              spellCheck={false}
              onChange={(e) => edit({ key: e.target.value })}
            />
          </label>
          <label className={`new-song-field${bad.has('bpm') ? ' bad' : ''}`}>
            <span>BPM</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.bpm}
              placeholder="128"
              spellCheck={false}
              onChange={(e) => edit({ bpm: e.target.value })}
            />
          </label>
          <div className={`new-song-field new-song-color${bad.has('color') ? ' bad' : ''}`}>
            <span>Color</span>
            <ColorSelect
              palette={palette}
              current={draft.colorIndex}
              label="Song color"
              showLabel={false}
              onPick={(colorIndex) => edit({ colorIndex })}
              onClear={() => edit({ colorIndex: null })}
            />
          </div>
        </div>

        <label className={`new-song-field${bad.has('at') ? ' bad' : ''}`}>
          <span>Insert</span>
          <ControlSelect
            appearance="native"
            value={draft.at}
            onChange={(e) => edit({ at: Number(e.target.value) })}
          >
            {placements.map((placement) => (
              <option key={placement.at} value={placement.at}>
                {placement.label}
              </option>
            ))}
          </ControlSelect>
        </label>

        {problems.length > 0 && draft.name.trim() !== '' && (
          <div className="hint bad">{problems[0]!.message}</div>
        )}

        <div className="modal-actions">
          <div className="spacer" />
          <ControlButton onClick={onClose}>
            Cancel
          </ControlButton>
          <ControlButton type="submit" intent="primary" disabled={busy || problems.length > 0}>
            Add {NEW_SONG_SCENES} scenes
          </ControlButton>
        </div>
      </form>
    </div>
  );
}
