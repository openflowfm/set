import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ControlButton } from './Control.tsx';
import './BulkWorkflow.css';
import './ShowModal.css';
import { hex } from '@openflow/core/color.ts';
import { songKey, type Derivation, type DerivedSong } from '@openflow/core/derive.ts';
import { songFacts } from '@openflow/core/songRows.ts';
import { orderScenes, type OrderedScene, type SongPlacement } from '@openflow/core/songOrder.ts';
import { describeKeep, planSceneKeep, type SceneKeepPlan } from '@openflow/core/sceneMove.ts';
import { TagChip } from './TagChip.tsx';

interface Props {
  derivation: Derivation;
  snapshot: OpenFlow.Snapshot;
  palette: number[];
  busy: boolean;
  /**
   * Put tonight's songs in order and delete everything else. Like the reorder,
   * there is no undo of ours — and this one deletes songs outright.
   */
  onApply: (plan: OpenFlow.KeepPlan, summary: { songs: number; scenes: number }) => void;
  onClose: () => void;
}

/** How many suggestions the typeahead offers at once. */
const SUGGESTIONS = 8;

/** A song the typeahead can offer: its identity and the spelling the set uses. */
export interface ShowSong {
  key: string;
  name: string;
}

/**
 * The set's songs that match `query` and haven't been picked yet.
 *
 * Case-insensitive. A name that *is* the query comes first, then names that
 * **start** with it, then names that merely contain it, and each group keeps set order — the first suggestion is
 * what Enter takes, and a prefix is almost always what someone typing a title
 * from memory means. An empty query suggests nothing: the list starts blank on
 * purpose, and a full menu of the set would turn typing a show into scrolling one.
 */
export function suggestSongs(
  songs: readonly ShowSong[],
  picked: ReadonlySet<string>,
  query: string,
  limit = SUGGESTIONS,
): ShowSong[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const exact: ShowSong[] = [];
  const prefix: ShowSong[] = [];
  const inside: ShowSong[] = [];
  for (const song of songs) {
    if (picked.has(song.key)) continue;
    const name = song.name.toLowerCase();
    const at = name.indexOf(q);
    if (name === q) exact.push(song);
    else if (at === 0) prefix.push(song);
    else if (at > 0) inside.push(song);
  }
  return [...exact, ...prefix, ...inside].slice(0, limit);
}

export interface ShowOrder {
  /** Every scene that survives, in the order it ends up. */
  order: number[];
  /** Unmapped scenes above the first song — kept, at the top. */
  head: number[];
  /** The picked songs, in show order, each with the unmapped scenes it carries. */
  kept: SongPlacement[];
}

/**
 * The scenes a show keeps, in show order.
 *
 * `orderScenes` lays out the whole set with the picked songs first and every
 * other song appended after them; a show is the first `picked.length` of those
 * placements. That reuses the reorder's rules exactly — a song in two runs is
 * gathered into one, an unmapped scene goes wherever the song it sits after
 * goes (here: kept or deleted with it), and the unmapped scenes above the first
 * song stay at the top — rather than inventing a second set of them.
 */
export function showOrder(scenes: readonly OrderedScene[], picked: readonly string[]): ShowOrder {
  const { head, placements } = orderScenes(scenes, picked);
  const wanted = new Set(picked);
  const kept = placements.filter((p) => wanted.has(p.songKey));
  const order = [...head];
  for (const p of kept) order.push(...p.scenes, ...p.trailing);
  return { order, head, kept };
}

/**
 * The plan as the wire carries it: the planner's four fields, plus every scene
 * name of the snapshot the plan was built against, in index order. The bridge
 * refuses the plan unless Live's names still match, which is what stops a plan
 * built against one set deleting scenes from another.
 */
export function wirePlan(
  plan: SceneKeepPlan,
  scenes: readonly Pick<OpenFlow.Scene, 'i' | 'name'>[],
): OpenFlow.KeepPlan {
  return {
    sceneCount: plan.sceneCount,
    create: plan.create,
    steps: plan.steps,
    remove: plan.remove,
    sceneNames: [...scenes].sort((a, b) => a.i - b.i).map((sc) => sc.name),
  };
}

/** Move `key` to a gap in `list`, where gap `i` is "above the song at `i`". */
function moveTo(list: readonly string[], key: string, gap: number): string[] {
  const from = list.indexOf(key);
  if (from < 0) return [...list];
  const out = [...list];
  out.splice(from, 1);
  out.splice(gap > from ? gap - 1 : gap, 0, key);
  return out;
}

/** Swap the song at `i` with its neighbour, or return the list unchanged. */
function nudge<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * A new show: type tonight's songs in, put them in order, and commit — the set
 * is left holding those songs in that order and **nothing else**.
 *
 * It is the running order's sibling rather than a mode of it. The reorder
 * starts from the whole set and every song survives; this starts from nothing,
 * and every song you don't name is deleted. Starting blank is the point: a show
 * is written as a list of what you'll play, not as a list of what you won't.
 *
 * Nothing is written until Commit, and Commit takes two presses. This is the
 * one write in the app that deletes songs, there is no undo of ours, and the
 * number of songs it will delete is on the button before the second press —
 * any change to the list disarms it, so what was armed is what runs.
 */
