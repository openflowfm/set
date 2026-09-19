import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergeSceneOps, songTempoOps, type SceneFields } from '@openflow/core/roles.ts';
import {
  MIN_TEMPO,
  songsOfScenes,
  type Derivation,
  type DerivedSong,
} from '@openflow/core/derive.ts';
import {
  commonTitle,
  titleOf,
  titleOps,
  type TitlePatch,
} from '@openflow/core/sceneTitle.ts';
import type { BridgeState } from './useBridge.ts';

interface Args {
  derivation: Derivation;
  /** The selected scenes, ascending — see useGridSelection. */
  sceneList: number[];
  scenesForOps: SceneFields[];
  sceneNames: Map<number, string>;
  /** Set-wide seed offered only when every selected scene has a blank artist. */
  defaultArtist: string;
  /**
   * The set has opted into a rename also projecting the bpm onto Live — see
   * `DeviceState.writeSceneTempo`. Off, renaming only renames.
   */
  writeSceneTempo: boolean;
  applyScenes: BridgeState['applyScenes'];
}

/**
 * The bpm to project onto a song, when the panel's own field doesn't say.
 *
 * The song's own name, when its scenes agree on one — the name is the record.
 * Failing that, whatever its first scene already carries, which makes the
 * projection a no-op there and leaves the action doing only the useful half:
 * clearing the strays. It never invents a value for a song whose scenes
 * disagree, because picking one of two would be the drift the grid reports
 * rather than resolves.
 */
function statedBpm(song: DerivedSong): number | null {
  const named = song.observed.bpm.length === 1 ? Number(song.observed.bpm[0]) : NaN;
  return Number.isFinite(named) ? named : song.firstSceneTempo;
}

/**
 * Editing the selected scenes' names — `@{bpm}-{key} {SONG} - {ARTIST}`,
 * everything after the role tag — and projecting a song's bpm onto Live.
 *
 * **The name is the record and the rename writes all five fields.** Projecting
 * the bpm onto `Scene.tempo` is a second, separate action, because that one
 * changes how the set plays: Live takes a scene's tempo the moment it fires.
 */
