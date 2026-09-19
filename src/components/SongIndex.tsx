import { useMemo, useState, type CSSProperties } from 'react';
import { hex, legibleOn } from '@openflow/core/color.ts';
import type { Derivation } from '@openflow/core/derive.ts';
import { songFacts } from '@openflow/core/songRows.ts';
import {
  columnTemplate,
  INDEX_FACTS,
  loadIndexColumns,
  paneWidth,
  saveIndexColumns,
  shownFacts,
  type IndexColumns,
  type IndexFact,
} from '../lib/songIndexColumns.ts';
import { BAND_CONTRAST, RAIL } from './ClipGrid/constants.ts';
import { ControlButton } from './Control.tsx';
import { IconColumns } from './Icon.tsx';
import './SongIndex.css';

interface Props {
  derivation: Derivation;
  /** Live's palette, used only to paint the derived canonical song color. */
  palette: number[];
  onJump: (scene: number) => void;
  onClose: () => void;
}

type SortField = 'name' | IndexFact;
type SortDirection = 'ascending' | 'descending';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface DisplaySong {
  name: string;
  artist: string;
  key: string;
  bpm: string;
  type: string;
  firstScene: number | undefined;
  setOrder: number;
  searchText: string;
  /** Contrast-adjusted canonical RGB, or undefined for none/mixed/unresolvable. */
  color: number | undefined;
}

