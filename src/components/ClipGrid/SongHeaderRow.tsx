import { memo, type CSSProperties, type DragEvent } from 'react';
import './SongHeaderRow.css';
import { hex, legibleOn } from '@openflow/core/color.ts';
import { roleKey } from '@openflow/core/roles.ts';
import type { Column } from '@openflow/core/trackColumns.ts';
import {
  mergeShapes,
  type SongHeader,
  type TrackShape,
} from '@openflow/core/songRows.ts';
import { IconGroupFold } from '../Icon.tsx';
import { ControlButton } from '../Control.tsx';
import { TagChip } from '../TagChip.tsx';
import { BAND_CONTRAST, isShape, RAIL, UNTAGGED } from './constants.ts';
import type { DropEdge } from './dropEdge.ts';

/** `CHORUS ×4, JAM1` — what a track plays, for the cell's tooltip. */
function sections(shape: TrackShape): string {
  const named = shape.roles.map((r) => (r.scenes > 1 ? `${r.name} ×${r.scenes}` : r.name));
  if (shape.untagged > 0) named.push(`${shape.untagged} untagged`);
  return named.length === 0 ? 'no sections' : named.join(', ');
}

interface SongHeaderRowProps {
  header: SongHeader;
  columns: Column<OpenFlow.Track>[];
  /** The song's color, or -1 when it has none or its scenes disagree. A number
   *  rather than the palette, so this row stays memoizable on primitives. */
  rgb: number;
  /**
   * Track index → what that track plays in this block. Empty while the song is
   * open: the shape stands in for rows that are on screen anyway.
   */
  shapes: Map<number, TrackShape>;
  /** roleKey → the RGB its band is painted. Shared with the scene rows' chips. */
  roleColors: Map<string, number>;
  /** This block is the one being dragged. */
  dragging: boolean;
  /** Which edge of this header the drop indicator sits on, if any. */
  dropEdge: DropEdge;
  /** What the drop would cost, shown on the indicator. `''` when not the target. */
  dropNote: string;
  onToggle: (songKey: string) => void;
  onPickSong: (songKey: string) => void;
  /** The scenes this grip picks up. A block header hands over its whole run. */
  onDragStart: (sources: readonly number[]) => void;
  onDragOver: (from: number, to: number, below: boolean) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

/**
 * A song's header, spanning the grid above the first scene of one of its
 * blocks.
 *
 * Memoized on primitives for the same reason `Row` is: there can be a hundred
 * of these, and they must not all re-render because one song folded. That's why
 * `SongHeader` in core carries rendered strings rather than the observed arrays.
 *
 * The four non-primitive props are all deliberate exceptions, and all safe for
 * the same reason: `header`, `columns`, `shapes` and `roleColors` are rebuilt only
 * when the set or the vocabulary changes — never on a fold, and never on the
 * mouse moves a drag produces, which are the two gestures that would otherwise
 * cost a hundred re-renders.
 */
export const SongHeaderRow = memo(function SongHeaderRow({
  header,
  columns,
  rgb,
  shapes,
  roleColors,
  dragging,
  dropEdge,
  dropNote,
  onToggle,
  onPickSong,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SongHeaderRowProps) {
  const cls = [
    'song-row',
    header.collapsed ? 'collapsed' : '',
    rgb >= 0 ? 'colored' : '',
    dragging ? 'dragging' : '',
    dropEdge ? `drop-${dropEdge}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  // Two custom properties rather than one: the solid left edge and the wash
  // behind the whole row are the same color at different strengths, and a
  // background gradient can't carry per-layer opacity. Alpha is appended as hex
  // the same way a folded group cell tints itself.
  const band = rgb < 0 ? rgb : legibleOn(rgb, RAIL, BAND_CONTRAST);
  const paint =
    rgb < 0
      ? undefined
      : ({
          '--song-rgb': hex(band),
          '--song-wash': `${hex(band)}24`,
          // Half strength, for a folded row's track cells: the cell holding the
          // title is the song, those are what's inside it. See color.md.
          '--song-wash-dim': `${hex(band)}12`,
        } as CSSProperties);

  // Folded, the header stands in for the rows it hides, so each track column
  // says what that track plays in this song. Open, the clips speak for
  // themselves and the track region is one uninterrupted band.
  const folded = header.collapsed;
  // What the tiles give up their space for. Both are things you have to act on
  // — a fault to fix, a move about to happen — and both outrank a summary of
  // what the song contains.
  const notice = header.colorClash || dropNote !== '';

  const foldGlyph = (
    <span className="fold">
      <IconGroupFold folded={folded} />
    </span>
  );
  const songButton = (
    <ControlButton
      type="button"
      className="song"
      title={
        `Work on ${header.song}` +
        (header.artist === '' ? '' : ` by ${header.artist}`) +
        ' — selects every scene of it'
      }
      onClick={(e) => {
        e.stopPropagation();
        onPickSong(header.songKey);
      }}
    >
      {header.song}
    </ControlButton>
  );
  // Nothing when the set never named one. A song with no artist gives the line
  // over to whatever else is on it rather than holding an empty slot open.
  const artistText =
    header.artist === '' ? null : (
      <span
        className={`song-artist${header.artistClash ? ' clash' : ''}`}
        title={
          header.artistClash
            ? `This song's scenes disagree: ${header.artist}`
            : header.artist
        }
      >
        {header.artist}
      </span>
    );
  // A song that states neither fact still shows both slots, as dashes as wide as
  // the value that's missing — three for a bpm, two for a key. An empty slot
  // reads as a rendering gap; a dash says the set never named one, which is a
  // thing to go and fix. Dimmer than any real value, and it stays dim under
  // `clash` — nothing said is not the same as two scenes disagreeing.
  const facts = (
    <span className={`facts${header.clash ? ' clash' : ''}`}>
      <span className={`bpm${header.bpm === '' ? ' none' : ''}`}>{header.bpm || '---'}</span>
      <span className={`key${header.key === '' ? ' none' : ''}`}>{header.key || '--'}</span>
    </span>
  );
  const tagChip = (
    <TagChip
      tag={header.tag}
      className="song-tag"
      color="var(--song-rgb, var(--caption))"
      clash={header.tagClash}
      title={
        header.tagClash ? `This song's scenes disagree: ${header.tag}` : undefined
      }
    />
  );
  const mixedColor = header.colorClash && (
    <span
      className="mixed-color"
      title="This song's scenes hold more than one color — pick a swatch to make it one"
    >
      mixed color
    </span>
  );

  /* The song's identity, over the metadata and Master columns both — the same
     two columns every other row splits at, so the Master section reads as one
     region running the whole height of the grid rather than as something the
     header rows paper over.

     **Two lines, because the segment is narrower than a song name.** They split
     by side rather than by kind: what the song *is* runs down the left — its
     name, then who wrote it — and what it's filed under runs down the right,
     the tag over the two facts. So each edge reads as a column of its own down
     a set, and the free text can take the space the fixed fields don't use.
     Both lines fit the row's existing height — 14 and 14 inside 36 — so a
     folded set is no taller for it.

     The tag is a fixed slot rather than a pill sized to its word, for the same
     reason the facts are: a chip that grows with its tag moves the name's right
     edge song by song, and a jittering edge is the thing that stops a column
     being scannable. It also has no outline here — the row already carries the
     song's color as a bar and a wash, and the tag is drawn in that same color,
     so the border was a third rectangle saying nothing the color didn't.

     Folded, the Master column has no roles to show and its width is the name's;
     open, the same block sits above scenes that have roles in it. One layout
     either way: a header should not move when a song folds. */
  const identity = (
    <div className="song-line">
      {foldGlyph}
      <span className="song-identity">
        <span className="song-name-line">
          {songButton}
          {tagChip}
        </span>
        <span className="song-meta-line">
          {artistText}
          {/* Worth saying only when there is more than one — a song in two runs
              is a reprise, or two different songs sharing a name. Short here
              because it shares a line; the tooltip spells it out. */}
          {header.blocks > 1 && (
            <span className="part" title={`part ${header.block} of ${header.blocks}`}>
              {header.block}/{header.blocks}
            </span>
          )}
          {facts}
        </span>
      </span>
    </div>
  );

  // The drag handle is the identity cell in both shapes. Folded, the rest of
  // the row is tiles; open, it's the band across the track region — and a grab
  // cursor over either would promise a drag from somewhere it doesn't start.
  const lead = {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLTableCellElement>) => {
      // Firefox refuses to start a drag unless something is set.
      e.dataTransfer.setData('text/plain', header.song);
      e.dataTransfer.effectAllowed = 'move';
      const run: number[] = [];
      for (let s = header.from; s <= header.to; s++) run.push(s);
      onDragStart(run);
    },
    onDragEnd,
  };

  return (
    <tr
      className={cls}
      style={paint}
      data-song-start={header.from}
      // Folding is the row's job, not the lead cell's — a folded header is
      // several cells wide and a click on any of them means the same thing.
      onClick={() => onToggle(header.songKey)}
      // Which half of the row the pointer is in decides whether the block lands
      // above or below this song. A row is tall enough for that to be a
      // comfortable target, and it's the idiom every list-reorder UI uses.
      onDragOver={(e) => {
        e.preventDefault();
        // Without this the cursor shows "copy" and, in some browsers, the drop
        // never fires at all.
        e.dataTransfer.dropEffect = 'move';
        const box = e.currentTarget.getBoundingClientRect();
        onDragOver(header.from, header.to, e.clientY > box.top + box.height / 2);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <td className="song-lead" colSpan={2} {...lead}>
        {identity}
      </td>
      {!folded || notice ? (
        columns.length > 0 && (
          /* The track region, as one cell. Open, it is the band that separates
             this song's scenes from the one above — and the flags live in it
             rather than beside the name, because they are about a thing you
             have to go and do rather than about what the song is called.
             Folded, it takes the tile region for the same two, which outrank a
             summary of what the song contains for as long as they are there —
             and right-aligns there, where the tiles it replaced ended, rather
             than sitting alone at the far edge of an open header's band. */
          <td className={folded ? 'song-notice' : 'song-detail'} colSpan={columns.length}>
            {mixedColor}
            {/* The cost, on the indicator itself. This move can't be undone
                from here, so what it's about to do belongs in front of you
                while your finger is still on the mouse — not in the log
                afterwards. */}
            {dropNote !== '' && <span className="drop-note">{dropNote}</span>}
          </td>
        )
      ) : (
        <>
          {columns.map((c) => {
              // A group column stands for several tracks, so its cell shows
              // what any of them play — the union, same as the group's clip
              // slot stands in for the clips underneath it. Branching on
              // `c.kind` at each use rather than through a boolean: the
              // boolean reads better and narrows nothing, so `c.members` on a
              // track column would only fail at runtime.
              const grouped = c.kind === 'group';
              const shape =
                c.kind === 'group'
                  ? mergeShapes(c.members.map((t) => shapes.get(t)).filter(isShape))
                  : shapes.get(c.track.i);
              const name = c.kind === 'group' ? c.group.name : c.track.name;
              const used =
                c.kind === 'group'
                  ? c.members.filter((t) => shapes.has(t)).length
                  : (shape?.scenes ?? 0);
              const of = c.kind === 'group' ? c.members.length : header.scenes;
              return (
                <td
                  key={c.kind === 'group' ? `g${c.group.i}` : `t${c.track.i}`}
                  className="fill"
                  title={
                    used === 0
                      ? `${name} — nothing in ${header.song}`
                      : `${name} — ${sections(shape!)} · ` +
                        (grouped
                          ? `${used} of ${of} tracks used in ${header.song}`
                          : `${used} of ${of} scene${of === 1 ? '' : 's'} of ${header.song}`)
                  }
                >
                  {/* One slice per scene, in song order. A clip paints its
                      scene's role color; an empty clip slot stays blank. This
                      is the whole hidden run compressed into one track cell,
                      rather than only a list of its distinct roles. An empty
                      track still draws nothing at all — an absence answers
                      faster than a faint presence. */}
                  {shape && (
                    <span className="role-bands" aria-hidden="true">
                      {shape.slots.map((slot, i) => {
                        const roleRgb =
                          slot?.role === null || slot === null
                            ? undefined
                            : roleColors.get(roleKey(slot.role));
                        const kind =
                          slot === null
                            ? ' empty'
                            : slot.role === null
                              ? ' untagged'
                              : roleRgb === undefined
                                ? ' uncolored'
                                : '';
                        return (
                          <span
                            key={i}
                            className={`role-band${kind}`}
                            style={
                              slot?.role === null
                                ? { background: hex(UNTAGGED) }
                                : roleRgb === undefined
                                  ? undefined
                                  : { background: hex(roleRgb) }
                            }
                          />
                        );
                      })}
                    </span>
                  )}
                </td>
              );
          })}
        </>
      )}
    </tr>
  );
});
