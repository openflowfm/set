// Runs a hook the way the app does: in a renderer, with state that transitions.
//
// The counterpart to `render.ts`, and the more expensive one. This file's
// docblock is what pulls a DOM in, so **a spec using it must opt in per file**:
//
//   // @vitest-environment happy-dom
//
// The suite's default stays `environment: node`, because most of what a hook
// here does is derive and paying for a DOM to watch it derive is a cost with
// nothing on the other side. Reach for this when the behaviour under test is a
// gesture — folding a song, extending a selection, a drag — where the pin is
// what happens *between* two renders and `render.ts` can only see the first.

import { act, renderHook } from '@testing-library/react';

export { act, renderHook };
