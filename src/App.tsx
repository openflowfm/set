import { useCallback, useRef, useState } from 'react';
import './App.css';
import { ClipGrid } from './components/ClipGrid/ClipGrid.tsx';
import { DeviceChain } from './components/DeviceChain.tsx';
import { Header } from './components/Header.tsx';
import { IconSync } from './components/Icon.tsx';
import { Inspector } from './components/Inspector.tsx';
import { NewSongModal } from './components/NewSongModal.tsx';
import { Rail } from './components/Rail.tsx';
import { RecolorModal } from './components/RecolorModal.tsx';
import { ReorderModal } from './components/ReorderModal.tsx';
import { RoleMenu } from './components/RoleMenu.tsx';
import { SetConfigModal } from './components/SetConfigModal.tsx';
import { ScenePanel } from './components/ScenePanel.tsx';
import { SongIndex } from './components/SongIndex.tsx';
import { SongsModal } from './components/SongsModal.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { SyncModal } from './components/SyncModal.tsx';
import { useBridgeSession } from './hooks/useBridgeSession.ts';
import { useSnapshotLookups } from './hooks/useSnapshotLookups.ts';
import { useTrackColumns } from './hooks/useTrackColumns.ts';
import { useSongLayout } from './hooks/useSongLayout.ts';
import { useRailAndLog } from './hooks/useRailAndLog.ts';
import { useGridSelection } from './hooks/useGridSelection.ts';
import { useGridKeyboard } from './hooks/useGridKeyboard.ts';
import { useSceneDrag } from './hooks/useSceneDrag.ts';
import { clipsFromKeys, useClipDrag } from './hooks/useClipDrag.ts';
import { clipKey } from './lib/selection.ts';
import { useSceneTitles } from './hooks/useSceneTitles.ts';
import { useSongColor } from './hooks/useSongColor.ts';
import { useColorRules } from './hooks/useColorRules.ts';
import { useVocabulary } from './hooks/useVocabulary.ts';
import { useRoleAssignment } from './hooks/useRoleAssignment.ts';
import { useClipInspector } from './hooks/useClipInspector.ts';
import { useDeviceChain } from './hooks/useDeviceChain.ts';
import {
  loadColumnWidth,
  saveColumnWidth,
  type ColumnWidth,
} from './lib/columnWidth.ts';
import { DEFAULT_SCENE_PATTERN } from '@openflow/core/namePattern.ts';
import { songKey as songKeyOf } from '@openflow/core/derive.ts';
import { describeMove } from '@openflow/core/sceneMove.ts';

/**
 * The composition root. Every concern lives in a hook under hooks/; this
 * component calls them in dependency order — lookups and layout first, then
 * selection, then everything that acts on the selection — and wires their
 * outputs into the components. The few `useCallback`s left here are the
 * compositions that genuinely span two hooks.
 */