export function useSceneTitles({
  derivation,
  sceneList,
  scenesForOps,
  sceneNames,
  defaultArtist,
  writeSceneTempo,
  applyScenes,
}: Args) {
  /** Which title fields have been edited — see TitlePatch in core. */
  const [titlePatch, setTitlePatch] = useState<TitlePatch>({});

  // Reset the edits when the selection changes, or a song name typed for one
  // song would sit in the field waiting to be applied to the next one.
  const selectionKey = sceneList.join(',');
  useEffect(() => {
    setTitlePatch({});
  }, [selectionKey]);

  const selectedTitles = useMemo(
    () => sceneList.map((s) => titleOf(sceneNames.get(s) ?? '')),
    [sceneList, sceneNames],
  );

  /** What the selection's *names* agree on, field by field. */
  const namedFields = useMemo(() => commonTitle(selectedTitles), [selectedTitles]);

  /**
   * What the fields prefill from.
   *
   * Every part comes from the name, which is the durable record. BPM falls back
   * to `Scene.tempo` per scene, and only per scene: a set written the
   * every-scene way states its tempo there and nowhere else, and the field is
   * how that gets moved into the name.
   */
  const commonFields = useMemo(() => {
    if (sceneList.length === 0) return namedFields;
    const scenes = new Map(scenesForOps.map((scene) => [scene.s, scene]));
    const bpms = sceneList.map((s, i) => {
      const named = selectedTitles[i]?.bpm ?? '';
      if (named !== '') return named;
      const tempo = scenes.get(s)?.tempo ?? -1;
      return tempo >= MIN_TEMPO ? String(tempo) : '';
    });
    const bpm = bpms.every((value) => value === bpms[0]) ? bpms[0]! : null;
    return { ...namedFields, bpm };
  }, [namedFields, sceneList, scenesForOps, selectedTitles]);

  // Two pending suggestions, never implicit writes, and both the same shape: a
  // value the panel offers that an explicit edit always overrides.
  //
  // - A default artist, for a selection that uniformly has none.
  // - A bpm that only exists on `Scene.tempo`, for a set still written the
  //   every-scene way. Renaming is what moves it into the name, so the field
  //   showing 128 while the rename dropped it would be a lie about the button.
  const pendingPatch = useMemo<TitlePatch>(() => {
    let out = titlePatch;
    const artist = defaultArtist.trim();
    if (out.artist === undefined && commonFields.artist === '' && artist !== '') {
      out = { ...out, artist };
    }
    if (out.bpm === undefined && namedFields.bpm === '' && (commonFields.bpm ?? '') !== '') {
      out = { ...out, bpm: commonFields.bpm! };
    }
    return out;
  }, [commonFields.artist, commonFields.bpm, defaultArtist, namedFields.bpm, titlePatch]);

  const sceneNameOps = useMemo(
    () =>
      titleOps(scenesForOps, sceneList, {
        song: pendingPatch.song,
        artist: pendingPatch.artist,
        tag: pendingPatch.tag,
        bpm: pendingPatch.bpm,
        key: pendingPatch.key,
      }),
    [pendingPatch, sceneList, scenesForOps],
  );

  /** The first selected scene as it would read after the pending edit. */
  const titlePreview = useMemo(() => {
    const first = sceneList[0];
    if (first === undefined) return null;
    // titleOps drops scenes it wouldn't change, so fall back to the current
    // name — a preview that goes blank when the edit is a no-op reads as if
    // the rename would blank the scene.
    return sceneNameOps.find((op) => op.s === first)?.name ?? sceneNames.get(first) ?? '';
  }, [sceneList, sceneNameOps, sceneNames]);

  /** The songs the selection touches — the unit the tempo projection works in. */
  const selectedSongs = useMemo(
    () => songsOfScenes(derivation, sceneList),
    [derivation, sceneList],
  );

  /**
   * Putting each selected song's bpm on the one scene Live should act on.
   *
   * Song-scoped rather than selection-scoped, exactly like the color swatch:
   * touching any scene of Nightfall projects onto Nightfall's first scene and
   * clears the tempo off the rest of it, reprise included.
   */
  const songTempoWriteOps = useMemo(() => {
    const edited = pendingPatch.bpm?.trim();
    return selectedSongs.flatMap((song) => {
      const wanted =
        edited === undefined ? statedBpm(song) : edited === '' ? null : Number(edited);
      return songTempoOps(
        scenesForOps,
        song,
        wanted === null || !Number.isFinite(wanted) ? null : wanted,
      );
    });
  }, [pendingPatch.bpm, scenesForOps, selectedSongs]);

  const onApplySongTempo = useCallback(
    () => void applyScenes(songTempoWriteOps, 'song start tempo'),
    [applyScenes, songTempoWriteOps],
  );

  /**
   * What Rename writes — the names, plus the tempo projection when the set has
   * asked for it.
   *
   * One batch rather than two calls, so it is one Live undo step and one
   * `applied === total` check: the song's first scene is usually in both lists,
   * and writing it twice would undo in halves. Off — the default — this is the
   * name ops and nothing else, and renaming cannot change what the set does.
   */
  const renameOps = useMemo(
    () =>
      writeSceneTempo ? mergeSceneOps(sceneNameOps, songTempoWriteOps) : sceneNameOps,
    [sceneNameOps, songTempoWriteOps, writeSceneTempo],
  );

  // The label says when the write did the second thing, because that one is the
  // one you'd want to find in the log after a set changed tempo unexpectedly.
  const onRenameScenes = useCallback(
    () =>
      void applyScenes(
        renameOps,
        writeSceneTempo && songTempoWriteOps.length > 0
          ? 'rename scenes and set song start tempo'
          : 'rename scenes',
      ),
    [applyScenes, renameOps, songTempoWriteOps.length, writeSceneTempo],
  );

  return {
    titlePatch: pendingPatch,
    setTitlePatch,
    commonFields,
    sceneNameOps,
    titlePreview,
    onRenameScenes,
    songCount: selectedSongs.length,
    // Whether that button clears rather than applies. Not "the field looks
    // empty": a field blank because the selection *disagrees* still applies,
    // each song using its own bpm. Only an emptied field means delete.
    clearingTempo: pendingPatch.bpm?.trim() === '',
    songTempoWriteOps,
    onApplySongTempo,
  };
}
