#!/usr/bin/env node
// set[flow], driven from one place. `node tools/app.ts <command>`.
//
// The single-app copy of BSV's `tools/app.ts`. That one drove every app in the
// monorepo from a shared registry; this repo has exactly one app, so the
// registry, `every` and `one` machinery are gone and each command just runs.
//
//   build     the renderer, with vite
//   electron  main, preload and the server, with esbuild
//   icons     the .icns, from public/mark.svg
//   run       build, electron, and open it
//   watch     the dev server and the window, together — the one to type
//   dev       electron, and open it against a dev server that is already up
//   pack      build, electron, icons, and electron-builder
//
// Anything that looks like a flag is handed to electron-builder, which is what
// keeps `npm run pack -- -c.mac.identity="Developer ID Application: …"` working.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repairBuilder } from '@openflow/desktop/builderPatch.ts';
import { bin, setRoot } from './bin.ts';

const root = setRoot;
const node = (script: string, args: string[]) =>
  run(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    path.join(root, 'tools', script),
    ...args,
  ]);

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const done = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (done.status !== 0) process.exit(done.status ?? 1);
}

const build = () => run(bin('vite'), ['build', '--config', 'vite.config.ts']);
const electron = () => node('electron.ts', []);
const icons = () => node('icons.ts', []);

/**
 * The signed pair, or the ad-hoc bundle QA wants.
 *
 * `OPENFLOW_QA` overrides the disk image and the identity, because
 * `install:apps` in BSV copies the `.app` locally and never opens an image —
 * measured at 4.7s against about three minutes for the signed, notarised pair.
 * The electron version is read off the installed package rather than pinned
 * here, so an upgrade is one `npm install`.
 */
function pack(): void {
  // v26's published package still lacks upstream #10101. Apply the exact
  // three-line backport before any signing; reject unfamiliar package code.
  const signing = createRequire(import.meta.url).resolve(
    'app-builder-lib/out/codeSign/macCodeSign.js',
  );
  const original = fs.readFileSync(signing, 'utf8');
  const repaired = repairBuilder(original);
  if (repaired !== original) fs.writeFileSync(signing, repaired);
  build();
  electron();
  icons();
  const read = "JSON.stringify(require('electron/package.json').version)";
  const version = JSON.parse(
    spawnSync(process.execPath, ['-p', read], { cwd: root, encoding: 'utf8' }).stdout,
  ) as string;
  run(bin('electron-builder'), [
    '--config',
    'electron-builder.yml',
    `-c.electronVersion=${version}`,
    ...(process.env.OPENFLOW_QA ? ['-c.mac.target=dir', '-c.mac.identity=null'] : []),
    // Last, so anything said on the command line wins over what is said here —
    // signing with a named identity on a machine that has one, most of all.
    ...flags,
  ]);
}

/** The window, on what is built. The app on what is built, and the slow one. */
function open(): void {
  build();
  electron();
  run(bin('electron'), ['.']);
}

/**
 * Working on it: the dev server and the window, in one command.
 *
 * `watch` is `dev` plus the vite server `dev` refuses to start, and it is the
 * thing to type.
 *
 * `-k` is what makes it one command rather than two in a trench coat: closing
 * the window takes vite with it, and a vite that cannot bind takes the
 * window's retry loop with it rather than leaving it asking forever.
 */
function watch(): void {
  const quoted = (what: string) => `"${what}"`;
  run(bin('concurrently'), [
    '-k',
    '-n',
    'set-ui,set-app',
    '-c',
    'gray,green',
    `${quoted(bin('vite'))} --config vite.config.ts`,
    [
      quoted(process.execPath),
      '--disable-warning=ExperimentalWarning',
      quoted(path.join(root, 'tools', 'app.ts')),
      'dev',
    ].join(' '),
  ]);
}

/**
 * The window, on a dev server somebody else is running.
 *
 * It does not start one: the dev server is `watch`'s to own, and an app that
 * started its own would race it for the port. What this does is rebuild the
 * main process — which vite knows nothing about — and open onto whatever is
 * there, retrying until it answers.
 */
function dev(): void {
  electron();
  run(bin('electron'), ['.'], { OPENFLOW_DEV: '1' });
}

const [command, ...rest] = process.argv.slice(2);
const flags = rest.filter((arg) => arg.startsWith('-'));

if (flags.length && command !== 'pack') {
  console.error(`app: ${command} takes no options — ${flags.join(' ')} is electron-builder's`);
  process.exit(1);
}

switch (command) {
  case 'build':
    build();
    break;
  case 'electron':
    electron();
    break;
  case 'icons':
    icons();
    break;
  case 'pack':
    pack();
    break;
  case 'run':
    open();
    break;
  case 'watch':
    watch();
    break;
  case 'dev':
    dev();
    break;
  default:
    console.error(
      `app: no such command — ${command ?? '(none named)'}.\n` +
        '     Try: build, electron, icons, pack, run, watch, dev',
    );
    process.exit(1);
}
