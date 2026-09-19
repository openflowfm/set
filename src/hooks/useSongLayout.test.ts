import { describe, expect, it } from 'vitest';
import { corpusSnapshot } from '../../test/corpus.ts';
import { firstRender } from '../../test/render.ts';
import { useSongLayout } from './useSongLayout.ts';

const recorded = corpusSnapshot();
const set = recorded.data;
const model = recorded.model;

const layout = (
  snapshot: OpenFlow.Snapshot | null = set,
  songs: OpenFlow.SetModel | null = model,
) => firstRender(() => useSongLayout(snapshot, songs));

/** Maps and Sets, ordered, so a golden diff reads as a change and not a reshuffle. */
const ordered = (value: unknown): unknown => {
  if (value instanceof Map) {
    return [...value.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => [k, ordered(v)]);
  }
  if (value instanceof Set) return [...value].sort((a, b) => Number(a) - Number(b));
  return value;
};

describe('the set as recorded', () => {
  it('shows every scene as a row while nothing is folded', () => {
    expect(layout().rows).toEqual(set.scenes.map((sc) => sc.i));
  });

  it('hides nothing while nothing is folded', () => {
    expect(layout().hiddenScenes.size).toBe(0);
  });

  it('starts with every song open', () => {
    expect(layout().collapsedSongs.size).toBe(0);
  });

  it('heads each of the set\'s song blocks with one header row', () => {
    // 36 songs, none of them a reprise, so one block each.
    expect(layout().headers.size).toBe(model.songs.length);
  });

  it('parses every scene into the fields the scene-level modals work in', () => {
    expect(layout().derivation.scenes).toHaveLength(set.sceneCount);
  });

  /**
   * The wide pin: every header and every folded-header shape, for a real set.
   * Granular assertions cover the counts; this covers the contents, which is
   * where a change to `songRows` or `blockTrackRoles` would otherwise land
   * unnoticed. Re-record and the diff is the report.
   */
  it('lays the songs out exactly as recorded', async () => {
    const { headers, songShapes } = layout();
    await expect(
      JSON.stringify({ headers: ordered(headers), songShapes: ordered(songShapes) }, null, 2),
    ).toMatchFileSnapshot('../../test/golden/songLayout.json');
  });
});

describe('before a snapshot has landed', () => {
  it('has no rows and no headers rather than throwing', () => {
    const { rows, headers, hiddenScenes } = layout(null, null);
    expect([rows.length, headers.size, hiddenScenes.size]).toEqual([0, 0, 0]);
  });

  it('reports the empty model with a rev of -1, so nothing mistakes it for a set', () => {
    expect(layout(null, null).songs.rev).toBe(-1);
  });
});

/**
 * A snapshot without a model is what a client sees between the two arriving,
 * and the grid draws the scenes as unmapped rows rather than waiting for songs.
 */
describe('a snapshot whose model has not arrived', () => {
  it('still shows every scene', () => {
    expect(layout(set, null).rows).toHaveLength(set.sceneCount);
  });

  it('shows no song headers over them', () => {
    expect(layout(set, null).headers.size).toBe(0);
  });
});