export function ShowModal({ derivation, snapshot, palette, busy, onApply, onClose }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dragKey, setDragKey] = useState<string | null>(null);
  /** The gap the drop would land in, as an index into the picked list. */
  const [dropAt, setDropAt] = useState<number | null>(null);
  /**
   * The show the first press armed. `showOrder` is rebuilt whenever the list or
   * the set's scenes change, so a different object means a different show.
   */
  const [armed, setArmed] = useState<ShowOrder | null>(null);

  // Esc clears what you're typing first and closes only from an empty field —
  // closing would throw away the whole list, and Esc is also how a typeahead
  // is told "not that". Capture phase, like useCloseOnEscape, so the grid's
  // own Esc (stop every clip) never sees it.
  const queryRef = useRef(query);
  queryRef.current = query;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (queryRef.current !== '') {
        setQuery('');
        setHighlight(0);
      } else closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const songs = useMemo(() => {
    const at = new Map<string, DerivedSong>();
    for (const song of derivation.songs) at.set(songKey(song.name), song);
    return at;
  }, [derivation]);
  const catalog = useMemo<ShowSong[]>(
    () => derivation.songs.map((song) => ({ key: songKey(song.name), name: song.name })),
    [derivation],
  );
  const scenes = useMemo(
    () =>
      derivation.scenes.map((sc) => ({
        s: sc.s,
        songKey: sc.song === null ? null : songKey(sc.song),
      })),
    [derivation],
  );

  // A snapshot arriving while this is open can take a picked song out of the
  // set. It drops out of the list rather than sitting there naming nothing.
  const shown = useMemo(() => picked.filter((key) => songs.has(key)), [picked, songs]);
  const pickedSet = useMemo(() => new Set(shown), [shown]);
  const suggestions = useMemo(
    () => suggestSongs(catalog, pickedSet, query),
    [catalog, pickedSet, query],
  );
  const show = useMemo(() => showOrder(scenes, shown), [scenes, shown]);

  /**
   * The plan and its cost, or why there isn't one. Planning can throw — on a
   * bad order, which would be our bug — and a throw during render blanks the
   * app, so it becomes a disabled button and a line instead.
   */
  const { plan, cost, planError } = useMemo(() => {
    if (show.kept.length === 0) return { plan: null, cost: '', planError: '' };
    try {
      const plan = planSceneKeep({
        sceneCount: snapshot.scenes.length,
        order: show.order,
        clips: snapshot.clips,
        tracks: snapshot.tracks,
      });
      return { plan, cost: plan ? describeKeep(plan) : '', planError: '' };
    } catch (e) {
      return { plan: null, cost: '', planError: e instanceof Error ? e.message : String(e) };
    }
  }, [show, snapshot]);

  const deletedSongs = catalog.length - show.kept.length;
  const deletedScenes = snapshot.scenes.length - show.order.length;
  const isArmed = plan !== null && armed === show;

  const add = (key: string) => {
    setPicked([...shown, key]);
    setQuery('');
    setHighlight(0);
  };
  const remove = (key: string) => setPicked(shown.filter((k) => k !== key));

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[Math.min(highlight, suggestions.length - 1)];
      if (pick) add(pick.key);
    } else if (e.key === 'Backspace' && query === '' && shown.length > 0) {
      e.preventDefault();
      setPicked(shown.slice(0, -1));
    }
  };

  const drop = (gap: number) => {
    if (dragKey !== null) setPicked(moveTo(shown, dragKey, gap));
    setDragKey(null);
    setDropAt(null);
  };

  const commit = () => {
    if (!plan) return;
    if (!isArmed) {
      setArmed(show);
      return;
    }
    onApply(wirePlan(plan, snapshot.scenes), { songs: deletedSongs, scenes: deletedScenes });
  };

  const travelling = show.kept.reduce((n, p) => n + p.trailing.length, 0);

  return (
    <div className="viewport-overlay modal-back" onClick={onClose}>
      <div className="modal wide show-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">New show — {shown.length}</div>
        <div className="hint">
          Type tonight's songs in the order you'll play them; <b>Enter</b> takes the
          highlighted one. Drag to fix the order, then <b>Commit</b>: the set keeps
          these songs in this order and <b>deletes every other song</b>.
        </div>

        <div className="show-pick">
          <input
            type="text"
            className="show-input"
            aria-label="Add a song"
            placeholder={shown.length === 0 ? 'First song…' : 'Next song…'}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setHighlight(0);
            }}
            onKeyDown={onInputKey}
          />
          {suggestions.length > 0 && (
            <div className="show-suggest" role="listbox" aria-label="Matching songs">
              {suggestions.map((s, i) => (
                <div
                  key={s.key}
                  role="option"
                  aria-selected={i === highlight}
                  className={`show-option${i === highlight ? ' on' : ''}`}
                  // mousedown, not click, and no default: the input keeps focus,
                  // so the next title can be typed straight away.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s.key);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
          {query.trim() !== '' && suggestions.length === 0 && (
            <div className="hint">No song in the set matches “{query.trim()}” that isn't already in the show.</div>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="hint show-empty">No songs yet. Nothing is deleted until you commit.</div>
        ) : (
          <div className="order-rows">
            {shown.map((key, i) => {
              const song = songs.get(key);
              const facts = song ? songFacts(song) : { bpm: '', key: '', artist: '', tag: '' };
              const runs = song?.blocks.length ?? 1;
              const colorIndex =
                song?.observed.colorIndex.length === 1 ? song.observed.colorIndex[0]! : -1;
              const tagColor = colorIndex >= 0 ? palette[colorIndex] : undefined;
              return (
                <div
                  key={key}
                  className={[
                    'order-row',
                    dragKey === key ? 'dragging' : '',
                    dropAt === i ? 'drop-above' : '',
                    dropAt === shown.length && i === shown.length - 1 ? 'drop-below' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable
                  onDragStart={(e: DragEvent<HTMLDivElement>) => {
                    // Firefox refuses to start a drag unless something is set.
                    e.dataTransfer.setData('text/plain', key);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragKey(key);
                  }}
                  onDragEnd={() => {
                    setDragKey(null);
                    setDropAt(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const box = e.currentTarget.getBoundingClientRect();
                    const gap = e.clientY > box.top + box.height / 2 ? i + 1 : i;
                    setDropAt((prev) => (prev === gap ? prev : gap));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    drop(e.clientY > box.top + box.height / 2 ? i + 1 : i);
                  }}
                >
                  <span className="grip" aria-hidden>
                    ≡
                  </span>
                  <span className="pos">{i + 1}</span>
                  <span className="facts">
                    <span className={`bpm${facts.bpm === '' ? ' none' : ''}`}>
                      {facts.bpm || '---'}
                    </span>
                    <span className={`key${facts.key === '' ? ' none' : ''}`}>
                      {facts.key || '--'}
                    </span>
                  </span>
                  <span className="song">{song?.name ?? key}</span>
                  <TagChip
                    tag={facts.tag}
                    color={tagColor === undefined ? undefined : hex(tagColor)}
                    clash={(song?.observed.tag.length ?? 0) > 1}
                  />
                  {runs > 1 && (
                    <span
                      className="flag"
                      title={`This song sits in ${runs} runs. Committing collects them into one.`}
                    >
                      {runs} runs → 1
                    </span>
                  )}
                  <ControlButton
                    type="button"
                    className="x"
                    title="Move up"
                    disabled={i === 0}
                    onClick={() => setPicked(nudge(shown, i, -1))}
                  >
                    ↑
                  </ControlButton>
                  <ControlButton
                    type="button"
                    className="x"
                    title="Move down"
                    disabled={i === shown.length - 1}
                    onClick={() => setPicked(nudge(shown, i, 1))}
                  >
                    ↓
                  </ControlButton>
                  <ControlButton
                    type="button"
                    className="x"
                    title="Take this song out of the show"
                    aria-label={`Remove ${song?.name ?? key}`}
                    onClick={() => remove(key)}
                  >
                    ×
                  </ControlButton>
                </div>
              );
            })}
          </div>
        )}

        {shown.length > 0 && (travelling > 0 || show.head.length > 0) && (
          <div className="hint">
            {travelling > 0 &&
              `${plural(travelling, 'unmapped scene')} after these songs ` +
                `${travelling === 1 ? 'is' : 'are'} kept with ${travelling === 1 ? 'it' : 'them'}. `}
            {show.head.length > 0 &&
              `${plural(show.head.length, 'unmapped scene')} above the first song ` +
                `${show.head.length === 1 ? 'stays' : 'stay'} at the top.`}
          </div>
        )}
        {planError !== '' && <div className="warn">Could not plan this show — {planError}</div>}

        <div className="warn">
          There is no undo for this. It deletes every song not in the list, and no
          snapshot can rebuild a deleted scene — Live's own ⌘Z is the only way back,
          and only if Live agrees to group the change.
        </div>

        <div className="modal-actions">
          <div className="hint">
            {shown.length === 0
              ? 'add a song to start'
              : plan
                ? `${cost} · deletes ${plural(deletedSongs, 'song')}, ${plural(deletedScenes, 'scene')}`
                : planError === ''
                  ? 'the set is already exactly this show'
                  : 'nothing to commit'}
          </div>
          <div className="spacer" />
          <ControlButton onClick={onClose}>Cancel</ControlButton>
          <ControlButton
            intent="primary"
            className={isArmed ? 'show-armed' : undefined}
            disabled={busy || plan === null}
            title={
              plan === null
                ? 'Nothing to commit'
                : isArmed
                  ? 'Press again to write this show to Live'
                  : 'Write this show to Live — asks once more first'
            }
            onClick={commit}
          >
            {isArmed
              ? deletedSongs > 0
                ? `Delete ${plural(deletedSongs, 'song')} — press again`
                : 'Reorder — press again'
              : 'Commit'}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
