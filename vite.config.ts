import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS, uiPort } from '@openflow/desktop/apps.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

// One bridge, many set[flow] dev servers. Each worktree runs its own on its own port
// and proxies through to the same device, so several share one Live session — which
// is the multi-client case the bridge is meant to serve anyway.
const BRIDGE = process.env.OPENFLOW_BRIDGE || 'http://127.0.0.1:17800';
// No dev port is assumed (`@openflow/desktop/apps.ts`): `OPENFLOW_SET_UI_PORT`
// or `PORT` when a launcher picked one, otherwise `0` and the OS hands out a
// free one. `npm run dev` reads the port vite settled on off the socket and
// tells the window — nothing has to work it out.
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
    // Strict only when a port was named: whoever named it is going to dial it,
    // so drifting to the next one would leave them on the wrong server.
    strictPort: PORT !== 0,
    // Dev serves the app here but the bridge stays authoritative for data.
    //
    proxy: {
      '/ws': { target: BRIDGE.replace('http', 'ws'), ws: true },
    },
  },
});
