---
name: set-spec
description: Write a regression spec for one file  Use when adding tests to set/src — a hook, a component or a lib helper — or when asked to raise . Drives specs from the recorded corpus and gates them on mutation score rather than coverage.
---

# Writing a spec in set/

**These specs are a regression net, not a specification.** The behaviour  has been
validated in the app; you are recording it so a later change cannot alter it unnoticed. You
are not deciding whether it is correct, and `docs/` is not your oracle — it describes
intent, and intent is not what you are pinning.

That framing decides everything below. In particular it means the usual defence against
characterization tests is off: pinning what the code does is the *point*. What replaces it
is the mutation gate, because a spec that records behaviour without noticing it change is
worth nothing at all.

## The loop

### 1. Read the target and one neighbour

Read the file. Read one existing spec beside it for house style —
`src/hooks/useSnapshotLookups.test.ts` for derivation,
`src/hooks/useSongLayout.folding.test.ts` for gestures. Match their comment density:
a `describe` says what area, an `it` says what behaviour, and a comment explains only what
the assertion cannot.

### 2. Drive it with the corpus, never a fixture you invented

```ts
import { corpusSnapshot, corpusStream } from '../../test/corpus.ts';
```

`test/corpus/main-set/` is a real recording: 36 tracks, 272 scenes, 454 clips, 36
songs, group nesting, 95 empty scenes, real device chains and 200 meter frames. Counts off
it are the strongest assertions you have — a lookup that silently drops one track's clips
is exactly what a three-clip fixture cannot show.

Write `set.clipCount`, not `454`. A number you typed is a number a re-recording falsifies,
and a re-recording is expected.

### 3. Pick the cheapest renderer that can see the behaviour

| the hook | use | environment |
|---|---|---|
| derives — memos, lookups, layout | `test/render.ts`'s `firstRender` | `node`, free |
| has a gesture — a toggle, a drag, a selection | `test/hook.ts`'s `renderHook` + `act` | `happy-dom`, opt in per file |

The DOM is opted into **per file** with `// @vitest-environment happy-dom` at the top. A
hook that does both splits in two: `useSongLayout.test.ts` and
`useSongLayout.folding.test.ts`. The gate runs `X.test.ts` and every `X.<aspect>.test.ts`
beside it, so the split costs nothing.

Never bend `firstRender` into something that transitions state. It renders once; a
`useState` setter called on its result goes nowhere.

### 4. Assert behaviour, one claim at a time

- Every `it` names a behaviour and its consequence, not a function.
- **No `toMatchSnapshot`.** The one legitimate wide pin is a golden over real corpus input
  at a whole-derivation boundary — `toMatchFileSnapshot('../../test/golden/<name>.json')`,
  few and wide, never in the middle of the range. Sort Maps and Sets before serializing so
  a diff reads as a change and not a reshuffle.
- Prefer several small assertions over one large `toEqual`. A giant equality catches
  everything and screams at every legitimate change, and a net that cries wolf gets deleted.
- Identity is a behaviour here. `collapsedSongs` and the lookup Maps reach memoized rows, so
  `toBe` on a no-op path is pinning a real promise — see `docs/performance.md`.

### 5. Label what nobody has walked

Ryan validated the paths he uses. Error branches, reconnects, empty sets and LOM-gone nulls
are mostly not among them, and pinning those pins whatever happens to be there. Mark them:

```ts
// PINNED: unvalidated path — recorded, not endorsed.
```

A future fix to that branch then arrives as a red test that reads as permission, not as a
regression. Do not label the null-snapshot path this way: rendering before the first
snapshot lands is what every launch does.

### 6. Gate on mutation, not coverage

```sh
npx vitest run <spec> --coverage --coverage.include='<source>' --coverage.reporter=text
npm run mutate -- <source>
```

Coverage tells you which lines ran. It cannot tell a spec that checks something from one
that merely runs it, and for a regression net that is the only distinction that matters.
**Survivors are the finding.** Each one is a change the spec would not notice: either add
the claim it points at, or say plainly why that mutation is not a behaviour anyone would
miss. `useSnapshotLookups` reads 100% of lines and kills all 5 of its mutants;
`chainStore` also reads 100% and still has survivors — a comparison that never sees two
quantized parameters with different labels, a listener map never checked for cleanup.
Same coverage, different nets.

"Nothing to mutate" is not a pass. Say so.

## When a spec goes red

Two cases, and they are resolved differently:

- **The shape was wrong** — you assumed `scenesForOps` carried `i` and it carries `s`.
  That is a fact about the code, not a behaviour. Fix the spec, note the real shape in a
  comment, move on.
- **The behaviour is not what you expected** — stop. Do not adjust the expectation until it
  passes. Report it: this is either a bug worth a separate commit (failing test first, then
  the fix) or a misreading, and quietly rewriting the assertion loses the difference. A
  coverage batch never changes behaviour.

## When the corpus is re-recorded

Goldens will diff, and reading that diff is the job — it is the report, not a chore. Check
whether the *derived* facts moved or only the set did: 36 song headers byte-identical with
new track shapes means six tracks were added, and the layout logic is untouched. Take it
with `npx vitest run --project=set -u` only after you have read it and can say what changed.

## What you hand back

The spec, and a short findings note: mutation survivors you chose not to chase, unvalidated
paths you labelled, and anything the code does that looked wrong. **An empty findings list
on a file that has never been tested is a suspicious result**, not a clean one — it usually
means the code was transcribed rather than examined.
