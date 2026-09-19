import { describe, expect, it } from 'vitest';
import { armedTracks, has, marksByScene } from './rowMarks.ts';
import type { PlayState } from '../hooks/useBridge.ts';

const STOP_FIRED = -2;

function playing(
  tracks: Array<Partial<OpenFlow.TrackPlayState>>,
  isPlaying = true,
): PlayState {
  return {
    isPlaying,
    tracks: tracks.map((t) => ({
      playing: t.playing ?? -1,
      fired: t.fired ?? -1,
      armed: t.armed ?? false,
    })),
  };
}

describe('marksByScene', () => {
  it('reports only the scenes something is happening in', () => {
    const marks = marksByScene(playing([{ playing: 4 }, {}, { fired: 9 }]));
    expect([...marks.keys()].sort((a, b) => a - b)).toEqual([4, 9]);
    expect(has(marks.get(4), 'p0')).toBe(true);
    expect(has(marks.get(9), 'f2')).toBe(true);
  });

  it('keeps a pending track stop out of the rows', () => {
    // -2 is the track's own stop button, which no scene owns — it belongs to
    // the track header and the footer's stop row.
    expect(marksByScene(playing([{ playing: 3, fired: STOP_FIRED }])).get(3)).toBe(
      '|p0|',
    );
  });

  it('delimits tokens so one track index cannot match inside another', () => {
    const marks = marksByScene(playing([...Array(10).fill({}), { playing: 2 }]));
    expect(has(marks.get(2), 'p10')).toBe(true);
    expect(has(marks.get(2), 'p1')).toBe(false);
  });
});

describe('armedTracks', () => {
  it('is empty when nothing is armed, so every row stays memo-equal', () => {
    expect(armedTracks(playing([{}, { playing: 1 }]))).toBe('');
  });

  it('lists armed tracks in one delimited string', () => {
    expect(armedTracks(playing([{ armed: true }, {}, { armed: true }]))).toBe('|0|2|');
  });

  it('answers `has` per track without matching a longer index', () => {
    const armed = armedTracks(playing([...Array(13).fill({}), { armed: true }]));
    expect(has(armed, '13')).toBe(true);
    expect(has(armed, '1')).toBe(false);
    expect(has(armed, '3')).toBe(false);
  });

  it('rebuilds to the same string, which is what keeps Row from re-rendering', () => {
    const state = playing([{ armed: true }, { playing: 0 }]);
    const rolling = playing([{ armed: true }, { playing: 4 }]);
    expect(armedTracks(rolling)).toBe(armedTracks(state));
  });
});
