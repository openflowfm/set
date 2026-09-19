import { useCallback, useMemo, useState } from 'react';
import { colorOps } from '@openflow/core/ops.ts';
import {
  findRole,
  roleIn,
  roleOps,
  sharedRole,
  type Role,
  type SceneFields,
} from '@openflow/core/roles.ts';
import type { PopupBox } from '@openflow/widgets/chrome/Popup.tsx';
import type { BridgeState } from './useBridge.ts';

interface Args {
  /** The selected scenes, ascending — see useGridSelection. */
  sceneList: number[];
  selectedScenes: ReadonlySet<number>;
  sceneNames: Map<number, string>;
  scenesForOps: SceneFields[];
  clipsByScene: Map<number, OpenFlow.Clip[]>;
  vocabulary: Role[];
  apply: BridgeState['apply'];
  applyScenes: BridgeState['applyScenes'];
}

/**
 * Writing roles onto scenes, and role colors onto their clips — from the rail's
 * chips and from the floating role menu alike.
 *
 * Roles color *clips*, never scene rows. Painting a scene its role's color
 * would stripe a song into as many colors as it has sections, which is the one
 * thing the song band can't survive — see useSongColor.
 */
export function useRoleAssignment({
  sceneList,
  selectedScenes,
  sceneNames,
  scenesForOps,
  clipsByScene,
  vocabulary,
  apply,
  applyScenes,
}: Args) {
  /** The role the selection shares, and whether the selected scenes disagree. */
  const { currentRole, mixed } = useMemo(
    () => sharedRole(sceneList, sceneNames),
    [sceneList, sceneNames],
  );

  /** Selected scenes paired with the palette slot their role calls for. */
  const roleColorTargets = useMemo(() => {
    const byColor = new Map<number, number[]>();
    for (const s of sceneList) {
      const role = roleIn(sceneNames.get(s) ?? '');
      if (role === null) continue;
      const entry = findRole(vocabulary, role);
      if (!entry || entry.colorIndex < 0) continue;
      const list = byColor.get(entry.colorIndex);
      if (list) list.push(s);
      else byColor.set(entry.colorIndex, [s]);
    }
    return byColor;
  }, [sceneList, sceneNames, vocabulary]);

  // Each scene's clips take *that scene's* role color, so one press works over
  // a selection spanning several roles. Passing the scene's own clips as the
  // "before" is what keeps this linear — colorOps needs the previous color, and
  // the clips in hand already carry it.
  const roleClipOps = useMemo<OpenFlow.ApplyOp[]>(() => {
    const out: OpenFlow.ApplyOp[] = [];
    for (const [colorIndex, scenes] of roleColorTargets) {
      for (const s of scenes) {
        const cells = clipsByScene.get(s) ?? [];
        out.push(...colorOps(cells, cells, colorIndex));
      }
    }
    return out;
  }, [clipsByScene, roleColorTargets]);

  const assignRoleTo = useCallback(
    (scenes: readonly number[], role: string | null) => {
      const ops = roleOps(scenesForOps, scenes, role);
      void applyScenes(ops, role === null ? 'clear role' : `role ${role}`);
    },
    [applyScenes, scenesForOps],
  );

  const onAssignRole = useCallback(
    (role: string | null) => assignRoleTo(sceneList, role),
    [assignRoleTo, sceneList],
  );

  /**
   * The role picker hanging off a scene's chip in the grid.
   *
   * Holds the scene that was clicked and where its chip is, and nothing else:
   * which scenes the pick writes to is worked out at render from the selection
   * as it stands, and `onRoleMenu` stays identity-stable so opening the menu
   * doesn't re-render all 848 memoized rows.
   */
  const [roleMenu, setRoleMenu] = useState<{ s: number; anchor: PopupBox } | null>(null);
  const onRoleMenu = useCallback((s: number, anchor: PopupBox) => {
    setRoleMenu({ s, anchor });
  }, []);
  const closeRoleMenu = useCallback(() => setRoleMenu(null), []);

  /**
   * Scenes a pick in that menu writes.
   *
   * The chip you pressed, unless it belongs to a scene selection you already
   * made — then it's the whole selection, because that's the pass you're in the
   * middle of. Either way the menu says the count out loud, so the scope is
   * never inferred from the chip alone.
   */
  const roleMenuScenes = useMemo(() => {
    if (!roleMenu) return [];
    return selectedScenes.has(roleMenu.s) ? sceneList : [roleMenu.s];
  }, [roleMenu, sceneList, selectedScenes]);

  const roleMenuRole = useMemo(
    () => sharedRole(roleMenuScenes, sceneNames),
    [roleMenuScenes, sceneNames],
  );

  const onColorClips = useCallback(
    () => void apply(roleClipOps, 'role color'),
    [apply, roleClipOps],
  );

  return {
    currentRole,
    mixed,
    clipCount: roleClipOps.length,
    assignRoleTo,
    onAssignRole,
    onColorClips,
    roleMenu,
    onRoleMenu,
    closeRoleMenu,
    roleMenuScenes,
    roleMenuRole,
  };
}
