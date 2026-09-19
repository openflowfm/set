import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS, uiPort } from '@openflow/desktop/apps.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

// One bridge, many set[flow] dev servers. Each worktree runs its own on its own port
// and proxies through to the same device, so several share one Live session — which
// is the multi-client case the bridge is meant to serve anyway.
//
// strictPort stays on deliberately: a dev server that silently drifts to the next
// free port is worse than one that fails, because nothing downstream can then say
// which URL it ended up on.
const BRIDGE = process.env.OPENFLOW_BRIDGE || 'http://127.0.0.1:17800';
// `OPENFLOW_PORT_BASE` is what every dev server in the repo counts from, and
// each app's offset from it is `@openflow/desktop/apps.ts` — set[flow] is just the one
// that sits on the base itself. The two benches are still counted here, at +100
// and +200, because neither is an app. One variable moves a whole worktree out
// of the way of the next.
const PORT = uiPort(APPS.set);

export default defineConfig({
  root: here,
  plugins: [react()],
  // Named, because the device bench runs beside this one and the default
  // resolves to the same `node_modules/.vite` for both. Two servers sharing
  // one dep cache re-optimize over each other's work on every start — the
  // config hash differs, so each one decides the cache is stale.
  cacheDir: path.resolve(here, 'node_modules/.vite/set'),
  // Nothing may come from a CDN — this eventually runs on stage.
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: PORT,
    strictPort: true,
    // Dev serves the app here but the bridge stays authoritative for data.
    //
    proxy: {
      '/ws': { target: BRIDGE.replace('http', 'ws'), ws: true },
    },
  },
});
