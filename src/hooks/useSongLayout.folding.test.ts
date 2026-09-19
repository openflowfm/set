// @vitest-environment happy-dom
//
// Folding is a gesture: the pin is what happens between two renders, which is
// the one thing `test/render.ts` cannot see. The derivation half of this hook
// is next door in useSongLayout.test.ts and stays in `environment: node`.
import { describe, expect, it } from 'vitest';
import { corpusSnapshot } from '../../test/corpus.ts';
import { act, renderHook } from '../../test/hook.ts';
import { useSongLayout } from './useSongLayout.ts';

const recorded = corpusSnapshot();
const set = recorded.data;
const model = recorded.model;

/** The first song in the recorded set: eight scenes, 0 through 7. */
const FIRST = model.songs[0];

const layout = () => renderHook(() => useSongLayout(set, model));

describe('folding one song', () => {
  it('hides its scenes', () => {
    const { result } = layout();
    act(() => result.current.onToggleSong(FIRST.songKey));
    expect([...result.current.hiddenScenes].sort((a, b) => a - b)).toEqual(FIRST.scenes);
  });

  it('takes those rows out of the grid, leaving every other scene', () => {
    const { result } = layout();
    act(() => result.current.onToggleSong(FIRST.songKey));
    expect(result.current.rows).toHaveLength(set.sceneCount - FIRST.scenes.length);
    expect(result.current.rows).not.toContain(FIRST.scenes[0]);
  });

  it('keeps its header row, which is what there is left to click', () => {
    const { result } = layout();
    act(() => result.current.onToggleSong(FIRST.songKey));
    expect(result.current.headers.get(FIRST.scenes[0])?.collapsed).toBe(true);
  });

  it('leaves the other songs open', () => {
    const { result } = layout();
    act(() => result.current.onToggleSong(FIRST.songKey));
    expect(result.current.collapsedSongs.size).toBe(1);
  });

  it('opens it again on a second toggle', () => {
    const { result } = layout();
    act(() => result.current.onToggleSong(FIRST.songKey));
    act(() => result.current.onToggleSong(FIRST.songKey));
    expect(result.current.hiddenScenes.size).toBe(0);
    expect(result.current.rows).toHaveLength(set.sceneCount);
  });
});

describe('collapse all', () => {
  it('folds every song in the set', () => {
    const { result } = layout();
    act(() => result.current.onCollapseAll(true));
    expect(result.current.collapsedSongs.size).toBe(model.songs.length);
  });

  it('opens every song again', () => {
    const { result } = layout();
    act(() => result.current.onCollapseAll(true));
    act(() => result.current.onCollapseAll(false));
    expect(result.current.collapsedSongs.size).toBe(0);
    expect(result.current.rows).toHaveLength(set.sceneCount);
  });
});

describe('unfoldSong', () => {
  it('opens the one song, leaving the rest folded', () => {
    const { result } = layout();
    act(() => result.current.onCollapseAll(true));
    act(() => result.current.unfoldSong(FIRST.songKey));
    expect(result.current.collapsedSongs.has(FIRST.songKey)).toBe(false);
    expect(result.current.collapsedSongs.size).toBe(model.songs.length - 1);
  });

  /**
   * Identity, not equality. `collapsedSongs` reaches memoized rows, and a fresh
   * Set for a song that was already open would re-render all 272 of them on a
   * gesture that changed nothing — see set/docs/performance.md.
   */
  it('keeps the same set when the song is already open', () => {
    const { result } = layout();
    const before = result.current.collapsedSongs;
    act(() => result.current.unfoldSong(FIRST.songKey));
    expect(result.current.collapsedSongs).toBe(before);
  });
});
