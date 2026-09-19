import { hex } from '@openflow/core/color.ts';
import './ScenePanel.css';
import { MIN_TEMPO } from '@openflow/core/derive.ts';
import { roleKey, type Role } from '@openflow/core/roles.ts';
import {
  isBpm,
  isKey,
  isTag,
  splitsAsArtist,
  type TitlePatch,
} from '@openflow/core/sceneTitle.ts';
import { SUGGESTED_SONG_TAGS } from '@openflow/core/songTags.ts';
import { ColorSelect } from './ColorSelect.tsx';
import { ControlButton, ControlSelect } from './Control.tsx';

interface Props {
  /** Configured roles plus any tagged in the set — see mergeVocabulary. */
  vocabulary: Role[];
  palette: number[];
  /** Set-wide seed; offered explicitly when this selection names someone else. */
  defaultArtist: string;
  /** How many scenes the scene-name column has selected. */
  sceneCount: number;
  /**
   * What the selected scenes agree on, per field; `null` where they differ.
   * The title fields prefill from this.
   */
  common: {
    song: string | null;
    artist: string | null;
    tag: string | null;
    bpm: string | null;
    key: string | null;
  };
  /**
   * Which title fields have been edited.
   *
   * A field that's absent here is left alone on every scene; a field present
   * and empty clears that part. The distinction can't come from the value
   * alone — blank means "these scenes disagree, don't flatten them" on arrival
   * and "delete this part" once you've deleted it — so it's tracked, in `App`,
   * and reset whenever the selection changes.
   */
  patch: TitlePatch;
  onPatch: (patch: TitlePatch) => void;
  /** Scenes the pending title edit would actually rename. */
  titleCount: number;
  /** The first selected scene's name after the pending edit. */
  titlePreview: string | null;
  onRenameScenes: () => void;
  /** Songs the selection touches — the unit the tempo projection works in. */
  songCount: number;
  /**
   * True when the bpm field has been *emptied*, so the button clears rather
   * than applies. Not the same as the field looking blank: blank because the
   * selection disagrees still applies, each song using its own bpm.
   */
  clearingTempo: boolean;
  /** Scenes the tempo projection would write: one per song, plus its strays. */
  tempoCount: number;
  /**
   * The set has asked for a rename to project the bpm too — so the hint must
   * stop promising that naming changes nothing about playback.
   */
  writeSceneTempo: boolean;
  onApplySongTempo: () => void;
  /**
   * Palette slot the songs in the selection already share, or -1 when they
   * don't — which includes a song that's only half painted.
   */
  songColorIndex: number;
  /** Scenes a swatch would write: every scene of every song in the selection. */
  songColorCount: number;
  /** Those songs in words — "NIGHTFALL", "3 songs" — for saying so first. */
  songColorLabel: string;
  onSongColor: (index: number) => void;
  /** The role all selected scenes share, or null when they have none. */
  currentRole: string | null;
  /** True when the selection spans more than one role. */
  mixed: boolean;
  busy: boolean;
  onAssign: (role: string | null) => void;
  /** Opens the set configuration panel, which `App` owns. */
  onManageRoles: () => void;
}

/**
 * Everything that acts on the scenes picked in the scene-name column: the
 * name — `@{bpm}-{key} {SONG} {TAG}` — the song's start tempo, and the role tag
 * that leads it.
 *
 * The two commit differently, on purpose. **Assigning a role writes on click,
 * the way a swatch does**, which only looks like it breaks the Inspector's rule
 * that naming needs an explicit commit: that rule exists because a rename
 * *overwrites* a name you can no longer see, and a role tag is additive — it
 * goes on the front, the rest of the name is untouched, and it shows as a chip
 * the moment it lands. There is nothing to preview. **A title edit does
 * overwrite**, so it keeps its preview and a button.
 */