/** The column heading, and what a toggle calls the same column. */
const FACT_LABEL: Record<IndexFact, string> = {
  artist: 'Artist',
  key: 'Key',
  bpm: 'BPM',
  type: 'Type',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function SortHeading({
  field,
  label,
  sort,
  onSort,
}: {
  field: SortField;
  label: string;
  sort: SortState | null;
  onSort: (field: SortField) => void;
}) {
  const active = sort?.field === field;
  const direction = active ? sort.direction : null;
  const next = direction === 'ascending' ? 'descending' : 'ascending';

  return (
    <ControlButton
      type="button"
      className={active ? 'active' : ''}
      pressed={active}
      aria-label={`Sort by ${label} ${next}`}
      title={`Sort by ${label} ${next}`}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      {direction && (
        <span className="sort-direction" aria-hidden="true">
          {direction === 'ascending' ? '↑' : '↓'}
        </span>
      )}
    </ControlButton>
  );
}

/**
 * A compact, read-only contents pane for moving around a large set.
 *
 * Songs appear once, in first-appearance order. A reprise is still the same
 * song, so its name jumps to the first block rather than inventing a second
 * identity here. The grid remains authoritative for folding and selection;
 * this pane does neither.
 */
export function SongIndex({ derivation, palette, onJump, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [columns, setColumns] = useState<IndexColumns>(loadIndexColumns);
  const [pickingColumns, setPickingColumns] = useState(false);
  const visibleFacts = shownFacts(columns);

  // This is the index's own read-only list. It is rebuilt from the app's
  // derivation, then everything below this line is display state local to the
  // pane — no sorting or filtering can reach the snapshot or Live.
  const displaySongs = useMemo<DisplaySong[]>(
    () =>
      derivation.songs.map((song, setOrder) => {
        const facts = songFacts(song);
        // Exactly the same canonical-color rule as a grid header: all scenes
        // must agree on one real palette slot. Mixed and uncolored songs stay
        // neutral rather than letting the first scene speak for all of them.
        const colorIndex =
          song.observed.colorIndex.length === 1 ? song.observed.colorIndex[0] : undefined;
        const rgb = colorIndex === undefined || colorIndex < 0 ? undefined : palette[colorIndex];
        const values = {
          name: song.name,
          artist: facts.artist,
          key: facts.key,
          bpm: facts.bpm,
          type: facts.tag,
        };
        return {
          ...values,
          firstScene: song.scenes[0],
          setOrder,
          searchText: Object.values(values).join(' ').toLocaleLowerCase(),
          color: rgb === undefined ? undefined : legibleOn(rgb, RAIL, BAND_CONTRAST),
        };
      }),
    [derivation, palette],
  );

  const shownSongs = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const shown =
      terms.length === 0
        ? [...displaySongs]
        : displaySongs.filter((song) =>
            terms.every((term) => song.searchText.includes(term)),
          );

    if (sort === null) return shown;
    return shown.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      // An absent fact is not a value and stays below stated facts in either
      // direction. Set order is the stable answer when two values agree.
      if (av === '' && bv !== '') return 1;
      if (av !== '' && bv === '') return -1;
      const compared = collator.compare(av, bv);
      return compared === 0
        ? a.setOrder - b.setOrder
        : compared * (sort.direction === 'ascending' ? 1 : -1);
    });
  }, [displaySongs, query, sort]);

  const onSort = (field: SortField) => {
    setSort((current) => ({
      field,
      direction:
        current?.field === field && current.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  };

  /**
   * Hiding the column a sort is keyed on leaves the list in an order nothing
   * on screen explains, so the sort goes with it. Falling back to set order is
   * also the pane's own default, which is the order the grid is in.
   */
  const onToggleFact = (fact: IndexFact) => {
    setColumns((current) => {
      const next = { ...current, [fact]: !current[fact] };
      saveIndexColumns(next);
      return next;
    });
    setSort((current) => (current?.field === fact ? null : current));
  };

  return (
    <nav
      id="song-index"
      className="song-index"
      aria-label="Song index"
      // Both derived from the same visible-column list, so the pane is exactly
      // as wide as the columns in it — which is what makes hiding one narrow
      // the pane rather than hand its space to the name.
      style={
        {
          '--song-index-w': `${paneWidth(columns)}px`,
          '--song-index-cols': columnTemplate(columns),
        } as CSSProperties
      }
    >
      <div className="song-index-head">
        <span className="lbl">Song index</span>
        <span className="song-index-head-actions">
          <ControlButton
            type="button"
            icon
            className="song-index-cols-btn"
            pressed={pickingColumns}
            aria-expanded={pickingColumns}
            aria-label="Choose columns"
            title="Choose columns"
            onClick={() => setPickingColumns((open) => !open)}
          >
            <IconColumns />
          </ControlButton>
          <ControlButton
            type="button"
            className="song-index-close"
            aria-label="Close song index"
            title="Close song index"
            onClick={onClose}
          >
            ×
          </ControlButton>
        </span>
      </div>

      {/* A disclosed row rather than a popover. There are four switches, they
          are all the same kind of thing, and seeing which are on is most of
          what you came for — a menu would hide that behind a press. */}
      {pickingColumns && (
        <div className="song-index-fields" role="group" aria-label="Columns">
          {INDEX_FACTS.map((fact) => (
            <ControlButton
              key={fact}
              type="button"
              pressed={columns[fact]}
              title={`${columns[fact] ? 'Hide' : 'Show'} the ${FACT_LABEL[fact]} column`}
              onClick={() => onToggleFact(fact)}
            >
              {FACT_LABEL[fact]}
            </ControlButton>
          ))}
        </div>
      )}

      <div className="song-index-search">
        <input
          type="search"
          value={query}
          placeholder="Search songs"
          // Searching covers every fact the pane knows, including the ones
          // currently hidden — a column you turned off to save width is still
          // a thing you might be looking for.
          aria-label="Search song names, artists, keys, BPM, and types"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div className="song-index-columns">
        <SortHeading field="name" label="Name" sort={sort} onSort={onSort} />
        {visibleFacts.map((fact) => (
          <SortHeading
            key={fact}
            field={fact}
            label={FACT_LABEL[fact]}
            sort={sort}
            onSort={onSort}
          />
        ))}
      </div>

      <div className="song-index-list">
        {shownSongs.length === 0 ? (
          <div className="song-index-empty">
            {displaySongs.length === 0 ? 'No mapped songs' : 'No songs match this search'}
          </div>
        ) : (
          shownSongs.map((song) => {
            return (
              <div
                className={`song-index-row${song.color === undefined ? '' : ' colored'}`}
                key={song.firstScene}
                style={
                  song.color === undefined
                    ? undefined
                    : ({
                        '--index-song-rgb': hex(song.color),
                      } as CSSProperties)
                }
              >
                <ControlButton
                  type="button"
                  className="song-index-name"
                  title={`Jump to ${song.name}`}
                  disabled={song.firstScene === undefined}
                  onClick={() => {
                    if (song.firstScene !== undefined) onJump(song.firstScene);
                  }}
                >
                  {song.name}
                </ControlButton>
                {visibleFacts.map((fact) => (
                  <span
                    key={fact}
                    className={song[fact] === '' ? 'none' : ''}
                    title={song[fact]}
                  >
                    {/* An em dash rather than a blank: the set never said, and
                        a gap reads as the pane failing to draw something. */}
                    {song[fact] || '—'}
                  </span>
                ))}
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
}
