import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The device bench. Faces are composed here rather than in `widgets/`, so they
// need a harness here too — the widget bench may not import this module, and a
// face drawn only inside the app can't be looked at without Live.
//
// Never built, like the widget bench: no `outDir`, nothing in `bench/` ships.
//
// No port is assumed: `PORT` when a launcher picked one, otherwise `0` and the
// OS hands out a free one, which vite prints. The bench never talks to the dev
// server, so it has no other port to know.
const PORT = Number(process.env.PORT) || 0;

export default defineConfig({
  root: path.resolve(here, 'bench'),
  plugins: [react()],
  // Named for the same reason the other two are: three Vite servers sharing one
  // dep cache each decide the others' is stale and re-optimize on every start.
  cacheDir: path.resolve(here, 'node_modules/.vite/devices'),
  server: {
    port: PORT,
    strictPort: PORT !== 0,
    // The bench reaches up into `src` for the faces, so the root is the repo.
    fs: { allow: [here] },
  },
});
