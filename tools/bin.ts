// Shared by the set tools for finding an installed binary and the root
// they run relative to.
//
// BSV hoists `node_modules` today, so `electron`, `vite` and the rest resolve
// from the repo root one level up from `set/`. Standalone, once this
// directory is its own repo, they resolve from `set/node_modules` itself.
// `bin()` tries the local one first and falls back to the hoisted one, so the
// tools that call it need no change on the day this repo splits.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const setRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const bin = (name: string): string => {
  const local = path.join(setRoot, 'node_modules', '.bin', name);
  if (fs.existsSync(local)) return local;
  return path.join(setRoot, '..', 'node_modules', '.bin', name);
};
