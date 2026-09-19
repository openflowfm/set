import { useMemo, useState } from 'react';
import './BulkWorkflow.css';
import './RecolorModal.css';
import { hex } from '@openflow/core/color.ts';
import { songKey, type Derivation } from '@openflow/core/derive.ts';
import { songFacts } from '@openflow/core/songRows.ts';
import {
  planSongColors,
  type ColorRule,
  type SongColorInput,
} from '@openflow/core/colorRules.ts';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.ts';
import { SwatchGrid } from './SwatchGrid.tsx';
import { ControlButton, ControlGroup } from './Control.tsx';

interface Props {
  derivation: Derivation;
  snapshot: OpenFlow.Snapshot;
  palette: number[];
  /** What each song states, for the rule to key on — see useColorRules. */
  songs: SongColorInput[];
  /** Palette slots the rule may hand out, ascending. */
  allowed: number[];
  /** `null` puts it back to "whatever the palette holds". */
  onAllowed: (next: number[] | null) => void;
  busy: boolean;
  onApply: (colors: ReadonlyMap<string, number>) => void;
  onClose: () => void;
}

const RULES: Array<{ rule: ColorRule; label: string; says: string }> = [
  {
    rule: 'key',
    label: 'by key',
    says: 'Songs in the same key share a color, so the bands say what will mix into what.',
  },
  {
    rule: 'bpm',
    label: 'by bpm',
    says: 'The palette walks with the tempo, slowest first, so the bands say where the set changes gear.',
  },
  {
    rule: 'rainbow',
    label: 'rainbow',
    says: 'Every song the next allowed color, in set order, wrapping when they run out.',
  },
  {
    rule: 'random',
    label: 'random',
    says: 'Dealt from a shuffled bag, so every allowed color is used before any repeats and no two songs in a row match.',
  },
];

/** A song's color as the set holds it: a slot, -1 for none, or `mixed`. */
function currentColor(observed: readonly number[]): number | 'mixed' {
  if (observed.length > 1) return 'mixed';
  return observed[0] ?? -1;
}

function Swatch({ index, palette }: { index: number | 'mixed'; palette: number[] }) {
  if (index === 'mixed') {
    return <span className="sw small clash" title="This song's scenes hold more than one color" />;
  }
  const rgb = index >= 0 ? palette[index] : undefined;
  return (
    <span
      className={`sw small${rgb === undefined ? ' empty' : ''}`}
      style={rgb === undefined ? undefined : { background: hex(rgb) }}
      title={rgb === undefined ? 'No color' : `index ${index}`}
    />
  );
}

/**
 * Coloring every song in the set from a rule.
 *
 * **A song is one color** and a set is a hundred of them, so which color a song
 * gets is only worth deciding across the whole set at once: by key it says what
 * mixes into what, by bpm it says where the set changes gear. Picking them one
 * swatch at a time — which the rail does, and does well for one song — can't
 * produce either.
 *
 * Everything here is a preview until Apply. It's an undoable write, unlike the
 * reorder next to it, but a hundred songs changing color at once is still worth
 * seeing first — and the count on the button is the honest one, since a song
 * already carrying its color writes nothing.
 */