export function ScenePanel({
  vocabulary,
  palette,
  defaultArtist,
  sceneCount,
  common,
  patch,
  onPatch,
  titleCount,
  titlePreview,
  onRenameScenes,
  songCount,
  clearingTempo,
  tempoCount,
  writeSceneTempo,
  onApplySongTempo,
  songColorIndex,
  songColorCount,
  songColorLabel,
  onSongColor,
  currentRole,
  mixed,
  busy,
  onAssign,
  onManageRoles,
}: Props) {
  const none = sceneCount === 0;
  const currentKey = currentRole === null ? null : roleKey(currentRole);
  const selectedRole = vocabulary.find((r) => roleKey(r.name) === currentKey);
  const selectedRoleSwatch =
    selectedRole && selectedRole.colorIndex >= 0
      ? palette[selectedRole.colorIndex]
      : undefined;

  const shown = (f: keyof TitlePatch) => patch[f] ?? common[f] ?? '';
  const badTag = shown('tag').trim() !== '' && !isTag(shown('tag'));
  // Live's own lower bound as well as the name's shape. A `@19` name parses,
  // but Live refuses that tempo — so the projection would silently *clear*
  // where the button says apply. Rejected here, where it can still be fixed.
  const badBpm =
    shown('bpm').trim() !== '' &&
    (!isBpm(shown('bpm')) || Number(shown('bpm').trim()) < MIN_TEMPO);
  const badKey = shown('key').trim() !== '' && !isKey(shown('key'));
  // A song carrying the artist separator is read back as a song *and* an
  // artist, so writing it would name one thing and map another. Blocked here
  // because this is the last point where someone can still split it themselves.
  const badSong = splitsAsArtist(shown('song'));

  const field = (
    key: keyof TitlePatch,
    label: string,
    placeholder: string,
    bad = false,
    transform: (value: string) => string = (value) => value,
  ) => (
    <label className={`field${bad ? ' bad' : ''}`}>
      <span>{label}</span>
      <input
        type="text"
        value={shown(key)}
        placeholder={common[key] === null && sceneCount > 1 ? 'mixed' : placeholder}
        disabled={none || busy}
        spellCheck={false}
        list={key === 'tag' ? 'song-tags' : undefined}
        onChange={(e) => onPatch({ ...patch, [key]: transform(e.target.value) })}
      />
    </label>
  );

  return (
    <>
      <div className="lbl facet-title">
        <span>Song</span>
        <span className="facet-summary">
          {none
            ? 'click a scene name'
            : `${sceneCount} scene${sceneCount === 1 ? '' : 's'} selected`}
        </span>
      </div>

      <div className="song-field-row">
        {field('song', 'song', 'Nightfall', badSong)}
        <div className="field song-color-field">
          <span>color</span>
          <ColorSelect
            palette={palette}
            current={songColorIndex}
            disabled={none || busy}
            label="Song color"
            showLabel={false}
            titleFor={(i) =>
              none
                ? `index ${i}`
                : `index ${i} — paints all ${songColorCount} scene` +
                  `${songColorCount === 1 ? '' : 's'} of ${songColorLabel}`
            }
            onPick={onSongColor}
          />
        </div>
      </div>
      {/* Its own row rather than beside the song: an artist name is as long as
          a song name, and the two are written into the name as one run. */}
      <div className="artist-field-row">
        {field('artist', 'artist', 'The Aviators')}
        {defaultArtist.trim() !== '' && (
          <ControlButton
            type="button"
            disabled={
              none ||
              busy ||
              shown('artist').trim().toUpperCase() === defaultArtist.trim().toUpperCase()
            }
            title={`Use this Live Set's default artist: ${defaultArtist.trim()}`}
            onClick={() => onPatch({ ...patch, artist: defaultArtist.trim() })}
          >
            Use default
          </ControlButton>
        )}
      </div>
      <div className="field-row">
        {field('tag', 'tag', 'COVER', badTag, (value) => value.toUpperCase())}
        {field('bpm', 'bpm', '128', badBpm)}
        {field('key', 'key', 'Bm', badKey)}
      </div>
      <datalist id="song-tags">
        {SUGGESTED_SONG_TAGS.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <div className="hint">
        {badSong ? (
          <span className="bad">
            " - " is the artist separator — put that half in the artist field
          </span>
        ) : badTag || badBpm || badKey ? (
          <span className="bad">
            {badTag ? "tag uses letters, numbers, spaces, &, ' or -" : ''}
            {badTag && (badBpm || badKey) ? ' · ' : ''}
            {badBpm ? `bpm is ${MIN_TEMPO}–999` : ''}
            {badBpm && badKey ? ' · ' : ''}
            {badKey ? 'key is like Bm, F#m, Eb' : ''}
          </span>
        ) : none ? (
          'Shift-click a second scene name to take a whole song.'
        ) : (
          <>
            Song, artist, tag, bpm and key rename scenes — the name is the record.{' '}
            {writeSceneTempo ? (
              <>
                This set also projects the bpm on rename, so <b>Rename</b> moves each
                song&rsquo;s start tempo too.
              </>
            ) : (
              'Writing a bpm changes nothing about playback.'
            )}{' '}
            Color paints all {songColorCount} scene{songColorCount === 1 ? '' : 's'} of{' '}
            {songColorLabel}.
          </>
        )}
      </div>
      {titlePreview !== null && (
        <div className="hint">
          Preview <span className="preview">{titlePreview || '(empty)'}</span>
        </div>
      )}
      {/* Not `primary`, unlike the role color below it: this one overwrites
          names, and the loud button in the rail should be the reversible,
          instantly-legible action rather than the destructive one. */}
      <ControlButton
        type="button"
        disabled={titleCount === 0 || busy || badSong || badTag || badBpm || badKey}
        onClick={onRenameScenes}
      >
        Rename {titleCount} scene{titleCount === 1 ? '' : 's'}
      </ControlButton>

      {/* Separate from the rename on purpose. Everything else in this panel
          changes what a scene is *called*; this changes what the set *does* —
          Live uses a scene's own tempo the moment that scene fires. Folding it
          into Rename would make a naming pass quietly alter playback.

          Song start, not "these scenes": the tempo goes on the song's first
          scene alone, so entering the song at the top sets it and mixing into
          the middle doesn't. The same press clears the tempo off the rest of
          the song, which is how a set written the every-scene way converts. */}
      <ControlButton
        type="button"
        disabled={tempoCount === 0 || busy || badBpm}
        title={
          clearingTempo
            ? 'Clears the song\u2019s scene tempos, so it follows the Live Set tempo again'
            : 'Writes Scene.tempo on each song\u2019s first scene and clears it off the ' +
              'rest, so entering the song sets the tempo and mixing into it does not'
        }
        onClick={onApplySongTempo}
      >
        {clearingTempo
          ? `Clear tempo on ${tempoCount} scene${tempoCount === 1 ? '' : 's'}`
          : songCount > 1
            ? `Apply tempo to ${songCount} song starts`
            : 'Apply tempo to song start'}
      </ControlButton>

      <div className="lbl">Role</div>

      <div className="role-select-row">
        {vocabulary.length === 0 ? (
          <ControlSelect appearance="native" disabled aria-label="Role">
            <option>No roles yet</option>
          </ControlSelect>
        ) : (
          <div className="role-select-control">
            <span
              className={`color-dot${selectedRoleSwatch === undefined ? ' empty' : ''}`}
              style={
                selectedRoleSwatch === undefined
                  ? undefined
                  : { background: hex(selectedRoleSwatch) }
              }
            />
            <ControlSelect
              appearance="native"
              aria-label="Role"
              value={
                mixed
                  ? 'mixed'
                  : currentRole === null
                    ? 'none'
                    : String(vocabulary.findIndex((r) => roleKey(r.name) === currentKey))
              }
              disabled={none || busy}
              onChange={(e) => {
                if (e.target.value === 'none') onAssign(null);
                else if (e.target.value !== 'mixed') {
                  const role = vocabulary[Number(e.target.value)];
                  if (role) onAssign(role.name);
                }
              }}
            >
              {mixed && (
                <option value="mixed" disabled>
                  Mixed roles
                </option>
              )}
              <option value="none">No role</option>
              {vocabulary.map((r, i) => (
                <option key={roleKey(r.name)} value={i}>
                  {r.name}
                </option>
              ))}
            </ControlSelect>
          </div>
        )}
        <ControlButton className="manage-roles" disabled={busy} onClick={onManageRoles}>
          Manage…
        </ControlButton>
      </div>

      <div className="hint">
        {none
          ? 'Roles are stored in the scene name as [role], so they travel with the set.'
          : mixed
            ? 'These scenes have different roles — pick one to set them all.'
            : 'Choosing a role writes it into the scene name straight away.'}
      </div>
    </>
  );
}
