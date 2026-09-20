# set[flow]

Read [`README.md`](README.md) as the topic index, then only the docs matching the change.
Reading the docs end to end is the wrong default; most of them reason about a feature
you aren't touching.

## Rules

1. **This is the only app allowed to know both `@openflow/core` and `@openflow/widgets`,
   and it joins them in one place:** `src/lib/liveParam.ts`. Widgets take a `Param` and a
   number and know nothing about Live; core knows nothing about React. Nothing Live-specific
   about a control may leak past that adapter.
2. **The device holds the set; this app is shown it.** Connecting, disconnecting,
   refreshing or hot-reloading must never start, stop or re-arm anything on the bridge, and
   must never decide to walk Live — only the Snapshot button does. The reasoning is the
   bridge's [multiple clients](https://github.com/openflowfm/bridge/blob/main/docs/multiple-clients.md);
   the client side of it is [snapshot lifecycle](docs/snapshot-lifecycle.md).
3. **Every write goes through the protocol, one message per operation.** Clip color is
   `color_index`, never raw RGB. A new write path needs an undo entry — [undo](docs/undo.md).
4. **Anything that reaches a memoized row reads [performance notes](docs/performance.md)
   first.** A prop that changes identity per render re-renders 848 rows.
5. **Nothing loads from a CDN.** This runs on stage.
6. **Don't name things with words that already mean something in a DAW.** `transport`
   is play/stop/record. Same trap: scene, clip, cue, bus, send, return, warp, quantize,
   follow action, slot, take, punch, bounce, freeze. Where a DAW term *is* the right word
   for the actual Live concept, use it precisely and don't overload it.
7. **Whenever feature functionality is added or changed, update the relevant wiki page in
   the same change.** The [wiki](https://github.com/ryangavin/better-session-view/wiki) is
   the user manual, so documentation is part of the feature rather than follow-up work. It
   is a separate repository and needs its own commit and push.
8. **A change to how a feature works updates that feature's topic doc in the same
   commit.** A doc that drifts is worse than one that never existed, because it's believed.
   If a change makes a doc wrong, fix the doc — don't append a note saying it's wrong.
9. **Imports use the package specifier with the real TypeScript extension**
   (`@openflow/core/derive.ts`, `./param.ts`, never `./param.js`). The org packages are
   pinned by commit in `package.json`; to change one, commit and push it there, then
   `npm install 'github:openflowfm/<pkg>#<full-sha>'` here and commit manifest and lock
   together. **Never `npm link`** a sibling checkout: its React becomes a second copy in the
   renderer, and every `useContext` under it reads a null dispatcher.
10. **Every commit made by an agent must include a GitHub-compatible Codex co-author
    trailer**, after a blank line:

    ```text
    Co-authored-by: Codex <noreply@openai.com>
    ```

## Before you claim something works

```sh
npm run typecheck        # the renderer and the Electron main
npm test                 # the unit tests — the corpus under test/ is real sessions
npm run mutate -- <file> # would its spec notice the file changing? see .claude/skills/set-spec
npm run record -- <name> # a real session into test/corpus/ — needs Live and the device
npm run build            # dist/ and the Electron bundle
npm run dev              # the dev server and the window — needs a running bridge
```

The bridge is [openflowfm/bridge](https://github.com/openflowfm/bridge). If a change
depends on what Live sends, say plainly what was checked against a real set and what
wasn't; a passing suite against the corpus is not a run against Live.
