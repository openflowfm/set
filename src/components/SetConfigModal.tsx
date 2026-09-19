import { useMemo, useState } from 'react';
import './SetConfigModal.css';
import { hex } from '@openflow/core/color.ts';
import {
  planDefaultArtist,
  type DefaultArtistPlan,
} from '@openflow/core/defaultArtist.ts';
import type { Derivation } from '@openflow/core/derive.ts';
import {
  findRoleProblems,
  MAX_ROLE_LEN,
  roleKey,
  type Role,
  type SceneFields,
  type SceneWriteOp,
} from '@openflow/core/roles.ts';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.ts';
import { SwatchGrid } from './SwatchGrid.tsx';
import { ControlButton } from './Control.tsx';

interface Props {
  defaultArtist: string;
  vocabulary: Role[];
  palette: number[];
  /** Roles actually tagged on a scene right now, by `roleKey`. */
  inUse: ReadonlySet<string>;
  derivation: Derivation;
  scenes: SceneFields[];
  /** Whether renaming a song also writes `Scene.tempo` on its first scene. */
  writeSceneTempo: boolean;
  busy: boolean;
  onSave: (
    defaultArtist: string,
    roles: Role[],
    fill: SceneWriteOp[],
    writeSceneTempo: boolean,
  ) => void;
  onClose: () => void;
}

const count = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

function FillSummary({ plan }: { plan: DefaultArtistPlan }) {
  if (plan.artist === '') {
    return <div className="hint">Leave blank when this set does not have a usual artist.</div>;
  }
  if (plan.ops.length === 0 && plan.conflicts.length === 0) {
    return <div className="hint">No blank mapped songs to fill.</div>;
  }
  return (
    <div className="hint set-config-fill-summary">
      {plan.ops.length > 0 && (
        <span>
          Can fill {count(plan.ops.length, 'blank scene')} across{' '}
          {count(plan.songs.length, 'song')}.
        </span>
      )}
      {plan.conflicts.length > 0 && (
        <span className="bad">
          {count(plan.conflicts.length, 'partly named song')} already{' '}
          {plan.conflicts.length === 1 ? 'uses' : 'use'} another artist and will be left
          alone:{' '}
          {plan.conflicts.map((conflict) => conflict.song).join(', ')}.
        </span>
      )}
    </div>
  );
}

