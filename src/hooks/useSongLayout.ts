import { useCallback, useMemo, useState } from 'react';
import { derive } from '@openflow/core/derive.ts';
import { SCENE_PATTERNS } from '@openflow/core/namePattern.ts';
import { allSongKeys, blockTrackRoles, songRows } from '@openflow/core/songRows.ts';

/** Before the first snapshot lands. A constant, so its identity is stable. */
const NO_SONGS: OpenFlow.SetModel = {
  rev: -1,
  songs: [],
  songByScene: {},
  factsByScene: {},
  unmapped: [],
};

/**
 * How the songs lay the grid out: where the headers go, which songs are folded,
 * and what a folded header shows in place of the rows it hides.
 *
 * **The songs come from the bridge**, as a `SetModel` — the mapping is read out
 * of the scene names once, there, for Push and every browser tab at the same
 * time (see `core/docs/setModel.md`). Nothing here compiles a pattern to draw a
 * header.
 *
 * The `derivation` it returns is a different thing and still read here: the
 * **scene** layer — every scene's parsed fields, which is what the scene-level
 * modals work in and what the model deliberately doesn't carry.
 */
export function useSongLayout(snapshot: OpenFlow.Snapshot | null, model: OpenFlow.SetModel | null) {
  const derivation = useMemo(
    () => derive(snapshot?.scenes ?? [], SCENE_PATTERNS),
    [snapshot],
  );

  const songs = model ?? NO_SONGS;

  // Which songs are folded. Keyed by song rather than by scene index, so it
  // survives a re-snapshot — every write re-walks the set, and a collapsed
  // state that reset each time would make the grid unusable during a mapping
  // pass. Like collapsing a track group, this never writes back to Live.
  const [collapsedSongs, setCollapsedSongs] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /**
   * Every scene in the set, in index order.
   *
   * From the snapshot rather than the model, because a scene belonging to no
   * song is still a row: it can be selected, named, and folded into a song by
   * being named. The model answers about songs, and an unnamed scene has none.
   */
  const sceneIndexes = useMemo(
    () => snapshot?.scenes.map((sc) => sc.i) ?? [],
    [snapshot],
  );

  const layout = useMemo(
    () => songRows(songs, sceneIndexes, collapsedSongs),
    [collapsedSongs, sceneIndexes, songs],
  );

  /**
   * Per block, per track, which sections of the song that track plays — what a
   * folded header shows in place of the rows it's hiding.
   *
   * This one stays in the browser rather than riding on the model, and the
   * reason is the boundary the model is drawn along: it reads the *clips*, so
   * folding it into the bridge's answer would make every clip edit anywhere in
   * the set rebuild the whole song list. See `core/docs/setModel.md`.
   *
   * Computed for every block rather than only the folded ones, deliberately.
   * It's a single pass over the clips, and keying it off the songs instead of
   * `collapsedSongs` means folding a song doesn't rebuild the map — which would
   * hand every header a new prop and re-render all hundred of them on a gesture
   * that changed one.
   */
  const songShapes = useMemo(
    () =>
      blockTrackRoles(
        snapshot?.clips ?? [],
        snapshot?.scenes ?? [],
        songs.songs.flatMap((s) => s.blocks),
      ),
    [songs, snapshot],
  );

  /**
   * Visible scene indexes, the row-wise counterpart of `trackColumns`.
   *
   * Everything that moves or selects goes through this rather than through
   * `sceneCount`, so a collapsed song is invisible to the arrow keys and to
   * block selection. Without it ⌘↓ would descend into scenes you can't see and
   * fire them, which is the one thing the ⌘-makes-a-sound rule exists to keep
   * predictable.
   */
  const rows = layout.rows;

  const onToggleSong = useCallback((songKey: string) => {
    setCollapsedSongs((prev) => {
      const next = new Set(prev);
      if (!next.delete(songKey)) next.add(songKey);
      return next;
    });
  }, []);

  const onCollapseAll = useCallback(
    (all: boolean) => setCollapsedSongs(all ? new Set(allSongKeys(songs)) : new Set()),
    [songs],
  );

  /** Open one song, leaving the rest as they are. A no-op keeps the identity. */
  const unfoldSong = useCallback((songKey: string) => {
    setCollapsedSongs((prev) => {
      if (!prev.has(songKey)) return prev;
      const next = new Set(prev);
      next.delete(songKey);
      return next;
    });
  }, []);

  return {
    derivation,
    songs,
    headers: layout.headers,
    hiddenScenes: layout.hidden,
    rows,
    songShapes,
    collapsedSongs,
    onToggleSong,
    onCollapseAll,
    unfoldSong,
  };
}