export function RecolorModal({
  derivation,
  snapshot,
  palette,
  songs,
  allowed,
  onAllowed,
  busy,
  onApply,
  onClose,
}: Props) {
  useCloseOnEscape(onClose);

  const [rule, setRule] = useState<ColorRule>('key');
  /** Re-rolling `random` is a different seed, not a different function. */
  const [seed, setSeed] = useState(1);

  const plan = useMemo(
    () => planSongColors(songs, rule, allowed, seed),
    [songs, rule, allowed, seed],
  );

  const allowedSet = useMemo(() => new Set(allowed), [allowed]);

  /**
   * What Apply would actually write. Scenes, not songs — a song already
   * carrying its color writes nothing, and a count that included it would be a
   * lie about how much work is about to happen.
   */
  const counts = useMemo(() => {
    let scenes = 0;
    let songsChanged = 0;
    for (const song of derivation.songs) {
      const index = plan.colors.get(songKey(song.name));
      if (index === undefined) continue;
      const n = song.scenes.filter((s) => snapshot.scenes[s]?.colorIndex !== index).length;
      scenes += n;
      if (n > 0) songsChanged++;
    }
    return { scenes, songsChanged };
  }, [derivation, plan, snapshot]);

  // Ascending, so `rainbow` walks Live's own picker order — its grid is roughly
  // a hue sweep, which is what makes that rule look like one.
  const toggleColor = (index: number) => {
    onAllowed(
      allowedSet.has(index)
        ? allowed.filter((i) => i !== index)
        : [...allowed, index].sort((a, b) => a - b),
    );
  };

  const said = RULES.find((r) => r.rule === rule)?.says ?? '';
  // Two different reasons a song can be left alone, and they want different
  // words: the rule needs a fact this song doesn't state, or there's no color
  // to give anybody. The second only happens before the first snapshot.
  const missing = rule === 'bpm' ? 'bpm' : 'key';
  const why =
    allowed.length === 0
      ? 'no color is allowed yet'
      : `the set states no ${missing} for it`;

  return (
    <div className="viewport-overlay modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Recolor songs — {derivation.songs.length}</div>

        <ControlGroup className="choices" label="Coloring rule" appearance="bare">
          {RULES.map((r) => (
            <ControlButton
              key={r.rule}
              pressed={r.rule === rule}
              title={r.says}
              onClick={() => setRule(r.rule)}
            >
              {r.label}
            </ControlButton>
          ))}
          {rule === 'random' && (
            <ControlButton title="Deal again" onClick={() => setSeed((s) => s + 1)}>
              roll again
            </ControlButton>
          )}
        </ControlGroup>
        <div className="hint">{said}</div>

        {/* Which of Live's 70 this set's rules may hand out. Eight chosen colors read
            better across a set than seventy: several of Live's are hard to tell
            apart at the size a scene row draws them, and two bands you can't
            tell apart aren't doing the job the color is there for. */}
        <div className="lbl">
          Allowed colors — {allowed.length} of {palette.length}
          <ControlButton
            type="button"
            className="link"
            title="Let a rule use the whole palette"
            onClick={() => onAllowed(null)}
          >
            all
          </ControlButton>
          <ControlButton
            type="button"
            className="link"
            title="Start from nothing and pick the few you want"
            onClick={() => onAllowed([])}
          >
            none
          </ControlButton>
        </div>
        {palette.length === 0 ? (
          <div className="hint">Built-in palette unavailable — rebuild the app.</div>
        ) : (
          <SwatchGrid
            palette={palette}
            current={null}
            chosen={allowedSet}
            onPick={toggleColor}
            titleFor={(i) => `index ${i} — click to ${allowedSet.has(i) ? 'exclude' : 'allow'}`}
          />
        )}

        <div className="color-rows">
            {derivation.songs.map((song) => {
              const key = songKey(song.name);
              const next = plan.colors.get(key);
              const facts = songFacts(song);
              const now = currentColor(song.observed.colorIndex);
              return (
                <div key={key} className={`color-row${next === undefined ? ' skipped' : ''}`}>
                  <Swatch index={now} palette={palette} />
                  <span className="arrow">→</span>
                  {/* Nothing at all where the new color would be, rather than an
                      empty swatch: "no color" is a color this could write, and
                      this song isn't being written to. */}
                  {next === undefined ? (
                    <span className="sw small unchanged" title="Left as it is" />
                  ) : (
                    <Swatch index={next} palette={palette} />
                  )}
                  <span className="facts">
                    <span className={`bpm${facts.bpm === '' ? ' none' : ''}`}>
                      {facts.bpm || '---'}
                    </span>
                    <span className={`key${facts.key === '' ? ' none' : ''}`}>
                      {facts.key || '--'}
                    </span>
                  </span>
                  <span className="song">{song.name}</span>
                  <span className="count">
                    {song.scenes.length} scene{song.scenes.length === 1 ? '' : 's'}
                  </span>
                  {next === undefined && <span className="caption">left alone — {why}</span>}
                </div>
              );
            })}
        </div>

        {/* The legend is what makes a grouping rule checkable at a glance: three
            colors for three keys, and which is which. Rainbow and random have
            one group per song, so the list above already is the legend. */}
        {plan.legend.length > 0 && (
          <div className="legend">
            {plan.legend.map((g) => (
              <span key={g.label} className="legend-item" title={`${g.songs} songs`}>
                <Swatch index={g.colorIndex} palette={palette} />
                {g.label}
              </span>
            ))}
          </div>
        )}

        {plan.skipped.length > 0 && allowed.length > 0 && (
          <div className="hint">
            {plan.skipped.length} song{plan.skipped.length === 1 ? '' : 's'} left alone:
            the set never states a {missing} for{' '}
            {plan.skipped.length === 1 ? 'it' : 'them'}, or its scenes disagree about
            one. Coloring by a fact nobody wrote down is how a color stops meaning
            anything.
          </div>
        )}

        <div className="modal-actions">
          <div className="hint">
            {counts.scenes === 0
              ? 'every song already carries its color'
              : `${counts.scenes} scene${counts.scenes === 1 ? '' : 's'} across ` +
                `${counts.songsChanged} song${counts.songsChanged === 1 ? '' : 's'}`}
          </div>
          <div className="spacer" />
          <ControlButton onClick={onClose}>
            Cancel
          </ControlButton>
          <ControlButton
            intent="primary"
            disabled={busy || counts.scenes === 0}
            onClick={() => onApply(plan.colors)}
          >
            Recolor
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