/** Set-owned naming defaults and role definitions, stored in the Live Set. */
export function SetConfigModal({
  defaultArtist,
  vocabulary,
  palette,
  inUse,
  derivation,
  scenes,
  writeSceneTempo,
  busy,
  onSave,
  onClose,
}: Props) {
  const [artistDraft, setArtistDraft] = useState(defaultArtist);
  const [tempoDraft, setTempoDraft] = useState(writeSceneTempo);
  const [roleDraft, setRoleDraft] = useState<Role[]>(() =>
    vocabulary.map((role) => ({ ...role })),
  );
  /** Row whose color is being picked, or null when the palette is closed. */
  const [picking, setPicking] = useState<number | null>(null);

  useCloseOnEscape(onClose);

  const problems = useMemo(() => findRoleProblems(roleDraft), [roleDraft]);
  const fillPlan = useMemo(
    () => planDefaultArtist(derivation, scenes, artistDraft),
    [artistDraft, derivation, scenes],
  );

  const editRole = (i: number, patch: Partial<Role>) =>
    setRoleDraft((before) =>
      before.map((role, j) => (j === i ? { ...role, ...patch } : role)),
    );

  const save = (fill: boolean) => {
    const roles = roleDraft.map((role) => ({ ...role, name: role.name.trim() }));
    onSave(artistDraft.trim(), roles, fill ? fillPlan.ops : [], tempoDraft);
  };

  return (
    <div className="viewport-overlay modal-back" onClick={onClose}>
      <div
        className="modal set-config-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-config-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h" id="set-config-title">
          Set configuration
        </div>
        <div className="hint">
          Saved with this Live Set. Defaults pre-fill future naming; nothing here changes
          an existing scene until you apply it.
        </div>

        <section className="set-config-section">
          <div className="lbl">Naming defaults</div>
          <label className="set-config-field">
            <span>Default artist</span>
            <input
              autoFocus
              type="text"
              value={artistDraft}
              placeholder="The Aviators"
              spellCheck={false}
              onChange={(event) => setArtistDraft(event.currentTarget.value)}
            />
          </label>
          <FillSummary plan={fillPlan} />
        </section>

        {/* Its own section rather than a third naming default, because it is
            not one. Everything above changes what a scene is *called*; this
            decides whether a rename also changes what the set *does*. */}
        <section className="set-config-section">
          <div className="lbl">Song start tempo</div>
          <div className="set-config-toggle">
            <ControlButton
              type="button"
              pressed={tempoDraft}
              onClick={() => setTempoDraft((on) => !on)}
            >
              {tempoDraft ? 'On' : 'Off'}
            </ControlButton>
            <span>Renaming a song writes its bpm to the first scene</span>
          </div>
          <div className="hint">
            A bpm in a scene name is a label and changes nothing on its own. With this on,
            renaming a song also sets <span className="preview">Scene.tempo</span> on the
            scene it starts at, and clears it from the rest — so entering the song from the
            top takes the set to that tempo, and firing a scene part-way through leaves the
            tempo where it is. Off, <b>Apply tempo to song start</b> in the scene panel is
            the only thing that writes it.
          </div>
        </section>

        <section className="set-config-section">
          <div className="lbl">Roles</div>
          <div className="hint">
            A role is stored at the front of the scene name as{' '}
            <span className="preview">[ROLE]</span>. Its color is what <b>Color clips</b>{' '}
            writes.
          </div>

          <div className="role-rows">
            {roleDraft.map((role, i) => {
              const used = inUse.has(roleKey(role.name));
              return (
                <div key={i} className={`role-row${problems.has(i) ? ' bad' : ''}`}>
                  <ControlButton
                    type="button"
                    className={`sw role-sw${role.colorIndex < 0 ? ' empty' : ''}`}
                    style={
                      role.colorIndex >= 0 && palette[role.colorIndex] !== undefined
                        ? { background: hex(palette[role.colorIndex]!) }
                        : undefined
                    }
                    title={role.colorIndex < 0 ? 'No color — click to pick' : 'Change color'}
                    onClick={() => setPicking(picking === i ? null : i)}
                  />
                  <input
                    type="text"
                    value={role.name}
                    maxLength={MAX_ROLE_LEN}
                    spellCheck={false}
                    placeholder="role name"
                    onChange={(event) => editRole(i, { name: event.currentTarget.value })}
                  />
                  <span
                    className={`used${used ? '' : ' off'}`}
                    title="Tagged on a scene in this set"
                  >
                    {used ? 'in set' : ''}
                  </span>
                  <ControlButton
                    type="button"
                    className="x"
                    title={
                      used
                        ? 'Forget this role and its color. Scenes keep their tag, so it ' +
                          'will reappear here without a color.'
                        : 'Remove this role'
                    }
                    onClick={() => {
                      setPicking(null);
                      setRoleDraft((before) => before.filter((_, j) => j !== i));
                    }}
                  >
                    ×
                  </ControlButton>
                </div>
              );
            })}
          </div>

          {picking !== null && (
            <>
              <div className="lbl">Color for {roleDraft[picking]?.name || 'this role'}</div>
              {palette.length === 0 ? (
                <div className="hint">Built-in palette unavailable — rebuild the app.</div>
              ) : (
                <SwatchGrid
                  palette={palette}
                  current={roleDraft[picking]?.colorIndex ?? null}
                  onPick={(colorIndex) => {
                    editRole(picking, { colorIndex });
                    setPicking(null);
                  }}
                />
              )}
            </>
          )}

          <div>
            <ControlButton
              type="button"
              onClick={() => {
                setRoleDraft((before) => [...before, { name: '', colorIndex: -1 }]);
                setPicking(null);
              }}
            >
              Add role
            </ControlButton>
          </div>
          <div className="hint">
            Deleting a role only forgets its color. Scenes keep their tag, so a role still
            in the set comes back here uncolored.
          </div>
        </section>

        <div className="modal-actions">
          <div className="spacer" />
          <ControlButton onClick={onClose}>Cancel</ControlButton>
          <ControlButton
            intent={fillPlan.ops.length === 0 ? 'primary' : undefined}
            disabled={busy || problems.size > 0}
            title={
              problems.size > 0
                ? 'Fix the highlighted role names first — blank, duplicate or illegal'
                : undefined
            }
            onClick={() => save(false)}
          >
            Save
          </ControlButton>
          {fillPlan.ops.length > 0 && (
            <ControlButton
              intent="primary"
              disabled={busy || problems.size > 0}
              onClick={() => save(true)}
            >
              Save &amp; fill {count(fillPlan.songs.length, 'song')}
            </ControlButton>
          )}
        </div>
      </div>
    </div>
  );
}
