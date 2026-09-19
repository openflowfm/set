import { memo, type DragEvent } from 'react';
import './Row.css';
import { hex, inkOn } from '@openflow/core/color.ts';
import { MIN_TEMPO } from '@openflow/core/derive.ts';
import { groupSlot } from '@openflow/core/groupSlot.ts';
import { roleIn, roleKey } from '@openflow/core/roles.ts';
import { titleOf } from '@openflow/core/sceneTitle.ts';
import type { Column } from '@openflow/core/trackColumns.ts';
import { clipKey } from '../../lib/selection.ts';
import { LAUNCH_KEY, mods } from '../../lib/keys.ts';
import { has, type RowMarks } from '../../lib/rowMarks.ts';
import { ControlButton } from '../Control.tsx';
import { GROUP_CELL_ALPHA, GROUP_SLOT_ALPHA } from './constants.ts';
import type { DropEdge } from './dropEdge.ts';
import type { Props } from './ClipGrid.tsx';

interface RowProps {
  scene: OpenFlow.Scene;
  columns: Column<OpenFlow.Track>[];
  clips: Map<string, OpenFlow.Clip>;
  selected: ReadonlySet<string>;
  marks: RowMarks;
  /**
   * Every armed track, as `|t|t|`. One string for the whole grid rather than a
   * per-row token — arm is a track property, so every row's answer is the same.
   * See RowMarks for why it crosses this boundary flattened.
   */
  armed: string;
  /** Track index when the active cell is a clip in this row, `'scene'` when it's the name. */
  active: number | 'scene' | undefined;
  roleColors: Map<string, number>;
  sceneSelected: boolean;
  /** This scene is one of the ones in flight. */
  dragging: boolean;
  /** Which edge the drop line sits on, if this row is the target. */
  dropEdge: DropEdge;
  /** Tracks whose clip in this row is in flight, as `|t|t|`. See RowMarks. */
  lifting: RowMarks;
  /** Tracks whose slot in this row is a drop target, same shape. */
  landing: RowMarks;
  onClip: Props['onClip'];
  onScene: Props['onScene'];
  onFireScene: Props['onFireScene'];
  onFireClip: Props['onFireClip'];
  onRoleMenu: Props['onRoleMenu'];
  onSceneDragStart: Props['onSceneDragStart'];
  onSceneDragOver: Props['onSceneDragOver'];
  onSceneDrop: Props['onSceneDrop'];
  onSceneDragEnd: Props['onSceneDragEnd'];
  onClipDragStart: Props['onClipDragStart'];
  onClipDragOver: Props['onClipDragOver'];
  onClipDrop: Props['onClipDrop'];
  onClipDragEnd: Props['onClipDragEnd'];
}

