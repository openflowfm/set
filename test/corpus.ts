// The set, as recorded off a real bridge — see tools/record-session.ts.
//
// Every other fixture in this repository is invented, and `set/bench/fixtures.ts`
// admits it: "the names are a guess". These specs are a regression net over
// behaviour already validated in the app, so what drives them has to be the set
// that was validated — 30 tracks, 272 scenes, 387 clips and 36 songs, with the
// group nesting, the empty scenes and the reprises all where Live put them.
//
// A recording is a moment, not a promise. Re-recording deliberately changes
// what these specs pin, and the goldens beside it are how you see by how much:
// `npm run dev:record -- main-set` then `npx vitest run --project=set -u`, and
// read the diff before taking it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, 'corpus');

/** One recorded broadcast, and when it arrived relative to the recording's start. */
export interface Recorded {
  at: number;
  event: OpenFlow.Event;
}

function read<T>(name: string, file: string): T {
  const path = resolve(dir, name, file);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    throw new Error(
      `no corpus at ${path} — record one with: npm run dev:record -- ${name}\n` +
        '(needs Live open with the Session Bridge device loaded)',
    );
  }
}

/** The whole `snapshot` event: what Live held, and the model derived from it. */
export function corpusSnapshot(name = 'main-set'): OpenFlow.EventOf<'snapshot'> {
  return read<{ event: OpenFlow.EventOf<'snapshot'> }>(name, 'snapshot.json').event;
}

/** Every broadcast that arrived while recording, in the order it arrived. */
export function corpusStream(name = 'main-set'): Recorded[] {
  return read<{ events: Recorded[] }>(name, 'stream.json').events;
}
