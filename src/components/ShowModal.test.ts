// @vitest-environment happy-dom
import { createElement } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { derive, songKey } from '@openflow/core/derive.ts';
import { SCENE_PATTERNS } from '@openflow/core/namePattern.ts';
import type { SceneKeepPlan } from '@openflow/core/sceneMove.ts';
import { corpusSnapshot } from '../../test/corpus.ts';

// The planner is another lane's, and a stub that throws at the commit this is
// pinned to. What this spec pins is the modal's half: what it asks the planner
// for, and what it does with the answer.
const planner = vi.hoisted(() => ({
  planSceneKeep: vi.fn(),
  describeKeep: vi.fn(),
}));
vi.mock('@openflow/core/sceneMove.ts', () => planner);

const { ShowModal, showOrder, suggestSongs, wirePlan } = await import('./ShowModal.tsx');

afterEach(cleanup);

const set = corpusSnapshot().data;
const derivation = derive(set.scenes, SCENE_PATTERNS);
const songs = derivation.songs;

const PLAN: SceneKeepPlan = {
  sceneCount: set.scenes.length,
  create: [0],
  steps: [{ from: 5, to: 0 }] as SceneKeepPlan['steps'],
  remove: [6, 4],
  keep: 2,
  moved: 1,
  dropped: 1,
  clips: 3,
};

beforeEach(() => {
  planner.planSceneKeep.mockReset().mockReturnValue(PLAN);
  planner.describeKeep.mockReset().mockReturnValue('2 scenes · 3 clips copied');
});

