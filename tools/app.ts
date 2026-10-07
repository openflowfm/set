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
//   dev       the dev server and the window, together — the one to type
//   watch     the same as dev, by its older name
//   pack     build, electron, icons, and electron-builder
//
// Anything that looks like a flag is handed to electron-builder, which is what
// keeps `npm run pack -- -c.mac.identity="Developer ID Application: …"` working.

import { spawn, spawnSync } from 'node:child_process';
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
 * Vite runs in this process rather than beside it, because no dev port is
 * assumed: it takes `OPENFLOW_SET_UI_PORT` or `PORT` when a launcher picked
 * one and otherwise a free port from the OS (`vite.config.ts`), so the only
 * place that knows where it landed is its own socket. That port is read off it
 * and handed to the window as `OPENFLOW_DEV_URL` to open onto and
 * `OPENFLOW_SET_UI_PORT` to key its dev profile by (`@openflow/desktop`'s
 * `state.ts`). set[flow] has no reach, so there is no reach port to hand on.
 *
 * With `OPENFLOW_DEV_URL` already set, the dev server is somebody else's — a
 * second window onto one server — and this starts none.
 *
 * One command rather than two in a trench coat: closing the window takes vite
 * with it, and a vite that cannot bind exits before any window opens.
 */
async function dev(): Promise<void> {
  electron();
  const given = process.env.OPENFLOW_DEV_URL;
  let server: { close(): Promise<void> } | undefined;
  let url: string;
  if (given) {
    url = given;
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ configFile: path.join(root, 'vite.config.ts') });
    server = vite;
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === 'string') {
      await vite.close();
      throw new Error('app: vite is listening but its socket names no port');
    }
    url = `http://localhost:${address.port}`;
    vite.printUrls();
  }
  const port = new URL(url).port;
  const window = spawn(bin('electron'), ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENFLOW_DEV: '1',
      OPENFLOW_DEV_URL: url,
      ...(port ? { OPENFLOW_SET_UI_PORT: port } : {}),
    },
  });
  const stop = () => window.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  window.on('exit', (code) => {
    void (server?.close() ?? Promise.resolve()).finally(() => process.exit(code ?? 0));
  });
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
  case 'dev':
    await dev();
    break;
  default:
    console.error(
      `app: no such command — ${command ?? '(none named)'}.\n` +
        '     Try: build, electron, icons, pack, run, watch, dev',
    );
    process.exit(1);
}