export function App() {
  const [showIndex, setShowIndex] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  // Everything the bridge holds comes from above this component — see
  // BridgeProvider for why the connection can't live inside the composition
  // root. The mixer visibility flags are up there too because they decide
  // whether Live is streaming meter frames and observing sends at all.
  const bridge = useBridgeSession();
  const { snapshot, model, play, launch, stop, setFold, selectScene, apply, applyScenes, undo } =
    bridge;
  const { showMeters, showSends, toggleMeters, toggleSends } = bridge;
  const onStopAll = useCallback(() => stop({ kind: 'clips' }), [stop]);

  const [columnWidth, setColumnWidth] = useState<ColumnWidth>(loadColumnWidth);
  const chooseColumnWidth = useCallback((w: ColumnWidth) => {
    setColumnWidth(w);
    saveColumnWidth(w);
  }, []);

  const { clips, trackNames, sceneNames, isOccupied, scenesForOps, clipsByScene } =
    useSnapshotLookups(snapshot);
  const { columns, trackColumns, onToggleGroup } = useTrackColumns(snapshot, setFold);
  const {
    derivation,
    headers: songHeaders,
    hiddenScenes,
    rows,
    songShapes,
    collapsedSongs,
    onToggleSong,
    onCollapseAll,
    unfoldSong,
  } = useSongLayout(snapshot, model);

  const { showRail, openRail, hideRail, showLog, toggleLog } = useRailAndLog();

  const {
    selected,
    selectedScenes,
    sceneList,
    active,
    activeRef,
    goActive,
    onClip,
    onScene,
    onFireScene,
    onFireClip,
    onStopTrack,
    clearSelection,
    pickScenes,
  } = useGridSelection({ trackColumns, rows, isOccupied, launch, stop, openRail });

  const selectAllScenes = useCallback(() => {
    onCollapseAll(false);
    pickScenes(snapshot?.scenes.map((scene) => scene.i) ?? []);
  }, [onCollapseAll, pickScenes, snapshot]);

  useGridKeyboard({
    rows,
    trackColumns,
    activeRef,
    goActive,
    isPlaying: play.isPlaying,
    launch,
    stop,
    undo,
    selectAllScenes,
  });

  /**
   * Work on a whole song: select every scene it has, across every block.
   *
   * Unfolds it first. Selecting scenes that are folded away would leave the
   * panel offering to rename eighteen rows you can't see, and a write you can't
   * preview is the one thing the pending-changes idea exists to prevent.
   */
  const onPickSong = useCallback(
    (songKey: string) => {
      const song = derivation.songs.find((s) => songKey === songKeyOf(s.name));
      if (!song) return;
      unfoldSong(songKey);
      pickScenes(song.scenes);
    },
    [derivation, pickScenes, unfoldSong],
  );

  /** Navigate both grids without changing this app's fold state or selection. */
  const jumpToSong = useCallback(
    (firstScene: number) => {
      // Live centers an assigned selected_scene in Session View. Send this even
      // if our own DOM target is momentarily absent; the two views are useful
      // independently and neither should make the other conditional.
      selectScene(firstScene);

      const grid = gridRef.current;
      const target = grid?.querySelector<HTMLElement>(`[data-song-start="${firstScene}"]`);
      if (!grid || !target) return;

      // Move only this scroll box, and only vertically. `scrollIntoView` may
      // also move an ancestor or the horizontal track viewport; an index jump
      // should leave the columns exactly where the performer had them.
      const stickyHeight = grid.querySelector('thead')?.getBoundingClientRect().height ?? 0;
      const top = grid.scrollTop + target.getBoundingClientRect().top;
      grid.scrollTo({
        top: Math.max(0, top - grid.getBoundingClientRect().top - stickyHeight - 4),
        behavior: 'auto',
      });
    },
    [selectScene],
  );

  /**
   * Closing the rail drops the selection with it.
   *
   * The rail is the only place a selection is *shown* as anything but painted
   * cells — what it is, how many, what a write would say. Closing it while
   * ninety scenes stay picked leaves a live target you can't see and can't
   * check, and the next thing you open the rail with is a click that would have
   * replaced the selection anyway. So closing means done, not minimized.
   */
  const closeRail = useCallback(() => {
    hideRail();
    clearSelection();
  }, [clearSelection, hideRail]);

  const {
    dragFrom,
    dragScenes,
    dropAt,
    movePlan,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useSceneDrag(snapshot, clearSelection, bridge.moveScenes);

  /**
   * Grabbing a scene by its number moves that scene — unless it's part of a
   * selection, in which case it moves the lot. Picking several rows and then
   * dragging one of them anywhere else is the gesture every list does, and
   * `planSceneMove` takes a non-contiguous set, so this needs no special case
   * below it.
   *
   * The selection is read through a ref so this callback keeps one identity.
   * It's a prop on 848 memoized rows; rebuilding it whenever the selection
   * changes would re-render all of them for a value only the drag reads.
   */
  const selectedScenesRef = useRef(selectedScenes);
  selectedScenesRef.current = selectedScenes;
  const onSceneDragStart = useCallback(
    (s: number) => {
      const picked = selectedScenesRef.current;
      onDragStart(picked.size > 1 && picked.has(s) ? [...picked] : [s]);
    },
    [onDragStart],
  );

  const {
    lifting,
    landing,
    onDragStart: onClipDragBegin,
    onDragOver: onClipDragOver,
    onDrop: onClipDrop,
    onDragEnd: onClipDragEnd,
  } = useClipDrag(snapshot, clearSelection, bridge.moveClips);

  /**
   * Grabbing a clip drags that clip — unless it's part of a selection, in which
   * case the whole selection travels. The same rule the scene grip follows, and
   * the same reason the selection is read through a ref: this is a prop on 848
   * memoized rows and has to keep one identity.
   */
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onClipDragStart = useCallback(
    (t: number, s: number) => {
      const picked = selectedRef.current;
      const key = clipKey(t, s);
      onClipDragBegin(
        picked.size > 1 && picked.has(key) ? clipsFromKeys(picked) : [{ t, s }],
        { t, s },
      );
    },
    [onClipDragBegin],
  );

  const {
    titlePatch,
    setTitlePatch,
    commonFields,
    sceneNameOps,
    titlePreview,
    onRenameScenes,
    songCount,
    clearingTempo,
    songTempoWriteOps,
    onApplySongTempo,
  } = useSceneTitles({
    derivation,
    sceneList,
    scenesForOps,
    sceneNames,
    defaultArtist: bridge.defaultArtist,
    writeSceneTempo: bridge.writeSceneTempo,
    applyScenes,
  });

  const { songColorCount, songColorLabel, songColorIndex, onSongColor } = useSongColor({
    derivation,
    sceneList,
    snapshot,
    palette: bridge.palette,
    scenesForOps,
    applyScenes,
  });

  // The bulk counterpart to useSongColor: a rule over every song rather than a
  // swatch over the selection.
  const {
    allowed: allowedColors,
    setAllowed: setAllowedColors,
    songs: songColorInputs,
    recolorSongs,
  } = useColorRules({
    derivation,
    palette: bridge.palette,
    storedColors: bridge.allowedColors,
    setStoredColors: bridge.setAllowedColors,
    scenesForOps,
    applyScenes,
  });

  const { vocabulary, inUseKeys, roleColors } = useVocabulary({
    roles: bridge.roles,
    snapshot,
    palette: bridge.palette,
  });

  const {
    currentRole,
    mixed,
    clipCount,
    assignRoleTo,
    onAssignRole,
    onColorClips,
    roleMenu,
    onRoleMenu,
    closeRoleMenu,
    roleMenuScenes,
    roleMenuRole,
  } = useRoleAssignment({
    sceneList,
    selectedScenes,
    sceneNames,
    scenesForOps,
    clipsByScene,
    vocabulary,
    apply,
    applyScenes,
  });

  const { chosenIndex, pattern, setPattern, onColor, renameCount, onRename, preview } =
    useClipInspector({ selected, clips, trackNames, sceneNames, snapshot, apply });

  // Clicking a track header opens this track's chain along the bottom, and
  // selects the same track in Live so its own device view agrees with ours.
  const deviceChain = useDeviceChain({
    lomReady: bridge.lomReady,
    selectTrack: bridge.selectTrack,
    watchChains: bridge.watchChains,
    subscribeChains: bridge.subscribeChains,
    subscribeChainValues: bridge.subscribeChainValues,
    setDevice: bridge.setDevice,
  });

  // Set configuration is owned here rather than by any one opener: the header,
  // rail and grid role menu all reach it, and the rail can be shut while it is up.
  const [configOpen, setConfigOpen] = useState(false);
  const [showSongs, setShowSongs] = useState(false);
  // Song workflows opened from the scene column's header. Owned here with the
  // other modals: they act on set structure rather than only on a selection.
  const [addingSong, setAddingSong] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [recoloring, setRecoloring] = useState(false);

  return (
    <>
      <Header
        lomReady={bridge.lomReady}
        busy={bridge.busy}
        isPlaying={play.isPlaying}
        songPosition={bridge.songPosition}
        transport={bridge.transport}
        onTransport={bridge.setTransport}
        showIndex={showIndex}
        onToggleIndex={() => setShowIndex((shown) => !shown)}
        songCount={derivation.songs.length}
        collapsedCount={collapsedSongs.size}
        onCollapseAll={onCollapseAll}
        launch={launch}
        stop={stop}
        onSetConfig={() => setConfigOpen(true)}
        onSnapshot={bridge.refresh}
      />

      <main>
        {showIndex && (
          <SongIndex
            derivation={derivation}
            palette={bridge.palette}
            onJump={jumpToSong}
            onClose={() => setShowIndex(false)}
          />
        )}
        <div ref={gridRef} className="grid-wrap">
          {snapshot ? (
            <ClipGrid
              snapshot={snapshot}
              columns={columns}
              clips={clips}
              selected={selected}
              active={active}
              play={play}
              canControlLive={bridge.lomReady}
              showMeters={showMeters}
              onToggleMeters={toggleMeters}
              showSends={showSends}
              onToggleSends={toggleSends}
              subscribeMeters={bridge.subscribeMeters}
              subscribeMixer={bridge.subscribeMixer}
              subscribeClipStatus={bridge.subscribeClipStatus}
              setMixer={bridge.setMixer}
              tempo={bridge.transport?.tempo}
              columnWidth={columnWidth}
              onColumnWidth={chooseColumnWidth}
              palette={bridge.palette}
              roleColors={roleColors}
              selectedScenes={selectedScenes}
              songHeaders={songHeaders}
              hiddenScenes={hiddenScenes}
              songShapes={songShapes}
              onToggleSong={onToggleSong}
              onPickSong={onPickSong}
              songCount={derivation.songs.length}
              onAddSong={() => setAddingSong(true)}
              onReorder={() => setReordering(true)}
              onRecolor={() => setRecoloring(true)}
              dragFrom={dragFrom}
              dragScenes={dragScenes}
              // -1 rather than null so the prop stays a number all the way down
              // to the memoized header row.
              dropAt={movePlan ? (dropAt ?? -1) : -1}
              dropNote={movePlan ? describeMove(movePlan) : ''}
              onSongDragStart={onDragStart}
              onSongDragOver={onDragOver}
              onSongDrop={onDrop}
              onSongDragEnd={onDragEnd}
              onSceneDragStart={onSceneDragStart}
              onSceneDragOver={onDragOver}
              onSceneDrop={onDrop}
              onSceneDragEnd={onDragEnd}
              lifting={lifting}
              landing={landing}
              onClipDragStart={onClipDragStart}
              onClipDragOver={onClipDragOver}
              onClipDrop={onClipDrop}
              onClipDragEnd={onClipDragEnd}
              onClip={onClip}
              onScene={onScene}
              onFireScene={onFireScene}
              onFireClip={onFireClip}
              onRoleMenu={onRoleMenu}
              onStopTrack={onStopTrack}
              onStopAll={onStopAll}
              onToggleGroup={onToggleGroup}
              selectedTrack={deviceChain.track ?? -1}
              onSelectTrack={deviceChain.onSelectTrack}
            />
          ) : (
            <div className="empty-state">
              {/* The glyph rather than the word: the button stopped saying
                  "Snapshot" when it became an icon, and pointing at a label
                  that isn't there is worse than no instruction. */}
              Load the device in Live, then hit{' '}
              <b className="inline-glyph">
                <IconSync />
              </b>{' '}
              in the header.
            </div>
          )}
        </div>

        {/* Song and scene metadata first, then every action that writes clips.
            That keeps the rail's two facets readable even when both selections
            are live at once. */}
        {showRail && (
          <Rail onClose={closeRail}>
            <ScenePanel
              vocabulary={vocabulary}
              palette={bridge.palette}
              defaultArtist={bridge.defaultArtist}
              sceneCount={selectedScenes.size}
              common={commonFields}
              patch={titlePatch}
              onPatch={setTitlePatch}
              titleCount={sceneNameOps.length}
              titlePreview={selectedScenes.size === 0 ? null : titlePreview}
              onRenameScenes={onRenameScenes}
              songCount={songCount}
              clearingTempo={clearingTempo}
              tempoCount={songTempoWriteOps.length}
              writeSceneTempo={bridge.writeSceneTempo}
              onApplySongTempo={onApplySongTempo}
              songColorIndex={songColorIndex}
              songColorCount={songColorCount}
              songColorLabel={songColorLabel}
              onSongColor={onSongColor}
              currentRole={currentRole}
              mixed={mixed}
              busy={bridge.busy}
              onAssign={onAssignRole}
              onManageRoles={() => setConfigOpen(true)}
            />

            <div className="rule" />

            <Inspector
              palette={bridge.palette}
              chosenIndex={chosenIndex}
              onColor={onColor}
              pattern={pattern}
              onPattern={setPattern}
              selectedCount={selected.size}
              roleColorCount={clipCount}
              renameCount={renameCount}
              preview={preview}
              busy={bridge.busy}
              progress={bridge.progress}
              undoDepth={bridge.undoDepth}
              onRename={onRename}
              onColorClips={onColorClips}
              onUndo={() => void bridge.undo()}
              onClear={clearSelection}
            />
          </Rail>
        )}
      </main>

      {/* Below `main` rather than inside it, so the chain spans the window the
          way Live's device view does — under the rail as well as the grid,
          rather than being one more column in the row. */}
      {deviceChain.track !== null && (
        <DeviceChain
          t={deviceChain.track}
          name={trackNames.get(deviceChain.track) ?? `Track ${deviceChain.track + 1}`}
          devices={deviceChain.devices}
          loading={deviceChain.loading}
          failed={deviceChain.failed}
          runAt={deviceChain.runAt}
          chainAt={deviceChain.chainAt}
          onChain={deviceChain.onChain}
          store={deviceChain.store}
          onDevice={deviceChain.onDevice}
          onClose={deviceChain.onClose}
        />
      )}

      {/* Outside `main` with the modals: it's anchored to the viewport, and a
          menu clipped by the grid's own scroll box would be cut off on the
          bottom rows — the ones a set spends most of its time near. */}
      {roleMenu && (
        <RoleMenu
          vocabulary={vocabulary}
          palette={bridge.palette}
          anchor={roleMenu.anchor}
          count={roleMenuScenes.length}
          current={roleMenuRole.currentRole}
          mixed={roleMenuRole.mixed}
          busy={bridge.busy}
          onPick={(role) => {
            assignRoleTo(roleMenuScenes, role);
            closeRoleMenu();
          }}
          onManage={() => {
            closeRoleMenu();
            setConfigOpen(true);
          }}
          onClose={closeRoleMenu}
        />
      )}

      {configOpen && (
        <SetConfigModal
          defaultArtist={bridge.defaultArtist}
          vocabulary={vocabulary}
          palette={bridge.palette}
          inUse={inUseKeys}
          derivation={derivation}
          scenes={scenesForOps}
          writeSceneTempo={bridge.writeSceneTempo}
          busy={bridge.busy}
          onSave={(defaultArtist, roles, fill, writeSceneTempo) => {
            void (async () => {
              await bridge.saveSetConfig(defaultArtist, roles, writeSceneTempo);
              if (fill.length > 0) await bridge.applyScenes(fill, 'fill missing artists');
            })();
            setConfigOpen(false);
          }}
          onClose={() => setConfigOpen(false)}
        />
      )}

      {showSongs && snapshot && (
        <SongsModal
          derivation={derivation}
          pattern={DEFAULT_SCENE_PATTERN}
          // Picking closes the modal — the point of the pick is to look at the
          // rows it just selected, and the modal is what's covering them.
          onPick={(scenes) => {
            pickScenes(scenes);
            setShowSongs(false);
          }}
          onPickUnmapped={() => {
            pickScenes(derivation.unmapped);
            setShowSongs(false);
          }}
          collapsedCount={collapsedSongs.size}
          onCollapseAll={onCollapseAll}
          onClose={() => setShowSongs(false)}
        />
      )}

      {addingSong && snapshot && (
        <NewSongModal
          derivation={derivation}
          sceneCount={snapshot.sceneCount}
          palette={bridge.palette}
          defaultArtist={bridge.defaultArtist}
          busy={bridge.busy}
          onAdd={(addition) => {
            setAddingSong(false);
            // Insertion renumbers every selected address at or below it.
            clearSelection();
            void bridge.addScenes(addition, `add song ${addition.name}`);
          }}
          onClose={() => setAddingSong(false)}
        />
      )}

      {reordering && snapshot && (
        <ReorderModal
          derivation={derivation}
          snapshot={snapshot}
          palette={bridge.palette}
          busy={bridge.busy}
          // Closes on apply: every scene index is about to mean a different
          // row, so a list still showing the old ones is worse than no list.
          // The selection goes for the same reason a drop clears it.
          onApply={(plan) => {
            setReordering(false);
            clearSelection();
            void bridge.moveScenes(plan, `reorder ${plan.scenes} scenes`);
          }}
          onClose={() => setReordering(false)}
        />
      )}

      {recoloring && snapshot && (
        <RecolorModal
          derivation={derivation}
          snapshot={snapshot}
          palette={bridge.palette}
          songs={songColorInputs}
          allowed={allowedColors}
          onAllowed={setAllowedColors}
          busy={bridge.busy}
          // Stays open, unlike the reorder: this one is undoable, the scene
          // indexes still mean what they meant, and trying a second rule
          // against what the first did is the point of having four.
          onApply={recolorSongs}
          onClose={() => setRecoloring(false)}
        />
      )}

      {showLog && (
        <footer>
          {bridge.log.map((l) => (
            <div key={l.id} className={`log-line ${l.kind}`}>
              {l.text}
            </div>
          ))}
        </footer>
      )}

      {/* Last, so the counts are the strip along the bottom edge and the log
          opens as a panel above them rather than shunting them off-screen.
          The readiness state and counts are glanceable here without making a
          band across the top cost a scene row on every set. */}
      <StatsBar
        connection={bridge.connection}
        lomReady={bridge.lomReady}
        snapshot={snapshot}
        songCount={derivation.songs.length}
        unmappedCount={derivation.unmapped.length}
        selectedCount={selected.size}
        showLog={showLog}
        onToggleLog={toggleLog}
        onOpenSongs={() => setShowSongs(true)}
      />

      {bridge.syncing && <SyncModal progress={bridge.progress} />}
    </>
  );
}
