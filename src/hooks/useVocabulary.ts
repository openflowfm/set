import { useMemo } from 'react';
import { mergeVocabulary, roleKey, rolesInUse } from '@openflow/core/roles.ts';

/**
 * The role vocabulary as the UI shows it, and the colors it paints.
 *
 * Roles are stored in the scene's own name as `[role]` — see core/src/roles.ts
 * for why the set is the storage and why the tag is bracketed. Everything here
 * is pure derivation over the snapshot, the configured roles and the palette.
 */
export function useVocabulary({
  roles,
  snapshot,
  palette,
}: {
  /** The configured vocabulary restored from the bridge device state. */
  roles: OpenFlow.Role[];
  snapshot: OpenFlow.Snapshot | null;
  palette: number[];
}) {
  /** Roles actually tagged somewhere in the set, in order of first appearance. */
  const inUseRoles = useMemo(
    () => rolesInUse(snapshot?.scenes.map((sc) => sc.name) ?? []),
    [snapshot],
  );
  const inUseKeys = useMemo(() => new Set(inUseRoles.map(roleKey)), [inUseRoles]);

  // Configured roles plus anything tagged in the set but never configured. A
  // vocabulary that only listed what someone remembered to configure would hide
  // a role typed straight into Live and then fail to color it for no visible
  // reason.
  const vocabulary = useMemo(
    () => mergeVocabulary(roles, inUseRoles),
    [roles, inUseRoles],
  );

  /**
   * roleKey → the RGB its chip is painted. Memoized because it reaches the
   * memoized `Row`: a fresh Map every render would re-render all 848 scenes.
   * It changes only when the vocabulary or the palette does, which is rare.
   */
  const roleColors = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of vocabulary) {
      const rgb = r.colorIndex >= 0 ? palette[r.colorIndex] : undefined;
      if (rgb !== undefined) m.set(roleKey(r.name), rgb);
    }
    return m;
  }, [palette, vocabulary]);

  return { vocabulary, inUseKeys, roleColors };
}