const modal = () => {
  const props = {
    derivation,
    snapshot: set,
    palette: [],
    busy: false,
    onApply: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(createElement(ShowModal, props));
  const input = view.getByLabelText('Add a song') as HTMLInputElement;
  const type = (text: string) => fireEvent.change(input, { target: { value: text } });
  const key = (k: string) => fireEvent.keyDown(input, { key: k });
  const rows = () =>
    [...view.container.querySelectorAll('.order-row .song')].map((el) => el.textContent);
  const commit = () =>
    view.container.querySelector('.modal-actions .control-button-primary') as HTMLButtonElement;
  return { props, view, input, type, key, rows, commit };
};

/** Pick a song by typing its whole name and pressing Enter. */
const pick = (m: ReturnType<typeof modal>, name: string) => {
  m.type(name);
  m.key('Enter');
};

describe('suggestSongs', () => {
  const catalog = ['Overture', 'Nightfall', 'Fall Out', 'Waterfall', 'fall'].map((name) => ({
    key: songKey(name),
    name,
  }));
  const names = (q: string, picked: string[] = []) =>
    suggestSongs(catalog, new Set(picked.map(songKey)), q).map((s) => s.name);

  it('suggests nothing for an empty query', () => {
    expect(names('')).toEqual([]);
    expect(names('   ')).toEqual([]);
  });

  it('puts the exact name, then prefixes, then substrings, each in set order', () => {
    expect(names('FALL')).toEqual(['fall', 'Fall Out', 'Nightfall', 'Waterfall']);
  });

  it('leaves out songs already picked', () => {
    expect(names('fall', ['fall', 'Nightfall'])).toEqual(['Fall Out', 'Waterfall']);
  });

  it('caps the list', () => {
    expect(suggestSongs(catalog, new Set(), 'a', 2)).toHaveLength(2);
  });
});

describe('showOrder', () => {
  // 0 unmapped · A 1-2 · 3 unmapped · B 4 · C 5-6 · 7 unmapped
  const scenes = [
    { s: 0, songKey: null },
    { s: 1, songKey: 'a' },
    { s: 2, songKey: 'a' },
    { s: 3, songKey: null },
    { s: 4, songKey: 'b' },
    { s: 5, songKey: 'c' },
    { s: 6, songKey: 'c' },
    { s: 7, songKey: null },
  ];

  it('keeps the head at the top and each picked song with what trails it, in picked order', () => {
    const out = showOrder(scenes, ['c', 'a']);
    expect(out.order).toEqual([0, 5, 6, 7, 1, 2, 3]);
    expect(out.head).toEqual([0]);
    expect(out.kept.map((p) => p.songKey)).toEqual(['c', 'a']);
  });

  it('drops an unpicked song together with the unmapped scenes trailing it', () => {
    expect(showOrder(scenes, ['b']).order).toEqual([0, 4]);
  });

  it('gathers a song found in two runs', () => {
    const reprise = [...scenes, { s: 8, songKey: 'a' }];
    expect(showOrder(reprise, ['a']).order).toEqual([0, 1, 2, 8, 3]);
  });
});

describe('wirePlan', () => {
  it('carries the planner fields and every scene name in index order', () => {
    const wire = wirePlan(PLAN, [
      { i: 1, name: 'b' },
      { i: 0, name: 'a' },
    ]);
    expect(wire).toEqual({
      sceneCount: PLAN.sceneCount,
      create: PLAN.create,
      steps: PLAN.steps,
      remove: PLAN.remove,
      sceneNames: ['a', 'b'],
    });
  });
});

describe('ShowModal', () => {
  it('starts blank, with the field focused and Commit disabled', () => {
    const m = modal();
    expect(m.rows()).toEqual([]);
    expect(document.activeElement).toBe(m.input);
    expect(m.commit().disabled).toBe(true);
    expect(planner.planSceneKeep).not.toHaveBeenCalled();
  });

  it('adds the first suggestion on Enter and clears the field', () => {
    const m = modal();
    pick(m, songs[2]!.name);
    expect(m.rows()).toEqual([songs[2]!.name]);
    expect(m.input.value).toBe('');
  });

  it('moves the highlight with the arrows', () => {
    const m = modal();
    m.type(songs[0]!.name.slice(0, 1));
    const offered = [...m.view.container.querySelectorAll('.show-option')].map((el) => el.textContent);
    expect(offered.length).toBeGreaterThan(1);
    m.key('ArrowDown');
    m.key('ArrowDown');
    m.key('ArrowUp');
    m.key('Enter');
    expect(m.rows()).toEqual([offered[1]]);
  });

  it('does not offer a song twice', () => {
    const m = modal();
    pick(m, songs[0]!.name);
    m.type(songs[0]!.name);
    const offered = [...m.view.container.querySelectorAll('.show-option')].map((el) => el.textContent);
    expect(offered).not.toContain(songs[0]!.name);
  });

  it('takes the last song back on Backspace in an empty field, and only then', () => {
    const m = modal();
    pick(m, songs[0]!.name);
    pick(m, songs[1]!.name);
    m.type('x');
    m.key('Backspace');
    expect(m.rows()).toHaveLength(2);
    m.type('');
    m.key('Backspace');
    expect(m.rows()).toEqual([songs[0]!.name]);
  });

  it('clears the field on Esc, and closes only from an empty one', () => {
    const m = modal();
    m.type('abc');
    m.key('Escape');
    expect(m.input.value).toBe('');
    expect(m.props.onClose).not.toHaveBeenCalled();
    m.key('Escape');
    expect(m.props.onClose).toHaveBeenCalledTimes(1);
  });

  it('reorders with the arrow buttons and removes with ×', () => {
    const m = modal();
    pick(m, songs[0]!.name);
    pick(m, songs[1]!.name);
    fireEvent.click(m.view.getAllByTitle('Move down')[0]!);
    expect(m.rows()).toEqual([songs[1]!.name, songs[0]!.name]);
    fireEvent.click(m.view.getByLabelText(`Remove ${songs[1]!.name}`));
    expect(m.rows()).toEqual([songs[0]!.name]);
  });

  it('plans against the snapshot with the picked order', () => {
    const m = modal();
    pick(m, songs[3]!.name);
    pick(m, songs[1]!.name);
    const scenes = derivation.scenes.map((sc) => ({
      s: sc.s,
      songKey: sc.song === null ? null : songKey(sc.song),
    }));
    const want = showOrder(scenes, [songKey(songs[3]!.name), songKey(songs[1]!.name)]).order;
    expect(planner.planSceneKeep).toHaveBeenLastCalledWith({
      sceneCount: set.scenes.length,
      order: want,
      clips: set.clips,
      tracks: set.tracks,
    });
    const deleted = songs.length - 2;
    expect(m.view.getByText(new RegExp(`3 clips copied · deletes ${deleted} songs, ${set.scenes.length - want.length} scenes`))).toBeTruthy();
  });

  it('takes two presses to commit, and any change to the list disarms it', () => {
    const m = modal();
    pick(m, songs[0]!.name);
    pick(m, songs[1]!.name);
    const deleted = songs.length - 2;

    fireEvent.click(m.commit());
    expect(m.commit().textContent).toBe(`Delete ${deleted} songs — press again`);
    expect(m.props.onApply).not.toHaveBeenCalled();

    fireEvent.click(m.view.getAllByTitle('Move down')[0]!);
    expect(m.commit().textContent).toBe('Commit');

    fireEvent.click(m.commit());
    fireEvent.click(m.commit());
    expect(m.props.onApply).toHaveBeenCalledTimes(1);
    const [wire, summary] = m.props.onApply.mock.calls[0]!;
    expect(wire).toEqual(wirePlan(PLAN, set.scenes));
    expect(wire.sceneNames).toHaveLength(set.scenes.length);
    expect(summary.songs).toBe(deleted);
  });

  it('says why and stays disabled when the planner throws', () => {
    planner.planSceneKeep.mockImplementation(() => {
      throw new Error('planSceneKeep: not implemented');
    });
    const m = modal();
    pick(m, songs[0]!.name);
    expect(m.view.getByText(/Could not plan this show — planSceneKeep: not implemented/)).toBeTruthy();
    expect(m.commit().disabled).toBe(true);
  });

  it('stays disabled when there is nothing to do', () => {
    planner.planSceneKeep.mockReturnValue(null);
    const m = modal();
    pick(m, songs[0]!.name);
    expect(m.commit().disabled).toBe(true);
  });
});
