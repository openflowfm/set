import type { Derivation, DerivedSong } from '@openflow/core/derive.ts';
import './SongsModal.css';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.ts';
import { ControlButton } from './Control.tsx';

interface Props {
  derivation: Derivation;
  pattern: string;
  /** Select every scene in a song and close. */
  onPick: (scenes: number[]) => void;
  /** Select the scenes the pattern couldn't read. */
  onPickUnmapped: () => void;
  /** How many songs are folded in the grid right now. */
  collapsedCount: number;
  onCollapseAll: (all: boolean) => void;
  onClose: () => void;
}

/** One value, or the disagreement — never one of several presented as the answer. */
function Observed({ values }: { values: readonly (string | number)[] }) {
  if (values.length === 0) return <span className="caption">—</span>;
  if (values.length === 1) return <>{values[0]}</>;
  return (
    <span className="clash" title="The scenes of this song disagree">
      {values.join(' / ')}
    </span>
  );
}

function rowFlags(song: DerivedSong): string[] {
  const flags: string[] = [];
  // Legal — a song is a label, not a range — but worth surfacing, because the
  // other reason for two blocks is that two different songs share a name.
  if (song.blocks.length > 1) flags.push(`${song.blocks.length} blocks`);
  // A tempo anywhere but the first scene is a scene the set can't be mixed
  // into: firing it snaps the Live Set tempo. This is where you find them.
  const strays = song.tempoScenes.filter((s) => s !== song.scenes[0]).length;
  if (strays > 0) flags.push(`${strays} stray tempo${strays === 1 ? '' : 's'}`);
  return flags;
}

/**
 * What the app made of the set, read back through the scene pattern.
 *
 * Read-only on purpose. This is the view that answers "does derivation work on
 * a real set" before anything is built on top of it, and it can't give a
 * misleading answer if it has nothing to write with.
 */
export function SongsModal({
  derivation,
  pattern,
  onPick,
  onPickUnmapped,
  collapsedCount,
  onCollapseAll,
  onClose,
}: Props) {
  useCloseOnEscape(onClose);

  const { songs, unmapped, scenes } = derivation;

  return (
    <div className="viewport-overlay modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          Songs — {songs.length} in {scenes.length} scenes
        </div>
        <div className="hint">
          Read back out of the scene names with{' '}
          <span className="preview">{pattern}</span>. Nothing here is stored; it is
          what the set says. Click a song to select its scenes.
        </div>

        {songs.length === 0 ? (
          <div className="hint">No scene name matched the pattern.</div>
        ) : (
          <div className="songs-wrap">
            <table className="songs">
              <thead>
                <tr>
                  <th>song</th>
                  <th>artist</th>
                  <th className="n">scenes</th>
                  <th>bpm</th>
                  <th>key</th>
                  <th>tag</th>
                  <th title="Scene.tempo on the song's first scene — what Live does when you enter the song at the top">
                    start tempo
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => (
                  <tr key={song.name} onClick={() => onPick(song.scenes)}>
                    <td className="song-name">{song.name}</td>
                    <td>
                      <Observed values={song.observed.artist} />
                    </td>
                    <td className="n">{song.scenes.length}</td>
                    <td>
                      <Observed values={song.observed.bpm} />
                    </td>
                    <td>
                      <Observed values={song.observed.key} />
                    </td>
                    <td>
                      <Observed values={song.observed.tag} />
                    </td>
                    {/* What Live will actually do, which is not the same fact
                        as the bpm the names state — that one is the record and
                        this one is the projection of it. A song with none
                        simply keeps whatever tempo is already running. */}
                    <td>
                      {song.firstSceneTempo === null ? (
                        <span className="caption">—</span>
                      ) : (
                        song.firstSceneTempo
                      )}
                    </td>
                    <td className="flags">
                      {rowFlags(song).map((f) => (
                        <span key={f} className="flag">
                          {f}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          {/* Folding everything is how a 100-song set becomes navigable, so it
              belongs next to the list rather than buried in the grid. */}
          <ControlButton
            type="button"
            disabled={songs.length === 0}
            onClick={() => onCollapseAll(collapsedCount < songs.length)}
          >
            {collapsedCount < songs.length ? 'Collapse all' : 'Expand all'}
          </ControlButton>
          {unmapped.length > 0 ? (
            <ControlButton onClick={onPickUnmapped}>
              Select {unmapped.length} unmapped scene{unmapped.length === 1 ? '' : 's'}
            </ControlButton>
          ) : (
            <div className="hint">Every scene matched.</div>
          )}
          <div className="spacer" />
          <ControlButton intent="primary" onClick={onClose}>
            Close
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
