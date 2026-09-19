#!/usr/bin/env node
// Makes set[flow]'s `.icns` from `public/mark.svg` — the single-app copy of
// BSV's `tools/build-icons.ts`.
//
// The mark is SVG, and every tile is rasterised from it at that tile's own
// size rather than resampled down from one big render — a 16-pixel icon drawn
// as vector is a different picture from a 1024 one squeezed.
//
// `sips` and `iconutil` ship with macOS, which is the only platform that wants
// an `.icns` at all. Generated at pack time rather than committed: an icon
// derived from a file already in the repo is an artifact, not a source.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setRoot } from './bin.ts';

const root = setRoot;

/** Every size macOS asks an iconset for, at 1× and 2×. */
const SIZES = [16, 32, 128, 256, 512];

/**
 * How much of a tile the mark is drawn into.
 *
 * Apple's icon grid puts a rounded-square icon at 824 of 1024, and the mark is
 * drawn edge to edge in its own viewBox, so the ratio is the grid's outright.
 * Draw it full bleed instead and it overhangs every neighbour in the Dock by a
 * fifth, which doesn't read as a bigger icon so much as a wrong one.
 */
const INSET = 824 / 1024;

const inner = (tile: number): number => 2 * Math.round((tile * INSET) / 2);

const run = (cmd: string, args: string[]): void => {
  const done = spawnSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (done.status !== 0) throw new Error(`${cmd} failed`);
};

if (process.platform !== 'darwin') {
  console.log('icons: not macOS — nothing to make');
  process.exit(0);
}

const source = path.join(root, 'public', 'mark.svg');
if (!fs.existsSync(source)) {
  console.error(`icons: no mark at ${path.relative(root, source)}`);
  process.exit(1);
}

const out = path.join(root, 'electron', 'dist');
fs.mkdirSync(out, { recursive: true });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'openflow-icon-'));
const iconset = path.join(scratch, 'icon.iconset');
fs.mkdirSync(iconset);

try {
  for (const size of SIZES) {
    for (const [scale, suffix] of [[1, ''], [2, '@2x']] as const) {
      const tile = size * scale;
      const drawn = path.join(scratch, `mark-${tile}.png`);
      run('sips', [
        '-s', 'format', 'png',
        '-z', String(inner(tile)), String(inner(tile)),
        source,
        '--out', drawn,
      ]);
      // Pad rather than draw large: no `--padColor`, so the margin is
      // transparent and the tile is the mark sitting on Apple's grid.
      run('sips', [
        '--padToHeightWidth', String(tile), String(tile),
        drawn,
        '--out', path.join(iconset, `icon_${size}x${size}${suffix}.png`),
      ]);
    }
  }

  run('iconutil', ['-c', 'icns', iconset, '-o', path.join(out, 'icon.icns')]);
  console.log('built electron/dist/icon.icns — from public/mark.svg');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
