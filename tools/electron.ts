#!/usr/bin/env node
// Bundles set[flow]'s Electron main and preload into CommonJS — the single-app
// copy of BSV's `tools/build-electron.ts`.
//
// It exists for the same reason that one did: a Node runtime that is not ours
// to pick. Electron ships its own Node, that Node does not strip types the way
// Node 26 on your PATH does, and `--experimental-strip-types` is not a flag to
// rely on inside somebody else's runtime. So the main process is built rather
// than run from source, and it is built to **CommonJS** because a
// `sandbox: true` preload must be — which is not a limitation to work around,
// since a sandboxed preload is the whole reason the renderer can be trusted
// with `contextIsolation`.

import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { setRoot } from './bin.ts';

const root = setRoot;
const here = path.join(root, 'electron');
if (!fs.existsSync(path.join(here, 'main.ts'))) {
  console.error(`electron: no ${path.relative(root, path.join(here, 'main.ts'))}`);
  process.exit(1);
}

await esbuild.build({
  entryPoints: [path.join(here, 'main.ts'), path.join(here, 'preload.ts')],
  outdir: path.join(here, 'dist'),
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // Electron's bundled Node, not the one on your PATH. Conservative because
  // the runtime is not ours to assume.
  target: 'node20',
  // Provided by the runtime itself and unbundlable — resolving it would inline
  // a stub that silently does nothing.
  external: ['electron'],
  legalComments: 'none',
  minify: false, // this is what you read when a window does not open
});

const size = (file: string) => fs.statSync(path.join(here, 'dist', file)).size;
const kB = (file: string) => `${(size(file) / 1024).toFixed(0)} kB`;
console.log(`built electron/dist — main ${kB('main.cjs')}, preload ${kB('preload.cjs')}`);
