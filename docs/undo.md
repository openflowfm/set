# Undo

One level, no redo, why moving scenes sits outside it entirely.

## Undo is ours to provide

`⌘Z`, or the button. One level, and there is no redo. **Reordering scenes is outside it
entirely** — see below.

**LOM writes don't reach Live's own history**, so Live's ⌘Z will not bring a rename back —
this is the only way back that exists. `useBridge` captures the reverse batch from the
snapshot before every write (see [`core/src/ops.ts`](https://github.com/openflowfm/core/blob/main/docs/ops.md)), which costs
nothing because the snapshot already holds every clip's name and color.

One level rather than a stack, on purpose: the snapshot an entry was captured against
moves under it — patched after most writes, re-walked after the rest — so a stack would
have to stay valid across all of that, and a stale entry that quietly restores the wrong
thing is worse than having no stack. The entry is consumed whether or not the undo
succeeds, so a failed undo can't be replayed into a half-reverted state by pressing ⌘Z
twice.

`⌘Z` doesn't conflict with the ⌘-makes-a-sound rule below — it isn't a grid gesture, and
it's guarded by `isTypingInto` so the rename field keeps its own undo.

**Moving scenes has no undo here, and can't.** `inverseOps` works by reading "before" out
of the snapshot, which holds every clip's name and color — and nothing that could rebuild a
deleted scene's clips. So `moveScenes` *clears* the undo entry rather than replacing it:
every scene index means something different afterwards, and a ⌘Z that wrote clip names
against the wrong rows would be worse than no undo at all. The move asks Live to group
itself into one step in Live's *own* history instead, and the log says whether Live agreed,
because that mechanism is undocumented and unverified.