// memo on the row is what keeps toggling one cell from re-rendering all 848
// scenes. Without it this is slower than the innerHTML version it replaced.
export const Row = memo(function Row({
  scene,
  columns,
  clips,
  selected,
  marks,
  armed,
  active,
  roleColors,
  sceneSelected,
  dragging,
  dropEdge,
  lifting,
  landing,
  onClip,
  onScene,
  onFireScene,
  onFireClip,
  onRoleMenu,
  onSceneDragStart,
  onSceneDragOver,
  onSceneDrop,
  onSceneDragEnd,
  onClipDragStart,
  onClipDragOver,
  onClipDrop,
  onClipDragEnd,
}: RowProps) {
  // There is no "scene is playing" property in the LOM, so derive it: a scene
  // is sounding if any track is playing a clip in this row.
  const sceneLive = marks !== undefined && marks.indexOf('|p') >= 0;
  const sceneFired = marks !== undefined && marks.indexOf('|f') >= 0;

  // The role is parsed out of the name and shown as a chip. The header owns
  // everything a scene shares with the rest of its song — the name, the artist,
  // the tag — and a row repeats only what can differ from the row above it.
  // Live keeps the complete literal name either way.
  const role = roleIn(scene.name);
  const metadata = titleOf(scene.name);
  // **The name is the record.** Scene.tempo is a projection of it onto the one
  // scene Live should act on, so it stands in only for a set that hasn't been
  // renamed yet — the same migration fallback the editor uses in useSceneTitles.
  const bpm = metadata.bpm !== '' ? metadata.bpm : scene.tempo >= MIN_TEMPO ? String(scene.tempo) : '';
  const { key } = metadata;
  const roleRgb = role === null ? undefined : roleColors.get(roleKey(role));

  return (
    <tr
      className={
        `scene-row${dragging ? ' dragging' : ''}${dropEdge ? ` drop-${dropEdge}` : ''}`
      }
      // The whole row is the drop target, not just the scene column: a row is a
      // wide, easy thing to aim at, and which half the pointer is in decides
      // whether the scenes land above or below it. Same idiom as the song
      // header, and the same reason.
      onDragOver={(e: DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        // Without this the cursor shows "copy" and, in some browsers, the drop
        // never fires at all.
        e.dataTransfer.dropEffect = 'move';
        const box = e.currentTarget.getBoundingClientRect();
        onSceneDragOver(scene.i, scene.i, e.clientY > box.top + box.height / 2);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onSceneDrop();
      }}
    >
      {/* The app's own column: what this scene is numbered, and the two facts
          it states. No Live identity, nothing to fire. */}
      <td
        className={`scene-meta${sceneSelected ? ' picked' : ''}`}
        title={
          `${scene.name || `Scene ${scene.i + 1}`} — click selects every clip in it` +
          ` · ⇧ extends over scenes · ${LAUNCH_KEY}-click fires it`
        }
        onClick={(e) => onScene(scene.i, mods(e))}
      >
        <span className="scene-line">
        {/* The number is the grip. The cell around it already means "select",
            and ⇧ already means "extend", so the row itself can't be the handle
            without one gesture stealing from the other — where the number is
            inert, sits at a fixed x down the whole column, and is the one part
            of the row that names the position being changed. Clicking it still
            selects: a drag and a click are different gestures. */}
          <span
            className="scene-n"
            draggable
            title={`Scene ${scene.i + 1} — drag to move it`}
            onDragStart={(e: DragEvent<HTMLSpanElement>) => {
              // Firefox refuses to start a drag unless something is set.
              e.dataTransfer.setData('text/plain', String(scene.i));
              e.dataTransfer.effectAllowed = 'move';
              onSceneDragStart(scene.i);
            }}
            onDragEnd={onSceneDragEnd}
          >
            {scene.i + 1}
          </span>
        {/* Fixed slots, so a bpm reads as a column down the set rather than as
            a number that moves with the scene number's width. The song header
            states the same two facts in the same widths, but against the right
            edge of its segment — one column per side, not one shared one. */}
          <span
            className={`scene-bpm${bpm === '' ? ' none' : ''}`}
            title={bpm === '' ? 'This scene names no BPM' : `BPM: ${bpm}`}
          >
            {bpm || '---'}
          </span>
        {/* The `@` belongs to the storage syntax, not the key value, so the
            grid shows the clean `Bm` / `F#m` reading. */}
          <span
            className={`scene-key${key === '' ? ' none' : ''}`}
            title={key === '' ? 'No key set for this scene' : `key: ${key}`}
          >
            {key || '--'}
          </span>
        </span>
      </td>
      {/* The Master column's cell, built like a clip cell because that is what
          it is: Live's own scene launcher at the left end, and the scene's role
          filling the rest the way a clip's name fills its slot. The launcher is
          here rather than in the metadata column for the same reason Live puts
          it in the Master track — firing a scene is Live's, not ours. */}
      <td
        className={
          `scene-role${role === null ? ' none' : ''}` +
          `${role !== null && roleRgb === undefined ? ' uncolored' : ''}` +
          `${active === 'scene' ? ' active' : ''}${sceneSelected ? ' picked' : ''}`
        }
        // The role paints the cell, exactly as a clip's color paints its own —
        // edge to edge, with the launcher recessed on top of it rather than
        // beside it. An inset pill on a dark cell was the same information in a
        // shape that read as an annotation; this reads as a slot with something
        // in it, which is what a tagged scene is.
        //
        // `picked` sets `--sel` from the stylesheet and is simply outranked
        // here, so a selected row shows its band on the cells that have no
        // color of their own and leaves the colored ones alone — the same way
        // a selected clip keeps its color and takes a border instead.
        style={
          role === null || roleRgb === undefined
            ? undefined
            : { background: hex(roleRgb), color: inkOn(roleRgb) }
        }
        data-active={active === 'scene' ? '1' : undefined}
        title={
          `${scene.name || `Scene ${scene.i + 1}`} — click selects every clip in it` +
          ` · ⇧ extends over scenes · ${LAUNCH_KEY}-click fires it`
        }
        onClick={(e) => onScene(scene.i, mods(e))}
      >
        <ControlButton
          type="button"
          className={`fire${sceneLive ? ' live' : ''}${sceneFired ? ' fired' : ''}`}
          title={`Fire scene ${scene.i + 1}`}
          // The row's own click selects; this button only ever fires, so let it
          // do that on a plain click without breaking the modifier rule.
          onClick={(e) => {
            e.stopPropagation();
            onFireScene(scene.i);
          }}
        >
          ▶
        </ControlButton>
        {/* The label reads like a clip's name and is a button, because the
            label is where the role gets changed. An untagged scene says `NONE`
            through the same button, so it is one click from a role rather than
            a trip to the rail. Lowercase in the source and uppercased in CSS,
            like every other label in this grid.

            `stopPropagation` for the same reason the fire button has it — the
            cell's own click selects, and pressing this is not a selection. The
            launcher strip left of it stays cell, so there is somewhere on a
            colored scene to click that still means "select", exactly as there
            is on a clip. */}
        <ControlButton
          type="button"
          aria-haspopup="menu"
          className="role-chip"
          title={
            role === null
              ? 'No role — click to tag this scene'
              : roleRgb === undefined
                ? `${role} — no color set for this role · click to change`
                : `role: ${role} · click to change`
          }
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onRoleMenu(scene.i, { left: r.left, top: r.top, bottom: r.bottom });
          }}
        >
          {role === null ? 'none' : role}
        </ControlButton>
      </td>
      {columns.map((c) => {
        if (c.kind === 'group') {
          // A real Live slot: firing it fires every clip the group holds in
          // this scene. Its color is the first of those clips, which is Live's
          // own rule — see core/groupSlot.
          const slot = groupSlot(c.members, (t) => clips.get(clipKey(t, scene.i)));
          const t = c.group.i;
          // The group track reports its own play state, but only if Live fills
          // in playing_slot_index for group tracks — unconfirmed, so fall back
          // to the members, which is what this cell has always used.
          const live = has(marks, `p${t}`) || c.members.some((m) => has(marks, `p${m}`));
          const fired = has(marks, `f${t}`) || c.members.some((m) => has(marks, `f${m}`));
          return (
            <td
              key={`g${t}`}
              className={`cell group${live ? ' playing' : ''}${fired ? ' fired' : ''}`}
              style={
                slot.count ? { background: `${hex(slot.color)}${GROUP_SLOT_ALPHA}` } : undefined
              }
              title={
                slot.count
                  ? `${c.group.name} — fire ${slot.count} of ${c.members.length} tracks` +
                    ` in scene ${scene.i + 1}`
                  : `${c.group.name} — nothing to fire in scene ${scene.i + 1}`
              }
            >
              {/* Plain click fires, like the scene row's button and unlike a
                  clip cell, because there is nothing here to select — the
                  modifier rule exists to keep firing away from selection, and
                  a group slot has no selection to protect. Absent entirely
                  when the group has nothing here: Live draws no launcher on an
                  empty group slot either. */}
              {slot.count > 0 && (
                <>
                  <ControlButton
                    type="button"
                    className="fire"
                    title={`Fire ${c.group.name} in scene ${scene.i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFireClip(t, scene.i);
                    }}
                  >
                    ▶
                  </ControlButton>
                  <span className="group-n">{slot.count}</span>
                </>
              )}
            </td>
          );
        }

        const t = c.track.i;
        const key = clipKey(t, scene.i);
        const clip = clips.get(key);
        const isSel = selected.has(key);
        const playing = has(marks, `p${t}`);
        const fired = has(marks, `f${t}`);
        const isLifting = has(lifting, String(t));
        const isLanding = has(landing, String(t));
        // What an empty slot's button will do, which is Live's rule rather than
        // ours: one ClipSlot.fire() triggers the slot's stop button on an
        // unarmed track and starts recording on an armed one. The glyph says
        // which, so the button never has to be pressed to find out.
        const willRecord = clip === undefined && has(armed, String(t));
        const slotAction = willRecord
          ? `Record into ${c.track.name} in scene ${scene.i + 1}`
          : `Stop ${c.track.name}`;
        return (
          <td
            key={key}
            className={
              `cell${clip ? ' has' : ' empty'}${isSel ? ' sel' : ''}` +
              `${active === t ? ' active' : ''}${playing ? ' playing' : ''}` +
              `${fired ? ' fired' : ''}${isLifting ? ' lifting' : ''}` +
              `${isLanding ? ' landing' : ''}`
            }
            data-active={active === t ? '1' : undefined}
            // Only a slot holding a clip can start a drag. An empty one is
            // still a drop *target*, which is the whole point of dragging.
            draggable={clip !== undefined}
            onDragStart={(e: DragEvent<HTMLTableCellElement>) => {
              // Firefox refuses to start a drag unless something is set.
              e.dataTransfer.setData('text/plain', clip?.name ?? '');
              e.dataTransfer.effectAllowed = 'move';
              onClipDragStart(t, scene.i);
            }}
            onDragEnd={onClipDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              onClipDragOver(t, scene.i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              // Stop the row's own handler firing too — a clip landing on a
              // slot is not a request to reorder the scene it landed in.
              e.stopPropagation();
              onClipDrop();
            }}
            style={
              clip
                ? { background: hex(clip.color), color: inkOn(clip.color) }
                : c.group
                  ? { background: `${hex(c.group.color)}${GROUP_CELL_ALPHA}` }
                  : undefined
            }
            title={
              clip
                ? `${clip.name}  ·  index ${clip.colorIndex}` +
                  `  ·  ▶ or ${LAUNCH_KEY}-click fires it`
                : willRecord
                  ? `empty · ${c.track.name} is armed — ● or ${LAUNCH_KEY}-click` +
                    ' records into this slot'
                  : `empty — ■ or ${LAUNCH_KEY}-click stops this track`
            }
            onClick={(e) => onClip(t, scene.i, mods(e))}
          >
            {/* Live's own launcher, on the slots that have something to launch.
                Plain click fires, like the scene and group buttons: the
                modifier rule keeps firing away from *selection*, and a button
                that only ever fires has no selection to take. The rest of the
                cell is unchanged, so an unmodified click there still selects
                and opens the editor. */}
            {clip && (
              <ControlButton
                type="button"
                className="fire"
                title={`Fire ${clip.name || `track ${t + 1}`} in scene ${scene.i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFireClip(t, scene.i);
                }}
              >
                ▶
              </ControlButton>
            )}
            {/* An empty slot's button, in the launcher's own place — Live draws
                one there too. It is the *same* LOM call as the launcher, so
                there is no second callback: `ClipSlot.fire()` triggers the
                slot's stop button when the track is unarmed and starts
                recording when it's armed, and the glyph is how you can tell in
                advance which of the two you're about to get. */}
            {clip === undefined && (
              <ControlButton
                type="button"
                className={`slot-btn${willRecord ? ' rec' : ''}`}
                aria-label={slotAction}
                title={slotAction}
                onClick={(e) => {
                  e.stopPropagation();
                  onFireClip(t, scene.i);
                }}
              >
                {willRecord ? '●' : '■'}
              </ControlButton>
            )}
            {clip?.name}
          </td>
        );
      })}
    </tr>
  );
});
